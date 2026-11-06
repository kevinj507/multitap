// E19.1 — derived plan structure. PURE: takes in-memory node + edge lists and
// returns the regions, so it unit-tests directly (no db, no express).
//
// The premise (measured on the KB-search graph, 2026-07-30): a program of work
// is ALREADY fully encoded in its `required for` chains — 118 intra-family vs 7
// cross-family edges on that graph. Grouping does not need a containment edge
// or a container node; it needs a read query. This is that query.
//
// A REGION is a connected component of the purpose-filtered subgraph. That is
// the whole definition: deterministic, label-free, no heuristic, no resolution
// knob.
//
// What this deliberately does NOT do: cut bridges to reconstruct a finer
// taxonomy. That was the original design and it was withdrawn — measurement
// showed no label-free criterion separates a program handoff from an ordinary
// chain link (intra-program bridges had min-side 19 and 17; the cross-program
// ones 18 and 14), and in a linear chain EVERY edge is a bridge, so cutting
// shatters chains. Auto-cutting would manufacture a silently-wrong grouping.
//
// Bridges are still computed and reported, under a different reading: a bridge
// in a dependency graph is a SINGLE POINT OF FAILURE — sever it and everything
// on the far side is cut off from the work that feeds it. That is a real
// plan-risk signal, which is what `seams` are for. Never auto-cut.

const ALL_PURPOSES = ['required for', 'supports', 'contradicts', 'related to', 'supersedes'];
const DEFAULT_PURPOSES = ['required for'];

// Normalize either shape we get fed: PG rows ({source_id,target_id,purpose}) or
// /graph-map rows ({source,target,purpose}). Self-loops are dropped — they
// carry no connectivity and would break the bridge DFS's parent-edge test.
function normalizeEdges(edges, purposeSet) {
  const out = [];
  for (const e of edges || []) {
    if (!purposeSet.has(e.purpose)) continue;
    const s = Number(e.source ?? e.source_id);
    const t = Number(e.target ?? e.target_id);
    if (!Number.isFinite(s) || !Number.isFinite(t) || s === t) continue;
    out.push({ source: s, target: t, purpose: e.purpose });
  }
  return out;
}

// Undirected adjacency carrying the edge INDEX, not just the endpoint. The
// index is what makes the bridge DFS correct in the presence of parallel edges:
// two edges between the same pair means neither is a bridge, and we can only
// tell them apart by index.
function buildAdjacency(edges) {
  const adj = new Map();
  const push = (a, b, i) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, idx: i });
  };
  edges.forEach((e, i) => {
    push(e.source, e.target, i);
    push(e.target, e.source, i);
  });
  return adj;
}

// Tarjan bridge detection, iterative (a long dependency chain would blow a
// recursive stack). Returns a Set of edge indices.
//
// Standard low-link: for tree edge p->u, the edge is a bridge iff no back edge
// from u's subtree reaches p or above (low[u] > disc[p]). The parent-EDGE index
// check (rather than parent-node) is what handles parallel edges correctly.
export function findBridges(edges) {
  const adj = buildAdjacency(edges);
  const disc = new Map();
  const low = new Map();
  const bridges = new Set();
  let timer = 0;

  for (const start of adj.keys()) {
    if (disc.has(start)) continue;
    disc.set(start, timer);
    low.set(start, timer);
    timer += 1;
    // frame: [node, parentEdgeIdx, nextChildPos]
    const stack = [[start, -1, 0]];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const [u, parentEdge] = frame;
      const nbrs = adj.get(u) || [];
      if (frame[2] < nbrs.length) {
        const { to: v, idx } = nbrs[frame[2]];
        frame[2] += 1;
        if (idx === parentEdge) continue; // the edge we arrived by, not a back edge
        if (!disc.has(v)) {
          disc.set(v, timer);
          low.set(v, timer);
          timer += 1;
          stack.push([v, idx, 0]);
        } else {
          low.set(u, Math.min(low.get(u), disc.get(v)));
        }
      } else {
        stack.pop();
        if (stack.length) {
          const p = stack[stack.length - 1][0];
          low.set(p, Math.min(low.get(p), low.get(u)));
          if (low.get(u) > disc.get(p)) bridges.add(parentEdge);
        }
      }
    }
  }
  return bridges;
}

// Connected components over the undirected filtered subgraph. Every node in
// `nodeIds` is placed, so isolated nodes come back as their own size-1
// component and the output stays total.
function findComponents(edges, nodeIds) {
  const adj = buildAdjacency(edges);
  const seen = new Set();
  const comps = [];
  for (const start of nodeIds) {
    if (seen.has(start)) continue;
    const comp = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const u = stack.pop();
      comp.push(u);
      for (const { to } of adj.get(u) || []) {
        if (!seen.has(to)) {
          seen.add(to);
          stack.push(to);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

// Readiness, mirroring GET /tasks/ready exactly: status 'todo' AND no
// confidence AND every recursive prerequisite done. Computed over ALL
// `required for` edges graph-wide — NOT the purpose-filtered subset — because a
// prerequisite in another region still blocks. Divergence here would make the
// per-region `ready` lie, so a parity test against the live SQL gates it.
function computeReady(nodes, allEdges) {
  const status = new Map(nodes.map((n) => [n.id, n.status]));
  const hasConfidence = new Map(nodes.map((n) => [n.id, n.confidence != null]));
  const preds = new Map();
  for (const e of allEdges) {
    if (e.purpose !== 'required for') continue;
    const s = Number(e.source ?? e.source_id);
    const t = Number(e.target ?? e.target_id);
    if (!Number.isFinite(s) || !Number.isFinite(t) || s === t) continue;
    if (!preds.has(t)) preds.set(t, []);
    preds.get(t).push(s);
  }
  const ready = new Set();
  for (const n of nodes) {
    if (status.get(n.id) !== 'todo' || hasConfidence.get(n.id)) continue;
    // walk the full recursive prerequisite closure; any non-done blocks
    let blocked = false;
    const seen = new Set();
    const stack = [...(preds.get(n.id) || [])];
    while (stack.length && !blocked) {
      const p = stack.pop();
      if (seen.has(p)) continue;
      seen.add(p);
      // A prerequisite not present in this graph's node set can't be judged
      // done; treat it as absent rather than blocking (matches the SQL, which
      // joins tasks and so skips dangling ids).
      if (status.has(p) && status.get(p) !== 'done') blocked = true;
      for (const pp of preds.get(p) || []) if (!seen.has(pp)) stack.push(pp);
    }
    if (!blocked) ready.add(n.id);
  }
  return ready;
}

/**
 * Derive plan regions from a graph's nodes + edges.
 *
 * @param {object} input
 * @param {Array<{id:number,title?:string,status?:string,confidence?:number|null}>} input.nodes
 * @param {Array<{source_id?:number,target_id?:number,source?:number,target?:number,purpose:string}>} input.edges
 *   ALL edges for the graph; filtering happens here.
 * @param {object} [opts]
 * @param {string[]} [opts.purposes=['required for']] which purposes to traverse
 * @param {number}   [opts.minRegionSize=2] components below this go to `singletons`
 * @returns {{regions:Array, seams:Array, singletons:Array, params:object}}
 */
export function derivePlanRegions({ nodes = [], edges = [] } = {}, opts = {}) {
  const purposes = opts.purposes ?? DEFAULT_PURPOSES;
  const minRegionSize = opts.minRegionSize ?? 2;
  const purposeSet = new Set(purposes);

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = nodes.map((n) => n.id);
  const filtered = normalizeEdges(edges, purposeSet);
  const bridgeIdx = findBridges(filtered);
  const readySet = computeReady(nodes, edges);

  // Directed in/out degree WITHIN the filtered subgraph, for entry/exit.
  const indeg = new Map();
  const outdeg = new Map();
  for (const e of filtered) {
    outdeg.set(e.source, (outdeg.get(e.source) || 0) + 1);
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
  }

  const comps = findComponents(filtered, nodeIds);
  const compOf = new Map();
  comps.forEach((c, i) => c.forEach((n) => compOf.set(n, i)));

  const summary = (id) => {
    const n = nodeById.get(id) || {};
    return { id, title: n.title ?? null, status: n.status ?? null };
  };

  const regions = [];
  const singletons = [];
  comps.forEach((comp, i) => {
    const ids = [...comp].sort((a, b) => a - b);
    if (ids.length < minRegionSize) {
      singletons.push(...ids.map(summary));
      return;
    }
    const counts = {};
    for (const id of ids) {
      const s = nodeById.get(id)?.status ?? 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    }
    regions.push({
      id: i,
      size: ids.length,
      nodes: ids.map(summary),
      counts,
      // Directed shape of the region: where it starts and what it delivers.
      entry: ids.filter((id) => !(indeg.get(id) > 0)),
      exit: ids.filter((id) => !(outdeg.get(id) > 0)),
      ready: ids.filter((id) => readySet.has(id)),
    });
  });
  // Biggest first, then by id for a stable order across identical sizes.
  regions.sort((a, b) => b.size - a.size || a.id - b.id);

  // Seams: bridges annotated with how much work sits on each side. sideB is
  // what gets severed if the edge's prerequisite never lands.
  const compSize = comps.map((c) => c.length);
  const seams = [...bridgeIdx]
    .map((i) => {
      const e = filtered[i];
      // Recompute the split for THIS edge only: remove it and see the two sides.
      const without = filtered.filter((_, j) => j !== i);
      const sides = findComponents(without, [e.source, e.target]);
      const sideOf = (n) => sides.find((c) => c.includes(n))?.length ?? 1;
      return {
        source_id: e.source,
        target_id: e.target,
        purpose: e.purpose,
        sideA: sideOf(e.source),
        sideB: sideOf(e.target),
        region: compOf.get(e.source) ?? null,
        regionSize: compSize[compOf.get(e.source)] ?? null,
      };
    })
    // Widest severance first — the biggest single points of failure.
    .sort((a, b) => Math.min(b.sideA, b.sideB) - Math.min(a.sideA, a.sideB)
      || a.source_id - b.source_id);

  return {
    regions,
    seams,
    singletons,
    params: { purposes, minRegionSize },
  };
}

export { ALL_PURPOSES, DEFAULT_PURPOSES };
export default { derivePlanRegions, findBridges, ALL_PURPOSES, DEFAULT_PURPOSES };
