// Markdown chunker for the dense retriever's store (graph task #190, P2.2).
//
// One node → many passages. Decided from real corpus sizes, not defaults:
// the market-research graph averages ~2,470 tok/node (max ~9,108) and 57 of
// its 73 nodes blow past the small model's 512-tok window — so embedding whole
// nodes truncates the majority of real content. We split instead.
//
// This module is PURE: no DB, no embedding model, no IO. That is deliberate —
// it lets the eval/dry-run measure chunk shapes on real graphs with no model
// stood up yet (the "how many chunks, what sizes" question), and later lets the
// write path (re-chunk on sha change) call the exact same splitter that the
// dry-run validated. `estimateTokens` is injectable so a real BGE-M3 tokenizer
// drops in where the heuristic sits today without reshaping callers.

import { createHash } from 'node:crypto';

// Per #190: ~300-token target sections, ~50-token overlap when a section is
// sub-split. BGE-M3's 8192 window is the safe default; 512 is the small-model
// limit we report viability against.
export const DEFAULT_TARGET_TOKENS = 300;
export const DEFAULT_OVERLAP_TOKENS = 50;

const FENCE = '---';
const HEADING = /^#{1,6}\s+/;

/**
 * Rough token estimate. A real subword tokenizer (BGE-M3 = XLM-RoBERTa
 * SentencePiece) lands with P2.1; until then ~4 chars/token is the standard
 * sizing proxy — good enough to decide chunk counts, NOT a substitute for the
 * model's own count. The dry-run labels every number it prints as an estimate.
 * Injectable via opts.estimateTokens so the real tokenizer swaps in cleanly.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Minimal frontmatter split — mirrors eval/run-eval.js and public/app.js
 * parseFrontmatter (the project ships three small copies rather than a shared
 * module; kept consistent here on purpose). Pulls title/description out of the
 * YAML head and returns the body with the fence stripped. We never embed the
 * YAML syntax, `status`, or timestamps — those are columns, not meaning (#190).
 * @param {string} content
 * @returns {{title:string, description:string, body:string}}
 */
export function parseNode(content) {
  const text = content || '';
  let meta = {};
  let body = text;
  if (text.startsWith(FENCE + '\n')) {
    const end = text.indexOf('\n' + FENCE, FENCE.length);
    if (end !== -1) {
      for (const line of text.slice(FENCE.length + 1, end).split('\n')) {
        const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
        if (m) meta[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
      }
      body = text.slice(end + FENCE.length + 2);
    }
  }
  return {
    title: meta.title || '',
    description: meta.description || '',
    body: body.trim(),
  };
}

/** sha256 of the whole node content — the re-chunk trigger (#190 write path:
 *  skip embed entirely when this is unchanged). */
export function contentSha(content) {
  return createHash('sha256').update(content || '', 'utf8').digest('hex');
}

// Split a section into heading-led blocks. A new section starts at every
// heading line (## sections are the natural boundaries — 387 of them across the
// 73 market nodes), with any pre-heading preamble kept as the first section.
function splitSections(body) {
  const lines = body.split('\n');
  const sections = [];
  let cur = [];
  for (const line of lines) {
    if (HEADING.test(line) && cur.some((l) => l.trim() !== '')) {
      sections.push(cur.join('\n').trim());
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.some((l) => l.trim() !== '')) sections.push(cur.join('\n').trim());
  return sections.filter(Boolean);
}

// Explode a too-big section into atomic units no larger than `target`: try
// paragraphs first, fall back to sentences, then a hard word-window split for
// the rare single sentence that still overflows. Each returned unit is the
// finest granularity we'll pack with overlap.
function explodeToUnits(section, target, estimate) {
  const out = [];
  for (const para of section.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    if (estimate(para) <= target) { out.push(para); continue; }
    for (const sent of para.match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [para]) {
      const s = sent.trim();
      if (!s) continue;
      if (estimate(s) <= target) { out.push(s); continue; }
      // Hard word-window fallback for a single oversized sentence.
      const words = s.split(/\s+/);
      const per = Math.max(1, Math.floor(target / Math.max(1, estimate(s) / words.length)));
      for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(' '));
    }
  }
  return out;
}

// A trailing word-suffix of `text` totalling ~overlap tokens. Word-bounded (not
// unit-bounded) on purpose: an overlap that swallowed a whole paragraph would
// nearly double the chunk — the bug that produced a 584-tok outlier on real
// data. Capping the tail at `overlap` keeps every emitted chunk ≤ target+overlap.
function overlapSuffix(text, overlap, estimate) {
  if (overlap <= 0) return '';
  const words = text.split(/\s+/).filter(Boolean);
  const tail = [];
  let tok = 0;
  for (let i = words.length - 1; i >= 0 && tok < overlap; i--) {
    tail.unshift(words[i]);
    tok += estimate(words[i]);
  }
  return tail.join(' ');
}

// Pack atomic units into overlapping ~target windows. Two phases keep the size
// bound honest: first build NON-overlapping windows each ≤ target (every unit
// is already ≤ target from explodeToUnits, so a window never overflows), then
// prepend an overlap suffix from the previous window so context isn't severed
// at a boundary. Result: each chunk ≤ target + overlap.
function packWithOverlap(units, target, overlap, estimate) {
  const windows = [];
  let cur = [];
  let curTok = 0;
  for (const u of units) {
    const ut = estimate(u);
    if (cur.length > 0 && curTok + ut > target) {
      windows.push(cur.join('\n\n'));
      cur = [];
      curTok = 0;
    }
    cur.push(u);
    curTok += ut;
  }
  if (cur.length) windows.push(cur.join('\n\n'));

  return windows.map((w, i) => {
    if (i === 0) return w;
    const tail = overlapSuffix(windows[i - 1], overlap, estimate);
    return tail ? tail + '\n\n' + w : w;
  });
}

/**
 * Chunk already-parsed node parts — the shared core. Used by `splitMarkdown`
 * (which parses raw content first) AND by the dense retriever, which gets the
 * corpus as parsed `{title,description,body}` Docs and must chunk them WITHOUT
 * re-parsing frontmatter (one chunking implementation, two callers — same shape
 * the lexical leg already shares with the eval).
 *
 * Each chunk's `text` is the raw passage stored as `chunk_text`; `embedText` is
 * what actually hits the model — title prepended for topic context ("contextual
 * chunking"), with `description` folded into chunk 0 when present. `tokens` is
 * the estimate of `embedText`, because that's the string measured against the
 * 512 / 8192 windows.
 *
 * @param {{title?:string, description?:string, body?:string}} parts
 * @param {{targetTokens?:number, overlapTokens?:number,
 *          estimateTokens?:(t:string)=>number}} [opts]
 * @returns {Array<{index:number, text:string, embedText:string, tokens:number}>}
 */
export function chunkParts({ title = '', description = '', body = '' } = {}, opts = {}) {
  const target = opts.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const overlap = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const estimate = opts.estimateTokens ?? estimateTokens;

  // Body → sections → (sub-split oversized sections) → ordered passages.
  const passages = [];
  for (const section of splitSections((body || '').trim())) {
    if (estimate(section) <= target) {
      passages.push(section);
    } else {
      passages.push(...packWithOverlap(explodeToUnits(section, target, estimate), target, overlap, estimate));
    }
  }
  // A node with a title but no body still yields one chunk (title-only), so it
  // is reachable by semantic search rather than silently dropped.
  if (passages.length === 0) passages.push('');

  const titlePrefix = title ? title + '\n\n' : '';
  return passages.map((text, index) => {
    let embedText = titlePrefix + text;
    if (index === 0 && description) embedText = titlePrefix + description + '\n\n' + text;
    embedText = embedText.trim();
    return { index, text, embedText, tokens: estimate(embedText) };
  });
}

/**
 * Split one raw node (frontmatter + body) into title-prefixed, header-aware
 * chunks (#190). Thin wrapper: parse → chunk → stamp the content sha (the
 * re-chunk trigger for the write path).
 *
 * @param {string} content  full node content (frontmatter + body)
 * @param {{targetTokens?:number, overlapTokens?:number,
 *          estimateTokens?:(t:string)=>number}} [opts]
 * @returns {{nodeSha:string, title:string,
 *            chunks:Array<{index:number, text:string, embedText:string, tokens:number}>}}
 */
export function splitMarkdown(content, opts = {}) {
  const { title, description, body } = parseNode(content);
  return {
    nodeSha: contentSha(content),
    title,
    chunks: chunkParts({ title, description, body }, opts),
  };
}

export default { splitMarkdown, chunkParts, parseNode, contentSha, estimateTokens, DEFAULT_TARGET_TOKENS, DEFAULT_OVERLAP_TOKENS };
