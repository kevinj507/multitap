// Pure-core tests for the context-pack neighborhood selection (E13 / #461).
// No DB, no model — exercises buildNeighborhood / buildAdjacency in-memory the
// same way the route runs them live.
import { describe, it, expect } from 'vitest';
import { buildNeighborhood, buildAdjacency } from '../src/search/contextPack.js';

// A small graph:  1 —rel— 2 —rel— 3 —rel— 4 ;  1 —rel— 5 ;  1 —dep— 6
const EDGES = [
  { source_id: 1, target_id: 2, type: 'related' },
  { source_id: 2, target_id: 3, type: 'related' },
  { source_id: 3, target_id: 4, type: 'related' },
  { source_id: 1, target_id: 5, type: 'related' },
  { source_id: 1, target_id: 6, type: 'dependency' },
];

describe('buildAdjacency', () => {
  it('builds an undirected map and honors the edgeTypes filter', () => {
    const all = buildAdjacency(EDGES, null);
    expect([...all.get(1)].sort()).toEqual([2, 5, 6]); // dep edge to 6 included
    expect([...all.get(2)].sort()).toEqual([1, 3]);

    const relOnly = buildAdjacency(EDGES, ['related']);
    expect([...relOnly.get(1)].sort()).toEqual([2, 5]); // dep edge to 6 dropped
    expect(relOnly.has(6)).toBe(false);
  });

  it('accepts the /graph map shape ({source,target}) too', () => {
    const adj = buildAdjacency([{ source: 7, target: 8, type: 'related' }], ['related']);
    expect([...adj.get(7)]).toEqual([8]);
    expect([...adj.get(8)]).toEqual([7]);
  });
});

describe('buildNeighborhood — BFS distance + hop cap', () => {
  it('computes min hops from the seed and respects the hop ceiling', () => {
    const r1 = buildNeighborhood({ seeds: [1], edges: EDGES, edgeTypes: ['related'], hops: 1, maxNodes: 100 });
    expect(r1.ids.sort((a, b) => a - b)).toEqual([1, 2, 5]); // 1-hop only
    expect(r1.dist.get(1)).toBe(0);
    expect(r1.dist.get(2)).toBe(1);

    const r2 = buildNeighborhood({ seeds: [1], edges: EDGES, edgeTypes: ['related'], hops: 2, maxNodes: 100 });
    expect(r2.ids.sort((a, b) => a - b)).toEqual([1, 2, 3, 5]); // 3 is now reachable at dist 2
    expect(r2.dist.get(3)).toBe(2);

    const r3 = buildNeighborhood({ seeds: [1], edges: EDGES, edgeTypes: ['related'], hops: 3, maxNodes: 100 });
    expect(r3.ids.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(r3.dist.get(4)).toBe(3);
  });

  it('multi-source BFS uses the min distance from ANY seed', () => {
    const r = buildNeighborhood({ seeds: [1, 4], edges: EDGES, edgeTypes: ['related'], hops: 1, maxNodes: 100 });
    // seeds 1 and 4; 1-hop neighbours 2,5 (from 1) and 3 (from 4)
    expect(r.ids.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(r.dist.get(3)).toBe(1); // reached from seed 4 at 1 hop, not seed 1 at 2
    expect(r.dist.get(4)).toBe(0);
  });

  it('the edgeTypes filter keeps the dependency neighbour out of a related-only walk', () => {
    const rel = buildNeighborhood({ seeds: [1], edges: EDGES, edgeTypes: ['related'], hops: 1, maxNodes: 100 });
    expect(rel.ids).not.toContain(6);
    const all = buildNeighborhood({ seeds: [1], edges: EDGES, edgeTypes: null, hops: 1, maxNodes: 100 });
    expect(all.ids).toContain(6);
  });
});

describe('buildNeighborhood — budget + truncation', () => {
  it('returns the whole reachable set under budget (truncated=false)', () => {
    const r = buildNeighborhood({ seeds: [1], edges: EDGES, edgeTypes: ['related'], hops: 3, maxNodes: 100 });
    expect(r.truncated).toBe(false);
    expect(r.ids).toHaveLength(5);
  });

  it('keeps seeds + fills to the budget when over budget (truncated=true)', () => {
    const r = buildNeighborhood({ seeds: [1], edges: EDGES, edgeTypes: ['related'], hops: 3, maxNodes: 2 });
    expect(r.truncated).toBe(true);
    expect(r.ids).toHaveLength(2);
    expect(r.ids[0]).toBe(1); // seed always present and first
  });

  it('a tiny budget that cannot fit all seeds still returns the seeds', () => {
    const r = buildNeighborhood({ seeds: [1, 4], edges: EDGES, edgeTypes: ['related'], hops: 1, maxNodes: 1 });
    expect(r.truncated).toBe(true);
    expect(r.ids).toEqual(expect.arrayContaining([1, 4])); // seeds never dropped
  });
});

describe('buildNeighborhood — relevance weighting (alpha)', () => {
  // Two equidistant non-seed candidates (2 and 5 are both 1 hop from seed 1).
  // Budget = 2 → seed + exactly one of them. Relevance should pick the
  // query-relevant one; pure BFS (alpha=1) falls back to a deterministic tiebreak.
  const opts = { seeds: [1], edges: EDGES, edgeTypes: ['related'], hops: 1, maxNodes: 2 };

  it('alpha<1 prefers the higher search-ranked neighbour', () => {
    // 5 ranked above 2 in the search pool → relevance pulls 5 in.
    const rel = new Map([[5, 0], [2, 40]]);
    const r = buildNeighborhood({ ...opts, relevanceRank: rel, alpha: 0.3 });
    expect(r.ids).toContain(5);
    expect(r.ids).not.toContain(2);
  });

  it('flipping the ranking flips the chosen neighbour', () => {
    const rel = new Map([[2, 0], [5, 40]]);
    const r = buildNeighborhood({ ...opts, relevanceRank: rel, alpha: 0.3 });
    expect(r.ids).toContain(2);
    expect(r.ids).not.toContain(5);
  });

  it('alpha=1 (pure BFS) ignores relevance — deterministic tiebreak by degree then id', () => {
    const rel = new Map([[5, 0], [2, 40]]); // would favour 5 if relevance counted
    const r = buildNeighborhood({ ...opts, relevanceRank: rel, alpha: 1 });
    // 2 and 5 tie on dist; 2 has degree 2 (1,3) vs 5's degree 1 → 2 wins.
    expect(r.ids).toContain(2);
    expect(r.ids).not.toContain(5);
  });
});

describe('buildNeighborhood — induced edges', () => {
  it('returns only edges among the returned nodes, of the traversed types, deduped', () => {
    const r = buildNeighborhood({ seeds: [1], edges: EDGES, edgeTypes: ['related'], hops: 2, maxNodes: 100 });
    // nodes {1,2,3,5}; related edges among them: 1-2, 2-3, 1-5 (3-4 excluded: 4 absent)
    const pairs = r.edges.map((e) => [e.source, e.target].sort((a, b) => a - b).join('-')).sort();
    expect(pairs).toEqual(['1-2', '1-5', '2-3']);
    expect(r.edges.every((e) => e.type === 'related')).toBe(true);
  });
});
