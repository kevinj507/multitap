// E16.16 form half — deterministic document-form grader. No agents, no
// network: pure markdown analysis. The prose twin of these gates lives in
// SKILL.md "### Document form" and the workflow's FORM block; agents follow
// the rules, this measures them. Rules without gates decay; gates without
// rules get gamed — they ship together.
//
// The failure this measures, from the real 317KB data-layer report (v1950):
// 264 paragraphs at median 153 words, 0 tables, 0 blockquotes, 0 diagrams —
// content-faithful (1,266 valid cites) and unreadable. The old gate scored
// only faithfulness, so agents optimized exactly that.
import { CITE_MARKER_SOURCE } from '../public/reader-cite.js';

const FRONTMATTER_RE = /^---[\s\S]*?---\n?/; // scoreReport's exact regex
const CITE_RE = new RegExp(CITE_MARKER_SOURCE, 'g');
const FENCE_RE = /^\s*(```|~~~)/;
const HEADING_RE = /^(#{1,6})\s+(.*)/;
const LIST_RE = /^\s{0,3}(?:[-*+]|\d{1,9}[.)])\s/;
const QUOTE_RE = /^\s{0,3}>/;
const HTML_RE = /^\s{0,3}</;
// GFM delimiter row: pipes/colons/dashes only, at least one dash.
const TABLE_DELIM_RE = /^\s*\|?[\s:|-]+\|?\s*$/;

// Blank-line-split blocks, fence-aware (a blank line INSIDE a code fence is
// not a boundary). Each block: { type, text, words, level?, dataRows? }.
// type ∈ code | heading | table | list | blockquote | html | paragraph.
export function parseBlocks(markdown) {
  const src = String(markdown || '').replace(FRONTMATTER_RE, '');
  const lines = src.split('\n');
  const raw = [];
  let cur = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      cur.push(line);
      inFence = !inFence;
      continue;
    }
    if (!inFence && line.trim() === '') {
      if (cur.length) raw.push(cur);
      cur = [];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) raw.push(cur);

  return raw.map((blockLines) => {
    const first = blockLines[0];
    const text = blockLines.join('\n');
    let type = 'paragraph';
    let level = null;
    let dataRows = null;
    const h = first.match(HEADING_RE);
    if (FENCE_RE.test(first)) {
      type = 'code';
    } else if (h) {
      type = 'heading';
      level = h[1].length;
    } else if (
      first.includes('|') &&
      blockLines.length > 1 &&
      TABLE_DELIM_RE.test(blockLines[1]) &&
      blockLines[1].includes('-')
    ) {
      type = 'table';
      dataRows = blockLines.slice(2).filter((l) => l.trim() !== '').length;
    } else if (LIST_RE.test(first)) {
      type = 'list';
    } else if (QUOTE_RE.test(first)) {
      type = 'blockquote';
    } else if (HTML_RE.test(first)) {
      // Covers <figure class="gt-fig">, <div class="gt-stats">, eyebrows —
      // all house structure. (Html blocks hold no blank lines by contract.)
      type = 'html';
    }
    // Cite markers render as tiny superscripts, not words — counting them
    // would penalize exactly the well-cited prose we want.
    const words = text.replace(CITE_RE, '').trim().split(/\s+/).filter(Boolean).length;
    return { type, text, words, level, dataRows };
  });
}

const NON_PROSE = new Set(['table', 'list', 'blockquote', 'code', 'html']);

const round3 = (x) => Number(x.toFixed(3));

// → { metrics, gates, pass }. Gates (SKILL.md § Document form):
//   1 medianParaWords ≤ 110       2 longParaShare (>150w) ≤ 0.15
//   3 overlongProseH3 = 0         4 thinTables (<3 data rows) = 0
//   5 consecutiveLongPairShare ≤ 0.10 (ADJACENT pairs — structure between
//     two long paragraphs cures the pair, which is the authoring behavior
//     the rule wants)             6 listWordShare ≤ 0.40 (word-share, not
//     block-share: block-share is gameable by splitting bullets; word-share
//     measures how much of the reading material is bulleted)
export function scoreForm({ markdown }) {
  const blocks = parseBlocks(markdown);
  const paras = blocks.filter((b) => b.type === 'paragraph');
  const counts = paras.map((b) => b.words).sort((a, b) => a - b);
  const P = paras.length;

  const median =
    P === 0 ? 0 : P % 2 ? counts[(P - 1) / 2] : (counts[P / 2 - 1] + counts[P / 2]) / 2;
  const longShare = P === 0 ? 0 : paras.filter((b) => b.words > 150).length / P;

  // Adjacent paragraph pairs, both >100 words, nothing between them.
  let longPairs = 0;
  for (let i = 1; i < blocks.length; i++) {
    if (
      blocks[i].type === 'paragraph' &&
      blocks[i - 1].type === 'paragraph' &&
      blocks[i].words > 100 &&
      blocks[i - 1].words > 100
    ) {
      longPairs++;
    }
  }
  const pairShare = P <= 1 ? 0 : longPairs / Math.max(P - 1, 1);

  // h3 sections: each ### heading to the next ###/## (or deeper stays inside).
  let overlongProseH3 = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type !== 'heading' || blocks[i].level !== 3) continue;
    let proseWords = 0;
    let hasStructure = false;
    for (let j = i + 1; j < blocks.length; j++) {
      const b = blocks[j];
      if (b.type === 'heading' && b.level <= 3) break;
      if (b.type === 'paragraph') proseWords += b.words;
      else if (NON_PROSE.has(b.type)) hasStructure = true;
    }
    if (proseWords > 400 && !hasStructure) overlongProseH3++;
  }

  const thinTables = blocks.filter((b) => b.type === 'table' && b.dataRows < 3).length;

  const listWords = blocks.filter((b) => b.type === 'list').reduce((s, b) => s + b.words, 0);
  const paraWords = paras.reduce((s, b) => s + b.words, 0);
  const listWordShare = listWords + paraWords === 0 ? 0 : listWords / (listWords + paraWords);

  const md = String(markdown || '');
  const metrics = {
    paragraphCount: P,
    medianParaWords: median,
    longParaShare: round3(longShare),
    consecutiveLongPairShare: round3(pairShare),
    overlongProseH3,
    thinTables,
    listWordShare: round3(listWordShare),
    tableCount: blocks.filter((b) => b.type === 'table').length,
    listCount: blocks.filter((b) => b.type === 'list').length,
    blockquoteCount: blocks.filter((b) => b.type === 'blockquote').length,
    htmlBlockCount: blocks.filter((b) => b.type === 'html').length,
    figureCount: (md.match(/<figure class="gt-fig">/g) || []).length,
    statsBlockCount: (md.match(/class="gt-stats"/g) || []).length,
  };

  const gates = {
    medianParaWords: median <= 110,
    longParaShare: longShare <= 0.15,
    overlongProseH3: overlongProseH3 === 0,
    thinTables: thinTables === 0,
    consecutiveLongPairShare: pairShare <= 0.1,
    listWordShare: listWordShare <= 0.4,
  };

  return { metrics, gates, pass: Object.values(gates).every(Boolean) };
}
