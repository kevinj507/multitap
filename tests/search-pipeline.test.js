import { describe, it, expect } from 'vitest';
import { SearchPipeline } from '../src/search/pipeline.js';
import { assemblePipeline } from '../src/search/service.js';
import { createLexicalRetriever } from '../src/search/retrievers/lexical.js';
import { defaultConfig } from '../src/search/config.js';
import { lexicalSearch, bm25Search } from '../public/search-lexical.js';

const CORPUS = [
  { id: 1, title: 'auth tokens', description: 'x', body: 'y', createdAt: '2026-01-01' },
  { id: 2, title: 'rate limiting', description: 'session token bucket', body: 'z', createdAt: '2026-01-02' },
  { id: 3, title: 'kanban', description: 'columns', body: 'a token appears here once', createdAt: '2026-01-03' },
];

// A retriever stub that returns a fixed list (or throws), for isolation tests.
const stub = (name, list, opts = {}) => ({
  name,
  retrieve() {
    if (opts.throw) throw new Error('boom');
    return list;
  },
});
const cand = (taskId) => ({ taskId, score: 0, source: 'stub' });

describe('LexicalRetriever wraps the shared ranker', () => {
  it('produces candidates in lexicalSearch order with snippet + meta', () => {
    const r = createLexicalRetriever();
    const out = r.retrieve('token', { corpus: CORPUS });
    const expected = lexicalSearch('token', CORPUS, { limit: 50 }).map((h) => h.id);
    expect(out.map((c) => c.taskId)).toEqual(expected);
    expect(out[0].source).toBe('lexical');
    expect(out[0]).toHaveProperty('snippet');
    expect(out[0].meta).toHaveProperty('field');
  });

  it('honors ctx.lexicalTopK', () => {
    const r = createLexicalRetriever();
    expect(r.retrieve('token', { corpus: CORPUS, lexicalTopK: 1 })).toHaveLength(1);
  });
});

describe('SearchPipeline — lexical-only ranks identically to its raw ranker (P2.0 gate)', () => {
  it('matches raw bm25Search order through the full pipeline (the default ranker)', async () => {
    const pipeline = assemblePipeline({ ...defaultConfig(), topK: 100 }, {});
    const { candidates } = await pipeline.run('token', { corpus: CORPUS, lexicalTopK: 100 });
    const expected = bm25Search('token', CORPUS, { limit: 100 }).map((h) => h.id);
    expect(candidates.map((c) => c.taskId)).toEqual(expected);
  });

  it('matches raw lexicalSearch order when ranker:tiered is configured', async () => {
    const cfg = { ...defaultConfig(), topK: 100, lexical: { ranker: 'tiered' } };
    const pipeline = assemblePipeline(cfg, {});
    const { candidates } = await pipeline.run('token', { corpus: CORPUS, lexicalTopK: 100 });
    const expected = lexicalSearch('token', CORPUS, { limit: 100 }).map((h) => h.id);
    expect(candidates.map((c) => c.taskId)).toEqual(expected);
  });

  it('applies final top-K', async () => {
    const pipeline = assemblePipeline(defaultConfig(), {}); // topK 10 default
    const big = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, title: `token ${i}`, createdAt: `2026-01-${(i % 28) + 1}` }));
    const { candidates } = await pipeline.run('token', { corpus: big });
    expect(candidates).toHaveLength(10);
  });
});

describe('SearchPipeline — observability', () => {
  it('returns per-stage timings and a total', async () => {
    const pipeline = new SearchPipeline({ retrievers: [createLexicalRetriever()] });
    const { timings } = await pipeline.run('token', { corpus: CORPUS });
    expect(timings.retrievers).toHaveProperty('lexical');
    expect(typeof timings.fusion).toBe('number');
    expect(typeof timings.total).toBe('number');
    expect(timings.errors).toEqual([]);
  });
});

describe('SearchPipeline — graceful degradation', () => {
  it('a throwing retriever drops to [] and records the error; the healthy leg still answers', async () => {
    const pipeline = new SearchPipeline({
      retrievers: [stub('broken', [], { throw: true }), stub('ok', [cand(5), cand(6)])],
    });
    const { candidates, timings } = await pipeline.run('q', {});
    expect(candidates.map((c) => c.taskId)).toEqual([5, 6]);
    expect(timings.errors.some((e) => e.stage === 'retriever:broken')).toBe(true);
  });

  it('search never hard-fails when every retriever yields nothing', async () => {
    const pipeline = new SearchPipeline({ retrievers: [stub('empty', [])] });
    const { candidates } = await pipeline.run('q', {});
    expect(candidates).toEqual([]);
  });

  it('a throwing postprocessor is skipped, leaving the fused list intact', async () => {
    const badPP = { name: 'bad', postprocess() { throw new Error('nope'); } };
    const pipeline = new SearchPipeline({
      retrievers: [stub('ok', [cand(1), cand(2)])],
      postprocessors: [badPP],
    });
    const { candidates, timings } = await pipeline.run('q', {});
    expect(candidates.map((c) => c.taskId)).toEqual([1, 2]);
    expect(timings.errors.some((e) => e.stage === 'postprocessor:bad')).toBe(true);
  });

  it('postprocessors run in order and transform the list', async () => {
    const reverse = { name: 'rev', postprocess: (_q, cs) => [...cs].reverse() };
    const pipeline = new SearchPipeline({
      retrievers: [stub('ok', [cand(1), cand(2), cand(3)])],
      postprocessors: [reverse],
    });
    const { candidates } = await pipeline.run('q', {});
    expect(candidates.map((c) => c.taskId)).toEqual([3, 2, 1]);
  });
});

describe('assemblePipeline', () => {
  it('drops unimplemented stages (dense/graphExpand) and still runs lexical', async () => {
    const pipeline = assemblePipeline(
      { retrievers: ['lexical', 'dense'], fusion: { mode: 'rrf', k: 60 }, postprocessors: ['graphExpand', 'rerank'], topK: 10, providers: { embedding: { backend: 'none' }, rerank: { backend: 'none' } } },
      {},
    );
    const { candidates } = await pipeline.run('token', { corpus: CORPUS });
    expect(candidates.length).toBeGreaterThan(0);
  });
});
