// E16.16 (#3332) — the LLM-judged half of the report-faithfulness gate. The
// deterministic half is eval/report-faithfulness.js (citation validity,
// high-significance coverage, grounding density); this workflow covers what a
// script can't: does each cited node actually SUPPORT its claim, is
// status/confidence respected, are contradictions surfaced. Run it from a
// session with the Workflow tool:
//
//   Workflow({ scriptPath: "eval/report-faithfulness-judges.workflow.js",
//              args: { base: "https://context.multitap.sh" /* optional */,
//                      graphs: [{key, gid}, ...] /* optional, defaults to the
//                      two E16.16 fixtures */ } })
//
// Gate (combined with the deterministic half): a report PASSES iff
// citationValidity == 1.0 AND coverage >= 0.8 AND every judge here >= 0.8.
//
// Judges are READ-ONLY: they fetch the stored report and the live graph
// themselves (so the args stay small and the report under test is exactly
// what GET /report serves), verify via curl, and never write.
//
// LESSON BAKED IN (first run of this eval, 2026-07-04): the judges' endpoint
// briefing MUST name the full read surface, including POST /frontier. The
// first grounding judge didn't know /frontier existed, so it flagged an
// accurate frontier-query passage in a report as fabricated output (grounding
// 0.68, false fail); with the briefing below the same report scored 0.98.
// Keep this list in sync with the real API or accurate reports get penalized
// for an evaluator blind spot. See eval/report-faithfulness-results.md.

export const meta = {
  name: 'report-faithfulness-judges',
  description: 'Judge stored Multitap reports against their live graphs: grounding, status fidelity, contradiction surfacing',
  phases: [
    { title: 'Judge', detail: '3 read-only dimensions per report, verified via live curls' },
  ],
};

const base = args?.base || 'https://context.multitap.sh';
// The E16.16 fixtures (existing graphs — do not create new ones): TINY
// exercises the inline fast-path, LARGE the report.workflow.js path.
const graphs = args?.graphs || [
  { key: 'tiny-inline', gid: 'u53pdwgdxmz6c284' },
  { key: 'large-workflow', gid: '8ew4cvsq3ag23m63' },
];

const DIMENSIONS = [
  {
    key: 'grounding',
    question: 'GROUNDING: does each [[cite:id]] marker actually SUPPORT the claim it is attached to, when you read that node body? Is there any substantive factual claim with NO citation nearby, or whose cited node does not contain/support it? Verify EDGE DIRECTION too: edges are directed (source → target), so prose saying "A supports B" must match a live edge A→B with purpose "supports" — flag inversions, and flag any "related to" edge upgraded into an evidence/causal claim. Pick a spread of at least 8 distinct citations across different sections (or all if fewer) and fetch each cited node via GET /tasks/:id, plus the edge list via GET /graph, to confirm.',
  },
  {
    key: 'status-fidelity',
    question: 'STATUS FIDELITY: for every node the report cites or discusses that is NOT status:done (todo open questions, review findings awaiting confirmation), does the report present it as OPEN / PROVISIONAL rather than settled? Are findings weighted per their confidence value (a 0.3-0.5 claim not asserted with unwarranted certainty; a high-confidence one not over-hedged)? Fetch a sample of the todo/review nodes via GET /tasks/:id and check actual status/confidence against the framing.',
  },
  {
    key: 'contradiction-surfacing',
    question: 'CONTRADICTION SURFACING: run POST /inconsistencies {} on the live graph to find contradicts-signed cycles, and scan the edge list for explicit contradicts edges. For each tension, does the report SURFACE it (a Contested/tensions treatment naming the conflicting nodes, stating it is unresolved) rather than silently picking a side or resolving it on its own authority? A report stating one side of a real contradiction as simply true, with no acknowledgement, scores low.',
  },
];

const READ = (gid) => `You are a read-only faithfulness judge for a Multitap report (E16.16). Graph id "${gid}" lives at ${base}. $MULTITAP_AGENT_TOKEN is set in your shell — include -H "Authorization: Bearer $MULTITAP_AGENT_TOKEN" on every curl. First fetch the report under test yourself: GET ${base}/api/graphs/${gid}/report (the markdown is the "body" field). Then verify it using ONLY read endpoints: GET ${base}/api/graphs/${gid}/graph (nodes + edge list with source/target/purpose), GET ${base}/api/graphs/${gid}/tasks/:id (node bodies), POST ${base}/api/graphs/${gid}/context, POST ${base}/api/graphs/${gid}/inconsistencies, POST ${base}/api/graphs/${gid}/frontier. NOTE on /frontier: it is a REAL, separate read endpoint (not a mode of /context) — POST {} for defaults (minImportance:2, staleDays:90, lowConfidenceBelow:0.5, maxResults:50); it returns {frontier:[{id,title,status,type,importance,confidence,verified_at,stale,lowConfidence}], truncated, params}, where "importance" is DERIVED on the fly (out-degree over required-for/supports edges), distinct from the stored "significance" meta field — do not flag a report's use of frontier output as invented without calling /frontier first. NEVER write anything (no PATCH/PUT/DELETE, no mutating POST). Ground your verdict in what you actually fetch, not in the report text alone.`;

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['score', 'pass', 'issues'],
  properties: {
    score: { type: 'number', description: '0..1 for this one dimension' },
    pass: { type: 'boolean', description: 'true iff score >= 0.8' },
    issues: { type: 'array', items: { type: 'string' }, description: 'specific problems; empty if none' },
  },
};

phase('Judge');
const results = await parallel(
  graphs.flatMap((g) => DIMENSIONS.map((d) => () =>
    agent(
      `${READ(g.gid)}\n\n${d.question}\n\nReturn {score (0..1), pass (score>=0.8), issues: [...]} strictly for the ${d.key} dimension only.`,
      { label: `${g.key}:${d.key}`, phase: 'Judge', schema: VERDICT_SCHEMA },
    )
      .then((v) => ({ report: g.key, dimension: d.key, ...v }))
      .catch(() => ({ report: g.key, dimension: d.key, score: 0, pass: false, issues: [`judge failed for ${g.key}:${d.key}`] })))),
);

const failed = results.filter((r) => !r.pass);
log(`${results.length - failed.length}/${results.length} judge dimensions passed${failed.length ? ` — FAILED: ${failed.map((f) => `${f.report}:${f.dimension}`).join(', ')}` : ''}`);
return { results, allPass: failed.length === 0 };
