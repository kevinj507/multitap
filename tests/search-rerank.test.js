import { describe, it, expect } from 'vitest';
import { createReranker } from '../src/search/postprocessors/rerank.js';
import { createRerankProvider } from '../src/search/providers/rerank.js';
import { configFromEnv } from '../src/search/config.js';
import { assemblePipeline } from '../src/search/service.js';

// A provider that scores by a fixed map so the reorder is deterministic.
function fakeProvider(scoreByDoc) {
  return {
    modelId: 'fake',
    async rerank(query, docs) {
      return docs.map((d) => scoreByDoc[d] ?? 0);
    },
  };
}

const corpus = [
  { id: 1, title: 'Alpha', body: 'about cats' },
  { id: 2, title: 'Beta', body: 'about dogs' },
  { id: 3, title: 'Gamma', body: 'about birds' },
];
const cands = [
  { taskId: 1, score: 0.9, source: 'lexical' },
  { taskId: 2, score: 0.8, source: 'dense' },
  { taskId: 3, score: 0.7, source: 'dense' },
];

describe('rerank postprocessor', () => {
  it('re-sorts by cross-encoder score and rewrites source/meta', async () => {
    // Doc 3 ("Gamma\nabout birds") is scored highest → should jump to the top.
    const provider = fakeProvider({ 'Alpha\nabout cats': 0.1, 'Beta\nabout dogs': 0.4, 'Gamma\nabout birds': 0.95 });
    const rr = createReranker({ provider });
    const out = await rr.postprocess('q', cands, { corpus });
    expect(out.map((c) => c.taskId)).toEqual([3, 2, 1]);
    expect(out[0].source).toBe('rerank');
    expect(out[0].meta.rerankScore).toBe(0.95);
    expect(out[0].meta.rerankedFrom).toBe('dense');
  });

  it('only reranks the top-M and passes the tail through unchanged', async () => {
    const provider = fakeProvider({}); // everything scores 0
    const rr = createReranker({ provider, topM: 1 });
    const out = await rr.postprocess('q', cands, { corpus });
    // head is just [1]; tail [2,3] keeps its order after the reranked head.
    expect(out.map((c) => c.taskId)).toEqual([1, 2, 3]);
  });

  it('returns the list unchanged on a malformed provider response (graceful)', async () => {
    const provider = { modelId: 'x', async rerank() { return [0.5]; } }; // wrong length
    const rr = createReranker({ provider });
    const out = await rr.postprocess('q', cands, { corpus });
    expect(out).toBe(cands);
  });

  it('falls back to the snippet when corpus text is missing', async () => {
    const provider = fakeProvider({ 'snip text': 0.9 });
    const rr = createReranker({ provider });
    const out = await rr.postprocess('q', [{ taskId: 99, score: 0.1, source: 'lexical', snippet: { text: 'snip text', ranges: [] } }], { corpus: [] });
    expect(out[0].meta.rerankScore).toBe(0.9);
  });

  it('passes an empty candidate list straight through', async () => {
    const rr = createReranker({ provider: fakeProvider({}) });
    expect(await rr.postprocess('q', [], { corpus })).toEqual([]);
  });

  it('input=chunk reranks the matched passage headed by the title (#227)', async () => {
    const seen = [];
    const provider = { modelId: 'fake', async rerank(q, docs) { seen.push(...docs); return docs.map(() => 0.5); } };
    const rr = createReranker({ provider, input: 'chunk' });
    const withSnippet = [{ taskId: 1, score: 0.9, source: 'dense', snippet: { text: 'the winning passage' } }];
    await rr.postprocess('q', withSnippet, { corpus });
    expect(seen).toEqual(['Alpha\nthe winning passage']); // not the body head
  });

  it('input=auto uses the head for docs that fit maxChars, the chunk for longer ones', async () => {
    const seen = [];
    const provider = { modelId: 'fake', async rerank(q, docs) { seen.push(...docs); return docs.map(() => 0.5); } };
    const longBody = 'x'.repeat(600);
    const autoCorpus = [
      { id: 1, title: 'Short', body: 'fits fine' },
      { id: 2, title: 'Long', body: longBody },
    ];
    const rr = createReranker({ provider, input: 'auto', maxChars: 512 });
    const cs = [
      { taskId: 1, score: 0.9, source: 'dense', snippet: { text: 'snip one' } },
      { taskId: 2, score: 0.8, source: 'dense', snippet: { text: 'snip two' } },
    ];
    await rr.postprocess('q', cs, { corpus: autoCorpus });
    expect(seen[0]).toBe('Short\nfits fine'); // whole doc fits → head
    expect(seen[1]).toBe('Long\nsnip two'); // would truncate → chunk
  });

  it('truncates doc text to maxChars before sending to the provider (#198 latency lever)', async () => {
    let sentLen = -1;
    const capture = { modelId: 'cap', async rerank(query, docs) { sentLen = docs[0].length; return docs.map(() => 0.5); } };
    const longCorpus = [{ id: 1, title: 'T', body: 'x'.repeat(5000) }];
    const rr = createReranker({ provider: capture, maxChars: 100 });
    await rr.postprocess('q', [{ taskId: 1, score: 0.9, source: 'lexical' }], { corpus: longCorpus });
    expect(sentLen).toBe(100);
  });
});

describe('local-onnx rerank provider', () => {
  it('cross-encodes (query, doc) pairs and sigmoids the logit', async () => {
    // Fake transformers: tokenizer echoes the pair count; model returns one
    // logit per doc so we can check the sigmoid mapping.
    const transformers = {
      AutoTokenizer: { from_pretrained: async () => (texts, opts) => ({ n: texts.length, pairs: opts.text_pair }) },
      AutoModelForSequenceClassification: {
        from_pretrained: async () => async (inputs) => ({ logits: { tolist: () => inputs.pairs.map(() => [0]) } }),
      },
    };
    const p = createRerankProvider({ backend: 'local-onnx', model: 'm' }, { transformers });
    const scores = await p.rerank('q', ['d1', 'd2']);
    // sigmoid(0) = 0.5
    expect(scores).toEqual([0.5, 0.5]);
  });

  it('returns [] for an empty doc list without loading the model', async () => {
    const p = createRerankProvider({ backend: 'local-onnx' }, { transformers: {} });
    expect(await p.rerank('q', [])).toEqual([]);
  });

  it('defaults to the sweep winner (TinyBERT-L-2) at q8, and passes dtype through', async () => {
    const seen = [];
    const transformers = {
      AutoTokenizer: { from_pretrained: async () => (texts, opts) => ({ pairs: opts.text_pair }) },
      AutoModelForSequenceClassification: {
        from_pretrained: async (model, opts) => { seen.push({ model, opts }); return async (inp) => ({ logits: { tolist: () => inp.pairs.map(() => [0]) } }); },
      },
    };
    const def = createRerankProvider({ backend: 'local-onnx' }, { transformers });
    expect(def.modelId).toBe('Xenova/ms-marco-TinyBERT-L-2-v2');
    await def.rerank('q', ['d']);
    expect(seen[0].model).toBe('Xenova/ms-marco-TinyBERT-L-2-v2');
    expect(seen[0].opts).toEqual({ dtype: 'q8' });

    const fp = createRerankProvider({ backend: 'local-onnx', model: 'X/y', dtype: 'fp32' }, { transformers });
    await fp.rerank('q', ['d']);
    expect(seen[1]).toEqual({ model: 'X/y', opts: { dtype: 'fp32' } });
  });
});

describe('rerank config + assembly wiring', () => {
  it('configFromEnv enables the rerank postprocessor when a backend is set', () => {
    const cfg = configFromEnv({ RERANK_BACKEND: 'http', RERANK_URL: 'http://x', RERANK_TOPM: '30', RERANK_TIMEOUT_MS: '60000' });
    expect(cfg.postprocessors).toContain('rerank');
    expect(cfg.providers.rerank.topM).toBe(30);
    expect(cfg.providers.rerank.timeoutMs).toBe(60000);
  });

  it('leaves rerank off when backend is none', () => {
    const cfg = configFromEnv({});
    expect(cfg.postprocessors).not.toContain('rerank');
  });

  it('assemblePipeline builds the reranker stage from an injected provider', async () => {
    const provider = fakeProvider({ 'Gamma\nabout birds': 0.95, 'Beta\nabout dogs': 0.4, 'Alpha\nabout cats': 0.1 });
    const pipeline = assemblePipeline(
      { retrievers: ['lexical'], fusion: { mode: 'rrf', k: 60 }, postprocessors: ['rerank'], topK: 10, providers: { embedding: { backend: 'none' }, rerank: { backend: 'http' } } },
      { rerankProvider: provider },
    );
    const { candidates } = await pipeline.run('about birds', { corpus });
    // Reranker should pull Gamma (id 3) to the top regardless of lexical order.
    expect(candidates[0].taskId).toBe(3);
    expect(candidates[0].source).toBe('rerank');
  });
});
