// LexicalRetriever (Tier 0) — wraps the shared pure ranker
// public/search-lexical.js behind the Retriever port. This is the "retrofit
// Tier-0 behind the interface" step of #189: the exact ranker the browser's
// instant-search and the eval harness already use becomes a pipeline stage,
// so there is ONE lexical implementation, not three.
//
// No model, no IO, no DB — reads the corpus straight from ctx.corpus. That is
// what lets the eval run this leg in-memory against a frozen fixture while the
// route runs it against PG-loaded rows: same code, same numbers (#173 §11).

import { lexicalSearch, bm25Search } from '../../../public/search-lexical.js';
import { makeCandidate } from '../types.js';

const DEFAULT_TOPK = 50; // #173 §10: lexical top-k 50

/**
 * @param {{topK?:number, ranker?:'tiered'|'bm25'}} [opts]
 *   ranker (#228) — 'tiered' (default): the original field-tiered substring-AND
 *   ranker, shared with the instant typing preview. 'bm25': BM25F scoring
 *   (IDF + length norm + OR-with-saturation) from the same module.
 * @returns {import('../types.js').Retriever}
 */
export function createLexicalRetriever(opts = {}) {
  const baseTopK = opts.topK ?? DEFAULT_TOPK;
  const rank = opts.ranker === 'bm25' ? bm25Search : lexicalSearch;
  return {
    name: 'lexical',
    retrieve(query, ctx = {}) {
      const docs = ctx.corpus || [];
      const limit = ctx.lexicalTopK ?? baseTopK;
      const hits = rank(query, docs, { limit });
      // Preserve the ranker's order (fusion reads POSITION, not score). `score`
      // is informational; carry freq so a single-retriever debug view is
      // still legible, and pass the snippet + field/tier through as meta.
      return hits.map((h) =>
        makeCandidate(h.id, h.freq, 'lexical', {
          snippet: h.snippet,
          meta: { field: h.field, tier: h.tier, freq: h.freq },
        }),
      );
    },
  };
}

export default { createLexicalRetriever };
