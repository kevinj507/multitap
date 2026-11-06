// EmbeddingProvider adapters — Tier 1 dense leg's model backend (graph task
// #194, P2.1; contract in #173 §10). The pipeline depends only on the
// EmbeddingProvider PORT (types.js); this is the adapter the assembler injects
// from config. A `none` backend returns null so the dense stage stays off and
// lexical still answers (graceful degradation, #173 §11).
//
// `http` is the one real backend — it covers BOTH a local TEI server and Modal,
// which differ only by url/model/auth (#173 §10). `local-onnx` is an optional
// in-process dev path deferred to the P2.3 local track (transformers.js is not
// a dependency yet), so selecting it fails loudly rather than silently no-op.

import { authHeaders, postJson, l2normalize } from './http.js';
import { createStaticEmbeddingProvider } from './staticEmbedding.js';

const DEFAULT_BATCH = 64; // TEI caps server-side batch; keep requests bounded.

// All HTTP-contract backends route to the same client; the value only changes
// which auth header authHeaders() emits, driven by the configured credential.
const HTTP_BACKENDS = new Set(['http', 'local', 'modal', 'api']);

/**
 * @param {{backend?:string, url?:string, model?:string, dim?:number,
 *          token?:string, modalKey?:string, modalSecret?:string,
 *          batchSize?:number, timeoutMs?:number, retries?:number}} [cfg]
 * @param {{fetchImpl?:Function}} [deps]
 * @returns {import('../types.js').EmbeddingProvider | null}
 */
export function createEmbeddingProvider(cfg = {}, deps = {}) {
  const backend = cfg.backend || 'none';
  if (backend === 'none') return null;
  if (HTTP_BACKENDS.has(backend)) return createHttpEmbeddingProvider(cfg, deps);
  if (backend === 'local-onnx') return createLocalOnnxProvider(cfg, deps);
  // In-process static-embedding-table backend (no model runtime at all —
  // tokenize + table lookup + mean pool). Cold-starts in <1s on the 1-core
  // box where local-onnx takes tens of seconds; see staticEmbedding.js.
  if (backend === 'static') return createStaticEmbeddingProvider(cfg);
  throw new Error(`unknown embedding backend "${backend}"`);
}

// In-process embedding via transformers.js / ONNX — the zero-service self-host
// backend (#173 §9: "OSS self-hosters run models locally"). No Docker, no
// endpoint: the model runs inside the Node server. @huggingface/transformers is
// an OPTIONAL dependency (it pulls onnxruntime, which `none`/`http` users
// shouldn't pay for), so it's imported lazily and a clear error fires if a
// self-hoster selected this backend without installing it.
//
// Default model is the ONNX build of BAAI/bge-small-en-v1.5 (#173 §10 Track A);
// override via EMBEDDING_MODEL. transformers.js does mean-pooling + L2-normalize
// internally when asked, matching the provider contract.
const DEFAULT_ONNX_MODEL = 'Xenova/bge-small-en-v1.5';

function createLocalOnnxProvider(cfg, { transformers } = {}) {
  const model = cfg.model || DEFAULT_ONNX_MODEL;
  const batchSize = cfg.batchSize ?? DEFAULT_BATCH;
  let resolvedDim = cfg.dim ?? null;
  let extractorPromise = null;

  async function getExtractor() {
    if (!extractorPromise) {
      extractorPromise = (async () => {
        let lib = transformers; // injectable for tests
        if (!lib) {
          try {
            lib = await import('@huggingface/transformers');
          } catch (err) {
            throw new Error(
              "embedding backend 'local-onnx' needs the optional '@huggingface/transformers' package — run: npm install @huggingface/transformers",
            );
          }
        }
        return lib.pipeline('feature-extraction', model);
      })();
    }
    return extractorPromise;
  }

  return {
    modelId: model,
    get dim() { return resolvedDim; },
    async embed(texts) {
      if (!Array.isArray(texts)) throw new Error('embed(texts) expects an array of strings');
      if (texts.length === 0) return [];
      const extractor = await getExtractor();
      const out = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const tensor = await extractor(batch, { pooling: 'mean', normalize: true });
        const rows = tensor.tolist(); // [batch][dim], already L2-normalized
        for (const v of rows) out.push(v);
      }
      if (resolvedDim == null && out[0]) resolvedDim = out[0].length;
      return out;
    },
  };
}

function createHttpEmbeddingProvider(cfg, { fetchImpl } = {}) {
  const fetchFn = fetchImpl || globalThis.fetch;
  if (!cfg.url) throw new Error('http embedding provider requires a url (EMBEDDING_URL)');
  const url = cfg.url;
  const modelId = cfg.model || '';
  const headers = authHeaders(cfg);
  const batchSize = cfg.batchSize ?? DEFAULT_BATCH;
  const opts = { timeoutMs: cfg.timeoutMs, retries: cfg.retries };
  // dim may be known from config up front, else learned from the first response
  // (and part of the index version — a change invalidates stored vectors).
  let resolvedDim = cfg.dim ?? null;

  return {
    modelId,
    get dim() { return resolvedDim; },
    async embed(texts) {
      if (!Array.isArray(texts)) throw new Error('embed(texts) expects an array of strings');
      if (texts.length === 0) return [];
      const out = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const data = await postJson(fetchFn, url, { texts: batch, model: modelId }, headers, opts);
        const embeddings = data && data.embeddings;
        if (!Array.isArray(embeddings)) throw new Error('embedding response missing "embeddings" array');
        if (embeddings.length !== batch.length) {
          throw new Error(`embedding count mismatch: sent ${batch.length}, got ${embeddings.length}`);
        }
        if (resolvedDim == null && Number.isInteger(data.dim)) resolvedDim = data.dim;
        for (const vec of embeddings) out.push(l2normalize(vec));
      }
      if (resolvedDim == null && out[0]) resolvedDim = out[0].length;
      return out;
    },
  };
}

export default { createEmbeddingProvider };
