// Context-pack neighborhood selection (E13 / graph #457, spec on #458) — the
// PURE core behind POST /api/graphs/:gid/context. Like the search pipeline, the
// algorithm here is DB- and model-free: it takes seeds, an in-memory edge list,
// and an optional relevance ranking, and returns the node id set (+ per-node
// hop distance, + induced edges, + a truncated flag). The route (routes/context.js)
// is the IO shell that loads edges from Postgres, runs the seed search through
// the POOLED SearchService, and hydrates bodies — so this part unit-tests
// in-memory exactly the way it runs live (one selection, no drift).
//
// Selection = relevance-weighted multi-source BFS to a node budget:
//   1. multi-source BFS from the seeds over `edgeTypes`-filtered edges → dist(n)
//      = min hops from any seed (seeds are dist 0), keeping everything ≤ hops.
//   2. if the reachable set fits the budget, take it all; otherwise rank the
//      non-seed reachable nodes by a combined score and keep the strongest until
//      the budget fills. Seeds are always kept (they're the entry point).
//   3. combined score = alpha·proximity + (1−alpha)·relevance, each min-max
//      normalized to [0,1] over the candidate set so alpha is a real dial:
//        • alpha = 1 → PURE BFS (proximity only) — eval baseline B (#460).
//        • alpha < 1 → relevance-weighted — candidate C; the search-leg rank
//          pulls query-relevant nodes up over merely-close ones.
//      Node-seeded entry has no relevance signal (relevance all 0), so it
//      degenerates to proximity BFS regardless of alpha — expected (#458).

const K = 60; // RRF constant — same as the retriever fusion leg

function minmax(values) {
  if (values.length === 0) return [];
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of values) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const span = mx - mn;
  return values.map((v) => (span > 0 ? (v - mn) / span : 0));
}

/**
 * Build an undirected adjacency map from edge rows, filtered to `edgeTypes`.
 * Accepts both the PG row shape ({source_id,target_id,type}) and the /graph
 * map shape ({source,target,type}); ids are normalized to Number so seeds
 * (numbers) and edge endpoints compare cleanly. Returns { adj: Map<id,Set<id>> }.
 */
export function buildAdjacency(edges, edgeTypes = null) {
  const adj = new Map();
  const link = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
  };
  for (const e of edges || []) {
    const sv = e.source ?? e.source_id;
    const tv = e.target ?? e.target_id;
    if (sv == null || tv == null) continue;
    if (edgeTypes && e.type != null && !edgeTypes.includes(e.type)) continue;
    const s = Number(sv);
    const t = Number(tv);
    if (!Number.isFinite(s) || !Number.isFinite(t)) continue;
    link(s, t);
    link(t, s);
  }
  return adj;
}

/**
 * Pure neighborhood selection. See file header for the algorithm.
 *
 * @param {{
 *   seeds: number[],                 // entry node ids (already resolved)
 *   edges: Array<Object>,            // edge rows ({source_id,target_id,type} or {source,target,type})
 *   edgeTypes?: string[]|null,       // null = all types; default ['related'] is applied by the route
 *   hops?: number,                   // BFS depth (default 2)
 *   maxNodes?: number,               // node budget (default 25)
 *   relevanceRank?: Map<number,number>, // id → 0-based search rank (query path); empty/absent on node path
 *   alpha?: number,                  // proximity weight in [0,1]; 1 = pure BFS (default 0.5)
 * }} opts
 * @returns {{ ids:number[], dist:Map<number,number>, edges:Array<{source:number,target:number,type:string}>, truncated:boolean, reachable:number }}
 *   `ids` ordered seeds-first then by selection score; `edges` are the induced
 *   subgraph (both endpoints in `ids`, of the traversed edgeTypes).
 */
export function buildNeighborhood({
  seeds = [],
  edges = [],
  edgeTypes = null,
  hops = 2,
  maxNodes = 25,
  relevanceRank = new Map(),
  alpha = 0.5,
} = {}) {
  const seedIds = [...new Set(seeds.map(Number).filter(Number.isFinite))];
  const adj = buildAdjacency(edges, edgeTypes);

  // Multi-source BFS — every seed starts at dist 0 in one frontier so dist(n)
  // is the min hop count from ANY seed (not per-seed). Walk THROUGH already-seen
  // nodes for multi-hop reach, but record each node's first (smallest) dist.
  const dist = new Map();
  let frontier = [];
  for (const s of seedIds) {
    if (!dist.has(s)) {
      dist.set(s, 0);
      frontier.push(s);
    }
  }
  for (let hop = 1; hop <= hops && frontier.length; hop++) {
    const next = [];
    for (const node of frontier) {
      for (const nb of adj.get(node) || []) {
        if (dist.has(nb)) continue;
        dist.set(nb, hop);
        next.push(nb);
      }
    }
    frontier = next;
  }

  const reachable = [...dist.keys()];
  const seedSet = new Set(seedIds);
  const nonSeed = reachable.filter((id) => !seedSet.has(id));

  let truncated = false;
  let selectedNonSeed;
  const budgetForNonSeed = Math.max(0, maxNodes - seedIds.length);

  if (nonSeed.length <= budgetForNonSeed) {
    // Everything fits. Order by proximity then degree so the body is still
    // sensibly ordered even when we keep all of it.
    selectedNonSeed = nonSeed.sort((a, b) =>
      dist.get(a) - dist.get(b)
      || (adj.get(b)?.size || 0) - (adj.get(a)?.size || 0)
      || a - b);
  } else {
    truncated = true;
    const proxRaw = nonSeed.map((id) => 1 / (1 + dist.get(id)));
    const relRaw = nonSeed.map((id) => (relevanceRank.has(id) ? 1 / (K + relevanceRank.get(id) + 1) : 0));
    const proxN = minmax(proxRaw);
    const relN = minmax(relRaw);
    const scored = nonSeed.map((id, i) => ({
      id,
      score: alpha * proxN[i] + (1 - alpha) * relN[i],
      dist: dist.get(id),
      degree: adj.get(id)?.size || 0,
    }));
    scored.sort((a, b) =>
      b.score - a.score
      || a.dist - b.dist
      || b.degree - a.degree
      || a.id - b.id);
    selectedNonSeed = scored.slice(0, budgetForNonSeed).map((s) => s.id);
  }

  const ids = [...seedIds, ...selectedNonSeed];
  const idSet = new Set(ids);

  // Induced edges: both endpoints kept, of the traversed edgeTypes. Dedup
  // undirected pairs so each link appears once.
  const inducedEdges = [];
  const seenPair = new Set();
  for (const e of edges || []) {
    const sv = Number(e.source ?? e.source_id);
    const tv = Number(e.target ?? e.target_id);
    const type = e.type;
    if (edgeTypes && type != null && !edgeTypes.includes(type)) continue;
    if (!idSet.has(sv) || !idSet.has(tv)) continue;
    const key = sv < tv ? `${sv}:${tv}:${type}` : `${tv}:${sv}:${type}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    inducedEdges.push({ source: sv, target: tv, type });
  }

  return { ids, dist, edges: inducedEdges, truncated, reachable: reachable.length };
}

export default { buildNeighborhood, buildAdjacency };
