// RerankProvider adapters — Tier 2 cross-encoder backend (graph task #194, P2.1;
// contract in #173 §10). The interface ships now so it can be injected; the
// Reranker POSTPROCESSOR that consumes it is Phase 3. Same none/http swap and
// same auth-by-credential rule as the embedding provider — one HTTP contract,
// local TEI and Modal differ only by url/model/auth.

import { authHeaders, postJson } from './http.js';

const HTTP_BACKENDS = new Set(['http', 'local', 'modal', 'api']);

// Permissively-licensed cross-encoder, ONNX build for in-process use (#173 §2
// "LICENSE WATCH: Jina rerankers are CC-BY-NC; bge/MS-MARCO are permissive").
// Default = ms-marco-TinyBERT-L-2-v2 @ q8: the #198 sweep found it ~4× lighter
// than MiniLM-L-2 at tied accuracy. Paired with maxChars=512 it reranks the
// top-20 in ~62ms on ONE CPU core (vs ~940ms for MiniLM-L-2 @ 2000 chars) —
// accuracy a wash on our eval. MiniLM-L-2 is the slightly-stronger fallback
// (RERANK_MODEL); the big bge-reranker-v2-m3 is the Modal/GPU `http` track.
const DEFAULT_ONNX_RERANKER = 'Xenova/ms-marco-TinyBERT-L-2-v2';
const DEFAULT_ONNX_DTYPE = 'q8'; // int8 — same accuracy as fp32 in the bake-off, ~1.5x faster

/**
 * @param {{backend?:string, url?:string, model?:string, token?:string,
 *          modalKey?:string, modalSecret?:string,
 *          timeoutMs?:number, retries?:number}} [cfg]
 * @param {{fetchImpl?:Function, transformers?:Object}} [deps]
 * @returns {import('../types.js').RerankProvider | null}
 */
export function createRerankProvider(cfg = {}, deps = {}) {
  const backend = cfg.backend || 'none';
  if (backend === 'none') return null;
  if (HTTP_BACKENDS.has(backend)) return createHttpRerankProvider(cfg, deps);
  if (backend === 'local-onnx') return createLocalOnnxRerankProvider(cfg, deps);
  throw new Error(`unknown rerank backend "${backend}"`);
}

// In-process cross-encoder via @huggingface/transformers (ONNX) — the zero-
// service local track, mirroring the local-onnx EMBEDDING provider. A
// cross-encoder scores (query, doc) PAIRS jointly (vs the bi-encoder's separate
// encodings), so we tokenize with text_pair and read the single regression
// logit → sigmoid → [0,1]. @huggingface/transformers is an OPTIONAL dep
// (imported lazily) so http/none users don't pay for onnxruntime.
const DEFAULT_RERANK_BATCH = 8; // bound cross-encoder activation memory (long docs OOM in one shot)

function createLocalOnnxRerankProvider(cfg, { transformers } = {}) {
  const model = cfg.model || DEFAULT_ONNX_RERANKER;
  const batchSize = cfg.batchSize ?? DEFAULT_RERANK_BATCH;
  // dtype selects the ONNX weights variant: 'q8' (int8, the default) measured
  // identical eval accuracy to 'fp32' in the #198 bake-off at ~1.5x the speed.
  // Override per deployment (RERANK_DTYPE) — e.g. 'fp32' if a model lacks q8
  // weights. Only applies to local-onnx; the http/GPU track is unaffected.
  const dtype = cfg.dtype ?? DEFAULT_ONNX_DTYPE;
  let modelPromise = null;

  async function getModel() {
    if (!modelPromise) {
      modelPromise = (async () => {
        let lib = transformers;
        if (!lib) {
          try {
            lib = await import('@huggingface/transformers');
          } catch (err) {
            throw new Error(
              "rerank backend 'local-onnx' needs the optional '@huggingface/transformers' package — run: npm install @huggingface/transformers",
            );
          }
        }
        const modelOpts = dtype ? { dtype } : {};
        const [tokenizer, seqModel] = await Promise.all([
          lib.AutoTokenizer.from_pretrained(model),
          lib.AutoModelForSequenceClassification.from_pretrained(model, modelOpts),
        ]);
        return { tokenizer, seqModel };
      })();
    }
    return modelPromise;
  }

  return {
    modelId: model,
    async rerank(query, docs) {
      if (typeof query !== 'string') throw new Error('rerank(query, docs) expects a string query');
      if (!Array.isArray(docs)) throw new Error('rerank(query, docs) expects an array of documents');
      if (docs.length === 0) return [];
      const { tokenizer, seqModel } = await getModel();
      const out = [];
      // Batched cross-encoder passes. The query repeats as the first segment,
      // each doc is the text_pair second segment. Small batches keep peak
      // activation memory bounded — a single pass over many long docs OOMs.
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        const inputs = tokenizer(new Array(batch.length).fill(query), {
          text_pair: batch,
          padding: true,
          truncation: true,
        });
        const { logits } = await seqModel(inputs);
        // bge-reranker is single-logit regression; sigmoid → [0,1] relevance.
        for (const row of logits.tolist()) {
          const x = Array.isArray(row) ? row[0] : row;
          out.push(1 / (1 + Math.exp(-x)));
        }
      }
      return out;
    },
  };
}

function createHttpRerankProvider(cfg, { fetchImpl } = {}) {
  const fetchFn = fetchImpl || globalThis.fetch;
  if (!cfg.url) throw new Error('http rerank provider requires a url (RERANK_URL)');
  const url = cfg.url;
  const modelId = cfg.model || '';
  const headers = authHeaders(cfg);
  const opts = { timeoutMs: cfg.timeoutMs, retries: cfg.retries };

  return {
    modelId,
    async rerank(query, docs) {
      if (typeof query !== 'string') throw new Error('rerank(query, docs) expects a string query');
      if (!Array.isArray(docs)) throw new Error('rerank(query, docs) expects an array of documents');
      if (docs.length === 0) return [];
      const data = await postJson(fetchFn, url, { query, documents: docs, model: modelId }, headers, opts);
      const scores = data && data.scores;
      if (!Array.isArray(scores)) throw new Error('rerank response missing "scores" array');
      if (scores.length !== docs.length) {
        throw new Error(`rerank score count mismatch: sent ${docs.length}, got ${scores.length}`);
      }
      return scores;
    },
  };
}

export default { createRerankProvider };
