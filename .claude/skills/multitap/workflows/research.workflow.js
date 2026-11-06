// Example deep-research workflow for Multitap (E15 universal schema).
// PARAMETERIZED by a research question; the only required arg is `question`
// (plus the target `gid` + `base` so the read-KB stage can curl what's already
// known). Run it from a session that has the Workflow tool:
//
//   Workflow({ scriptPath: ".../research.workflow.js",
//              args: { question: "…", gid: "<graph id>", base: "https://context.multitap.sh" } })
//
// CONTRACT (see the skill's "Using Multitap with dynamic workflows"): this
// workflow COMPUTES and RETURNS verified findings + edges in the small fixed
// vocabulary. It does NOT write to the graph — the MAIN LOOP batch-writes the
// returned payload with OCC, then works the frontier and runs the inconsistency
// scan. Workflow scripts can't curl; agents inside them can (read-KB stage).
//
// Shape: read-KB (filtered) → [discover → fetch+verify (adversarial 3-vote) →
// dedup] looped until dry → completeness critic → return at status:review.

export const meta = {
  name: 'multitap-research',
  description: 'Deep research into a Multitap graph: discover → verify → return E15-schema findings for the main loop to write',
  phases: [
    { title: 'Read KB', detail: 'filtered read of what is already known' },
    { title: 'Discover', detail: 'fan-out sub-angle discovery' },
    { title: 'Verify', detail: 'adversarial 3-vote per candidate finding' },
    { title: 'Critic', detail: 'completeness critic proposes the next round' },
  ],
};

const { question, gid, base } = args;
const MAX_ROUNDS = 4;
const FINDERS = 4; // sub-angle discovery agents per round

// A finding in the small fixed vocabulary. external_id makes the later batch
// write idempotent; sources become reference nodes; supports/contradicts become
// signed edges. NO `type` on findings (they're claims = confidence + status).
const FINDING_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['external_id', 'title', 'body'],
        properties: {
          external_id: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          significance: { type: 'number' },
          sources: {
            type: 'array',
            items: { type: 'object', required: ['external_id', 'title'], properties: {
              external_id: { type: 'string' }, title: { type: 'string' }, url: { type: 'string' }, reliability: { type: 'number' } } },
          },
          contradicts: { type: 'array', items: { type: 'string' }, description: 'external_ids of findings this one contradicts' },
        },
      },
    },
  },
};
const VERDICT_SCHEMA = {
  type: 'object', required: ['refuted', 'confidence'],
  properties: { refuted: { type: 'boolean' }, confidence: { type: 'number', description: '0..1, one decimal' }, reason: { type: 'string' } },
};

// 1. Read what's already known (filtered: trust only confident prior findings),
//    so discovery doesn't re-derive them — the compounding world-model move.
phase('Read KB');
const known = await agent(
  `Read the Multitap graph "${gid}" at ${base} (token in $MULTITAP_AGENT_TOKEN). POST /api/graphs/${gid}/search with {"query":${JSON.stringify(question)},"filter":{"confidence":{"$gte":0.6}}} and skim the hits. Return a short list of the sub-topics ALREADY well-covered (high confidence), so a research run won't waste effort re-finding them.`,
  { label: 'read-kb', phase: 'Read KB' },
);

const seen = new Set();
const verified = []; // {external_id, title, body, confidence, significance, sources, contradicts}
let dryRounds = 0;

for (let round = 0; round < MAX_ROUNDS && dryRounds < 2; round++) {
  // 2. DISCOVER — fan-out sub-angle finders (each blind to the others).
  const found = (await parallel(
    Array.from({ length: FINDERS }, (_, i) => () =>
      agent(
        `Research angle ${i} of the question: "${question}". Already covered (skip): ${known}\nAlready found this run: ${[...seen].slice(0, 30).join('; ')}\nUse web search. Return NEW candidate findings only, each with a stable external_id like "finding:<slug>", a title (<=100 chars), a body, the sources behind it (external_id "source:<slug>", title, url, reliability 0..1), and the external_ids of any findings it CONTRADICTS.`,
        { label: `discover#${round}.${i}`, phase: 'Discover', schema: FINDING_SCHEMA },
      ).then((r) => r?.findings ?? []).catch(() => []),
    ),
  )).flat();

  const fresh = found.filter((f) => f && f.external_id && !seen.has(f.external_id));
  if (fresh.length === 0) { dryRounds++; continue; }
  dryRounds = 0;
  fresh.forEach((f) => seen.add(f.external_id));

  // 3. VERIFY — adversarial 3-vote per finding. Survival is the vote (killed
  //    when 2+ of 3 refute); confidence = the MEAN of the judges' 0..1
  //    sureness scores, rounded to one decimal.
  const judged = await parallel(fresh.map((f) => () =>
    parallel(Array.from({ length: 3 }, (_, v) => () =>
      agent(
        `Try to REFUTE this finding using sources you can verify (default to refuted=true if you cannot stand it up). Finding: "${f.title}" — ${f.body}\nSources: ${JSON.stringify(f.sources || [])}\nReturn {refuted, confidence (your 0..1 sureness it's TRUE), reason}.`,
        { label: `verify:${f.external_id}#${v}`, phase: 'Verify', schema: VERDICT_SCHEMA },
      ).catch(() => ({ refuted: true, confidence: 0 })),
    )).then((votes) => {
      const live = votes.filter(Boolean);
      const refutes = live.filter((x) => x.refuted).length;
      const conf = live.length ? live.reduce((s, x) => s + (x.confidence || 0), 0) / live.length : 0;
      return { f, survives: refutes < 2, confidence: Math.round(conf * 10) / 10 };
    }),
  ));
  for (const j of judged.filter(Boolean)) {
    if (!j.survives) continue;
    verified.push({ ...j.f, confidence: j.confidence, significance: j.f.significance ?? 0.5 });
  }
}

// 4. COMPLETENESS CRITIC — what's still missing becomes the next session's todos.
phase('Critic');
const gaps = await agent(
  `Question: "${question}". We verified these findings: ${verified.map((v) => v.title).join('; ') || '(none)'}. What's still MISSING — an unexamined sub-question, a claim with weak sourcing, a likely contradiction not yet modeled? Return a short list of open questions to seed as todo nodes next.`,
  { label: 'critic', phase: 'Critic' },
);

log(`research: ${verified.length} findings verified across ${seen.size} candidates`);

// The main loop turns `nodes`/`edges` into a POST /api/graphs/:gid/batch (status
// review), seeds `openQuestions` as todo nodes (NO confidence), then runs
// /frontier (stale load-bearing nodes) and /inconsistencies (surface tensions,
// never auto-resolve). Sources → reference nodes; supports/contradicts → edges.
return {
  question,
  openQuestions: gaps,
  nodes: verified.flatMap((v) => [
    { external_id: v.external_id, content: `---\ntitle: ${JSON.stringify(v.title)}\nstatus: review\nconfidence: ${v.confidence}\nsignificance: ${v.significance}\nverified_at: PUT_ISO_TIMESTAMP_HERE\n---\n${v.body}` },
    ...(v.sources || []).map((s) => ({ external_id: s.external_id, content: `---\ntitle: ${JSON.stringify(s.title)}\nstatus: review\ntype: reference\nconfidence: ${s.reliability ?? 0.6}\n---\n${s.url || ''}` })),
  ]),
  edges: verified.flatMap((v) => [
    ...(v.sources || []).map((s) => ({ source: s.external_id, target: v.external_id, purpose: 'supports' })),
    ...(v.contradicts || []).filter((id) => seen.has(id)).map((id) => ({ source: v.external_id, target: id, purpose: 'contradicts' })),
  ]),
};
