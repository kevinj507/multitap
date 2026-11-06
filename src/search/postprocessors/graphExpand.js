// GraphExpander postprocessor — Phase 3, the RECALL lever (#197 / #173 §11,
// LlamaIndex PrevNext-style expansion §11). Runs AFTER fusion: it takes the
// fused top hits as SEEDS and traverses our `edges` table (k-hop BFS) to pull
// in edge-connected nodes that text retrieval missed entirely.
//
// Why this and not rerank: the reranker only REORDERS candidates already in the
// pool — it cannot fix a RETRIEVAL miss (the relevant node never got retrieved;
// see #196). Graph expansion can: when a missed node is edge-connected to one we
// DID find, traversal surfaces it. Free (SQL over `edges`), fast (no model/GPU),
// and it attacks exactly the recall@k gap our list-navigation flows need (#172).
//
// Precision guard: expanded nodes are APPENDED after the fused list, never
// interleaved above it, so a loosely-related neighbor can never bury a strong
// lexical/dense hit. Per-seed and total fan-out caps keep the tail from flooding
// the list. Both knobs are config.
//
// ── Why is this stage still here? (decision record, 2026-06-12) ──────────────
// The round-2/E10 campaign (#231, #436) measured expansion on three real graphs
// (stock-73, TIL-195, iOS-62), both hop depths, both modes, and found ZERO
// end-to-end value in production regimes: with the bm25 lexical leg the fused
// list runs 45-80 deep, so append-mode neighbours land past topK=20 and the
// rerank window (0 of 767 added nodes reached top-20 on TIL) — structurally
// invisible, not just statistically flat. Fusion mode (below) measured WORSE
// than off. Kevin's call: keep the stage enabled anyway — it costs ~2-5ms,
// can't bury good hits by construction, and may still recover misses on
// tiny/sparse graphs where the fused list runs short. Don't expect production
// lift from it, and don't re-run the kill investigation; the data lives on
// graph nodes #231 and #436 (graph safqkahqnftyef4j).
//
// Edge source is dual, mirroring the dense retriever's store/in-memory split:
//   • route   — query the `edges` table via deps.pool, scoped WHERE graph_id =
//               ctx.gid (single-graph search; the scope is the access control —
//               we never read another graph's edges).
//   • eval/test — ctx.edges supplies the adjacency in-memory (no DB), so the
//               same expander runs against the frozen fixture and the live graph.
// With neither available it returns the list unchanged (graceful, like every
// stage — the pipeline still wraps postprocess() so a throw degrades too).

import { makeCandidate } from '../types.js';

const DEFAULT_HOPS = 1;            // 1-hop neighbours by default; the cheap, high-precision layer
const DEFAULT_MAX_PER_SEED = 5;    // cap each seed's fan-out so a hub node can't flood the list
const DEFAULT_MAX_ADDED = 50;      // overall cap on appended nodes

/**
 * @param {{
 *   pool?: Object,            // pg pool for the route path (edges via SQL)
 *   hops?: number,            // BFS depth from each seed (default 1)
 *   maxAddedPerSeed?: number, // per-seed fan-out cap (default 5)
 *   maxAdded?: number,        // total appended-node cap (default 50)
 *   edgeTypes?: string[]|null,// restrict to these edge types; null = all (dependency + related)
 *   mode?: 'append'|'fusion'  // #231/E10: how expanded nodes enter the list.
 *     append (default) — strictly below the fused floor (#197's precision
 *       guard). PROVEN structurally invisible on large graphs: with the bm25
 *       leg the fused list runs 45-80 deep, so appended nodes sit past both
 *       topK and the reranker's topM window.
 *     fusion — expansion becomes a third leg: each neighbour is scored by its
 *       SEED MASS (Σ 1/(60+seedRank) over adjacent seeds — seed strength ×
 *       edge multiplicity, the #231 minimal-PPR idea), then RRF-merged with
 *       the fused order so neighbours COMPETE for positions instead of
 *       queueing behind them. The precision guard becomes statistical (RRF
 *       discounts deep ranks) instead of absolute.
 *       MEASURED (E10, 2026-06-12): fusion LOST on all three labeled real
 *       graphs (stock r@20 −0.070, iOS −0.129, TIL −0.022 vs no expansion) —
 *       edge-neighbours of retrieved nodes are mostly topical, not
 *       query-relevant, and equal-citizen RRF promotes them over real hits.
 *       Kept behind the flag as the experiment's paper trail; do not enable.
 * }} opts
 * @returns {import('../types.js').Postprocessor}
 */
export function createGraphExpander({
  pool,
  hops = DEFAULT_HOPS,
  maxAddedPerSeed = DEFAULT_MAX_PER_SEED,
  maxAdded = DEFAULT_MAX_ADDED,
  edgeTypes = null,
  mode = 'append',
} = {}) {
  // Pull edge rows for the searched graph(s). Scoped either way — the SQL leg
  // by WHERE graph_id (one id or, for cross-graph search, the accessible set;
  // edges only ever connect same-graph nodes, so traversal can't hop between
  // graphs), the in-memory leg because the caller only ever hands us the
  // relevant edges. Returns null when no edge source exists (→ no-op).
  async function resolveEdges(ctx) {
    if (Array.isArray(ctx.edges)) return ctx.edges;
    const scope = ctx.gids && ctx.gids.length ? ctx.gids : ctx.gid;
    if (pool && scope) {
      const { rows } = await pool.query(
        'SELECT source_id, target_id, type FROM edges WHERE graph_id = ANY($1)',
        [Array.isArray(scope) ? scope : [scope]],
      );
      return rows;
    }
    return null;
  }

  return {
    name: 'graphExpand',
    async postprocess(query, candidates, ctx = {}) {
      if (!Array.isArray(candidates) || candidates.length === 0) return candidates;
      if (!(hops >= 1) || !(maxAdded >= 1) || !(maxAddedPerSeed >= 1)) return candidates;

      const edges = await resolveEdges(ctx);
      if (!Array.isArray(edges) || edges.length === 0) return candidates;

      // Build an undirected adjacency map keyed by String(id). `orig` keeps the
      // original id value (number in PG / fixtures) so appended candidates carry
      // the same taskId type the rest of the pipeline uses.
      const adj = new Map();
      const orig = new Map();
      const link = (a, b) => {
        if (!adj.has(a)) adj.set(a, new Set());
        adj.get(a).add(b);
      };
      for (const e of edges) {
        const sv = e.source ?? e.source_id;
        const tv = e.target ?? e.target_id;
        if (sv == null || tv == null) continue;
        if (edgeTypes && e.type != null && !edgeTypes.includes(e.type)) continue;
        const s = String(sv);
        const t = String(tv);
        orig.set(s, sv);
        orig.set(t, tv);
        link(s, t);
        link(t, s);
      }
      if (adj.size === 0) return candidates;

      const seedIds = candidates.map((c) => String(c.taskId));
      const present = new Set(seedIds); // never re-add a node already in the list
      const addedSet = new Set();
      const added = [];

      // BFS seed-by-seed in fused-rank order: the strongest seeds contribute
      // their neighbours first, so when the total cap bites it drops the
      // weakest seeds' neighbours, not the best ones'.
      for (const seed of seedIds) {
        if (added.length >= maxAdded) break;
        let perSeed = 0;
        const visited = new Set([seed]); // traversal-visited (≠ output-added): we
        let frontier = [seed];           // walk THROUGH present nodes for multi-hop
        for (let hop = 1; hop <= hops && perSeed < maxAddedPerSeed && added.length < maxAdded; hop++) {
          const next = [];
          for (const node of frontier) {
            for (const nb of adj.get(node) || []) {
              if (visited.has(nb)) continue;
              visited.add(nb);
              next.push(nb);
              if (present.has(nb) || addedSet.has(nb)) continue; // dedup output only
              addedSet.add(nb);
              added.push({ id: orig.get(nb) ?? nb, hop, via: orig.get(seed) ?? seed });
              perSeed++;
              if (perSeed >= maxAddedPerSeed || added.length >= maxAdded) break;
            }
            if (perSeed >= maxAddedPerSeed || added.length >= maxAdded) break;
          }
          frontier = next;
        }
      }

      if (added.length === 0) return candidates;

      if (mode === 'fusion') {
        const K = 60; // same constant as the retriever-leg RRF
        const seedRank = new Map(seedIds.map((id, i) => [id, i]));
        // Seed mass: every fused seed directly adjacent to the neighbour
        // contributes 1/(K + its rank + 1) — strong seeds and multi-edged
        // neighbours both raise it. A multi-hop discovery with no direct seed
        // edge falls back to its discovery seed's term, discounted by hop.
        const massOf = (a) => {
          let mass = 0;
          for (const s of adj.get(String(a.id)) || []) {
            const r = seedRank.get(s);
            if (r !== undefined) mass += 1 / (K + r + 1);
          }
          if (mass === 0) mass = 1 / ((K + (seedRank.get(String(a.via)) ?? seedIds.length) + 1) * a.hop);
          return mass;
        };
        const expLeg = added
          .map((a) => ({ a, mass: massOf(a) }))
          .sort((x, y) => y.mass - x.mass);
        // RRF over the two lists (disjoint by construction — BFS never adds a
        // node already in the fused list). Fused candidates keep their objects
        // (snippets, meta); expanded ones enter as graph-sourced candidates.
        // Ties break to the fused side so an equal-rank neighbour never
        // displaces a real hit.
        return [
          ...candidates.map((c, i) => ({ cand: c, score: 1 / (K + i + 1), fused: true })),
          ...expLeg.map((e, j) => ({
            cand: makeCandidate(e.a.id, 0, 'graph', {
              meta: { expandHop: e.a.hop, via: e.a.via, expansionMass: e.mass, mode: 'fusion' },
            }),
            score: 1 / (K + j + 1),
            fused: false,
          })),
        ]
          .sort((x, y) => y.score - x.score || (x.fused === y.fused ? 0 : x.fused ? -1 : 1))
          .map((m) => ({ ...m.cand, score: m.score }));
      }

      // Score the appended nodes strictly below the fused tail and descending by
      // insertion order, so any consumer that sorts by score keeps them under
      // the real hits. Order is by array position regardless (the pipeline just
      // slices), so this is belt-and-suspenders for precision.
      const floor = Math.min(0, ...candidates.map((c) => Number(c.score) || 0));
      const expanded = added.map((a, i) =>
        makeCandidate(a.id, floor - 0.001 * (i + 1), 'graph', {
          meta: { expandHop: a.hop, via: a.via },
        }),
      );

      return [...candidates, ...expanded];
    },
  };
}

export default { createGraphExpander };
