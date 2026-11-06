// E16.16 form gates (eval/report-form.js) — each gate exercised in both
// directions on synthetic markdown, plus the parser edge cases that would
// silently mis-score real reports (fences, cite markers, html structure).
import { parseBlocks, scoreForm } from '../eval/report-form.js';
import { scoreReport } from '../eval/report-faithfulness.js';

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
const TABLE4 = '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |\n| 7 | 8 |';
const STATS = '<div class="gt-stats"><div class="gt-stat"><div class="k">N</div><div class="v">12</div></div></div>';

// A well-formed doc: short paragraphs, structure between them.
const GOOD = [
  '## Lede section',
  words(40),
  STATS,
  words(60),
  `<div class="gt-scroll">\n${TABLE4}\n</div>`,
  '> a primary-source quote of some length here',
  words(30),
].join('\n\n');

describe('parseBlocks', () => {
  it('classifies the block zoo', () => {
    const types = parseBlocks(GOOD).map((b) => b.type);
    expect(types).toEqual([
      'heading', 'paragraph', 'html', 'paragraph', 'html', 'blockquote', 'paragraph',
    ]);
  });

  it('is fence-aware: blank lines and fake structure inside code do not count', () => {
    const doc = '```\n\n| a | b |\n|---|---|\n\n' + words(200) + '\n```';
    const blocks = parseBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('code');
  });

  it('strips cite markers before counting words', () => {
    const doc = words(100) + ' [[cite:1]][[cite:2, 3]]';
    expect(parseBlocks(doc)[0].words).toBe(100);
  });

  it('strips frontmatter and counts table data rows', () => {
    const doc = `---\ntitle: x\n---\n\n${TABLE4}`;
    const blocks = parseBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'table', dataRows: 4 });
  });
});

describe('scoreForm gates', () => {
  it('passes a well-formed document on all six', () => {
    const { gates, pass } = scoreForm({ markdown: GOOD });
    expect(gates).toEqual({
      medianParaWords: true,
      longParaShare: true,
      overlongProseH3: true,
      thinTables: true,
      consecutiveLongPairShare: true,
      listWordShare: true,
    });
    expect(pass).toBe(true);
  });

  it('median: 140-word paragraphs fail, 80-word pass', () => {
    const long = [words(140), STATS, words(140), STATS, words(140)].join('\n\n');
    expect(scoreForm({ markdown: long }).gates.medianParaWords).toBe(false);
    const short = [words(80), STATS, words(80)].join('\n\n');
    expect(scoreForm({ markdown: short }).gates.medianParaWords).toBe(true);
  });

  it('longParaShare: one 160w paragraph among four fails 15%', () => {
    const doc = [words(160), STATS, words(50), STATS, words(50), STATS, words(50)].join('\n\n');
    const { metrics, gates } = scoreForm({ markdown: doc });
    expect(metrics.longParaShare).toBe(0.25);
    expect(gates.longParaShare).toBe(false);
  });

  it('overlongProseH3: 450 prose-only words fail; adding a table cures it', () => {
    const failDoc = ['### Deep dive', words(110), words(110), words(110), words(120)].join('\n\n');
    expect(scoreForm({ markdown: failDoc }).gates.overlongProseH3).toBe(false);
    const cured = failDoc + '\n\n' + TABLE4;
    expect(scoreForm({ markdown: cured }).gates.overlongProseH3).toBe(true);
    // A gt-stats html block also counts as structure.
    const curedHtml = failDoc + '\n\n' + STATS;
    expect(scoreForm({ markdown: curedHtml }).gates.overlongProseH3).toBe(true);
  });

  it('h3 section ends at the next h2/h3 (structure after the boundary does not cure)', () => {
    const doc = ['### A', words(110), words(110), words(110), words(120), '## Next', TABLE4].join('\n\n');
    expect(scoreForm({ markdown: doc }).gates.overlongProseH3).toBe(false);
  });

  it('thinTables: 2 data rows fail, 3 pass', () => {
    const thin = '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
    expect(scoreForm({ markdown: thin }).gates.thinTables).toBe(false);
    const ok = thin + '\n| 5 | 6 |';
    expect(scoreForm({ markdown: ok }).gates.thinTables).toBe(true);
  });

  it('consecutiveLongPairShare: adjacent 120w pair fails; structure between cures', () => {
    const pair = [words(120), words(120), words(20), words(20), words(20), words(20), words(20), words(20), words(20), words(20)].join('\n\n');
    expect(scoreForm({ markdown: pair }).gates.consecutiveLongPairShare).toBe(false);
    const cured = [words(120), TABLE4, words(120)].join('\n\n');
    expect(scoreForm({ markdown: cured }).gates.consecutiveLongPairShare).toBe(true);
  });

  it('listWordShare: a document that is mostly bullets fails the ceiling', () => {
    const bullets = Array.from({ length: 40 }, (_, i) => `- bullet item number ${i} with several words here`).join('\n');
    const doc = [words(30), bullets].join('\n\n');
    const { gates, metrics } = scoreForm({ markdown: doc });
    expect(metrics.listWordShare).toBeGreaterThan(0.4);
    expect(gates.listWordShare).toBe(false);
    expect(scoreForm({ markdown: GOOD }).gates.listWordShare).toBe(true);
  });

  it('empty document passes vacuously (emptiness is faithfulness s problem)', () => {
    expect(scoreForm({ markdown: '' }).pass).toBe(true);
  });

  it('counts figures and stat rows in metrics', () => {
    const doc = `<figure class="gt-fig">\n<svg viewBox="0 0 1 1"></svg>\n</figure>\n\n${STATS}`;
    const { metrics } = scoreForm({ markdown: doc });
    expect(metrics.figureCount).toBe(1);
    expect(metrics.statsBlockCount).toBe(1);
  });
});

describe('scoreReport integration', () => {
  it('carries a form result without disturbing legacy metrics', () => {
    const nodes = [{ id: 1, meta: { significance: 0.9 } }];
    const out = scoreReport({ markdown: `## S\n\n${words(20)} [[cite:1]]`, nodes });
    expect(out.citationValidity).toBeDefined();
    expect(out.coverage).toBeDefined();
    expect(out.form.pass).toBe(true);
    expect(out.form.metrics.paragraphCount).toBe(1);
  });
});
