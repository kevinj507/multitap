// Static EmbeddingProvider — in-process, zero-model-runtime dense backend.
// Reimplements sentence-transformers' StaticEmbedding inference exactly:
// WordPiece tokenize WITHOUT special tokens (wordpiece.js) → mean of the
// per-token embedding-table rows → L2-normalize (the provider contract;
// the upstream model is unnormalized + cosine-scored, so this is equivalent).
//
// Why it exists (Bog/ESE takeaway, graph eubxft9h7v9edta2 tk-static-embeddings):
// local-onnx pays a heavy cold path (transformers.js + ort session on a 1-core
// box) for every process start; a static model is a table lookup — the whole
// "model" is a quantized matrix loaded from disk in well under a second, so
// the dense leg is available immediately after a worker wake.
//
// Artifacts are produced by scripts/fetch-static-model.mjs (GTSE1 format:
// magic · u32 header len · header JSON · [f32 row scales when int8] · matrix).
// modelId comes from the artifact header and encodes dtype+dim, so switching
// variants re-versions the chunk store exactly like any model change.
//
// Empty input → zero vector (upstream EmbeddingBag semantics: empty bag = 0s;
// cosine against 0s is 0, and l2 normalization here is zero-safe).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWordPieceTokenizer } from './wordpiece.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DEFAULT_DIR = path.join(REPO_ROOT, 'models', 'static');
export const DEFAULT_STATIC_MODEL = 'static-retrieval-mrl-en-v1-int8-d256';

const MAGIC = 'GTSE1\n';

/**
 * Build a GTSE1 artifact buffer from an f32 row-major matrix. The single
 * canonical builder — scripts/fetch-static-model.mjs and the tests both use
 * it, so parseGtse below can never drift from the writer.
 *
 * @param {Float32Array} mat row-major [vocabSize × srcDim]
 * @param {{model:string, sourceModel?:string, vocabSize:number, srcDim:number,
 *          dim:number, dtype:'int8'|'f32', tokenizer?:string}} opts
 *   dim ≤ srcDim slices each row's prefix (MRL truncation).
 */
export function buildGtse(mat, { model, sourceModel = '', vocabSize, srcDim, dim, dtype, tokenizer = 'tokenizer.json' }) {
  if (!Number.isInteger(dim) || dim < 1 || dim > srcDim) throw new Error(`dim ${dim} out of range 1..${srcDim}`);
  const header = {
    format: 'GTSE1',
    model,
    sourceModel,
    vocabSize,
    dim,
    srcDim,
    dtype,
    quant: dtype === 'int8' ? 'absmax-row' : null,
    tokenizer,
    pooling: 'mean',
    normalize: 'l2-by-provider',
    specialTokens: false,
  };
  let headerJson = JSON.stringify(header);
  while ((10 + Buffer.byteLength(headerJson)) % 4 !== 0) headerJson += ' ';
  const headerBuf = Buffer.from(headerJson, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(headerBuf.length, 0);
  const parts = [Buffer.from(MAGIC), lenBuf, headerBuf];

  if (dtype === 'int8') {
    const scales = new Float32Array(vocabSize);
    const q = new Int8Array(vocabSize * dim);
    for (let r = 0; r < vocabSize; r++) {
      const src = r * srcDim;
      let absmax = 0;
      for (let j = 0; j < dim; j++) {
        const a = Math.abs(mat[src + j]);
        if (a > absmax) absmax = a;
      }
      const scale = absmax > 0 ? absmax / 127 : 1;
      scales[r] = scale;
      const dst = r * dim;
      for (let j = 0; j < dim; j++) q[dst + j] = Math.round(mat[src + j] / scale);
    }
    parts.push(Buffer.from(scales.buffer), Buffer.from(q.buffer));
  } else if (dtype === 'f32') {
    const out = new Float32Array(vocabSize * dim);
    for (let r = 0; r < vocabSize; r++) out.set(mat.subarray(r * srcDim, r * srcDim + dim), r * dim);
    parts.push(Buffer.from(out.buffer));
  } else {
    throw new Error(`unknown dtype ${dtype}`);
  }
  return Buffer.concat(parts);
}

/** Parse a GTSE1 artifact buffer into typed arrays (copies → aligned). */
export function parseGtse(buf) {
  if (buf.subarray(0, 6).toString('utf8') !== MAGIC) {
    throw new Error('not a GTSE1 artifact (bad magic)');
  }
  const headerLen = buf.readUInt32LE(6);
  const header = JSON.parse(buf.subarray(10, 10 + headerLen).toString('utf8'));
  const { vocabSize, dim, dtype } = header;
  let off = 10 + headerLen;

  // Exact-length check BEFORE decoding. Without it a truncated int8 artifact
  // (crashed download/copy) would parse "successfully" — Buffer.copy clamps,
  // zero-filling the matrix tail — and serve silently wrong embeddings under
  // a valid modelId. Fail loudly and actionably instead.
  const expected =
    dtype === 'int8' ? off + vocabSize * 4 + vocabSize * dim
    : dtype === 'f32' ? off + vocabSize * dim * 4
    : null;
  if (expected !== null && buf.length !== expected) {
    throw new Error(
      `truncated/corrupt GTSE artifact: have ${buf.length} bytes, expected ${expected} — re-run: node scripts/fetch-static-model.mjs`,
    );
  }

  let scales = null;
  if (dtype === 'int8') {
    scales = new Float32Array(vocabSize);
    for (let i = 0; i < vocabSize; i++) scales[i] = buf.readFloatLE(off + i * 4);
    off += vocabSize * 4;
    const data = new Int8Array(vocabSize * dim);
    // Int8Array copy is byte-for-byte; Buffer.copy handles pool offsets.
    buf.copy(Buffer.from(data.buffer), 0, off, off + vocabSize * dim);
    return { header, scales, data };
  }
  if (dtype === 'f32') {
    const data = new Float32Array(vocabSize * dim);
    for (let i = 0; i < data.length; i++) data[i] = buf.readFloatLE(off + i * 4);
    return { header, scales, data };
  }
  throw new Error(`unknown GTSE dtype "${dtype}"`);
}

/**
 * @param {{model?:string, staticDir?:string, batchSize?:number}} [cfg]
 *   model — artifact basename (no .gtse), default DEFAULT_STATIC_MODEL;
 *   staticDir — artifact directory, default <repo>/models/static
 *   (EMBEDDING_STATIC_DIR). An explicit `.gtse` path in `model` also works.
 * @returns {import('../types.js').EmbeddingProvider}
 */
export function createStaticEmbeddingProvider(cfg = {}) {
  const dir = cfg.staticDir || DEFAULT_DIR;
  const name = cfg.model || DEFAULT_STATIC_MODEL;
  const batchSize = cfg.batchSize ?? 64;
  const artifactPath = name.endsWith('.gtse') ? path.resolve(dir, name) : path.join(dir, `${name}.gtse`);

  let resolvedDim = null;
  let modelId = name.replace(/\.gtse$/, '');
  let loadPromise = null;

  async function load() {
    if (!loadPromise) {
      loadPromise = (async () => {
        let buf;
        try {
          buf = await fs.promises.readFile(artifactPath);
        } catch (err) {
          throw new Error(
            `static embedding artifact not found at ${artifactPath} — run: node scripts/fetch-static-model.mjs (${err.message})`,
          );
        }
        const { header, scales, data } = parseGtse(buf);
        const tokPath = path.join(path.dirname(artifactPath), header.tokenizer || 'tokenizer.json');
        const tokenizer = createWordPieceTokenizer(JSON.parse(await fs.promises.readFile(tokPath, 'utf8')));
        if (tokenizer.vocabSize !== header.vocabSize) {
          throw new Error(
            `tokenizer vocab (${tokenizer.vocabSize}) does not match artifact vocab (${header.vocabSize})`,
          );
        }
        resolvedDim = header.dim;
        modelId = header.model || modelId;
        return { header, scales, data, tokenizer };
      })();
      // A failed load must not be cached forever (artifact may get fetched
      // between attempts) — reset so the next embed() retries.
      loadPromise.catch(() => { loadPromise = null; });
    }
    return loadPromise;
  }

  function embedOne({ header, scales, data, tokenizer }, text) {
    const { dim } = header;
    const ids = tokenizer.encode(String(text ?? ''));
    const acc = new Float32Array(dim);
    if (ids.length === 0) return Array.from(acc); // empty bag → zeros
    if (header.dtype === 'int8') {
      for (let t = 0; t < ids.length; t++) {
        const id = ids[t];
        const s = scales[id];
        const base = id * dim;
        for (let j = 0; j < dim; j++) acc[j] += s * data[base + j];
      }
    } else {
      for (let t = 0; t < ids.length; t++) {
        const base = ids[t] * dim;
        for (let j = 0; j < dim; j++) acc[j] += data[base + j];
      }
    }
    const inv = 1 / ids.length;
    let norm = 0;
    for (let j = 0; j < dim; j++) {
      acc[j] *= inv;
      norm += acc[j] * acc[j];
    }
    norm = Math.sqrt(norm) || 1; // zero-safe
    const out = new Array(dim);
    for (let j = 0; j < dim; j++) out[j] = acc[j] / norm;
    return out;
  }

  return {
    get modelId() { return modelId; },
    get dim() { return resolvedDim; },
    async embed(texts) {
      if (!Array.isArray(texts)) throw new Error('embed(texts) expects an array of strings');
      if (texts.length === 0) return [];
      const model = await load();
      // Yield to the event loop between slices: embedding is a synchronous
      // CPU loop, and a large backfill batch on the 1-core box would
      // otherwise stall the server for the whole pass.
      const out = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        for (const t of texts.slice(i, i + batchSize)) out.push(embedOne(model, t));
        if (i + batchSize < texts.length) await new Promise((r) => setImmediate(r));
      }
      return out;
    },
  };
}

export default { createStaticEmbeddingProvider, parseGtse, DEFAULT_STATIC_MODEL };
