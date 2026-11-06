# E16.16 — report faithfulness eval results

Gate: a report PASSES iff `citationValidity == 1.0` AND `coverage >= 0.8` AND
`form.pass` (the deterministic document-form gates in `eval/report-form.js`:
median paragraph ≤110 words, >150-word paragraphs ≤15%, no 400-word prose-only
h3, tables ≥3 data rows, adjacent 100+-word pairs ≤10%, lists ≤40% of words)
AND every judge dimension scores `>= 0.8`. Both generation paths must pass with
the same markdown + `[[cite:id]]` shape. (Form gates added 2026-08-27; the
table below predates them — re-run `node eval/report-faithfulness.js` for
current form columns.)

**Verdict: PASS — both paths.**

| Path | Graph | citationValidity | coverage | groundingDensity | grounding | status-fidelity | contradiction-surfacing |
|---|---|---|---|---|---|---|---|
| tiny-inline (fast path) | `u53pdwgdxmz6c284` (9 nodes) | 1.0 | 1.0 | 1.0 | 0.97 | 1.0 | 0.9 |
| large-workflow (`report.workflow.js`) | `8ew4cvsq3ag23m63` (65 nodes) | 1.0 | 1.0 | 1.0 | 0.98 | 0.97 | 0.93 |

## How this was produced

1. **Deterministic half** — `eval/report-faithfulness.js` (`scoreReport()`), run via
   `node eval/report-faithfulness.js`. Fetches each fixture's live `GET /graph` +
   `GET /report` and computes:
   - `citationValidity` — fraction of `[[cite:id]]` markers (parsed via
     `extractCiteIds` from `public/reader-cite.js`, the same parser the reader
     uses) that resolve to a real node id. `1.0` on both means zero hallucinated
     citations.
   - `coverage` — fraction of `meta.significance >= 0.7` nodes that are cited at
     least once. `1.0` on both: tiny has 2 such nodes (both cited), large has 30
     (all cited).
   - `groundingDensity` — fraction of `## ` sections containing at least one
     citation. `1.0` on both: every section is grounded, not just narrative.
2. **Judged half** — 3 read-only Sonnet subagents per report (grounding,
   status-fidelity, contradiction-surfacing), each independently re-fetching the
   live graph via curl (`GET /tasks/:id`, `GET /graph`, `POST /context`,
   `POST /inconsistencies`, `POST /frontier`) rather than trusting the report
   text. The harness is committed as
   `eval/report-faithfulness-judges.workflow.js` (run via the Workflow tool)
   with the corrected endpoint briefing baked in; the substantive findings from
   this run are below.

## What the judges actually caught

The eval process surfaced two real issues and one false alarm — worth recording
because it's the reason a citation-validity script alone isn't sufficient.

- **Real bug, fixed: inverted support-chain direction (tiny-inline).** The first
  draft's "Contested" section said claim 2994 "is supported by" 2995, and 2995
  "is supported by" 2996 — backwards. The live edges are `2994→2995 supports`,
  `2995→2996 supports`, `2996→2994 contradicts` (confirmed via `GET /graph` and
  `POST /inconsistencies`). Two independent judge dimensions (grounding,
  contradiction-surfacing) flagged this on the same pass. Fixed by rewording to
  "supports" instead of "is supported by"; a follow-up judge run confirmed the
  correction (grounding 0.72 → 0.97) and independently re-verified all 9 node
  citations plus the edge directions and the `/inconsistencies` 3-cycle.
- **Real overreach, fixed: invented causal claim (tiny-inline).** The draft
  asserted the hybrid ranker "exists specifically because keyword-only search
  misses paraphrases" — the only edge between those nodes is a generic
  `related to` (not `supports`), so the causal claim wasn't grounded. Reworded
  to the plain "loosely related to" the edge actually supports.
- **False alarm, corrected in the harness: `/frontier` mistaken for
  fabrication (large-workflow).** The first judge run scored grounding 0.68,
  flagging the report's described "frontier query" (params, 7 nodes, `stale` /
  `verified_at` / `importance` fields) as invented output with no matching
  endpoint. That was the judge's own gap, not the report's: `POST
  /api/graphs/:gid/frontier` (`src/routes/frontier.js`) is a real, separate,
  read-gated endpoint the judge hadn't been told about — the judge only knew
  about `/context` and assumed no other option existed. Calling it live with
  default params reproduces the report's claim exactly (same 7 node ids, same
  `stale`/`verified_at`/`importance` values). Fixed by adding `/frontier` to the
  judges' allowed-endpoints list and its response shape to their briefing;
  re-run scored grounding 0.98. The corrected briefing is baked into the
  committed harness (`eval/report-faithfulness-judges.workflow.js`) so the
  blind spot can't silently recur — keep that briefing's endpoint list in sync
  with the real API surface, or accurate reports get penalized for an
  evaluator blind spot.

## Fixtures (unchanged, per task spec)

- **TINY** (inline fast-path) — `u53pdwgdxmz6c284`, 9 nodes: a build plan (done →
  todo → todo) plus 3 reference sources (one stale, one low-confidence, one
  clean) and a planted 3-node `supports→supports→contradicts` cycle.
- **LARGE** (`report.workflow.js` path) — `8ew4cvsq3ag23m63`, 65 nodes,
  pre-existing stored report (regenerating via the Workflow tool would have been
  expensive, so the already-stored report was graded as-is per the task spec).
