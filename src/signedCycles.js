// E15.B3 — signed-graph inconsistency detection. PURE: takes an in-memory edge
// list, returns the flagged cycles, so it unit-tests directly.
//
// Definition (balance theory): an inconsistency is a DIRECTED cycle in the
// supports/contradicts subgraph with an ODD number of `contradicts` edges.
//   - odd contradicts  → unbalanced → FLAG (a real tension).
//   - even contradicts → balanced (mutual disagreement / enemy-of-enemy) → skip.
//   - zero contradicts (pure supports) → circular reasoning, not contradiction → skip (v1).
// We scan ONLY supports/contradicts edges and follow them DIRECTED (the
// implication chain must close on itself). `required for` / `related to` are
// ignored. This is never a write guard and never auto-resolves — it surfaces
// structure for a human to adjudicate (like a merge conflict).

const SIGNED_PURPOSES = new Set(['supports', 'contradicts']);

// Build a directed adjacency: Map<source, Array<{to, contra}>>, contra=1 for a
// `contradicts` edge, 0 for `supports`. Accepts PG rows ({source_id,target_id,
// purpose}) and /graph-map rows ({source,target,purpose}).
function buildSignedAdjacency(edges) {
  const adj = new Map();
  const nodes = new Set();
  for (const e of edges || []) {
    const purpose = e.purpose;
    if (!SIGNED_PURPOSES.has(purpose)) continue;
    const s = Number(e.source ?? e.source_id);
    const t = Number(e.target ?? e.target_id);
    if (!Number.isFinite(s) || !Number.isFinite(t) || s === t) continue;
    if (!adj.has(s)) adj.set(s, []);
    adj.get(s).push({ to: t, contra: purpose === 'contradicts' ? 1 : 0 });
    nodes.add(s);
    nodes.add(t);
  }
  return { adj, nodes };
}

function canonicalCycle(pathNodes, edgesOnPath, contradicts) {
  return {
    nodes: pathNodes,
    edges: edgesOnPath, // [{source, target, purpose}]
    length: edgesOnPath.length,
    contradicts,
    balanced: contradicts % 2 === 0,
  };
}

/**
 * Find signed inconsistencies (odd-contradicts directed cycles).
 *
 * @param {Array} edges  edge rows; only supports/contradicts are considered.
 * @param {Object} [opts]
 * @param {'graph'|'claim'} [opts.mode='graph']  graph-wide enumeration, or cycles through `start`.
 * @param {number|null} [opts.start=null]        required for mode 'claim' (the node id).
 * @param {number} [opts.maxCycleLen=6]          max edges in a reported cycle.
 * @param {number} [opts.maxCycles=50]           cap on reported cycles.
 * @param {number} [opts.maxSteps=200000]        DFS-step budget (deterministic stand-in for a time budget).
 * @returns {{ inconsistencies:Array, truncated:boolean, scanned:{nodes:number,edges:number} }}
 */
export function findSignedInconsistencies(edges, opts = {}) {
  const {
    mode = 'graph',
    start = null,
    maxCycleLen = 6,
    maxCycles = 50,
    maxSteps = 200000,
  } = opts;

  const { adj, nodes } = buildSignedAdjacency(edges);
  const inconsistencies = [];
  let truncated = false;
  let steps = 0;
  let edgeCount = 0;
  for (const list of adj.values()) edgeCount += list.length;

  const purposeOf = (contra) => (contra === 1 ? 'contradicts' : 'supports');

  // DFS that walks directed signed edges from `origin`, closing cycles back to
  // it. `minNode` (graph mode) keeps `origin` the smallest id in any cycle, so
  // each directed cycle is enumerated exactly once (rotation-dedup, Johnson-style).
  function walk(origin, minNode) {
    const path = [origin];
    const onPath = new Set([origin]);
    const edgesOnPath = [];

    const dfs = (node, contradicts) => {
      if (inconsistencies.length >= maxCycles) {
        truncated = true;
        return;
      }
      if (++steps > maxSteps) {
        truncated = true;
        return;
      }
      for (const { to, contra } of adj.get(node) || []) {
        if (to === origin) {
          // Closing the cycle. Need ≥1 edge already on the path so the closure
          // makes a real cycle (≥2 edges; self-loops are filtered at build).
          if (edgesOnPath.length >= 1) {
            const total = contradicts + contra;
            if (total % 2 === 1) {
              inconsistencies.push(
                canonicalCycle(
                  [...path],
                  [...edgesOnPath, { source: node, target: origin, purpose: purposeOf(contra) }],
                  total,
                ),
              );
              if (inconsistencies.length >= maxCycles) {
                truncated = true;
                return;
              }
            }
          }
          continue;
        }
        if (minNode !== null && to < minNode) continue; // keep origin the min
        if (onPath.has(to)) continue; // simple cycles only
        if (edgesOnPath.length + 1 >= maxCycleLen) continue; // closing edge would exceed cap
        onPath.add(to);
        path.push(to);
        edgesOnPath.push({ source: node, target: to, purpose: purposeOf(contra) });
        dfs(to, contradicts + contra);
        edgesOnPath.pop();
        path.pop();
        onPath.delete(to);
        if (truncated && inconsistencies.length >= maxCycles) return;
      }
    };
    dfs(origin, 0);
  }

  if (mode === 'claim') {
    if (start == null || !Number.isFinite(Number(start))) {
      throw new Error('claim mode requires a numeric start node id');
    }
    walk(Number(start), null);
  } else {
    for (const s of [...nodes].sort((a, b) => a - b)) {
      if (inconsistencies.length >= maxCycles) {
        truncated = true;
        break;
      }
      walk(s, s);
    }
  }

  return { inconsistencies, truncated, scanned: { nodes: nodes.size, edges: edgeCount } };
}

export default { findSignedInconsistencies };
