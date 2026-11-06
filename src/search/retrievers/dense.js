// DenseRetriever (Tier 1) — the semantic leg, implementing the Retriever port
// (graph task #190, P2.2). Two forms behind the same `dense` stage name:
//
//   • createDenseRetriever — IN-MEMORY: chunk ctx.corpus, embed, rank by
//     cosine. The eval's form (#173 §10: "embed in-memory → cosine → RRF →
//     metrics, so it isolates the model") and the fallback wherever the
//     pgvector store can't run.
//   • createStoreDenseRetriever — PRODUCTION: embed the query only, ANN over
//     the pre-embedded `task_chunks` rows (store.js), scoped to ctx.gid. The
//     corpus was embedded at WRITE time by the indexer; a search embeds ONE
//     string instead of the whole graph.
//
// Both: one node → many chunk-vectors → collapse back to the node by MAX-POOL
// (a node is as relevant as its strongest passage, #190), carrying that passage
// as the snippet. Output is ordered strongest-first so fusion (RRF) reads it by
// position, same as the lexical leg.

import { chunkParts } from '../chunking.js';
import { makeCandidate } from '../types.js';
import { chunkStoreAvailable, annSearchChunks } from '../store.js';

const DEFAULT_TOPK = 50; // #173 §10: dense top-k 50 (collapsed nodes)

// Cosine == dot product because the provider returns L2-normalized vectors.
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * @param {{provider: import('../types.js').EmbeddingProvider, topK?:number,
 *          chunkOpts?:Object, queryPrefix?:string}} opts
 *   queryPrefix — instruction prepended to the QUERY before embedding, never to
 *   chunks (bge-*-v1.5 was trained with a query-side instruction for short
 *   query→passage retrieval; passages stay instruction-free). #224.
 * @returns {import('../types.js').Retriever}
 */
export function createDenseRetriever({ provider, topK = DEFAULT_TOPK, chunkOpts = {}, queryPrefix = '' } = {}) {
  if (!provider) throw new Error('createDenseRetriever needs an EmbeddingProvider');

  // Embedding the corpus is the expensive step; the eval runs many queries over
  // the SAME corpus object, so cache the built index per corpus reference. A
  // WeakMap keyed on the corpus array means no re-embed across queries and no
  // leak across graphs. We cache the in-flight Promise so concurrent queries
  // share one build.
  const indexCache = new WeakMap();

  async function buildIndex(corpus) {
    const chunks = []; // { taskId, text }
    for (const doc of corpus) {
      const parts = chunkParts(
        { title: doc.title, description: doc.description, body: doc.body },
        chunkOpts,
      );
      for (const c of parts) chunks.push({ taskId: doc.id, text: c.text, embedText: c.embedText });
    }
    if (chunks.length === 0) return { chunks: [], vectors: [] };
    const vectors = await provider.embed(chunks.map((c) => c.embedText));
    return { chunks, vectors };
  }

  function getIndex(corpus) {
    let idx = indexCache.get(corpus);
    if (!idx) {
      idx = buildIndex(corpus);
      indexCache.set(corpus, idx);
    }
    return idx;
  }

  return {
    name: 'dense',
    async retrieve(query, ctx = {}) {
      const corpus = ctx.corpus || [];
      if (corpus.length === 0) return [];
      const { chunks, vectors } = await getIndex(corpus);
      if (chunks.length === 0) return [];

      const [qvec] = await provider.embed([queryPrefix + query]);
      // Zero-norm guard: the static backend returns exact zeros for a
      // zero-token query (e.g. only zero-width chars) — cosine against a
      // zero vector is meaningless, so the dense leg abstains.
      if (!qvec || !qvec.some((x) => x !== 0)) return [];

      // Score every chunk, collapse to nodes by max-pool, keeping the winning
      // passage as the snippet.
      const best = new Map(); // taskId -> { score, text }
      for (let i = 0; i < chunks.length; i++) {
        const score = dot(qvec, vectors[i]);
        const cur = best.get(chunks[i].taskId);
        if (!cur || score > cur.score) best.set(chunks[i].taskId, { score, text: chunks[i].text });
      }

      const limit = ctx.denseTopK ?? topK;
      return [...best.entries()]
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, limit)
        .map(([taskId, { score, text }]) =>
          makeCandidate(taskId, score, 'dense', {
            snippet: { text, ranges: [] },
            meta: { similarity: score, distance: 1 - score },
          }),
        );
    },
  };
}

/**
 * The pgvector-backed form (#190 query path): embed query → ANN over
 * `task_chunks` (WHERE graph_id, top `chunkTopK` CHUNKS — counted in chunks,
 * deliberately ≥ node top-K so one chunk-heavy node can't crowd others out) →
 * collapse by task_id, max-pool → Candidate[] carrying the winning passage.
 *
 * Falls back to the in-memory leg when ANN can't or shouldn't run:
 *   • no ctx.gid, or the caller supplied its own corpus (the eval's frozen
 *     fixture must not be ranked against live store rows);
 *   • `task_chunks` absent — Postgres without pgvector (checked once);
 *   • the store has no rows for this graph yet (indexer still backfilling) —
 *     slower but correct beats silently empty.
 *
 * @param {{pool:Object, provider: import('../types.js').EmbeddingProvider,
 *          topK?:number, chunkTopK?:number, chunkOpts?:Object, queryPrefix?:string}} opts
 * @returns {import('../types.js').Retriever}
 */
export function createStoreDenseRetriever({ pool, provider, topK = DEFAULT_TOPK, chunkTopK = DEFAULT_TOPK, chunkOpts = {}, queryPrefix = '' } = {}) {
  if (!pool) throw new Error('createStoreDenseRetriever needs a pool');
  // The in-memory fallback gets the same prefix; both paths receive the RAW
  // query and prepend exactly once.
  const memory = createDenseRetriever({ provider, topK, chunkOpts, queryPrefix });
  let availablePromise = null; // table existence can't change mid-process; check once

  return {
    name: 'dense',
    async retrieve(query, ctx = {}) {
      // Scope: one graph (ctx.gid) or a set (ctx.gids — cross-graph search).
      const scope = ctx.gids && ctx.gids.length ? ctx.gids : ctx.gid;
      const eligible = scope && ctx.corpusFromStore === true;
      if (!eligible) return memory.retrieve(query, ctx);
      if (!availablePromise) availablePromise = chunkStoreAvailable(pool);
      if (!(await availablePromise)) return memory.retrieve(query, ctx);

      const [qvec] = await provider.embed([queryPrefix + query]);
      // Zero-norm guard: the static backend returns exact zeros for a
      // zero-token query (e.g. only zero-width chars) — cosine against a
      // zero vector is meaningless, so the dense leg abstains.
      if (!qvec || !qvec.some((x) => x !== 0)) return [];

      const rows = await annSearchChunks(pool, {
        vector: qvec,
        gid: scope,
        modelId: provider.modelId,
        limit: ctx.denseTopK ?? chunkTopK,
      });
      if (rows.length === 0) return memory.retrieve(query, ctx);

      // Rows arrive nearest-first; the first chunk seen per task IS its
      // max-pool winner. similarity = 1 - cosine distance.
      const out = [];
      const seen = new Set();
      for (const row of rows) {
        if (seen.has(row.task_id)) continue;
        seen.add(row.task_id);
        const distance = Number(row.distance);
        const score = 1 - distance;
        out.push(
          makeCandidate(row.task_id, score, 'dense', {
            snippet: { text: row.chunk_text, ranges: [] },
            meta: { similarity: score, distance },
          }),
        );
        if (out.length >= topK) break;
      }
      return out;
    },
  };
}

export default { createDenseRetriever, createStoreDenseRetriever };
