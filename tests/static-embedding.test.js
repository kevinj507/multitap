// Static embedding backend (wordpiece.js + staticEmbedding.js) — correctness
// against the OFFICIAL pipeline. tests/fixtures/static-embedding-reference.json
// was generated with HF `tokenizers` (the model's own tokenizer.json) + numpy
// over the raw safetensors, with add_special_tokens=False — the exact
// sentence-transformers StaticEmbedding semantics (verified against the
// v3.3.0/v5.6.1 sources). Tokenization fidelity IS embedding fidelity here.
//
// Two tiers: (1) dependency-free unit tests over a synthetic vocab/matrix that
// always run; (2) full-fidelity reference tests that need the fetched
// artifacts (models/ is gitignored) and skip cleanly when absent — they run on
// any box after `node scripts/fetch-static-model.mjs`.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWordPieceTokenizer, bertNormalize, bertPreTokenize } from '../src/search/providers/wordpiece.js';
import { createStaticEmbeddingProvider, buildGtse, parseGtse } from '../src/search/providers/staticEmbedding.js';
import { createEmbeddingProvider } from '../src/search/providers/embedding.js';
import { PROVIDER_BACKENDS } from '../src/search/types.js';
import { configFromEnv, validateConfig } from '../src/search/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIR = path.join(ROOT, 'models', 'static');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'static-embedding-reference.json');
// The reference tier exercises all four fetched variants — the guard must
// cover the same list, or a partial fetch fails the suite instead of skipping.
const REFERENCE_VARIANTS = [
  ['f32-d1024', 'dim1024', 0.999999],
  ['int8-d1024', 'dim1024', 0.9999],
  ['f32-d256', 'dim256', 0.999999],
  ['int8-d256', 'dim256', 0.9999],
];
const haveArtifacts =
  fs.existsSync(path.join(STATIC_DIR, 'tokenizer.json')) &&
  REFERENCE_VARIANTS.every(([v]) =>
    fs.existsSync(path.join(STATIC_DIR, `static-retrieval-mrl-en-v1-${v}.gtse`)));

function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return na === nb ? 1 : 0;
  return d / Math.sqrt(na * nb);
}

// ---------- tier 1: synthetic, always runs ----------

// Tiny WordPiece vocab exercising continuation, unk, punctuation, casing.
const miniTokenizerJson = {
  normalizer: { type: 'BertNormalizer', clean_text: true, handle_chinese_chars: true, strip_accents: null, lowercase: true },
  pre_tokenizer: { type: 'BertPreTokenizer' },
  model: {
    type: 'WordPiece',
    unk_token: '[UNK]',
    continuing_subword_prefix: '##',
    max_input_chars_per_word: 100,
    vocab: { '[UNK]': 0, 'un': 1, '##aff': 2, '##able': 3, 'run': 4, '##ning': 5, '!': 6, 'cafe': 7, '深': 8, 'a': 9 },
  },
};

describe('wordpiece: BertNormalizer', () => {
  it('lowercases and strips accents (strip_accents=null follows lowercase)', () => {
    expect(bertNormalize('Café MÜNCHEN')).toBe('cafe munchen');
  });
  it('cleans control chars and folds whitespace to single spaces', () => {
    // NUL and BEL built via escapes: raw control bytes in the source would
    // make git/grep/file(1) treat this test file as binary.
    const raw = `a${String.fromCharCode(0)}b${String.fromCharCode(7)}c\td\ne`;
    expect(bertNormalize(raw)).toBe('abc d e');
  });
  it('wraps CJK chars in spaces', () => {
    expect(bertNormalize('ab深度cd')).toBe('ab 深  度 cd');
  });
  it('respects explicit strip_accents=false', () => {
    expect(bertNormalize('Café', { stripAccents: false })).toBe('café');
  });
  it('U+2028/U+2029 separators are whitespace (Rust White_Space, not just Zs)', () => {
    expect(bertPreTokenize(bertNormalize('foo bar'))).toEqual(['foo', 'bar']);
    expect(bertPreTokenize(bertNormalize('foo bar'))).toEqual(['foo', 'bar']);
  });
  it('lowercase is per-code-point: word-final Σ → σ, never Final_Sigma ς', () => {
    expect(bertNormalize('ΣΑΣ')).toBe('σασ');
    expect(bertNormalize('ΟΔΥΣΣΕΥΣ')).toBe('οδυσσευσ');
  });
  it('unassigned code points (Cn) are KEPT in the word like HF, not deleted', () => {
    expect(bertNormalize('ab͸cd')).toContain('͸');
  });
});

describe('wordpiece: BertPreTokenizer', () => {
  it('splits whitespace and isolates every punctuation char', () => {
    expect(bertPreTokenize("it's  a-test!")).toEqual(['it', "'", 's', 'a', '-', 'test', '!']);
  });
  it('treats ASCII symbol chars ($ + = ~) as punctuation like HF does', () => {
    expect(bertPreTokenize('a$b=c~d')).toEqual(['a', '$', 'b', '=', 'c', '~', 'd']);
  });
});

describe('wordpiece: model', () => {
  const tok = createWordPieceTokenizer(miniTokenizerJson);
  it('greedy longest-match with ## continuation', () => {
    expect(Array.from(tok.encode('unaffable'))).toEqual([1, 2, 3]);
    expect(Array.from(tok.encode('running!'))).toEqual([4, 5, 6]);
  });
  it('whole word → [UNK] when any piece is unmatchable', () => {
    expect(Array.from(tok.encode('unxyz'))).toEqual([0]);
  });
  it('word longer than max_input_chars_per_word → [UNK]', () => {
    expect(Array.from(tok.encode('a'.repeat(101)))).toEqual([0]);
  });
  it('empty and whitespace-only → no tokens', () => {
    expect(Array.from(tok.encode(''))).toEqual([]);
    expect(Array.from(tok.encode('  \t\n '))).toEqual([]);
  });
  it('rejects non-WordPiece tokenizer json', () => {
    expect(() => createWordPieceTokenizer({ model: { type: 'BPE', vocab: {} } })).toThrow(/WordPiece/);
  });
});

describe('static provider: GTSE round-trip + contract (synthetic)', () => {
  // 10-token vocab, 4-dim matrix with distinctive rows.
  const vocabSize = 10, srcDim = 4;
  const mat = new Float32Array(vocabSize * srcDim);
  for (let r = 0; r < vocabSize; r++) for (let j = 0; j < srcDim; j++) mat[r * srcDim + j] = (r + 1) * (j % 2 === 0 ? 0.1 : -0.05) * (j + 1);

  function makeDir(dtype, dim) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtse-test-'));
    const name = `mini-${dtype}-d${dim}`;
    fs.writeFileSync(path.join(dir, `${name}.gtse`), buildGtse(mat, { model: name, vocabSize, srcDim, dim, dtype }));
    fs.writeFileSync(path.join(dir, 'tokenizer.json'), JSON.stringify(miniTokenizerJson));
    return dir;
  }

  it('parseGtse round-trips what buildGtse wrote (f32 and int8)', () => {
    for (const dtype of ['f32', 'int8']) {
      const { header, data, scales } = parseGtse(buildGtse(mat, { model: 'm', vocabSize, srcDim, dim: srcDim, dtype }));
      expect(header.vocabSize).toBe(vocabSize);
      expect(header.dim).toBe(srcDim);
      if (dtype === 'f32') {
        expect(scales).toBeNull();
        expect(Array.from(data.subarray(0, 4))).toEqual(Array.from(mat.subarray(0, 4)));
      } else {
        // dequantized values within absmax/127 half-step of the original
        for (let r = 0; r < vocabSize; r++) {
          for (let j = 0; j < srcDim; j++) {
            expect(Math.abs(scales[r] * data[r * srcDim + j] - mat[r * srcDim + j])).toBeLessThanOrEqual(scales[r] / 2 + 1e-9);
          }
        }
      }
    }
  });

  it('embeds = L2-normalized mean of token rows; batch preserves order', async () => {
    const dir = makeDir('f32', srcDim);
    const p = createStaticEmbeddingProvider({ model: 'mini-f32-d4', staticDir: dir });
    expect(p.dim).toBeNull(); // lazy until first embed
    const [vRun, vRunning] = await p.embed(['run', 'running']);
    expect(p.dim).toBe(srcDim);
    expect(p.modelId).toBe('mini-f32-d4');
    // 'run' = row 4 normalized
    const row4 = Array.from(mat.subarray(4 * srcDim, 5 * srcDim));
    expect(cosine(vRun, row4)).toBeCloseTo(1, 6);
    // 'running' = mean(row4,row5) normalized — differs from row4 alone
    const mean45 = row4.map((x, j) => (x + mat[5 * srcDim + j]) / 2);
    expect(cosine(vRunning, mean45)).toBeCloseTo(1, 6);
    // norms are 1
    for (const v of [vRun, vRunning]) {
      expect(Math.sqrt(v.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 6);
    }
  });

  it('empty / whitespace / unknown-only input → zero vector, no NaN', async () => {
    const dir = makeDir('int8', srcDim);
    const p = createStaticEmbeddingProvider({ model: 'mini-int8-d4', staticDir: dir });
    const [empty, ws] = await p.embed(['', '   \t ']);
    expect(empty).toEqual([0, 0, 0, 0]);
    expect(ws).toEqual([0, 0, 0, 0]);
  });

  it('MRL truncation: d2 artifact equals the first 2 dims renormalized', async () => {
    const pFull = createStaticEmbeddingProvider({ model: 'mini-f32-d4', staticDir: makeDir('f32', 4) });
    const pTrunc = createStaticEmbeddingProvider({ model: 'mini-f32-d2', staticDir: makeDir('f32', 2) });
    const [vFull] = await pFull.embed(['unaffable run']);
    const [vTrunc] = await pTrunc.embed(['unaffable run']);
    expect(vTrunc.length).toBe(2);
    const sliced = vFull.slice(0, 2);
    const n = Math.sqrt(sliced.reduce((s, x) => s + x * x, 0));
    expect(cosine(vTrunc, sliced.map((x) => x / n))).toBeCloseTo(1, 5);
  });

  it('missing artifact fails with an actionable message and retries after fix', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtse-test-'));
    const p = createStaticEmbeddingProvider({ model: 'mini-int8-d4', staticDir: dir });
    await expect(p.embed(['x'])).rejects.toThrow(/fetch-static-model/);
    // drop the artifact in and the SAME provider recovers (load not poisoned)
    fs.writeFileSync(path.join(dir, 'mini-int8-d4.gtse'), buildGtse(mat, { model: 'mini-int8-d4', vocabSize, srcDim, dim: srcDim, dtype: 'int8' }));
    fs.writeFileSync(path.join(dir, 'tokenizer.json'), JSON.stringify(miniTokenizerJson));
    const [v] = await p.embed(['run']);
    expect(v.length).toBe(srcDim);
  });

  it('tokenizer/artifact vocab mismatch fails loudly', async () => {
    const dir = makeDir('f32', srcDim);
    const badTok = JSON.parse(JSON.stringify(miniTokenizerJson));
    badTok.model.vocab.extra = 10;
    fs.writeFileSync(path.join(dir, 'tokenizer.json'), JSON.stringify(badTok));
    const p = createStaticEmbeddingProvider({ model: 'mini-f32-d4', staticDir: dir });
    await expect(p.embed(['x'])).rejects.toThrow(/vocab/);
  });

  it('embed input validation matches the provider contract', async () => {
    const dir = makeDir('f32', srcDim);
    const p = createStaticEmbeddingProvider({ model: 'mini-f32-d4', staticDir: dir });
    await expect(p.embed('not-an-array')).rejects.toThrow(/array/);
    expect(await p.embed([])).toEqual([]);
  });

  it('truncated artifact fails loudly for BOTH dtypes (no silent zero-fill)', () => {
    for (const dtype of ['int8', 'f32']) {
      const whole = buildGtse(mat, { model: 'm', vocabSize, srcDim, dim: srcDim, dtype });
      expect(() => parseGtse(whole.subarray(0, whole.length - 6))).toThrow(/truncated|corrupt/);
      // longer-than-expected is also corrupt (concatenated/garbage tail)
      expect(() => parseGtse(Buffer.concat([whole, Buffer.alloc(8)]))).toThrow(/truncated|corrupt/);
    }
  });

  it('batchSize slices the embed loop without changing results or order', async () => {
    const dir = makeDir('f32', srcDim);
    const texts = ['run', 'running', 'unaffable', 'run run', '!'];
    const whole = await createStaticEmbeddingProvider({ model: 'mini-f32-d4', staticDir: dir }).embed(texts);
    const sliced = await createStaticEmbeddingProvider({ model: 'mini-f32-d4', staticDir: dir, batchSize: 2 }).embed(texts);
    expect(sliced).toEqual(whole);
  });

  it('dense retriever abstains on a zero-norm query vector (static empty bag)', async () => {
    const { createDenseRetriever } = await import('../src/search/retrievers/dense.js');
    const zeroProvider = {
      modelId: 'z', dim: 4,
      async embed(texts) { return texts.map(() => [0, 0, 0, 0]); },
    };
    const r = createDenseRetriever({ provider: zeroProvider });
    const out = await r.retrieve('​', { corpus: [{ id: 1, title: 't', body: 'some body text here' }] });
    expect(out).toEqual([]);
  });
});

describe('config + factory wiring', () => {
  it("PROVIDER_BACKENDS includes 'static' and validateConfig accepts it", () => {
    expect(PROVIDER_BACKENDS).toContain('static');
    const { errors } = validateConfig({ providers: { embedding: { backend: 'static' } } });
    expect(errors).toEqual([]);
  });
  it('configFromEnv plumbs EMBEDDING_BACKEND=static + EMBEDDING_STATIC_DIR and enables dense', () => {
    const cfg = configFromEnv({ EMBEDDING_BACKEND: 'static', EMBEDDING_STATIC_DIR: '/tmp/x', EMBEDDING_MODEL: 'm-int8-d256' });
    expect(cfg.providers.embedding.backend).toBe('static');
    expect(cfg.providers.embedding.staticDir).toBe('/tmp/x');
    expect(cfg.providers.embedding.model).toBe('m-int8-d256');
    expect(cfg.retrievers).toContain('dense');
  });
  it('createEmbeddingProvider dispatches static without touching transformers', () => {
    const p = createEmbeddingProvider({ backend: 'static', model: 'anything', staticDir: '/nope' });
    expect(p).toBeTruthy();
    expect(p.modelId).toBe('anything');
  });
});

// ---------- tier 2: full-fidelity reference (needs fetched artifacts) ----------

describe.skipIf(!haveArtifacts)('reference fidelity vs official pipeline', () => {
  const fix = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

  it('tokenizer matches HF `tokenizers` exactly on every fixture case', () => {
    const tok = createWordPieceTokenizer(JSON.parse(fs.readFileSync(path.join(STATIC_DIR, 'tokenizer.json'), 'utf8')));
    for (const c of fix.cases) {
      expect(Array.from(tok.encode(c.text)), JSON.stringify(c.text.slice(0, 60))).toEqual(c.ids);
    }
  });

  for (const [variant, key, minCos] of REFERENCE_VARIANTS) {
    it(`${variant}: cosine vs reference ≥ ${minCos} on all cases`, async () => {
      const p = createStaticEmbeddingProvider({ model: `static-retrieval-mrl-en-v1-${variant}`, staticDir: STATIC_DIR });
      const vecs = await p.embed(fix.cases.map((c) => c.text));
      for (let i = 0; i < vecs.length; i++) {
        const ref = fix.cases[i][key];
        if (ref.every((x) => x === 0)) {
          expect(vecs[i].every((x) => x === 0), `case ${i} should be zero-vector`).toBe(true);
        } else {
          expect(cosine(vecs[i], ref), `case ${i}: ${JSON.stringify(fix.cases[i].text.slice(0, 40))}`).toBeGreaterThanOrEqual(minCos);
        }
      }
    });
  }

  it('semantic sanity: related sentences score higher than unrelated', async () => {
    const p = createStaticEmbeddingProvider({ model: 'static-retrieval-mrl-en-v1-int8-d1024', staticDir: STATIC_DIR });
    const [weather, sunny, stadium] = await p.embed([
      'The weather is lovely today.',
      "It's so sunny outside!",
      'He drove to the stadium.',
    ]);
    expect(cosine(weather, sunny)).toBeGreaterThan(cosine(weather, stadium));
    expect(cosine(weather, sunny)).toBeGreaterThan(cosine(sunny, stadium));
  });
});
