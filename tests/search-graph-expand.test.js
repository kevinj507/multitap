import { describe, it, expect } from 'vitest';
import { createGraphExpander } from '../src/search/postprocessors/graphExpand.js';
import { configFromEnv, validateConfig } from '../src/search/config.js';
import { assemblePipeline } from '../src/search/service.js';

// In-memory edge fixture (eval/test leg). A small graph:
//   1—2—3   (a chain)   4—5 (a separate pair)   6 (isolated)
// plus a `related` edge 1—6 so edge-type filtering has something to bite.
const edges = [
  { source: 1, target: 2, type: 'dependency' },
  { source: 2, target: 3, type: 'dependency' },
  { source: 4, target: 5, type: 'dependency' },
  { source: 1, target: 6, type: 'related' },
];

const seeds = [
  { taskId: 1, score: 0.9, source: 'lexical' },
  { taskId: 4, score: 0.5, source: 'dense' },
];

describe('graphExpand postprocessor', () => {
  it('appends edge-connected neighbours the retrieval missed, tagged source:graph', async () => {
    const ge = createGraphExpander({ hops: 1 });
    const out = await ge.postprocess('q', seeds, { edges });
    const ids = out.map((c) => c.taskId);
    // seeds stay first and in order; neighbours appended after.
    expect(ids.slice(0, 2)).toEqual([1, 4]);
    // 1's neighbours: 2 (dependency) and 6 (related); 4's neighbour: 5.
    expect(new Set(ids.slice(2))).toEqual(new Set([2, 6, 5]));
    for (const c of out.slice(2)) {
      expect(c.source).toBe('graph');
      expect(c.meta.expandHop).toBe(1);
    }
  });

  it('never re-adds a node already in the candidate list (dedup)', async () => {
    // 2 is already a seed → must not be appended again even though 1—2 is an edge.
    const withTwo = [...seeds, { taskId: 2, score: 0.4, source: 'lexical' }];
    const ge = createGraphExpander({ hops: 1 });
    const out = await ge.postprocess('q', withTwo, { edges });
    const ids = out.map((c) => c.taskId);
    expect(ids.filter((x) => x === 2)).toHaveLength(1);
  });

  it('reaches 2-hop neighbours when hops=2 and walks THROUGH present nodes', async () => {
    // From seed 1: hop1 → 2,6 ; hop2 → 3 (via 2). 3 should appear at hops=2 only.
    const oneHop = await createGraphExpander({ hops: 1 }).postprocess('q', [seeds[0]], { edges });
    expect(oneHop.map((c) => c.taskId)).not.toContain(3);
    const twoHop = await createGraphExpander({ hops: 2 }).postprocess('q', [seeds[0]], { edges });
    const three = twoHop.find((c) => c.taskId === 3);
    expect(three).toBeTruthy();
    expect(three.meta.expandHop).toBe(2);
  });

  it('respects maxAddedPerSeed and the total cap', async () => {
    const ge = createGraphExpander({ hops: 2, maxAddedPerSeed: 1 });
    const out = await ge.postprocess('q', [seeds[0]], { edges });
    // seed 1 + at most one appended neighbour
    expect(out.filter((c) => c.source === 'graph')).toHaveLength(1);

    const capped = createGraphExpander({ hops: 2, maxAdded: 1 });
    const out2 = await capped.postprocess('q', seeds, { edges });
    expect(out2.filter((c) => c.source === 'graph')).toHaveLength(1);
  });

  it('filters by edgeTypes — related-only skips the dependency chain', async () => {
    const ge = createGraphExpander({ hops: 1, edgeTypes: ['related'] });
    const out = await ge.postprocess('q', [seeds[0]], { edges });
    const added = out.filter((c) => c.source === 'graph').map((c) => c.taskId);
    // only the related edge 1—6 survives; the dependency edge 1—2 is excluded.
    expect(added).toEqual([6]);
  });

  it('is a graceful no-op when a seed has no edges', async () => {
    const ge = createGraphExpander({ hops: 1 });
    const out = await ge.postprocess('q', [{ taskId: 6, score: 0.9, source: 'lexical' }], { edges: [{ source: 7, target: 8, type: 'dependency' }] });
    expect(out.map((c) => c.taskId)).toEqual([6]);
  });

  it('returns the list unchanged with no edge source (no pool, no ctx.edges)', async () => {
    const ge = createGraphExpander({ hops: 1 });
    const out = await ge.postprocess('q', seeds, {});
    expect(out).toBe(seeds);
  });

  it('passes an empty candidate list straight through', async () => {
    const ge = createGraphExpander({ hops: 1 });
    expect(await ge.postprocess('q', [], { edges })).toEqual([]);
  });

  it('queries the edges table scoped to the graph on the pool leg', async () => {
    const calls = [];
    const pool = {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [{ source_id: 1, target_id: 2, type: 'dependency' }] };
      },
    };
    const ge = createGraphExpander({ pool, hops: 1 });
    const out = await ge.postprocess('q', [seeds[0]], { gid: 'g123' });
    expect(calls).toHaveLength(1);
    // ANY form: one id still scopes to one graph; cross-graph search passes
    // the accessible set through the same parameter.
    expect(calls[0].sql).toMatch(/WHERE graph_id = ANY\(\$1\)/);
    expect(calls[0].params).toEqual([['g123']]);
    expect(out.map((c) => c.taskId)).toEqual([1, 2]);
  });
});

describe('graphExpand config + assembly wiring', () => {
  it('configFromEnv enables graphExpand and reads its knobs', () => {
    const cfg = configFromEnv({ GRAPH_EXPAND: '1', GRAPH_EXPAND_HOPS: '2', GRAPH_EXPAND_MAX_PER_SEED: '3', GRAPH_EXPAND_EDGE_TYPES: 'related,dependency' });
    expect(cfg.postprocessors).toContain('graphExpand');
    expect(cfg.graphExpand.hops).toBe(2);
    expect(cfg.graphExpand.maxAddedPerSeed).toBe(3);
    expect(cfg.graphExpand.edgeTypes).toEqual(['related', 'dependency']);
  });

  it('orders graphExpand BEFORE rerank when both are enabled', () => {
    const cfg = configFromEnv({ GRAPH_EXPAND: '1', RERANK_BACKEND: 'http', RERANK_URL: 'http://x' });
    expect(cfg.postprocessors).toEqual(['graphExpand', 'rerank']);
  });

  it('leaves graphExpand off by default', () => {
    expect(configFromEnv({}).postprocessors).not.toContain('graphExpand');
  });

  it('rejects bad knobs and unknown edge types', () => {
    expect(validateConfig({ graphExpand: { hops: 0 } }).errors).toContain('graphExpand.hops must be a positive integer');
    expect(validateConfig({ graphExpand: { edgeTypes: ['nope'] } }).errors.join('|')).toMatch(/unknown type "nope"/);
  });

  it('assemblePipeline builds the stage and it expands via ctx.edges end-to-end', async () => {
    const pipeline = assemblePipeline(
      { ...configFromEnv({ GRAPH_EXPAND: '1' }), retrievers: ['lexical'], topK: 100 },
      {},
    );
    const corpus = [
      { id: 1, title: 'embeddings', body: 'vector embeddings for search' },
      { id: 2, title: 'pgvector', body: 'ann index' },
    ];
    const { candidates } = await pipeline.run('embeddings', { corpus, edges: [{ source: 1, target: 2, type: 'dependency' }] });
    const ids = candidates.map((c) => c.taskId);
    // lexical finds node 1; graphExpand pulls in its neighbour 2.
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(candidates.find((c) => c.taskId === 2).source).toBe('graph');
  });
});
