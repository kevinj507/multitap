import { describe, it, expect } from 'vitest';
import { defaultConfig, validateConfig, assertConfig, configFromEnv } from '../src/search/config.js';

describe('defaultConfig', () => {
  it('is Tier-0 lexical, RRF k=60, topK 10, no model providers', () => {
    const c = defaultConfig();
    expect(c.retrievers).toEqual(['lexical']);
    expect(c.fusion).toEqual({ mode: 'rrf', k: 60 });
    expect(c.postprocessors).toEqual([]);
    expect(c.topK).toBe(10);
    expect(c.providers.embedding.backend).toBe('none');
    expect(c.lexical.ranker).toBe('bm25'); // #228: bm25 is the default Tier-0 ranker
  });

  it('returns a fresh object each call (no shared mutation)', () => {
    const a = defaultConfig();
    a.retrievers.push('dense');
    expect(defaultConfig().retrievers).toEqual(['lexical']);
  });
});

describe('validateConfig', () => {
  it('accepts the default and reports no errors', () => {
    expect(validateConfig(defaultConfig()).errors).toEqual([]);
  });

  it('normalizes a partial config over defaults', () => {
    const { config, errors } = validateConfig({ topK: 25 });
    expect(errors).toEqual([]);
    expect(config.topK).toBe(25);
    expect(config.fusion.k).toBe(60); // filled from default
  });

  it('rejects unknown retrievers and postprocessors', () => {
    expect(validateConfig({ retrievers: ['lexical', 'magic'] }).errors[0]).toMatch(/unknown retriever "magic"/);
    expect(validateConfig({ postprocessors: ['nope'] }).errors[0]).toMatch(/unknown postprocessor "nope"/);
  });

  it('accepts known-but-future stage names (dense / graphExpand / rerank)', () => {
    expect(validateConfig({ retrievers: ['lexical', 'dense'] }).errors).toEqual([]);
    expect(validateConfig({ postprocessors: ['graphExpand', 'rerank'] }).errors).toEqual([]);
  });

  it('rejects bad fusion mode, non-positive k, bad topK', () => {
    expect(validateConfig({ fusion: { mode: 'xx', k: 60 } }).errors.join()).toMatch(/fusion.mode/);
    expect(validateConfig({ fusion: { mode: 'rrf', k: 0 } }).errors.join()).toMatch(/fusion.k/);
    expect(validateConfig({ topK: -1 }).errors.join()).toMatch(/topK/);
  });

  it('rejects an unknown provider backend', () => {
    const { errors } = validateConfig({ providers: { embedding: { backend: 'banana' } } });
    expect(errors.join()).toMatch(/providers.embedding.backend/);
  });

  it('requires a non-empty retrievers array', () => {
    expect(validateConfig({ retrievers: [] }).errors.join()).toMatch(/non-empty/);
  });

  it('defaults dense.chunkTopK to 50 and rejects non-positive values (#226)', () => {
    expect(validateConfig({}).config.dense.chunkTopK).toBe(50);
    expect(validateConfig({ dense: { chunkTopK: 0 } }).errors.join()).toMatch(/chunkTopK/);
  });
});

describe('assertConfig', () => {
  it('throws a 400-tagged error on invalid config', () => {
    try {
      assertConfig({ topK: 0 });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.status).toBe(400);
      expect(e.errors.join()).toMatch(/topK/);
    }
  });
});

describe('configFromEnv', () => {
  it('defaults to Tier-0 lexical with no env', () => {
    const c = configFromEnv({});
    expect(c.retrievers).toEqual(['lexical']);
    expect(c.providers.embedding.backend).toBe('none');
  });

  it('adds the dense retriever when an embedding backend is configured', () => {
    const c = configFromEnv({ EMBEDDING_BACKEND: 'http', EMBEDDING_URL: 'http://x/embed', EMBEDDING_MODEL: 'bge-m3', EMBEDDING_DIM: '1024' });
    expect(c.retrievers).toContain('dense');
    expect(c.providers.embedding).toMatchObject({ backend: 'http', url: 'http://x/embed', model: 'bge-m3', dim: 1024 });
  });

  it('respects SEARCH_TOPK', () => {
    expect(configFromEnv({ SEARCH_TOPK: '20' }).topK).toBe(20);
  });

  it('respects DENSE_CHUNK_TOPK (#226)', () => {
    expect(configFromEnv({ DENSE_CHUNK_TOPK: '150' }).dense.chunkTopK).toBe(150);
  });
});

// The silent-downgrade bug (fixed 2026-08-08). validateConfig's `base` decides
// what an OMITTED key inherits, and the library default is deliberately Tier-0
// (lexical only, no providers, topK 10). Validating a partial REQUEST config
// against that base stripped whatever the deployment had enabled — the dense
// leg, graph expansion, the tuned top-K — and returned keyword-only results
// with no error, no warning, and an empty timings.errors. The route must merge
// over the DEPLOYED config instead; these pin the mechanism that lets it.
describe('validateConfig base (deployed-config merge)', () => {
  const deployed = {
    ...defaultConfig(),
    retrievers: ['lexical', 'dense'],
    postprocessors: ['graphExpand'],
    topK: 50,
    providers: {
      embedding: { backend: 'static', model: 'static-retrieval-mrl-en-v1-int8-d1024' },
      rerank: { backend: 'none' },
    },
  };

  it('a partial config inherits the deployment stack, not the Tier-0 default', () => {
    const { config, errors } = validateConfig({ topK: 100 }, deployed);
    expect(errors).toEqual([]);
    expect(config.topK).toBe(100);              // the caller's one knob applies
    expect(config.retrievers).toEqual(['lexical', 'dense']); // dense survives
    expect(config.postprocessors).toEqual(['graphExpand']);  // expansion survives
    expect(config.providers.embedding.backend).toBe('static'); // provider survives
  });

  it('without a base it still yields the vanilla shape (self-host / tests)', () => {
    expect(validateConfig({ topK: 100 }).config.retrievers).toEqual(['lexical']);
  });

  it('an explicit override still wins over the deployed value', () => {
    const { config } = validateConfig({ retrievers: ['lexical'] }, deployed);
    expect(config.retrievers).toEqual(['lexical']);
  });

  it('rejects unknown top-level keys loudly instead of degrading silently', () => {
    // `alpha` is a /context body param, not a search config key — passing it
    // here used to be accepted and quietly halve the engine.
    const { errors } = validateConfig({ alpha: 0.5 }, deployed);
    expect(errors.join()).toMatch(/unknown config key "alpha"/);
    expect(validateConfig({ bogusKey: 123 }, deployed).errors.join()).toMatch(/unknown config key/);
    // A real config round-trips clean through the strict check.
    expect(validateConfig(deployed, deployed).errors).toEqual([]);
  });
});
