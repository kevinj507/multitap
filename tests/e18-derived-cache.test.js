// E18.1 STEP 5 — the derived-state memo is bounded by BYTES.
//
// WHY THIS FILE EXISTS. The cache used to hold 256 ENTRIES, whatever they
// weighed, on a comment claiming a folded state is "kilobytes per graph, not
// megabytes". Measured against the production clone the largest graph's state
// is 748 KB of JSON / ~1.28 MB of heap, so a full cache was ~330 MB of
// permanently-held heap on a box with under 3 GB — and reachable from a plain
// read, by walking `?asOfSeq=` down one big graph's log (RSS 57.8 -> 399.6 MB
// over 256 such reads). An entry count cannot bound that; only a byte budget
// can. These tests pin the budget, the per-graph fairness cap, and the LRU
// behaviour the budget must not break.
//
// The entries here are shaped like real ones (the `built` object store.js
// caches) and sized by the same JSON measure the cache uses, so the numbers
// asserted below are the numbers production would see.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  _derivedCacheLimits,
  _derivedCacheStats,
  _resetDerivedCacheForTests,
  dropDerivedForGraph,
  getDerived,
  setDerived,
} from '../src/derivedCache.js';

const { MAX_BYTES, MAX_BYTES_PER_GRAPH, MAX_ENTRIES_PER_GRAPH } = _derivedCacheLimits;

// A folded state whose JSON is roughly `kb` kilobytes — the weight lives in
// `meta.description`, exactly where it lives in production (bodies are never
// stored; see src/events/fold.js).
function entry(kb) {
  return {
    state: {
      v: 1,
      nodes: [
        {
          id: 1,
          meta: { title: 'big', description: 'x'.repeat(kb * 1024) },
          version: 1,
          external_id: null,
          content_sha: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      edges: [],
    },
    base: { kind: 'genesis', seq: 0, at: '2026-01-01T00:00:00.000Z' },
    events_replayed: 1,
    anomalies: [],
    history_starts_at: '2026-01-01T00:00:00.000Z',
    pre_history_approximation: false,
  };
}

beforeEach(() => {
  _resetDerivedCacheForTests();
});

describe('E18.1 derived cache — bounded by bytes', () => {
  it('evicts on a byte ceiling, not an entry count', () => {
    // 64 x ~1 MiB across 64 graphs: far below the 256-entry ceiling the cache
    // used to enforce, and four times over the byte budget it must enforce now.
    const size = 1024;
    for (let i = 0; i < 64; i++) setDerived(`g${i}`, 1, entry(size));

    const stats = _derivedCacheStats();
    expect(stats.bytes).toBeLessThanOrEqual(MAX_BYTES);
    // The entry count alone would have been happy to keep all 64.
    expect(stats.size).toBeLessThan(64);
    // ... and the budget is actually being used, not collapsed to one entry.
    expect(stats.size).toBeGreaterThan(1);
    // LRU: the newest survives, the oldest is gone.
    expect(getDerived('g63', 1)).toBeDefined();
    expect(getDerived('g0', 1)).toBeUndefined();
  });

  it('counts the real weight of what it stores', () => {
    setDerived('g', 1, entry(512));
    const bytes = _derivedCacheStats().bytes;
    // Within 1% of the JSON the entry actually serialises to — the measure the
    // budget is expressed in, not a guess from a node count.
    const truth = JSON.stringify(entry(512)).length;
    expect(Math.abs(bytes - truth) / truth).toBeLessThan(0.01);
    expect(bytes).toBeGreaterThan(512 * 1024);
  });

  it('refuses to cache a single entry larger than one graph may hold — AND SAYS SO', () => {
    const huge = entry(Math.ceil(MAX_BYTES_PER_GRAPH / 1024) + 64);
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // It still hands the value back — this is a memo, not a store.
      expect(setDerived('g', 1, huge)).toBe(huge);
      expect(getDerived('g', 1)).toBeUndefined();
      expect(_derivedCacheStats().bytes).toBe(0);

      // REGRESSION (E18 review, D4). Declining is CORRECT; being SILENT is the
      // defect. /frontier's verification-checks entry is ~72 bytes per check,
      // so it crosses this budget at ~58 000 checks and from then on every call
      // re-derives at full cost — indistinguishable from a cold process unless
      // the cache says something. It must be counted...
      expect(_derivedCacheStats().oversized).toBe(1);
      // ...and named once per graph, with the graph id an operator can act on.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('[derived-cache]');
      expect(warn.mock.calls[0][0]).toContain('g');
      expect(warn.mock.calls[0][0]).toContain('NOT cached');

      // Once per graph, not once per call — a hot read path must not spam.
      setDerived('g', 2, huge);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(_derivedCacheStats().oversized).toBe(2);
      setDerived('other', 1, huge);
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('the /frontier checks entry really does hit that ceiling — the measured shape', () => {
    // The entry /frontier caches is an array of checks, not event payloads:
    // {subjectId, at, outcome, deliberate}. Measure where it stops caching so
    // the number in setDerived()'s comment is a fact, not a guess.
    const checks = (n) => Array.from({ length: n }, (_, i) => ({
      subjectId: 100000 + i, at: 1767225600000 + i * 3600000, outcome: 'held', deliberate: true,
    }));
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      setDerived('g', 'verify:1', checks(32576));
      expect(getDerived('g', 'verify:1')).toBeDefined();
      _resetDerivedCacheForTests();
      setDerived('g', 'verify:2', checks(57000));
      expect(getDerived('g', 'verify:2')).toBeUndefined();
      expect(_derivedCacheStats().oversized).toBe(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('caps one graph so it cannot own the whole cache', () => {
    setDerived('small', 1, entry(1));
    // A timeline slider scrubbing one big graph: 40 distinct seqs, 40 states.
    for (let seq = 1; seq <= 40; seq++) setDerived('big', seq, entry(300));

    const mine = [];
    for (let seq = 1; seq <= 40; seq++) if (getDerived('big', seq) !== undefined) mine.push(seq);
    expect(mine.length).toBeLessThanOrEqual(MAX_ENTRIES_PER_GRAPH);
    expect(mine.length).toBeGreaterThan(0);
    // The other graph's entry was never the big graph's to evict.
    expect(getDerived('small', 1)).toBeDefined();
    expect(_derivedCacheStats().bytes).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('still memoises, still LRU, still resettable, still droppable per graph', () => {
    const a = entry(1);
    setDerived('g', 7, a);
    expect(getDerived('g', 7)).toBe(a); // same object, not a copy
    expect(getDerived('g', 8)).toBeUndefined();
    expect(_derivedCacheStats()).toMatchObject({ size: 1, hits: 1, misses: 1 });

    setDerived('h', 1, entry(1));
    dropDerivedForGraph('g');
    expect(getDerived('g', 7)).toBeUndefined();
    expect(getDerived('h', 1)).toBeDefined();
    expect(_derivedCacheStats().size).toBe(1);
    expect(_derivedCacheStats().bytes).toBeGreaterThan(0);

    _resetDerivedCacheForTests();
    expect(_derivedCacheStats()).toEqual({ size: 0, bytes: 0, hits: 0, misses: 0, oversized: 0 });
  });
});
