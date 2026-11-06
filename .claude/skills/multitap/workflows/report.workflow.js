// Example report-generation workflow for Multitap (E16, over the E15 universal
// schema). PARAMETERIZED by the target graph; the required args are `gid` +
// `base` (so the read stages can curl what the graph already holds), with
// optional `focus` (narrow the report to a sub-question / cluster) and
// `audience` (tune voice — "exec", "engineer", "newcomer"). Run it from a
// session that has the Workflow tool:
//
//   Workflow({ scriptPath: ".../report.workflow.js",
//              args: { gid: "<graph id>", base: "https://context.multitap.sh",
//                      focus: "…" /* optional */, audience: "…" /* optional */ } })
//
// CONTRACT (see the skill's "Using Multitap with dynamic workflows"): this
// workflow COMPUTES and RETURNS the finished report markdown + metadata. It is
// READ-OVER-GRAPH, WRITE-ONCE-BESIDE-IT. Contrast the research workflow, which
// is write-amplifying: it returns {nodes,edges} for the main loop to POST the
// /batch endpoint, writing INTO the graph. This one writes NOTHING into the
// graph — no report node, no tasks, no edges, no /batch. It RETURNS
// {title, description, markdown, source_graph_version, coverage}; the MAIN LOOP
// does the single side-effect: one idempotent PUT /api/graphs/:gid/report with
// Authorization: Bearer $MULTITAP_AGENT_TOKEN (a write-gated upsert; the PUT
// replaces the one report per graph). Workflow scripts can't curl; the agents
// inside them can — but ONLY the read endpoints (GET /graph, GET /tasks/:id,
// the read-gated POST /search|/context|/frontier|/inconsistencies). No agent
// here ever curls a write.
//
// INLINE FAST-PATH / DEGRADE: this fan-out only earns its token cost on a LARGE
// or multi-cluster graph. Always do the cheap GET /graph first for the node
// count N and theme count. For a TINY graph (N ≲ 35 AND ≲ 6 themes AND bodies
// ≲ ~40-50k tokens) SKIP this workflow: one search+traverse read → draft the
// whole report in a single inline pass → the main loop does the one PUT.
// Escalate to this workflow only when N ≳ 40, or bodies ≳ ~50k tokens, or ≳ 6
// themes/components — structure overrides raw count. Default to inline; agents
// cost tokens. If the Workflow tool is absent, degrade to the same single-agent
// sequential shape (map → draft → stitch → self-check → return) without the
// fan-out.
//
// Shape: index/read (one agent) → outline (one agent, shape-aware: each
// section carries a form recipe) → draft sections in parallel (blind drafters,
// each grounded strictly in fetched bodies, under the DOCUMENT FORM contract) →
// deterministic stitch (frontmatter + concat, no agent) → completeness critic
// + design critic in parallel with one merged bounded re-draft, then RETURN.

export const meta = {
  name: 'multitap-report',
  description: 'Generate a human-readable report OVER a Multitap graph: index → outline → draft sections in parallel → stitch → completeness critic; RETURNS markdown for the main loop to PUT (writes nothing into the graph)',
  phases: [
    { title: 'Index', detail: 'read-only scan of structure, status, themes, references, tensions' },
    { title: 'Outline', detail: 'status-aware section plan grounded in the index' },
    { title: 'Draft', detail: 'blind section drafters, each grounded in fetched bodies' },
    { title: 'Stitch', detail: 'deterministic concat + frontmatter (no agent)' },
    { title: 'Critic', detail: 'completeness critic with a bounded re-draft' },
  ],
};

const { gid, base, focus, audience } = args;
const MAX_ROUNDS = 2; // completeness critic → re-draft rounds

// A read-only preamble every agent shares — it names the graph + endpoints and
// forbids writes, so no drafter can wander into a mutation.
const READ = `Read the Multitap graph "${gid}" at ${base} (token in $MULTITAP_AGENT_TOKEN; read-only). Use ONLY read endpoints (GET /api/graphs/:gid for the graph row, GET /graph, GET /tasks/:id, the read-gated POST /search|/context|/frontier|/inconsistencies). Never write.`;

// Citation convention. Drafters cite NODES with a stable [[cite:<id>]] marker
// instead of spelling out ("Title," #id) or pasting URLs/paths; the reader turns
// those markers into small numbered footnotes (hover shows the node, click opens
// it). Clean markers are what make the footnote system work.
const CITE = `CITATIONS — IMPORTANT: when you reference a graph node in prose, cite it with a marker [[cite:<numeric node id>]] placed immediately after the claim it supports — e.g. "PF is a load-capacity problem, not a balance problem[[cite:3171]]." Do NOT spell the node's title or "#id" out inline as prose (write "loading beats balance[[cite:3171]]", NOT 'the node "PF is a load problem" (#3171)'). Never paste raw URLs or file paths, and never invent a citation. For an external source (paper, guideline), cite its type:reference node's id. Multiple sources back to back: [[cite:3171]][[cite:3200]]. These markers render as small numbered footnotes, so keep them clean.
EDGE FIDELITY — edges are DIRECTED (source → target). Before prose like "A supports B" or "A contradicts B", confirm the live edge really runs A→B with that purpose; "A is supported by B" requires the edge B→A. Never inverted. And never upgrade a plain "related to" edge into an evidence or causal claim ("X supports Y", "Y exists because of X") — "related to" licenses only loose-association language ("loosely related", "connected to"). The E16.16 faithfulness judges verify both against the live edge list, so an inversion or causal upgrade is a caught defect, not a style choice.`;

// Document-form contract — the anti-wall-of-prose rules. Prose twin of
// SKILL.md "### Document form"; eval/report-form.js scores these gates
// deterministically, so breaking them is a caught defect, not a style choice.
const FORM = `DOCUMENT FORM — a report is a DOCUMENT, not an essay; readers scan first, read second.
- Lede first: open every section with its finding in 1-2 sentences, then the evidence, then the analysis.
- Paragraphs: one idea each, median under 110 words; never two 100+-word paragraphs back to back — recast the second as a table, list, blockquote, stat row, or diagram.
- Any h3 subsection beyond ~400 words of prose must carry at least one non-prose block.
- Comparative content (3+ items with 2+ properties) is a GFM table wrapped in <div class="gt-scroll">…</div>, at least 3 data rows (fewer belongs in prose), cites in cells, class="num" on numeric cells, and a caption line under it stating the takeaway.
- 3-6 load-bearing numbers: a <div class="gt-stats"> row of <div class="gt-stat"><div class="k">label</div><div class="v">value</div><div class="s">context</div></div> tiles — never a stat row for one number, never numbers buried mid-sentence.
- A verbatim primary-source quote of 15+ words: a > blockquote immediately followed by its [[cite:id]].
- Sequential or causal content: a numbered list or a compact "A → B → C" line, never buried mid-sentence.
- DIAGRAMS: curl the read-gated GET ${base}/api/graphs/${gid}/diagram?kind=fan|chain|cluster&node=<id> (chain also takes &to=<id>) — it returns {markdown}: a finished <figure class="gt-fig"> with themed inline SVG derived from the live edge list. Paste that markdown VERBATIM as its own block (blank lines before and after it, none inside; keep the SVG untouched). You MAY rewrite only the <figcaption> sentence to state the section's takeaway. kind=fan → evidence around a claim node; kind=chain → a required-for path; kind=cluster → a decision's grounds. A 404 means no such diagram exists — skip it. NEVER hand-draw SVG.
- Carry structure through: if a cited node body holds a table, figure, image, or list, reproduce that structure — do not flatten it into prose.
- Bold at most one claim per paragraph; never all-caps in body prose.
- ANTI-DECORATION: every structural device must encode something true — no table restating one sentence, no numbered list over parallel (unordered) findings, no figure without a claim it illustrates; a chain of reasoning stays prose. When in doubt, prose.
- Keep h3 subsections to roughly 150-350 words of prose plus their structure; split or tighten past that.
- No blank line inside any HTML block (a blank line splits it during rendering).`;

// The structured index the map agent returns, so `source_graph_version` and the
// coverage checks below are real values, not free text.
const INDEX_SCHEMA = {
  type: 'object',
  required: ['N', 'version'],
  properties: {
    N: { type: 'number', description: 'node count' },
    version: { type: ['number', 'null'], description: 'graphs.version (integer, from GET /api/graphs/:gid — NOT /graph) — provenance of what the report was built from; the PUT rejects non-integers' },
    updated_at: { type: 'string' },
    status_histogram: { type: 'object', description: 'counts by todo/in_progress/review/done' },
    themes: { type: 'array', items: { type: 'string' }, description: 'themes/components over the related + required-for subgraph' },
    top_significance: { type: 'array', items: { type: 'string' } },
    references: { type: 'array', items: { type: 'string' }, description: 'type:reference sources' },
    open_questions: { type: 'array', items: { type: 'string' }, description: 'todo nodes with no confidence' },
    tensions: { type: 'array', items: { type: 'string' }, description: 'signed-cycle tensions from /inconsistencies' },
  },
};
// The section plan the outline agent returns; each section names its seed nodes
// (numeric task ids or search terms) so its drafter pulls exactly the bodies it
// needs and stays blind to the rest of the report.
const SECTION_SCHEMA = {
  type: 'object',
  required: ['title', 'description', 'sections'],
  properties: {
    title: { type: 'string', description: "the finished report's title, <=100 chars — a real headline a reader sees; do NOT append 'Outline' or 'Report Outline'" },
    description: { type: 'string', description: "one-line summary of the report for a reader, <=200 chars — do NOT mention the raw graph id or the word 'outline'" },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'heading', 'brief'],
        properties: {
          id: { type: 'string', description: 'stable slug, e.g. "section:decisions"' },
          heading: { type: 'string' },
          brief: { type: 'string', description: 'what this section must cover' },
          seeds: { type: 'array', items: { type: 'string' }, description: 'numeric task ids (usable as /context {"seeds":[...]}) or search terms (usable ONLY as /context {"query":"..."} or /search — /context seeds rejects non-numeric values)' },
          shape: { type: 'string', description: 'freeform one-line FORM recipe for the drafter, naming its structural devices and any diagram seeds — e.g. "vendor table + evidence fan around 3171 + 2 short paragraphs", "dependency chain 3140→3159 + risk table", "vitals stat row + findings table + ≤2 paragraphs synthesis"' },
        },
      },
    },
  },
};
const CRITIC_SCHEMA = {
  type: 'object',
  required: ['coverage_ok', 'coverage'],
  properties: {
    coverage_ok: { type: 'boolean' },
    coverage: { type: 'number', description: '0..1 fraction of load-bearing nodes/themes covered' },
    gaps: { type: 'array', items: { type: 'string' }, description: 'section ids that missed something' },
    fixes: {
      type: 'array',
      items: { type: 'object', required: ['id', 'note'], properties: { id: { type: 'string' }, note: { type: 'string' } } },
      description: 'per-section instructions for the re-draft',
    },
  },
};

// 1. INDEX — one agent maps the whole graph from the cheap read endpoints. No
//    bodies yet: GET /graph is structure-only, so this stays token-light. It
//    also captures graphs.version as the staleness key the return carries back.
phase('Index');
const index = await agent(
  `${READ}\nBuild an INDEX of the graph for a report${focus ? ` focused on: "${focus}"` : ''}. GET /api/graphs/${gid} for the graph row and read the integer graphs.version + updated_at from THAT (GET /graph does NOT carry them — it returns only {nodes, links}). Then GET /api/graphs/${gid}/graph for the node/edge map (structure only, no bodies). Then, read-only: POST /api/graphs/${gid}/frontier {} for load-bearing knowledge, POST /api/graphs/${gid}/inconsistencies {} for signed-cycle tensions, GET /api/graphs/${gid}/tasks/ready for open questions. Return: node count N, a status histogram (todo/in_progress/review/done), the themes/components over the related + "required for" subgraph, the top-significance nodes, the type:reference sources, the open todo questions, the surfaced tensions, and the integer graphs.version.`,
  { label: 'index', phase: 'Index', schema: INDEX_SCHEMA },
).catch(() => ({ N: 0, version: null }));

// 2. OUTLINE — one agent turns the index into a status-aware section plan:
//    exec summary; one section per theme/component; Decisions (high
//    significance); Done (status:done); In review (status:review); Open
//    questions (todo + /ready); Contested (from /inconsistencies); and a
//    Sources appendix (type:reference). Blind drafters fan out over these.
phase('Outline');
const plan = await agent(
  `${READ}\nFrom this INDEX, produce a status-aware OUTLINE for the report${audience ? ` for a "${audience}" audience` : ''}${focus ? `, focused on "${focus}"` : ''}.\nINDEX:\n${JSON.stringify(index)}\nDefault sections when the material is there: an exec summary; one per theme/component; Decisions from high-significance nodes; Done from status:done; In review from status:review; Open questions from todo + /ready; Contested from the /inconsistencies tensions; a Sources appendix from type:reference. Drop any section with no material. Give each section a stable id, a heading, a one-line brief, and the seed task ids / search terms its drafter should pull. For EVERY section also give a "shape": a one-line form recipe naming its structural devices (gt-stats row, GFM table, blockquote+cite, diagram kind + seed node id, short paragraphs) — no section may be prose-only. Section 1 MUST be "Executive summary" with shape "vitals stat row + findings table + at most 2 paragraphs of synthesis"; write the INDEX vitals (N, the status histogram counts, version) verbatim into its brief so its drafter needs no extra reads. NOTE: \`title\` and \`description\` are for the FINISHED report a human reads — give a real report headline (never ending in "Outline"/"Report Outline"), and a reader-facing one-line summary that does NOT mention the raw graph id or the word "outline".`,
  { label: 'outline', phase: 'Outline', schema: SECTION_SCHEMA },
);

const sections = plan?.sections ?? [];

// Draft one section. Each drafter is BLIND to the others (mirrors the research
// FINDERS) and grounds itself STRICTLY in fetched bodies + sources: it pulls its
// seeds' k-hop neighborhood WITH bodies via POST /context and/or reads specific
// nodes via GET /tasks/:id, cites inline, and invents nothing.
function draftSection(sec, note) {
  return agent(
    `${READ}\n${CITE}\n${FORM}\nDraft ONLY the "${sec.heading}" section of a report over graph "${gid}"${focus ? ` (report focus: "${focus}")` : ''}${audience ? ` for a "${audience}" audience` : ''}.\nBRIEF: ${sec.brief}\nSEEDS: ${JSON.stringify(sec.seeds ?? [])}${sec.shape ? `\nSHAPE — build the section in this form: ${sec.shape}` : ''}\nPull grounding with POST /api/graphs/${gid}/context — {"seeds":[<numeric task ids>],"hops":1} for id seeds, or {"query":"<search term>","hops":1} for text seeds (the seeds param accepts ONLY numeric ids) — and/or GET /api/graphs/${gid}/tasks/:id for specific nodes. Ground EVERY claim strictly in the fetched bodies + type:reference sources, citing with [[cite:<id>]] markers (see CITATIONS above) and inventing nothing; if the material isn't there, say so rather than filling it in.${note ? `\nCRITIC ASKED YOU TO FIX: ${note}` : ''}\nReturn ONLY the section's markdown, starting with "## ${sec.heading}". Your final message is published VERBATIM as the section a human reads — no status lines, no process narration ("All grounding fetched...", "Drafting the section now.", "Here is the section."), nothing before the heading.`,
    { label: `draft:${sec.id}${note ? ':redraft' : ''}`, phase: 'Draft' },
  ).catch(() => `## ${sec.heading}\n\n_Section draft unavailable._`);
}

// 3. DRAFT — fan out one blind drafter per section, all in parallel (a barrier).
phase('Draft');
let drafts = await parallel(
  sections.map((sec) => () => draftSection(sec).then((md) => ({ id: sec.id, heading: sec.heading, md }))),
);

// Drafters occasionally leak process narration into their returned markdown
// ("All grounding fetched... Drafting the section now.") — an agent's final
// message IS its return value, so anything it says ships. The prompt above
// forbids it, and stitch() scrubs whatever slips through anyway. The regex has
// a twin exported by eval/report-faithfulness.js (NARRATION_LINE_RE) — this
// script can't import repo modules, so keep the two literals in sync;
// tests/report-narration.test.js asserts they match.
const NARRATION_LINE_RE = /^[^\n#]*(?:Drafting the section now\.|Here is the section\.)\s*$/;
function cleanSection(md) {
  let text = String(md ?? '');
  // The drafter contract says output STARTS at "## <heading>" — anything
  // before the first heading line is preamble narration by definition, EXCEPT
  // a house-style eyebrow that legitimately sits right above the heading
  // (SKILL.md's "Structure is information" puts it exactly there).
  const m = text.match(/^## /m);
  if (m && m.index > 0) {
    const eyebrow = text.slice(0, m.index).match(/<p class="gt-eyebrow[^"]*">[\s\S]{0,200}?<\/p>\s*$/);
    text = (eyebrow ? `${eyebrow[0].trim()}\n\n` : '') + text.slice(m.index);
  }
  // Drop whole lines bearing known narration signatures anywhere in the body.
  text = text.split('\n').filter((l) => !NARRATION_LINE_RE.test(l)).join('\n');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// STITCH is DETERMINISTIC (no agent): scrub each section's narration, then
// concat the section markdown in outline order under generated frontmatter.
// Kept as a function so the critic loop can re-stitch after a bounded re-draft.
function stitch(parts) {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const bodyMd = sections
    .map((sec) => byId.get(sec.id)?.md)
    .filter(Boolean)
    .map((md) => cleanSection(md))
    .filter(Boolean)
    .join('\n\n');
  // Frontmatter mirrors research.workflow.js's PUT_ISO_TIMESTAMP_HERE sentinel:
  // the workflow does NOT know wall-clock time; the main loop stamps
  // generated_at at write time. source_graph_version records the integer graph
  // version the report was built from (provenance); staleness itself is
  // computed from the report's timestamps vs the graph's updated_at, not from
  // this field.
  const fm = [
    '---',
    `title: ${JSON.stringify(plan?.title || `Report: ${gid}`)}`,
    'generated_at: PUT_ISO_TIMESTAMP_HERE',
    `source_graph: ${gid}`,
    `source_graph_version: ${JSON.stringify(index?.version ?? null)}`,
    `node_count: ${index?.N ?? sections.length}`,
    ...(focus ? [`focus: ${JSON.stringify(focus)}`] : []),
    '---',
  ].join('\n');
  return `${fm}\n\n${bodyMd}\n`;
}

// 4. STITCH + 5. CRITIC loop. The critic is the only agent in the loop; when it
//    finds gaps and rounds remain, ONLY the affected sections are re-drafted,
//    then we re-stitch — a bounded (MAX_ROUNDS) completeness pass.
phase('Stitch');
let markdown = stitch(drafts);
let review = { coverage_ok: false, coverage: 0 };

// Two critics per round, in parallel: completeness (content gaps) and design
// (form violations). Their fixes merge into ONE bounded re-draft — dedupe by
// section id, completeness note first — so a section flagged by both gets a
// single combined instruction instead of two racing re-drafts.
function mergeFixes(covFixes, formFixes) {
  const byId = new Map();
  for (const f of covFixes) if (f?.id) byId.set(f.id, f.note);
  for (const f of formFixes) {
    if (!f?.id) continue;
    byId.set(f.id, byId.has(f.id) ? `${byId.get(f.id)}\nALSO (form): ${f.note}` : f.note);
  }
  return [...byId].map(([id, note]) => ({ id, note }));
}

phase('Critic');
for (let round = 0; round < MAX_ROUNDS; round++) {
  const completenessCall = () => agent(
    `${READ}\n${CITE}\nYou are the COMPLETENESS CRITIC for this report over graph "${gid}". Check it against the INDEX: is every high-significance node and theme covered? every status:done deliverable present? every /inconsistencies tension surfaced? any claim NOT grounded in a real node body or source? A claim followed by a [[cite:<id>]] marker IS grounded — that is the correct citation form, so do NOT ask a drafter to spell out the node title or #id inline; only flag a claim that has NO citation and isn't supported by a node body, or one whose cited node does not actually support it. Also flag prose that states a supports/contradicts relationship in the WRONG direction vs the live edge (edges are directed source → target), or that upgrades a "related to" edge into an evidence/causal claim (see EDGE FIDELITY above).\nINDEX:\n${JSON.stringify(index)}\nREPORT:\n${markdown}\nReturn {coverage_ok, coverage (0..1), gaps: [section ids], fixes: [{id, note}]}. Set coverage_ok true only when nothing load-bearing is missing and nothing is ungrounded.`,
    { label: `critic#${round}`, phase: 'Critic', schema: CRITIC_SCHEMA },
  ).catch(() => ({ coverage_ok: true, coverage: 1 }));
  const designCall = () => agent(
    `${READ}\n${FORM}\nYou are the DESIGN CRITIC for this report. Judge FORM ONLY — never coverage, never facts, and do NOT re-research the graph. Against DOCUMENT FORM above, flag: wall-of-prose sections (runs of long paragraphs; 400+ prose words with no table, list, quote, figure, or stat row), decorative or thin structure (a table under 3 data rows, a one-number stat row, a numbered list over parallel findings), sections that bury their lede, and a diagram named in a section's shape but absent from the section.\nSECTIONS (id, heading, shape):\n${JSON.stringify(sections.map((s) => ({ id: s.id, heading: s.heading, shape: s.shape })))}\nREPORT:\n${markdown}\nReturn {coverage_ok: true when the form is acceptable, coverage: a 0..1 form score, gaps: [section ids], fixes: [{id, note}]} — each note ONE concrete re-draft instruction naming the device to add, replace, or delete.`,
    { label: `design-critic#${round}`, phase: 'Critic', schema: CRITIC_SCHEMA },
  ).catch(() => ({ coverage_ok: true, coverage: 1 }));
  const [rev, design] = await parallel([completenessCall, designCall]);
  review = rev ?? { coverage_ok: true, coverage: 1 }; // returned coverage stays the COMPLETENESS number
  const fixes = mergeFixes(review?.fixes ?? [], design?.fixes ?? []);
  if ((review?.coverage_ok && (design?.coverage_ok ?? true)) || fixes.length === 0) break;
  // Re-draft ONLY the sections the critic flagged, then re-stitch.
  const fixMap = new Map(fixes.map((f) => [f.id, f.note]));
  const redone = await parallel(
    drafts
      .filter((d) => fixMap.has(d.id))
      .map((d) => () => {
        const sec = sections.find((s) => s.id === d.id);
        return draftSection(sec, fixMap.get(d.id)).then((md) => ({ id: d.id, heading: d.heading, md }));
      }),
  );
  const redoneById = new Map(redone.map((r) => [r.id, r]));
  drafts = drafts.map((d) => redoneById.get(d.id) ?? d);
  markdown = stitch(drafts);
}

log(`report: ${sections.length} sections, coverage ${review?.coverage ?? 'n/a'}`);

// The MAIN LOOP takes this return and does the ONE side-effect: a single
// idempotent PUT /api/graphs/:gid/report (Authorization: Bearer
// $MULTITAP_AGENT_TOKEN), stamping generated_at over the PUT_ISO_TIMESTAMP_HERE
// sentinel. It writes NOTHING into the graph — no report node, never the /batch
// endpoint, no tasks/edges — so the report has zero impact on the graph's
// version / updated_at. One report per graph; the PUT replaces any prior one.
return {
  title: plan?.title || `Report: ${gid}`,
  description: (plan?.description || `Report over Multitap graph ${gid}.`).slice(0, 200),
  markdown,
  // The PUT rejects a non-integer source_graph_version, so coerce defensively —
  // an index agent that returned a numeric string must not fail the main loop.
  // (Explicit null/'' guard: Number(null) and Number('') are 0, not NaN.)
  source_graph_version:
    index?.version != null && index.version !== '' && Number.isInteger(Number(index.version))
      ? Number(index.version)
      : null,
  coverage: review?.coverage ?? null,
};
