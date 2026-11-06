import { describe, it, expect } from 'vitest';
import {
  splitMarkdown, parseNode, contentSha, estimateTokens,
} from '../src/search/chunking.js';

// Deterministic word-count tokenizer for the structural tests — keeps token
// budgets exact so overlap/sub-split assertions don't depend on the char/4
// heuristic. The default estimator is exercised separately.
const byWord = (t) => (t ? t.split(/\s+/).filter(Boolean).length : 0);

describe('parseNode', () => {
  it('extracts title + description and strips the frontmatter fence', () => {
    const node = `---\ntitle: Auth model\ndescription: how login works\nstatus: todo\n---\nBody text here.`;
    expect(parseNode(node)).toEqual({
      title: 'Auth model',
      description: 'how login works',
      body: 'Body text here.',
    });
  });

  it('treats a node with no frontmatter as all body', () => {
    const r = parseNode('just a plain note');
    expect(r).toEqual({ title: '', description: '', body: 'just a plain note' });
  });
});

describe('splitMarkdown — embedding input', () => {
  const node = `---\ntitle: Rate limiting\ndescription: token bucket\nstatus: todo\ncreated_at: 2026-01-01\n---\n## Overview\nWe use a token bucket.\n\n## Details\nRefill happens per second.`;

  it('prepends the title to EVERY chunk (contextual chunking)', () => {
    const { chunks } = splitMarkdown(node);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.embedText.startsWith('Rate limiting')).toBe(true);
  });

  it('folds the description into chunk 0 only', () => {
    const { chunks } = splitMarkdown(node);
    expect(chunks[0].embedText).toContain('token bucket');
    for (const c of chunks.slice(1)) expect(c.embedText).not.toContain('token bucket');
  });

  it('never embeds frontmatter syntax, status, or timestamps', () => {
    const { chunks } = splitMarkdown(node);
    for (const c of chunks) {
      expect(c.embedText).not.toContain('---');
      expect(c.embedText).not.toContain('status:');
      expect(c.embedText).not.toContain('created_at');
      expect(c.embedText).not.toContain('2026-01-01');
    }
  });

  it('sizes tokens against embedText (the string the model sees)', () => {
    const { chunks } = splitMarkdown(node, { estimateTokens: byWord });
    for (const c of chunks) expect(c.tokens).toBe(byWord(c.embedText));
  });
});

describe('splitMarkdown — header-aware boundaries', () => {
  it('splits on ## sections so each becomes its own chunk', () => {
    const node = `---\ntitle: T\n---\n## Alpha\napple\n\n## Beta\nbanana`;
    const { chunks } = splitMarkdown(node, { estimateTokens: byWord });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toContain('Alpha');
    expect(chunks[0].text).toContain('apple');
    expect(chunks[1].text).toContain('Beta');
    expect(chunks[1].text).toContain('banana');
    // chunk indices are sequential from 0 (the chunk_index column).
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
  });

  it('keeps a short node as a single chunk', () => {
    const node = `---\ntitle: Tiny\n---\nshort body`;
    const { chunks } = splitMarkdown(node);
    expect(chunks).toHaveLength(1);
  });

  it('emits one title-only chunk for a node with no body (still searchable)', () => {
    const { chunks } = splitMarkdown(`---\ntitle: Just a heading\n---\n`);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].embedText).toBe('Just a heading');
  });
});

describe('splitMarkdown — oversized section sub-split with overlap', () => {
  // One section, three 4-word paragraphs; target 6 / overlap 3 forces a
  // multi-chunk split where consecutive chunks share a paragraph.
  const node = `---\ntitle: T\n---\n## S\nalpha beta gamma delta\n\nepsilon zeta eta theta\n\niota kappa lambda mu`;

  it('sub-splits a section longer than the target', () => {
    const { chunks } = splitMarkdown(node, { targetTokens: 6, overlapTokens: 3, estimateTokens: byWord });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('overlaps content across consecutive chunks (no severed context)', () => {
    const { chunks } = splitMarkdown(node, { targetTokens: 6, overlapTokens: 3, estimateTokens: byWord });
    // The tail of one window reappears as the head of the next: "delta" ends
    // the first window and rides into the second via the overlap suffix.
    const withDelta = chunks.filter((c) => c.text.includes('delta')).length;
    expect(withDelta).toBeGreaterThanOrEqual(2);
  });

  it('bounds every passage at target + overlap (no runaway chunks)', () => {
    const { chunks } = splitMarkdown(node, { targetTokens: 6, overlapTokens: 3, estimateTokens: byWord });
    // A chunk is one ≤target window plus an ≤overlap suffix from the previous
    // one — so target+overlap is the hard ceiling (the 584-tok outlier fix).
    for (const c of chunks) expect(byWord(c.text)).toBeLessThanOrEqual(6 + 3);
  });
});

describe('contentSha — the re-chunk trigger', () => {
  it('is stable for identical content and changes when content changes', () => {
    const a = `---\ntitle: T\n---\nbody`;
    expect(contentSha(a)).toBe(splitMarkdown(a).nodeSha);
    expect(contentSha(a)).toBe(contentSha(a));
    expect(contentSha(a)).not.toBe(contentSha(a + ' edit'));
  });
});

describe('estimateTokens — default heuristic', () => {
  it('approximates ~4 chars per token and is zero for empty', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });
});
