// Search pipeline — port definitions (interfaces) for the composable spine.
// graph task #189 (P2.0); architecture in #173 §11, configs in §10.
//
// These are JSDoc typedefs, not runtime classes: the project ships ESM with no
// build step and no TypeScript, so the "interface" is a documented duck-typed
// shape plus a couple of pure constructors. Every concrete retriever / joiner /
// postprocessor / provider implements one of the shapes below. The pipeline
// (pipeline.js) depends ONLY on these shapes; concrete backends are injected by
// the assembler (service.js) from config — ports & adapters / hexagonal.
//
// The whole point of pinning the ports now, in P2.0, is that the Phase-3
// stages (cross-encoder Reranker, k-hop GraphExpander) and the Phase-2 Dense
// retriever drop in without reshaping anything here.

/**
 * One retrieved/ranked result. The single currency the pipeline passes between
 * stages. `taskId` identifies the graph node; `score` is informational at the
 * candidate level (fusion re-ranks by POSITION, not by this score — see
 * fusion.js), `source` names the retriever/stage that produced or last touched
 * it, `snippet` is the optional highlight payload from the lexical leg, and
 * `meta` carries stage-specific extras (field/freq/tier for lexical, distance
 * for dense, rerank logit later).
 *
 * @typedef {Object} Candidate
 * @property {number|string} taskId
 * @property {number} score
 * @property {string} source
 * @property {{text:string, ranges:Array<[number,number]>}} [snippet]
 * @property {Object} [meta]
 */

/**
 * Per-search context handed to every stage. The corpus rides HERE (not loaded
 * by the retriever) so the same LexicalRetriever runs against an in-memory
 * fixture corpus in the eval harness and against PG-loaded rows in the route —
 * one pipeline, no drift (#173 §11 "two callers, one pipeline").
 *
 * @typedef {Object} SearchContext
 * @property {string} [gid] graph id (route caller)
 * @property {Array<Doc>} [corpus] candidate documents (both callers populate this)
 * @property {Object} [user] authenticated user, for access-scoped retrievers (cross-graph, later)
 * @property {number} [lexicalTopK] per-retriever candidate cap override
 * @property {number} [denseTopK]
 */

/**
 * A document in the corpus — the shape the lexical ranker expects.
 * @typedef {Object} Doc
 * @property {number|string} id
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [body]
 * @property {string|number} [createdAt]
 */

/**
 * Retriever port — parallel candidate generation.
 * @typedef {Object} Retriever
 * @property {string} name
 * @property {(query:string, ctx:SearchContext) => (Candidate[] | Promise<Candidate[]>)} retrieve
 */

/**
 * Joiner port — fuses N ranked candidate lists into one. Strategy swappable
 * (default RRF k=60), mirroring Haystack's DocumentJoiner join_mode.
 * @typedef {Object} Joiner
 * @property {string} name
 * @property {(lists:Candidate[][], opts?:Object) => Candidate[]} fuse
 */

/**
 * Postprocessor port — ordered transforms over the fused list (LlamaIndex
 * node-postprocessor pattern). GraphExpander (+graph) and Reranker (Tier 2)
 * are Phase 3; their interface is this shape.
 * @typedef {Object} Postprocessor
 * @property {string} name
 * @property {(query:string, candidates:Candidate[], ctx:SearchContext) => (Candidate[] | Promise<Candidate[]>)} postprocess
 */

/**
 * EmbeddingProvider port — Tier 1 dense leg's model backend (P2.1). One HTTP
 * contract covers both local TEI and Modal; `none` disables the dense stage.
 * @typedef {Object} EmbeddingProvider
 * @property {string} modelId  part of the index version; changing it invalidates stored vectors
 * @property {number} dim
 * @property {(texts:string[]) => Promise<number[][]>} embed  batched, L2-normalized
 */

/**
 * RerankProvider port — Tier 2 cross-encoder backend (P2.1 interface; used in
 * Phase 3). Same none/local/modal/api swap as embeddings.
 * @typedef {Object} RerankProvider
 * @property {string} modelId
 * @property {(query:string, docs:string[]) => Promise<number[]>} rerank
 */

/** Stable candidate constructor so every stage emits the same shape. */
export function makeCandidate(taskId, score, source, extra = {}) {
  return { taskId, score, source, ...extra };
}

/** Known stage names — the assembler's registry keys; config validates
 *  against these so a typo is a clear error, not a silently-dropped stage. */
export const RETRIEVERS = Object.freeze(['lexical', 'dense']);
export const POSTPROCESSORS = Object.freeze(['graphExpand', 'rerank']);
export const FUSION_MODES = Object.freeze(['rrf', 'merge', 'concat']);
export const PROVIDER_BACKENDS = Object.freeze(['none', 'http', 'local-onnx', 'local', 'modal', 'api', 'static']);
// Edge types the graphExpander may traverse — mirrors edges.js VALID_TYPES so
// config can restrict expansion to a subset and validate against the real set.
export const EDGE_TYPES = Object.freeze(['dependency', 'related']);

export default { makeCandidate, RETRIEVERS, POSTPROCESSORS, FUSION_MODES, PROVIDER_BACKENDS, EDGE_TYPES };
