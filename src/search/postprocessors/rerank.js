// Reranker postprocessor — Tier 2, the "single biggest accuracy lever" (#173
// §2/§11). Runs AFTER fusion, BEFORE the final top-K: it takes the top-M fused
// candidates, scores each (query, document) pair with a cross-encoder
// (RerankProvider — local-onnx in-process or http/Modal), and re-sorts by that
// score. The cross-encoder reads query+doc JOINTLY, which is why it beats the
// bi-encoder dense ranking on precision — at the cost of per-query compute, so
// we only rerank the top M (20–50), never the whole list.
//
// Graceful by construction: the pipeline already wraps postprocess() so a throw
// (provider down / cold-start timeout) leaves the fused order untouched. We also
// pull document text from ctx.corpus (the same corpus every stage shares), so
// reranking scores the real node text, not just the lexical snippet.

const DEFAULT_TOP_M = 50; // rerank this many fused hits; the tail passes through
// Cap doc text sent to the cross-encoder. 512 is the #198 sweet spot: sequence
// length dominates latency (2000→512 chars ≈ 3-8× faster) and the title+lead
// carries the relevance signal, so accuracy holds. Raise via RERANK_MAXCHARS
// for corpora where the signal sits deep in long bodies.
const DEFAULT_MAX_CHARS = 512;

/**
 * @param {{provider:import('../types.js').RerankProvider, topM?:number, maxChars?:number,
 *          input?:'head'|'chunk'|'chunkdesc'}} opts
 *   input (#227) — what the cross-encoder reads per candidate:
 *     head      (default) title+description+body, truncated at maxChars — the
 *               doc HEAD; a match deep in a long node may be judged on text
 *               that lacks the evidence.
 *     chunk     title + the candidate's winning passage (dense max-pool chunk
 *               or lexical match window); falls back to description/body head
 *               when a candidate carries no snippet (e.g. graph-expanded).
 *     chunkdesc chunk mode with the description always included.
 *     auto      head when the whole doc fits within maxChars (truncation
 *               loses nothing), chunk when it would be cut — so short notes
 *               keep full context and long notes keep their evidence.
 * @returns {import('../types.js').Postprocessor}
 */
export function createReranker({ provider, topM = DEFAULT_TOP_M, maxChars = DEFAULT_MAX_CHARS, input = 'head' } = {}) {
  if (!provider) throw new Error('createReranker needs a RerankProvider');
  const mode = ['chunk', 'chunkdesc', 'auto'].includes(input) ? input : 'head';

  return {
    name: 'rerank',
    async postprocess(query, candidates, ctx = {}) {
      if (!Array.isArray(candidates) || candidates.length === 0) return candidates;

      // taskId → document, from the shared corpus. Fall back to the
      // candidate's snippet, then empty, so a missing doc never throws.
      const docById = new Map();
      for (const doc of ctx.corpus || []) docById.set(String(doc.id), doc);
      const docTextFor = (c) => {
        const doc = docById.get(String(c.taskId));
        let t;
        if (!doc) {
          t = (c.snippet && c.snippet.text) || '';
        } else {
          const headText = [doc.title, doc.description, doc.body].filter(Boolean).join('\n');
          const useChunk = mode === 'chunk' || mode === 'chunkdesc'
            || (mode === 'auto' && headText.length > maxChars);
          if (useChunk) {
            // The evidence the retriever actually matched, headed by the title
            // so the cross-encoder keeps the topical anchor (#227).
            const snippet = c.snippet && c.snippet.text;
            const evidence = snippet || doc.description || doc.body || '';
            const desc = mode === 'chunkdesc' && doc.description !== evidence ? doc.description : null;
            t = [doc.title, desc, evidence].filter(Boolean).join('\n');
          } else {
            t = headText;
          }
        }
        return t.length > maxChars ? t.slice(0, maxChars) : t;
      };

      const head = candidates.slice(0, topM);
      const tail = candidates.slice(topM);
      const scores = await provider.rerank(query, head.map(docTextFor));
      if (!Array.isArray(scores) || scores.length !== head.length) {
        // Defensive: a malformed provider response leaves order unchanged.
        return candidates;
      }

      const reranked = head
        .map((c, i) => ({
          ...c,
          score: scores[i],
          source: 'rerank',
          meta: { ...(c.meta || {}), rerankScore: scores[i], rerankedFrom: c.source },
        }))
        .sort((a, b) => b.score - a.score);

      return [...reranked, ...tail];
    },
  };
}

export default { createReranker };
