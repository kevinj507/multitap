// SearchService — the single entry point both callers use (#173 §11 "two
// callers, one pipeline"): the route (POST /api/graphs/:gid/search, progressive
// UI) and the eval harness both go through here, so what ships is exactly what
// we measure. It does two jobs the pure pipeline deliberately doesn't:
//
//   1. ASSEMBLY — map a declarative config (config.js) to concrete stage
//      instances (the registry below) and build a SearchPipeline. This is the
//      ports-&-adapters seam: dense/rerank/graphExpand slot into the registry
//      in later phases with no change to the pipeline executor.
//   2. CORPUS IO — load the graph's nodes from Postgres when the caller didn't
//      already supply a corpus (the eval supplies its own in-memory fixture).
//
// Providers (EmbeddingProvider/RerankProvider) are injected here in P2.1; for
// P2.0 only the lexical retriever exists and dense is skipped if requested.

import { validateConfig } from './config.js';
import { getJoiner } from './fusion.js';
import { SearchPipeline } from './pipeline.js';
import { createLexicalRetriever } from './retrievers/lexical.js';
import { createDenseRetriever, createStoreDenseRetriever } from './retrievers/dense.js';
import { createEmbeddingProvider } from './providers/embedding.js';
import { createRerankProvider } from './providers/rerank.js';
import { createReranker } from './postprocessors/rerank.js';
import { createQueryRewriter } from './queryRewrite.js';
import { createGraphExpander } from './postprocessors/graphExpand.js';
import { parseMarkdown } from '../markdown.js';

// Stage registry. Each entry is a factory (deps, config) => instance | null.
// Returning null means "not available / not configured" — the assembler drops
// it and the pipeline degrades to the remaining stages (lexical always answers).
const RETRIEVER_FACTORIES = {
  lexical: (deps, config) => createLexicalRetriever({ ranker: config?.lexical?.ranker }),
  // Dense needs an EmbeddingProvider; with backend `none` (or unconfigured) the
  // provider is null → dense drops → lexical-only. With a pool the store-backed
  // form runs (ANN over task_chunks, embedded at write time by the indexer) and
  // itself falls back to the in-memory leg (chunk ctx.corpus → embed → cosine)
  // where ANN can't apply — caller-supplied corpus, no pgvector, empty store.
  dense: (deps, config) => {
    if (!deps.embeddingProvider) return null;
    // Query-side instruction prefix (#224) — applied to the query only, never
    // to indexed chunks, so toggling it requires no reindex.
    const queryPrefix = config?.providers?.embedding?.queryPrefix || '';
    return deps.pool
      ? createStoreDenseRetriever({
          pool: deps.pool,
          provider: deps.embeddingProvider,
          queryPrefix,
          // #226: ANN chunk-pool size, decoupled from the node top-K.
          ...(config?.dense?.chunkTopK ? { chunkTopK: config.dense.chunkTopK } : {}),
        })
      : createDenseRetriever({ provider: deps.embeddingProvider, queryPrefix });
  },
};

const POSTPROCESSOR_FACTORIES = {
  // Phase 3 recall lever — k-hop BFS over `edges` (SQL/in-memory, no model).
  // Unlike rerank it has no provider to gate on: it runs whenever an edge
  // source exists (deps.pool+gid on the route, ctx.edges in eval/tests) and is
  // a graceful no-op otherwise, so the factory always returns the stage.
  graphExpand: (deps, config) => createGraphExpander({ pool: deps.pool, ...(config.graphExpand || {}) }),
  // Tier 2 cross-encoder. Needs a RerankProvider; with backend `none` (or
  // unconfigured) the provider is null → rerank drops and the fused order
  // stands (graceful). topM caps how many fused hits get scored (cost knob).
  rerank: (deps, config) => {
    if (!deps.rerankProvider) return null;
    return createReranker({
      provider: deps.rerankProvider,
      topM: config.providers?.rerank?.topM,
      maxChars: config.providers?.rerank?.maxChars,
      input: config.providers?.rerank?.input,
    });
  },
};

/**
 * Build a SearchPipeline from a validated config. Unknown-but-registered
 * stages that a phase hasn't implemented yet resolve to null and are dropped
 * (graceful), so a config naming `dense` today simply runs lexical-only.
 *
 * @param {Object} config validated config (see config.js)
 * @param {Object} [deps] injected dependencies (pool, providers — later phases)
 * @returns {SearchPipeline}
 */
export function assemblePipeline(config, deps = {}) {
  // Adapters from config: build the embedding provider once and inject it so
  // the dense factory (and later the rerank postprocessor) just consume it.
  // A caller can pre-supply deps.embeddingProvider (tests inject a fake one).
  const stageDeps = {
    ...deps,
    embeddingProvider: deps.embeddingProvider ?? createEmbeddingProvider(config.providers?.embedding || {}, deps),
    rerankProvider: deps.rerankProvider ?? createRerankProvider(config.providers?.rerank || {}, deps),
  };

  const retrievers = config.retrievers
    .map((name) => (RETRIEVER_FACTORIES[name] ? RETRIEVER_FACTORIES[name](stageDeps, config) : null))
    .filter(Boolean);
  if (retrievers.length === 0) {
    // Never leave the pipeline legless: lexical is the always-on floor.
    retrievers.push(createLexicalRetriever({ ranker: config?.lexical?.ranker }));
  }

  const postprocessors = config.postprocessors
    .map((name) => (POSTPROCESSOR_FACTORIES[name] ? POSTPROCESSOR_FACTORIES[name](stageDeps, config) : null))
    .filter(Boolean);

  return new SearchPipeline({
    retrievers,
    joiner: getJoiner(config.fusion.mode),
    fusionOpts: { k: config.fusion.k },
    postprocessors,
    topK: config.topK,
  });
}

/**
 * Load a graph's nodes as the search corpus. Parses the markdown blob into the
 * {id,title,description,body,createdAt} shape the lexical ranker expects —
 * reusing src/markdown.js so frontmatter parsing matches the rest of the app.
 */
export async function loadCorpus(pool, gid) {
  // One graph or a set of graphs (cross-graph search). Docs carry `gid` so
  // multi-graph callers can attribute each hit back to its graph.
  const gids = Array.isArray(gid) ? gid : [gid];
  const { rows } = await pool.query(
    'SELECT id, graph_id, content, created_at FROM tasks WHERE graph_id = ANY($1)',
    [gids],
  );
  return rows.map((row) => {
    const { meta, body } = parseMarkdown(row.content || '');
    return {
      id: row.id,
      gid: row.graph_id,
      title: meta.title != null ? String(meta.title) : '',
      description: meta.description != null ? String(meta.description) : '',
      body: body || '',
      createdAt: row.created_at,
    };
  });
}

export class SearchService {
  /**
   * @param {{ config?: Object, pool?: Object, deps?: Object }} [opts]
   */
  constructor({ config, pool, deps = {} } = {}) {
    const { config: validated, errors } = validateConfig(config);
    if (errors.length) {
      const err = new Error(`invalid search config: ${errors.join('; ')}`);
      err.status = 400;
      err.errors = errors;
      throw err;
    }
    this.config = validated;
    this.pool = pool;
    // Providers are created here (not buried in assemblePipeline) and exposed
    // so the route can POOL them into ad-hoc per-request services — a local-onnx
    // provider holds an ONNX model in process memory, and a second copy OOMs
    // the box (#436 incident). Callers may still pre-supply either via deps.
    this.providers = {
      embedding: deps.embeddingProvider ?? createEmbeddingProvider(validated.providers?.embedding || {}, deps),
      rerank: deps.rerankProvider ?? createRerankProvider(validated.providers?.rerank || {}, deps),
    };
    // Optional pre-retrieval query rewriter (#436/E11). null unless configured.
    // Tests/eval inject deps.queryRewriter; production builds it from config.
    this.queryRewriter = deps.queryRewriter ?? createQueryRewriter(validated.queryRewrite || {}, deps);
    this.pipeline = assemblePipeline(validated, {
      pool,
      ...deps,
      embeddingProvider: this.providers.embedding,
      rerankProvider: this.providers.rerank,
    });
  }

  /**
   * Run a search. Corpus resolution order: explicit ctx.corpus (eval / tests)
   * → load from PG by gid (route). Returns the pipeline's
   * { candidates, timings } unchanged so both callers see per-stage latency.
   */
  async search(query, ctx = {}) {
    // Pre-retrieval rewrite (#436/E11): the rewritten query drives the lexical +
    // dense legs; the ORIGINAL is kept on ctx.rawQuery so any caller that wants
    // to highlight against what the user typed still can. Rewriting never throws
    // (it falls back to the raw query), so this is safe to always await.
    const rawQuery = query;
    if (this.queryRewriter && typeof query === 'string' && query.trim()) {
      query = await this.queryRewriter.rewrite(query);
    }
    ctx = { ...ctx, rawQuery: ctx.rawQuery ?? rawQuery };
    let corpus = ctx.corpus;
    // corpusFromStore tells the dense retriever whether ANN over task_chunks
    // ranks the SAME documents the caller is searching. A caller-supplied
    // corpus (eval fixture, tests) must be ranked in-memory, never against
    // live store rows.
    let corpusFromStore = false;
    if (!corpus) {
      const scope = ctx.gids && ctx.gids.length ? ctx.gids : ctx.gid;
      if (!this.pool || !scope) {
        throw new Error('SearchService.search needs either ctx.corpus or (pool + ctx.gid/gids)');
      }
      corpus = await loadCorpus(this.pool, scope);
      corpusFromStore = true;
    }
    return this.pipeline.run(query, { ...ctx, corpus, corpusFromStore });
  }
}

export default { SearchService, assemblePipeline, loadCorpus };
