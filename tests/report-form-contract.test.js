// Document-form prompt contracts — static twin of tests/report-narration.test.js.
// The FORM rules live in three places that cannot import each other:
//   report.workflow.js (a Workflow-tool script — drafters never read SKILL.md),
//   SKILL.md § Document form (the inline path's copy),
//   eval/report-form.js (the deterministic gates).
// These tests pin each copy's presence and their agreement on anchor phrases,
// so a rule edited in one place fails the build until the twins follow.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const workflow = read('../.claude/skills/multitap/workflows/report.workflow.js');
const skill = read('../.claude/skills/multitap/SKILL.md');

describe('report.workflow.js carries the DOCUMENT FORM contract', () => {
  it('defines FORM and injects it into the drafter alongside READ + CITE', () => {
    expect(workflow).toContain('const FORM = `DOCUMENT FORM');
    expect(workflow).toContain('${READ}\\n${CITE}\\n${FORM}\\nDraft ONLY');
  });

  it('teaches the diagram fetch-and-paste-verbatim contract', () => {
    expect(workflow).toContain('/diagram?kind=fan|chain|cluster');
    expect(workflow).toContain('VERBATIM');
    expect(workflow).toContain('NEVER hand-draw SVG');
  });

  it('outline plans a shape per section and mandates the executive summary', () => {
    expect(workflow).toMatch(/shape:\s*\{\s*type:\s*'string'/); // SECTION_SCHEMA
    expect(workflow).toContain('also give a "shape"');
    expect(workflow).toContain('Section 1 MUST be "Executive summary"');
    expect(workflow).toContain('vitals stat row + findings table');
    // Drafter receives it.
    expect(workflow).toContain('SHAPE — build the section in this form');
  });

  it('runs a design critic in parallel with the completeness critic and merges fixes', () => {
    expect(workflow).toContain('DESIGN CRITIC');
    expect(workflow).toContain('function mergeFixes');
    expect(workflow).toContain('design-critic#');
    // Both fail open independently.
    expect(workflow.match(/\.catch\(\(\) => \(\{ coverage_ok: true, coverage: 1 \}\)\)/g).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('preserves a leading gt-eyebrow through the stitch scrub', () => {
    const clean = workflow.slice(workflow.indexOf('function cleanSection'), workflow.indexOf('function stitch'));
    expect(clean).toContain('gt-eyebrow');
    expect(clean).toContain('text.match(/^## /m)'); // the narration test's literal survives
  });
});

describe('the FORM rules agree across their three homes', () => {
  // Anchor phrases that must appear in BOTH the workflow FORM const and
  // SKILL.md's Document form subsection — the load-bearing numbers, so a
  // threshold change in one place drags the other along.
  const formConst = workflow.slice(
    workflow.indexOf('const FORM = `'),
    workflow.indexOf('`;', workflow.indexOf('const FORM = `'))
  );
  const docForm = skill.slice(skill.indexOf('### Document form'), skill.indexOf('### Emphasis'));

  it.each(['110 words', '400 words', '3 data rows', 'gt-scroll', 'gt-stats', 'VERBATIM', 'figcaption'])(
    'anchor %s present in both the workflow FORM block and SKILL.md',
    (anchor) => {
      expect(formConst.toLowerCase()).toContain(anchor.toLowerCase());
      expect(docForm.toLowerCase()).toContain(anchor.toLowerCase());
    }
  );

  it('SKILL.md names the deterministic scorer and the gate includes it', () => {
    expect(docForm).toContain('eval/report-form.js');
    expect(skill).toContain('`eval/report-faithfulness.js` + `eval/report-form.js`');
  });

  it('SKILL.md and README both document the /diagram endpoint', () => {
    expect(skill).toContain('/api/graphs/:gid/diagram?kind=');
    expect(read('../README.md')).toContain('`/api/graphs/:gid/diagram`');
  });
});
