# Multitap — Knowledge-base Search (design + benchmarks)

> Hybrid lexical + dense retrieval over a graph's nodes, fused with Reciprocal Rank Fusion, optionally cross-encoder reranked, then expanded across the graph's own authored edges. Postgres-native (`pgvector` + BM25), self-hostable, progressive-enhancement by available compute.

> **How to read this doc.** This is the design record and benchmark log for Multitap's knowledge-base search — the retrieval engine behind the in-app Cmd/Ctrl+F bar and the agent `POST /api/graphs/:gid/search` / `POST /api/search` endpoints. The README's [Roadmap](../README.md#roadmap) links here instead of carrying the full R&D inline, and the canonical "what's next" task list lives in the project graph (`safqkahqnftyef4j`). This file captures the architecture, the measured trade-offs, and the references behind the shipped retrieval core.
>
> **Status:** the retrieval core is **shipped** — hybrid (lexical + dense) → RRF → optional rerank → graph expansion, per-graph + cross-graph endpoints, an embedding indexer, a metadata filter, and a boot warmup search. HippoRAG/PPR expansion, a GPU `bge-reranker` default, and autonomous ingestion remain future.

## Find / search bar (Cmd/Ctrl+F) — the front door

Shipped as graph task #172 (the UI layer), built on #171 (the search backend).

Previously, pressing Cmd/Ctrl+F triggered the *browser's* native find — which
reported "0/0" even when the word was plainly on screen, because Cytoscape
paints node labels onto a `<canvas>` and the browser only searches the DOM
text layer. That dead-end is now replaced with our own search bar that drives
the hybrid + graph search below.

- **Interception.** Intercepts the hotkey the same way Cmd/Ctrl+K opens graph
  settings (`public/app.js` global keydown handler, Cmd+K branch ~line 8637). A
  sibling branch for `e.key === 'f'` `preventDefault()`s the native find and
  calls `openSearchBar()` (~line 8646). No conflict with the bare `f` graph
  hotkey (zoom-to-fit, `handleGraphKeydown`) — that one carries no modifier.
- **Cmd+F just shows a text input bar.** Pressing **Enter triggers our search
  mechanism** — the lexical (BM25) + vector (hybrid) + graph pipeline in
  [Knowledge-base search](#knowledge-base-search-across-graphs) below. Enter
  *runs* the search; it is not a live filter.
- **Results.** A ranked list from the search backend; ↑/↓ (or Enter /
  Shift+Enter) walk the results; the active result selects + centers its node on
  the graph (`cy`). Esc closes the bar and restores prior selection.
- **Optional instant preview.** While typing, *before* Enter, we may show a
  zero-latency local preview over the current graph's already-loaded nodes —
  lexical substring over **title / description / body**, tiered by field (title
  hits first, then description, then body; within a tier order by match
  frequency, newest-first tie-break; a node ranks by its strongest field only).
  This local leg is the same matcher the backend's BM25 stage formalizes — the
  Enter-triggered query is cross-graph, hybrid, and graph-expanded.

## Knowledge-base search across graphs

Each node body is a piece of markdown that evolves with the work, so a
long-lived graph already functions as a notebook — but without search the only
way to find "the node about X" is to know the gid and `GET` it. The search layer
makes graphs a queryable knowledge base, both for humans ("where did I write
about cookie storage?") and agents ("read what this user already knows about
auth before planning").

### Architecture — decided (tracked as graph task #171)

Build our own hybrid + graph search on Postgres, taking the best concepts from
the field rather than adopting any one framework. Postgres *is* best-in-class at
our scale — on one condition: don't use vanilla full-text.

- **Retrieval recipe (this drives accuracy; it's store-agnostic).**
  Lexical (BM25) + dense (vector) candidate generation, top ~100 each → fuse
  with **Reciprocal Rank Fusion (RRF, k=60)** (rank-based, no score
  normalization) → *(optional)* **cross-encoder rerank** the top 20–50 →
  **graph expansion**: seed from the hits, then traverse our existing `edges`
  (k-hop, or Personalized PageRank à la HippoRAG) for multi-hop concepts. Get
  recall@50 solid *before* layering the reranker — a reranker can only reorder
  what retrieval already found (it can't fix a retrieval miss; **graph
  expansion** can). Rerank is **off by default** for our flows (see [How search
  is used](#how-search-is-used) below); graph expansion is the higher-value next
  layer.
- **Storage (Postgres-native — free + self-hostable).**
  - **Dense:** `pgvector` (HNSW). Matches/beats Qdrant/Milvus under ~50M
    vectors; our graphs are orders smaller. Embed `tasks.content` on the
    existing `updated_at` trigger.
  - **Lexical:** real BM25, **NOT `ts_rank`.** Built-in FTS has no IDF and no
    document-length normalization — adequate, not best. Use **ParadeDB
    `pg_search`** (embeds Tantivy, a Rust Lucene; Elasticsearch-equivalent BM25
    as a native index) or VectorChord-bm25.
  - **Rerank:** a self-hosted cross-encoder (`bge-reranker-v2-m3` /
    `Qwen3-Reranker`) — the single biggest accuracy lever (reranking alone ~3×
    nDCG@10 on hard benches; ~48% end-to-end retrieval lift), ~zero marginal
    cost.
- **Why this is the *best* path, not just the easy one.** Dedicated engines
  (Qdrant / Milvus / Elasticsearch / Neo4j) only pull ahead past 50–100M vectors
  or when horizontal scale is needed — task-graphs won't hit that, and the DB is
  rarely even the bottleneck (embedding latency dominates). And our unfair
  advantage: **our data is already a graph** (authored nodes + edges), so we skip
  the expensive LLM graph-*extraction* step every framework below pays for. The
  relatedness they compute, we already have for free.
- **UI.** Cmd/Ctrl+F is the front door (see [Find / search
  bar](#find--search-bar-cmdctrlf--the-front-door) above): the bar takes a
  query, **Enter runs this pipeline.**
- **Scope.** Per-graph search (`POST /api/graphs/:gid/search`, read-gated) plus
  cross-graph "search my graphs" (`POST /api/search`, shipped): one pipeline run
  over every graph the signed-in user **owns or is a member of** — the same set
  the sidebar lists. The ownership WHERE rides into every leg (corpus load, ANN
  chunk scan via `graph_id = ANY` + `hnsw.iterative_scan=strict_order`, edge
  expansion), so nodes never leak across owners; anonymous callers get a 401.
  Results carry `graphId` + `title` and a `graphs` name map. In the bar, the
  **"All graphs" scope toggle** lights up when signed in; cross-graph hits wear a
  graph chip, and committing one switches graphs in-app, focuses the node (the
  same `?node=<id>` deep-link mechanism shareable URLs use), and applies the
  match-type highlight.
- **Indexing — both sides get embedded.** Cosine similarity needs vectors on the
  query *and* the content, so node **content is embedded at write time**
  (`tasks.content` → a `pgvector` column, on the `updated_at` trigger; hash the
  content to skip re-embedding unchanged nodes) and the **query is embedded at
  search time**. The lexical (BM25/substring) leg needs *no* embeddings — only
  the vector leg does. That asymmetry is what makes the tiers below possible.

### How search is used

Two flows — and why the *list* matters more than rank #1.

1. **Human (Cmd/Ctrl+F).** The bar opens a **results dropdown**. ↑/↓ walk the
   list; as the active result changes, its node is **focused on the graph** and
   the **side panel opens** — the same mechanism as selecting a node or watching
   an agent — but keyboard focus stays in the dropdown. **Enter / click
   commits:** the dropdown closes, the node becomes the active selection, and the
   matched span is highlighted **by how it was found** — a **lexical**
   title/keyword hit highlights the matched *word*; a **dense** hit highlights
   the matched *chunk*, and the markdown viewer **scrolls that chunk into view**
   (bodies are long; the winning chunk may sit near the bottom). The highlight is
   **transient** (fades after focus) so it guides without nagging.
2. **Agent.** An agent calls the search skill, gets the ranked list, and picks
   using its own context — no UI, no highlight. It just needs the right node
   **present** in the results.

**Consequence for ranking — we optimize recall@k, not rank-1.** Neither flow
needs the best answer at **#1**; it only needs to be **in the visible list (top
~10–20)** — the human scrolls to it, the agent reads the list. Measured on a real
graph: **no-rerank recall@20 ≈ 0.885 ≈ rerank recall@10 ≈ 0.905** — i.e. *showing
a slightly longer list matches what the reranker buys, for free and ~30×
faster.* The reranker mostly improves **rank-1 (MRR 0.74→0.90)**, which these
flows don't need. That is **why Tier-2 rerank is off by default** (next section).
A self-hoster whose flow *does* need #1 precision can flip it on.

### Deployment & self-host tiers — search is progressive enhancement

Search degrades cleanly by available compute: it runs on a laptop with zero ML
and scales up to a GPU. Each tier is an opt-in config flag; the floor needs no
models at all, so self-hosters turn on only what their hardware supports.

- **Tier 0 — Lexical** *(always on)* — BM25 / substring find. Needs only
  Postgres. Runs on any box. This is the Cmd+F floor.
- **+ Graph expansion** *(always on)* — expand hits across `edges`. SQL only,
  **no model** — so it layers onto any tier for free.
- **Tier 1 — Semantic** *(opt-in)* — vector search via `pgvector`. Needs an
  **embedding model at *both* write time (to index content) and query time**.
  Floor: a small CPU model (e5-small ~118M, ~1–2 GB RAM), or an embedding API /
  Modal. No model configured → this tier stays off and lexical still works.
- **Tier 2 — Rerank** *(opt-in, **OFF by default** — set `RERANK_BACKEND`)* —
  cross-encoder precision. It only **reorders what retrieval already found** — it
  lifts the *ranking* (the best answer to the top), not *recall* (graph
  expansion does that). It's the **precision lever**; graph expansion is the
  recall lever.

**The CPU path is viable after all — with a small model, for the agent flow.**
Two measurements (#198):

*Model + truncation sweep (`eval/rerank-bench.js`, #198):* two levers stack —
**document length dominates latency** (2000→512 chars ≈ 3–8× faster, since it's
compute-bound) and **TinyBERT-L-2 is ~4× lighter than MiniLM-L-2** at tied
accuracy. The winner is **`ms-marco-TinyBERT-L-2-v2` @ q8, docs capped at 512
chars** — it reranks the top-20 in **~62 ms on ONE CPU core** vs ~940 ms for
MiniLM-L-2 @ 2000 chars, a ~15× speedup at the same accuracy. That's the local
default. MiniLM-L-2 is a slightly-stronger, ~4× slower fallback; the big
`bge-reranker-v2-m3` is the GPU/Modal `http` track.

*Real pipeline (hybrid-at-50, `eval/hybrid-ab.js` — runs the shipped defaults;
override with the same `RERANK_*` env the app reads):* on the **production**
config — lexical(top-50)+dense(top-50)→RRF — rerank is a big precision win, and
reranking the **whole fused list** (`topM=50`, the code default) beats top-20:
same precision, more recall, ~same cost. End-to-end per-query latency, one core:

| config | precision@1 | nDCG@10 | MRR | recall@10 | recall@20 | latency p50 |
|---|---|---|---|---|---|---|
| rerank off | 0.60 | 0.762 | 0.762 | 0.823 | 0.871 | **25 ms** |
| TinyBERT-L-2, topM=20 | 0.875 | 0.883 | 0.923 | 0.859 | 0.871 | ~100 ms |
| **TinyBERT-L-2, topM=50** | **0.875** | 0.883 | 0.921 | **0.871** | **0.892** | **~90 ms** |
| **topM=50 + graphExpand** | **0.875** | **0.891** | 0.918 | **0.880** | **0.960** | ~185 ms |

Keep **`RERANK_TOPM=50`** (the default): top-20 can only reorder fused positions
1–20, so it strands relevant docs in 21–50; top-50 lifts them (recall@20
0.871→0.892) at no measurable extra cost on this corpus. And **graphExpand is NOT
a no-op with rerank on** — the earlier "expansion changed nothing" result was an
artifact of the top-20 rerank window (expanded docs landed past position 20,
where rerank couldn't lift them). With topM=50 the pair is the best config
measured: recall@20 0.960, nDCG@10 0.891, ~185 ms p50 / ~250 ms p95 end-to-end on
ONE core. Latency is compute-bound, so more vCPUs scale it further. One real cost
remains: the **first search after boot** pays lazy ONNX model load (~1.4 s) — the
server now fires a warmup search at boot so users never see it. Rerank stays
**off by default** (our flows are recall-first), but at ~90–185 ms it's cheap to
flip on for the **agent / best-single-answer** path. On our English notes the
tiny local model matched bge-reranker-v2-m3 on quality at a fraction of the cost;
bge's edge only shows on harder/multilingual corpora. Tables + method in graph
#198; earlier GPU A/B in #196.

### How the two deployments differ

- **Hosted (Wafer / fly.io):** Postgres (pgvector + BM25) runs on the Wafer.
  **Embeddings default to a local in-process model** — the eval found a small
  local model *ties* a big GPU one on accuracy **and** is faster per query, so
  Tier 1 needs no GPU (graph task #193). **Modal** (serverless GPU, scale-to-zero,
  ~free at our volume) is reserved for the jobs that genuinely need it: the
  optional Tier-2 **reranker** (where the GPU is required — see above) and bulk
  re-index acceleration. Full topology + measured costs in graph tasks #173 /
  #193 / #196.
- **Self-hosting:** the model backend is **pluggable** — choose by what you have.
  Run Tier 0 + Graph with *zero* models (fully local, no GPU); flip on Tier 1 by
  pointing at any embedding endpoint (a local `sentence-transformers` / ONNX
  model, or an API); flip on Tier 2 only if you have the CPU/GPU headroom for a
  cross-encoder. Bigger models + GPU = more accuracy; small CPU models = lighter
  but still useful. Use the eval harness below to measure exactly what accuracy
  and latency a given stack buys you before committing.

### Eval harness

The `eval/` harnesses score retrieval/rerank strategies against frozen query
sets when tuning this — `run-eval.js`, `rewrite-ab.js`, `rerank-llm.js`,
`doc2query.js`, `rerank-bench.js` (the model + truncation sweep, #198), and
`hybrid-ab.js` (the real-pipeline A/B that runs the shipped defaults). Use them
to measure exactly what accuracy and latency a given stack buys before
committing. A dedicated server-side LLM rerank is only worth it to sharpen the
**browser UI's** top-10, where no LLM is in the loop; the agent path (an LLM
already reading the candidates) doesn't need it.

### References — best-of concepts to borrow (not adopt wholesale)

- `safishamsi`'s [`graphify`](https://github.com/safishamsi/graphify)
  (Karpathy-*inspired*, not by Karpathy) — turns a folder into a queryable
  concept graph with **no embeddings/vectors**. A linear pipeline
  (`detect → extract → build_graph → cluster → analyze → report → export`) builds
  a `graph.json`: nodes are entities/concepts, edges are **confidence-tagged**
  (`EXTRACTED` = stated in source like an import or call; `INFERRED` = deduced,
  e.g. call-graph 2nd pass or co-occurrence; `AMBIGUOUS` = flagged for review).
  Concepts come from tree-sitter ASTs (code), LLM extraction (docs/papers),
  vision (images); **Leiden** community detection clusters them and emits
  per-cluster wiki articles + "god nodes" (highest-degree hubs). SHA256 cache
  rebuilds only changed files. Query time = keyword-match seed nodes → BFS the
  subgraph → hand only that to the LLM (~1,700 vs ~123,000 raw tokens). *The
  takeaway for us: relatedness encoded as explicit typed/confidence-tagged edges
  — which we already author by hand.*
- Microsoft [`graphrag`](https://github.com/microsoft/graphrag) — local search
  (seed entities → fan out k-hops) vs global search (community summaries). The
  seed-then-traverse pattern is exactly our graph leg.
- [Neo4j GraphRAG](https://neo4j.com/blog/developer/enhancing-hybrid-retrieval-graphrag-python-package/)
  `HybridCypherRetriever` — vector + full-text → Cypher traversal; the canonical
  "hybrid + graph" shape we're rebuilding in Postgres.
- [LightRAG](https://github.com/hkuds/lightrag) (dual-level: entity + theme),
  **HippoRAG** (Personalized PageRank traversal), Microsoft **LazyGraphRAG**
  (defer summarization to query time), and the
  [HybridRAG](https://arxiv.org/pdf/2408.04948) paper (KG + vector beats either
  alone) — the efficiency + fusion ideas worth lifting.

### Ingestion is a separate (future) feature

This is the **retrieval** half of the KB story; its **ingestion** counterpart
(autonomously *building* a KB graph from sources) is a separate future feature —
see *Autonomous multimodal ingestion* under Reach in the [README
Roadmap](../README.md#roadmap). This search work does **not** depend on it; we're
building the search engine over graphs that already exist.

Pull deeper search work into active development once one of: (a) graphs we use
daily cross the size where manual recall stops working, (b) an agent workflow
asks "what does this graph already say about X" often enough that a search
endpoint pays for itself.
