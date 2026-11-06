#!/usr/bin/env node
// E16.16 (#3332) — deterministic faithfulness grader for Multitap-generated
// reports (E16). Mirrors eval/verify-multihop.js's independent-recheck style:
// no agents here, just graph math over the live GET /graph + GET /report
// endpoints. extractCiteIds is imported from public/reader-cite.js so the
// [[cite:id]] format has exactly one source of truth across app.js, the
// reader, and this grader.
//
// scoreReport() is the deterministic half of the E16.16 gate: citation
// validity (no hallucinated node ids), high-significance coverage, and
// per-section grounding density. The other half — whether a citation's node
// actually SUPPORTS the claim it's attached to, and whether status/confidence
// and contradictions are respected — needs a reader, so that's judged by LLM
// subagents; see eval/report-faithfulness-results.md for the combined verdict.
//
// Run: node eval/report-faithfulness.js
//   (fetches both fixture graphs' /graph + /report and prints a table)
import { extractCiteIds, CITE_MARKER_SOURCE } from '../public/reader-cite.js';
import { scoreForm } from './report-form.js';
import { resolveAgentToken } from './resolve-token.js';

const BASE = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'https://context.multitap.sh';
// Resolve from env OR a repo-local secrets file (.env, .wafer/session.env, …),
// so `node eval/report-faithfulness.js` authenticates even in a fresh shell
// that never sourced the token. null when genuinely absent (anonymous reads).
const TOKEN = resolveAgentToken();
const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

async function get(url) {
  const r = await fetch(`${BASE}${url}`, { headers });
  if (!r.ok) throw new Error(`GET ${url} -> HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

// The two E16.16 fixtures (do not create new graphs for this eval — see the
// task spec). TINY exercises the inline fast-path, LARGE the
// report.workflow.js path. Override via env if the fixtures ever move.
export const TINY_GID = process.env.FAITHFULNESS_TINY_GID || 'u53pdwgdxmz6c284';
export const LARGE_GID = process.env.FAITHFULNESS_LARGE_GID || '8ew4cvsq3ag23m63';

// Drafter self-talk detector: whole lines of process narration ("All grounding
// fetched... Drafting the section now.") that a section drafter leaked into its
// returned markdown. Twin of the literal in report.workflow.js's stitch scrub —
// that script can't import repo modules, so the two literals are kept in sync
// by tests/report-narration.test.js. A non-zero count means the workflow's
// scrub (or an inline generation) let narration through to the published body.
export const NARRATION_LINE_RE = /^[^\n#]*(?:Drafting the section now\.|Here is the section\.)\s*$/;

/** Deterministic faithfulness scorer over one report + its graph's node set. */
export function scoreReport({ markdown, nodes }) {
  const validIds = new Set(nodes.map((n) => String(n.id)));
  const citedIds = extractCiteIds(markdown);
  const invalidIds = citedIds.filter((id) => !validIds.has(id));
  const citationValidity = citedIds.length ? (citedIds.length - invalidIds.length) / citedIds.length : 1;

  const citedSet = new Set(citedIds);
  const highSig = nodes.filter((n) => typeof n.meta?.significance === 'number' && n.meta.significance >= 0.7);
  const coveredHighSig = highSig.filter((n) => citedSet.has(String(n.id)));
  const coverage = highSig.length ? coveredHighSig.length / highSig.length : 1;

  // Strip frontmatter, split into level-2 (## ) sections, and check each for
  // at least one citation. A fresh RegExp per test (CITE_MARKER_SOURCE has no
  // flags here) sidesteps the /g lastIndex statefulness of the shared export.
  const body = String(markdown || '').replace(/^---[\s\S]*?---\n?/, '');
  const sections = body.split(/\n(?=## )/).filter((s) => /^##\s/.test(s.trim()));
  const hasCite = (s) => new RegExp(CITE_MARKER_SOURCE).test(s);
  const sectionsWithCite = sections.filter(hasCite);
  const groundingDensity = sections.length ? sectionsWithCite.length / sections.length : 0;

  const narrationArtifacts = body.split('\n').filter((l) => NARRATION_LINE_RE.test(l));

  return {
    citedIds,
    invalidIds,
    citationValidity: +citationValidity.toFixed(3),
    coverage: +coverage.toFixed(3),
    groundingDensity: +groundingDensity.toFixed(3),
    highSigCount: highSig.length,
    sectionCount: sections.length,
    narrationArtifacts,
    // Document-form half of the gate (eval/report-form.js): deterministic
    // wall-of-prose detection. A report PASSES iff citationValidity == 1.0
    // AND coverage >= 0.8 AND form.pass AND every LLM judge >= 0.8.
    form: scoreForm({ markdown }),
  };
}

async function scoreGraph(gid, label) {
  const graph = await get(`/api/graphs/${gid}/graph`);
  const report = await get(`/api/graphs/${gid}/report`);
  const scored = scoreReport({ markdown: report.body, nodes: graph.nodes });
  return { label, gid, nodeCount: graph.nodes.length, reportTitle: report.title, ...scored };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await Promise.all([
    scoreGraph(TINY_GID, 'tiny-inline'),
    scoreGraph(LARGE_GID, 'large-workflow'),
  ]);
  const w = (s, n) => String(s).padEnd(n);
  console.log(w('report', 16), w('nodes', 6), w('cited', 6), w('invalid', 8), w('citeValidity', 13), w('coverage', 9), w('groundDensity', 13), w('narration', 10), w('formPass', 9), w('medianW', 8), w('structure', 9));
  for (const r of rows) {
    const structure = r.form.metrics.tableCount + r.form.metrics.figureCount + r.form.metrics.statsBlockCount;
    console.log(
      w(r.label, 16), w(r.nodeCount, 6), w(r.citedIds.length, 6), w(r.invalidIds.length, 8),
      w(r.citationValidity, 13), w(r.coverage, 9), w(r.groundingDensity, 13), w(r.narrationArtifacts.length, 10),
      w(r.form.pass, 9), w(r.form.metrics.medianParaWords, 8), w(structure, 9),
    );
  }
  console.log(JSON.stringify(rows, null, 2));
}
