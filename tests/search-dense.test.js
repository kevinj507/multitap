import { describe, it, expect, vi } from 'vitest';
import { createDenseRetriever } from '../src/search/retrievers/dense.js';
import { assemblePipeline } from '../src/search/service.js';
import { defaultConfig } from '../src/search/config.js';

// A fake EmbeddingProvider with hand-placed unit vectors, so cosine ranking is
// fully deterministic and the dense retriever is tested without a model. Each
// text maps to a 2-D unit vector via a lookup; unknown text → [0,0].
function fakeProvider(map, { onEmbed } = {}) {
  return {
    modelId: 'fake',
    dim: 2,
    embed: vi.fn(async (texts) => {
      if (onEmbed) onEmbed(texts);
      return texts.map((t) => map[t] || [0, 0]);
    }),
  };
}

// Single-chunk docs (short bodies) keep the chunk text == a known key.
const docs = [
  { id: 1, title: '', description: '', body: 'cats' },
  { id: 2, title: '', description: '', body: 'dogs' },
  { id: 3, title: '', description: '', body: 'finance' },
];

describe('createDenseRetriever — ranking', () => {
  it('ranks nodes by cosine to the query and collapses chunks to nodes', async () => {
    const provider = fakeProvider({
      cats: [1, 0], dogs: [0.8, 0.6], finance: [0, 1], 'pets?': [1, 0],
    });
    const dense = createDenseRetriever({ provider });
    const out = await dense.retrieve('pets?', { corpus: docs });
    expect(out.map((c) => c.taskId)).toEqual([1, 2, 3]); // cats > dogs > finance
    expect(out[0].source).toBe('dense');
    expect(out[0].snippet.text).toBe('cats'); // winning passage carried as snippet
  });

  it('max-pools: a node is as relevant as its STRONGEST passage', async () => {
    // One doc with two sections → two chunks; the query matches only section B.
    const multi = [{ id: 9, title: '', description: '', body: '## A\nalpha\n\n## B\nbeta' }];
    const provider = fakeProvider({
      '## A\nalpha': [0, 1], '## B\nbeta': [1, 0], q: [1, 0],
    });
    const dense = createDenseRetriever({ provider });
    const out = await dense.retrieve('q', { corpus: multi });
    expect(out).toHaveLength(1);
    expect(out[0].taskId).toBe(9);
    expect(out[0].meta.similarity).toBeCloseTo(1, 5); // the strong passage wins
    expect(out[0].snippet.text).toContain('beta');
  });

  it('honours denseTopK', async () => {
    const provider = fakeProvider({ cats: [1, 0], dogs: [0.9, 0.1], finance: [0.8, 0.2], q: [1, 0] });
    const dense = createDenseRetriever({ provider });
    const out = await dense.retrieve('q', { corpus: docs, denseTopK: 2 });
    expect(out).toHaveLength(2);
  });

  it('caches the corpus embedding across queries (no re-embed)', async () => {
    const provider = fakeProvider({ cats: [1, 0], dogs: [0, 1], q1: [1, 0], q2: [0, 1] });
    const dense = createDenseRetriever({ provider });
    const corpus = docs.slice(0, 2);
    await dense.retrieve('q1', { corpus });
    await dense.retrieve('q2', { corpus });
    // 2 corpus chunks embedded once (1 call) + one call per query = 3 total.
    expect(provider.embed).toHaveBeenCalledTimes(3);
  });

  it('prepends queryPrefix to the QUERY only, never to chunks (#224)', async () => {
    const seen = [];
    const provider = fakeProvider(
      { cats: [1, 0], dogs: [0, 1], 'PREFIX: pets?': [1, 0] },
      { onEmbed: (texts) => seen.push(...texts) },
    );
    const dense = createDenseRetriever({ provider, queryPrefix: 'PREFIX: ' });
    const out = await dense.retrieve('pets?', { corpus: docs.slice(0, 2) });
    expect(out[0].taskId).toBe(1); // ranked via the prefixed query vector
    expect(seen).toContain('PREFIX: pets?');
    // corpus chunks stay instruction-free
    expect(seen.filter((t) => t.startsWith('PREFIX: '))).toEqual(['PREFIX: pets?']);
  });

  it('returns [] for an empty corpus', async () => {
    const provider = fakeProvider({});
    const dense = createDenseRetriever({ provider });
    expect(await dense.retrieve('q', { corpus: [] })).toEqual([]);
  });

  it('requires a provider', () => {
    expect(() => createDenseRetriever({})).toThrow(/EmbeddingProvider/);
  });
});

describe('assembler wiring — dense lights up only with a provider', () => {
  it('drops dense (lexical-only) when the embedding backend is none', () => {
    const cfg = { ...defaultConfig(), retrievers: ['lexical', 'dense'] };
    const pipe = assemblePipeline(cfg, {});
    expect(pipe.retrievers.map((r) => r.name)).toEqual(['lexical']);
  });

  it('builds the dense leg when an embedding provider is injected', () => {
    const cfg = { ...defaultConfig(), retrievers: ['lexical', 'dense'] };
    const pipe = assemblePipeline(cfg, { embeddingProvider: fakeProvider({}) });
    expect(pipe.retrievers.map((r) => r.name)).toEqual(['lexical', 'dense']);
  });
});
