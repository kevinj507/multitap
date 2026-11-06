// E16.17 — the drafter self-talk (process narration) guard, both halves.
//
// Section drafters in report.workflow.js return their final message as the
// section markdown, so any process narration they emit ("All grounding
// fetched... Drafting the section now.") ships verbatim into the published
// report. Observed live on 2026-07-09: 8 leaked lines across two generated
// reports. The guard is (a) a hardened drafter prompt, (b) a deterministic
// scrub in stitch(), and (c) a detector in the eval scorer so the faithfulness
// gate catches whatever both miss.
//
// report.workflow.js is NOT importable (top-level return + injected globals —
// see report-workflow.test.js), so the workflow half is asserted statically
// as text, and the regex is kept in sync with the eval's exported twin.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scoreReport, NARRATION_LINE_RE } from '../eval/report-faithfulness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW = path.join(
  __dirname, '..', '.claude', 'skills', 'multitap', 'workflows', 'report.workflow.js',
);
const workflowSrc = fs.readFileSync(WORKFLOW, 'utf-8');

// The 8 narration lines that actually leaked (verbatim), 2026-07-09.
const OBSERVED_LEAKS = [
  'All edges are confirmed: the four capability nodes (3427–3430) each run `required for` → 3426, and the finding/open-question links are plain `related to` edges. I have full bodies for all seeds and their 1-hop neighborhood. Drafting the section now.',
  'All grounding fetched and the dependency edge verified (3452 → 3454, "required for"). Drafting the section now.',
  'All grounding is fetched and edge directions verified against the live edge list. Here is the section.',
  'All grounding fetched and verified against live node bodies. Drafting the section now.',
  'All grounding is fetched and edge directions verified. Here is the section.',
  'I have all the grounding I need — node bodies for the five seeds plus the open-question nodes, the reference report node, and the verified edge list. Drafting the section now.',
  'All grounding fetched (nodes 3464, 3474–3477 plus 1-hop neighbors; live edge list with purposes confirmed). Drafting the section now.',
  'All grounding is fetched. Drafting the section now.',
];

// Legitimate report prose the detector must NOT flag.
const LEGIT_LINES = [
  '## Executive summary',
  'The write-side engine is rated Strong and AI Decisioning Strongest[[cite:3484]].',
  'Here is the section. It covers the four ML jobs in ranking order.', // phrase mid-line, not line-final
  'Detection plus tracking delivers shots, location, and make/miss[[cite:3431]].',
  '', // blank line
];

describe('E16.17 narration-artifact detector (eval half, functional)', () => {
  it('matches every observed leaked line', () => {
    for (const line of OBSERVED_LEAKS) {
      expect(NARRATION_LINE_RE.test(line), `should match: ${line.slice(0, 60)}...`).toBe(true);
    }
  });

  it('does not match legitimate report prose or headings', () => {
    for (const line of LEGIT_LINES) {
      expect(NARRATION_LINE_RE.test(line), `should NOT match: ${line.slice(0, 60)}`).toBe(false);
    }
  });

  it('scoreReport surfaces leaked lines as narrationArtifacts without moving the other metrics', () => {
    const nodes = [{ id: 1, meta: { significance: 0.9 } }];
    const clean = '---\ntitle: "T"\n---\n\n## A\n\nGrounded claim[[cite:1]].\n';
    const leaky = `---\ntitle: "T"\n---\n\n## A\n\n${OBSERVED_LEAKS[3]}\n\nGrounded claim[[cite:1]].\n`;
    const cleanScore = scoreReport({ markdown: clean, nodes });
    const leakyScore = scoreReport({ markdown: leaky, nodes });
    expect(cleanScore.narrationArtifacts).toEqual([]);
    expect(leakyScore.narrationArtifacts).toEqual([OBSERVED_LEAKS[3]]);
    expect(leakyScore.citationValidity).toBe(cleanScore.citationValidity);
    expect(leakyScore.coverage).toBe(cleanScore.coverage);
    expect(leakyScore.groundingDensity).toBe(cleanScore.groundingDensity);
  });
});

describe('E16.17 stitch scrub (workflow half, static)', () => {
  it('report.workflow.js embeds the SAME regex literal as the eval twin', () => {
    expect(workflowSrc.includes(NARRATION_LINE_RE.source)).toBe(true);
  });

  it('stitch() cleans each section through cleanSection before concat', () => {
    expect(/function cleanSection\(/.test(workflowSrc)).toBe(true);
    expect(/\.map\(\(md\) => cleanSection\(md\)\)/.test(workflowSrc)).toBe(true);
  });

  it('the drafter prompt forbids narration and declares the message publishes verbatim', () => {
    expect(/published VERBATIM/.test(workflowSrc)).toBe(true);
    expect(/no process narration/.test(workflowSrc)).toBe(true);
  });

  it('the scrub also trims any preamble before the first "## " heading line', () => {
    expect(/text\.match\(\/\^## \/m\)/.test(workflowSrc)).toBe(true);
  });
});
