import { describe, it, expect } from 'vitest';
import { rrf, merge, concat, getJoiner } from '../src/search/fusion.js';

const c = (taskId, score = 0, source = 'x', extra = {}) => ({ taskId, score, source, ...extra });

describe('rrf', () => {
  it('preserves a single list order exactly (the P2.0 gate)', () => {
    // score 1/(k+rank) is strictly decreasing in rank → order unchanged.
    const list = [c(10), c(20), c(30), c(40)];
    const out = rrf([list], { k: 60 });
    expect(out.map((x) => x.taskId)).toEqual([10, 20, 30, 40]);
  });

  it('fuses two lists rank-based (no score normalization)', () => {
    // doc 2 appears high in both → should win even with low raw scores.
    const a = [c(1), c(2), c(3)];
    const b = [c(2), c(4), c(1)];
    const out = rrf([a, b], { k: 60 });
    expect(out[0].taskId).toBe(2); // rank1+rank0 across the two lists
    expect(new Set(out.map((x) => x.taskId))).toEqual(new Set([1, 2, 3, 4]));
  });

  it('sums reciprocal ranks for shared docs', () => {
    const a = [c(1), c(2)];
    const b = [c(1), c(3)];
    const out = rrf([a, b], { k: 60 });
    const score1 = out.find((x) => x.taskId === 1).score;
    expect(score1).toBeCloseTo(1 / 61 + 1 / 61, 10);
  });

  it('honors per-list weights', () => {
    const a = [c(1), c(2)];
    const b = [c(2), c(1)];
    // weight list b heavily → its rank-1 (doc 2) should lead.
    const out = rrf([a, b], { k: 60, weights: [1, 10] });
    expect(out[0].taskId).toBe(2);
  });

  it('interops string and number ids and tags fusedBy', () => {
    const out = rrf([[c('7'), c(8)]], { k: 60 });
    expect(out.map((x) => String(x.taskId))).toEqual(['7', '8']);
    expect(out[0].meta.fusedBy).toBe('rrf');
  });

  it('keeps the snippet-bearing representative when merging duplicates', () => {
    const withSnip = c(1, 0, 'lexical', { snippet: { text: 'hi', ranges: [] } });
    const without = c(1, 0, 'dense');
    const out = rrf([[without], [withSnip]], { k: 60 });
    expect(out[0].snippet).toEqual({ text: 'hi', ranges: [] });
  });

  it('records every contributing retriever in meta.sources, even when one is hidden behind the snippet-bearing source', () => {
    const lexical = [c(1, 0, 'lexical', { snippet: { text: 'hi', ranges: [] } })];
    const dense = [c(1, 0, 'dense')];
    const out = rrf([lexical, dense], { k: 60 });
    expect(out[0].source).toBe('lexical');
    expect(out[0].meta.sources).toEqual(['dense', 'lexical']);
  });

  it('a candidate found by only one retriever has a single-element meta.sources', () => {
    const out = rrf([[c(1, 0, 'lexical')], [c(2, 0, 'dense')]], { k: 60 });
    expect(out.find((x) => x.taskId === 1).meta.sources).toEqual(['lexical']);
    expect(out.find((x) => x.taskId === 2).meta.sources).toEqual(['dense']);
  });
});

describe('merge', () => {
  it('sums raw scores across lists', () => {
    const a = [c(1, 0.5), c(2, 0.1)];
    const b = [c(1, 0.4)];
    const out = merge([a, b]);
    expect(out[0].taskId).toBe(1);
    expect(out[0].score).toBeCloseTo(0.9, 10);
  });

  it('also records meta.sources for shared docs', () => {
    const a = [c(1, 0.5, 'lexical')];
    const b = [c(1, 0.4, 'dense')];
    const out = merge([a, b]);
    expect(out[0].meta.sources).toEqual(['dense', 'lexical']);
  });
});

describe('concat', () => {
  it('first-list-wins de-dup, preserving order', () => {
    const a = [c(1), c(2)];
    const b = [c(2), c(3)];
    const out = concat([a, b]);
    expect(out.map((x) => x.taskId)).toEqual([1, 2, 3]);
  });
});

describe('getJoiner', () => {
  it('resolves known modes and falls back to rrf for unknown', () => {
    expect(getJoiner('rrf').name).toBe('rrf');
    expect(getJoiner('merge').name).toBe('merge');
    expect(getJoiner('concat').name).toBe('concat');
    expect(getJoiner('nonsense').name).toBe('rrf');
  });
});
