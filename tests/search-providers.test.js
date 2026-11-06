import { describe, it, expect } from 'vitest';
import { createEmbeddingProvider } from '../src/search/providers/embedding.js';
import { createRerankProvider } from '../src/search/providers/rerank.js';
import { authHeaders, l2normalize } from '../src/search/providers/http.js';
import { configFromEnv } from '../src/search/config.js';

// A fake fetch that records calls and returns scripted responses, so provider
// tests never touch the network. Each response: { ok, status, json }.
function fakeFetch(responses) {
  const calls = [];
  const queue = Array.isArray(responses) ? [...responses] : null;
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = queue ? queue.shift() : responses(url, init);
    if (r.throw) throw r.throw;
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json };
  };
  fn.calls = calls;
  return fn;
}

describe('createEmbeddingProvider — backend selection', () => {
  it('returns null for backend "none" (Tier 1 off, lexical still answers)', () => {
    expect(createEmbeddingProvider({ backend: 'none' })).toBeNull();
    expect(createEmbeddingProvider({})).toBeNull();
  });

  it('builds a real in-process provider for local-onnx (lazy model load)', async () => {
    // Inject a fake transformers lib so the test never loads the real model.
    const fakeExtractor = async (batch) => ({ tolist: () => batch.map(() => [1, 0]) });
    const transformers = { pipeline: async () => fakeExtractor };
    const p = createEmbeddingProvider({ backend: 'local-onnx', model: 'm' }, { transformers });
    expect(p.modelId).toBe('m');
    const v = await p.embed(['a', 'b']);
    expect(v).toEqual([[1, 0], [1, 0]]);
    expect(p.dim).toBe(2); // learned from the first embed
  });

  it('requires a url for the http backend', () => {
    expect(() => createEmbeddingProvider({ backend: 'http' })).toThrow(/url/);
  });

  it('exposes modelId and (eventually) dim', async () => {
    const fetchImpl = fakeFetch([{ json: { embeddings: [[3, 4]], dim: 2, model: 'm' } }]);
    const p = createEmbeddingProvider({ backend: 'http', url: 'http://x', model: 'bge-m3' }, { fetchImpl });
    expect(p.modelId).toBe('bge-m3');
    expect(p.dim).toBeNull();
    await p.embed(['hi']);
    expect(p.dim).toBe(2); // learned from the response
  });
});

describe('http embedding provider — request/response contract (#173 §10)', () => {
  it('POSTs { texts, model } and returns L2-normalized vectors', async () => {
    const fetchImpl = fakeFetch([{ json: { embeddings: [[3, 4]], dim: 2 } }]);
    const p = createEmbeddingProvider({ backend: 'http', url: 'http://tei/embed', model: 'bge-m3' }, { fetchImpl });
    const out = await p.embed(['hello']);
    expect(fetchImpl.calls[0].body).toEqual({ texts: ['hello'], model: 'bge-m3' });
    expect(out).toEqual([[0.6, 0.8]]); // 3,4 normalized
  });

  it('returns [] without calling the backend for empty input', async () => {
    const fetchImpl = fakeFetch([]);
    const p = createEmbeddingProvider({ backend: 'http', url: 'http://x' }, { fetchImpl });
    expect(await p.embed([])).toEqual([]);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('batches large inputs into multiple requests, preserving order', async () => {
    const fetchImpl = fakeFetch([
      { json: { embeddings: [[1, 0], [0, 1]] } },
      { json: { embeddings: [[1, 0]] } },
    ]);
    const p = createEmbeddingProvider({ backend: 'http', url: 'http://x', batchSize: 2 }, { fetchImpl });
    const out = await p.embed(['a', 'b', 'c']);
    expect(fetchImpl.calls).toHaveLength(2);
    expect(fetchImpl.calls[0].body.texts).toEqual(['a', 'b']);
    expect(fetchImpl.calls[1].body.texts).toEqual(['c']);
    expect(out).toHaveLength(3);
  });

  it('throws when the response shape is wrong', async () => {
    const fetchImpl = fakeFetch([{ json: { oops: true } }]);
    const p = createEmbeddingProvider({ backend: 'http', url: 'http://x' }, { fetchImpl });
    await expect(p.embed(['a'])).rejects.toThrow(/embeddings/);
  });

  it('throws on a count mismatch (sent N, got M)', async () => {
    const fetchImpl = fakeFetch([{ json: { embeddings: [[1, 0]] } }]);
    const p = createEmbeddingProvider({ backend: 'http', url: 'http://x' }, { fetchImpl });
    await expect(p.embed(['a', 'b'])).rejects.toThrow(/mismatch/);
  });
});

describe('auth header per credential (#173 §10: swap = env change)', () => {
  it('sends Modal-Key/Modal-Secret when both are configured', async () => {
    const fetchImpl = fakeFetch([{ json: { embeddings: [[1]] } }]);
    const p = createEmbeddingProvider(
      { backend: 'http', url: 'http://modal', modalKey: 'k', modalSecret: 's' }, { fetchImpl });
    await p.embed(['x']);
    const h = fetchImpl.calls[0].init.headers;
    expect(h['Modal-Key']).toBe('k');
    expect(h['Modal-Secret']).toBe('s');
    expect(h['Authorization']).toBeUndefined();
  });

  it('sends a bearer token for a local backend', async () => {
    const fetchImpl = fakeFetch([{ json: { embeddings: [[1]] } }]);
    const p = createEmbeddingProvider(
      { backend: 'http', url: 'http://local', token: 'abc' }, { fetchImpl });
    await p.embed(['x']);
    expect(fetchImpl.calls[0].init.headers['Authorization']).toBe('Bearer abc');
  });

  it('authHeaders prefers Modal proxy-auth over a bearer token', () => {
    expect(authHeaders({ modalKey: 'k', modalSecret: 's', token: 't' })).toMatchObject({
      'Modal-Key': 'k', 'Modal-Secret': 's',
    });
    expect(authHeaders({ token: 't' })).toMatchObject({ Authorization: 'Bearer t' });
    expect(authHeaders({})).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('retry / resilience', () => {
  it('retries a 5xx then succeeds', async () => {
    const fetchImpl = fakeFetch([
      { ok: false, status: 503 },
      { json: { embeddings: [[1, 0]] } },
    ]);
    const p = createEmbeddingProvider({ backend: 'http', url: 'http://x', retries: 2 }, { fetchImpl });
    const out = await p.embed(['a']);
    expect(fetchImpl.calls).toHaveLength(2);
    expect(out).toEqual([[1, 0]]);
  });

  it('fails fast on a 4xx (our bug — no retry)', async () => {
    const fetchImpl = fakeFetch([{ ok: false, status: 401 }, { json: { embeddings: [[1]] } }]);
    const p = createEmbeddingProvider({ backend: 'http', url: 'http://x', retries: 2 }, { fetchImpl });
    await expect(p.embed(['a'])).rejects.toThrow(/401/);
    expect(fetchImpl.calls).toHaveLength(1);
  });
});

describe('createRerankProvider — contract', () => {
  it('returns null for "none"', () => {
    expect(createRerankProvider({ backend: 'none' })).toBeNull();
  });

  it('POSTs { query, documents } and returns the scores array', async () => {
    const fetchImpl = fakeFetch([{ json: { scores: [0.9, 0.1] } }]);
    const p = createRerankProvider({ backend: 'http', url: 'http://rr', model: 'bge-reranker' }, { fetchImpl });
    const scores = await p.rerank('q', ['d1', 'd2']);
    expect(fetchImpl.calls[0].body).toEqual({ query: 'q', documents: ['d1', 'd2'], model: 'bge-reranker' });
    expect(scores).toEqual([0.9, 0.1]);
  });

  it('returns [] for no documents without calling the backend', async () => {
    const fetchImpl = fakeFetch([]);
    const p = createRerankProvider({ backend: 'http', url: 'http://x' }, { fetchImpl });
    expect(await p.rerank('q', [])).toEqual([]);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('throws on a score-count mismatch', async () => {
    const fetchImpl = fakeFetch([{ json: { scores: [0.5] } }]);
    const p = createRerankProvider({ backend: 'http', url: 'http://x' }, { fetchImpl });
    await expect(p.rerank('q', ['a', 'b'])).rejects.toThrow(/mismatch/);
  });
});

describe('configFromEnv — provider auth wiring', () => {
  it('maps EMBEDDING_* / RERANK_* env into provider config and turns on dense', () => {
    const cfg = configFromEnv({
      EMBEDDING_BACKEND: 'http', EMBEDDING_URL: 'http://tei', EMBEDDING_MODEL: 'bge-m3',
      EMBEDDING_DIM: '1024', EMBEDDING_TOKEN: 'bearer-xyz',
    });
    expect(cfg.retrievers).toContain('dense');
    expect(cfg.providers.embedding).toMatchObject({
      backend: 'http', url: 'http://tei', model: 'bge-m3', dim: 1024, token: 'bearer-xyz',
    });
  });

  it('falls back to shared MODAL_KEY/MODAL_SECRET for both providers', () => {
    const cfg = configFromEnv({
      EMBEDDING_BACKEND: 'http', EMBEDDING_URL: 'http://modal',
      MODAL_KEY: 'k', MODAL_SECRET: 's',
    });
    expect(cfg.providers.embedding).toMatchObject({ modalKey: 'k', modalSecret: 's' });
  });

  it('leaves dense off and providers as none by default', () => {
    const cfg = configFromEnv({});
    expect(cfg.retrievers).toEqual(['lexical']);
    expect(cfg.providers.embedding.backend).toBe('none');
  });
});

describe('l2normalize', () => {
  it('scales a vector to unit length and is safe on zero', () => {
    expect(l2normalize([3, 4])).toEqual([0.6, 0.8]);
    expect(l2normalize([0, 0])).toEqual([0, 0]);
  });
});
