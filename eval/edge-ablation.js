#!/usr/bin/env node
// E13 edge-ablation (#464 follow-up, write-time-structure question) — does the
// CONNECTEDNESS authored at write time causally enable multi-hop retrieval?
//
// We can't mutate the shared live data graph, so we ablate NON-DESTRUCTIVELY:
// remove a fraction p of `related` edges client-side and measure GOLD
// REACHABILITY@hops2 — the fraction of each multihop question's gold nodes that
// a deployed pack (seedTopK=3, hops=2) could even REACH from the top-3 SEARCH
// seeds. Reachability is the CEILING on coverage (#463 pinned actual coverage at
// p=0), so reachability-vs-density isolates the mechanism: kill the bridge edges
// and the multi-hop gold becomes unreachable -> coverage must fall.
//
// Seeds are search-derived (realistic runtime), fetched once from the LIVE warm
// endpoint; the ablation itself is pure client-side graph math (no 2nd model).
// We also split gold into NEAR (dist<=1 from a seed at full density) vs BRIDGE
// (dist>=2) to show the bridge gold — the multi-hop payload — degrades fastest.
// Run: MULTITAP_BASE_URL=http://127.0.0.1:3000 node eval/edge-ablation.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAgentToken } from './resolve-token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000';
const TOKEN = resolveAgentToken();
const HJSON = { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };
const SEED_N = 3, HOPS = 2;
const P_GRID = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const R = Number(process.env.ABLATE_REPEATS || 30); // random removals averaged per p

const post = async (u, b) => { const r = await fetch(`${BASE}${u}`, { method: 'POST', headers: HJSON, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`${u} ${r.status} ${await r.text()}`); return r.json(); };
const get = async (u) => { const r = await fetch(`${BASE}${u}`, { headers: HJSON }); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); };

const multihop = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-context-multihop.json'), 'utf-8'));
const GID = multihop.gid_default;

const map = await get(`/api/graphs/${GID}/graph`);
const relEdges = map.links.filter((l) => l.type === 'related').map((l) => [Number(l.source), Number(l.target)]);
const nodeIds = map.nodes.map((n) => Number(n.id));

function buildAdj(edges) {
  const adj = new Map(nodeIds.map((id) => [id, new Set()]));
  for (const [s, t] of edges) { if (adj.has(s) && adj.has(t)) { adj.get(s).add(t); adj.get(t).add(s); } }
  return adj;
}
function reachWithin(adj, seeds, k) {
  const seen = new Set(seeds); let frontier = [...seeds];
  for (let d = 0; d < k; d++) { const next = []; for (const u of frontier) for (const v of (adj.get(u) || [])) if (!seen.has(v)) { seen.add(v); next.push(v); } frontier = next; }
  return seen;
}
function minDistToSeeds(adj, seeds, target, cap = 6) {
  if (seeds.includes(target)) return 0;
  const seen = new Set(seeds); let frontier = [...seeds];
  for (let d = 1; d <= cap; d++) { const next = []; for (const u of frontier) for (const v of (adj.get(u) || [])) { if (v === target) return d; if (!seen.has(v)) { seen.add(v); next.push(v); } } frontier = next; }
  return Infinity;
}
function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

// fetch search-derived top-3 seeds per multihop case (once, live warm endpoint)
const cases = [];
for (const c of multihop.cases) {
  const { results } = await post(`/api/graphs/${GID}/search`, { query: c.query });
  const seeds = results.slice(0, SEED_N).map((r) => Number(r.taskId));
  const fullAdj = buildAdj(relEdges);
  // classify gold at full density: NEAR (<=1 hop from a seed) vs BRIDGE (>=2)
  const near = [], bridge = [];
  for (const g of c.gold_nodes) { (minDistToSeeds(fullAdj, seeds, g) <= 1 ? near : bridge).push(g); }
  cases.push({ id: c.id, gold: c.gold_nodes, seeds, near, bridge });
}

// ablation curve
const curve = [];
for (const p of P_GRID) {
  let allG = 0, allGReach = 0, brG = 0, brGReach = 0, nrG = 0, nrGReach = 0;
  for (let r = 0; r < R; r++) {
    const keep = shuffle(relEdges).slice(0, Math.round(relEdges.length * (1 - p)));
    const adj = buildAdj(keep);
    for (const c of cases) {
      const reach = reachWithin(adj, c.seeds, HOPS);
      for (const g of c.gold) { allG++; if (reach.has(g)) allGReach++; }
      for (const g of c.bridge) { brG++; if (reach.has(g)) brGReach++; }
      for (const g of c.near) { nrG++; if (reach.has(g)) nrGReach++; }
    }
  }
  curve.push({
    p, edges_kept: Math.round(relEdges.length * (1 - p)),
    gold_reach: +(allGReach / allG).toFixed(3),
    bridge_gold_reach: brG ? +(brGReach / brG).toFixed(3) : null,
    near_gold_reach: nrG ? +(nrGReach / nrG).toFixed(3) : null,
  });
}

const out = {
  meta: { gid: GID, base: BASE, related_edges: relEdges.length, seedN: SEED_N, hops: HOPS, repeats: R, n_cases: cases.length,
    bridge_gold_total: cases.reduce((s, c) => s + c.bridge.length, 0), near_gold_total: cases.reduce((s, c) => s + c.near.length, 0) },
  curve, perCase: cases.map((c) => ({ id: c.id, seeds: c.seeds, n_near: c.near.length, n_bridge: c.bridge.length })),
};
fs.writeFileSync('/tmp/e13-edge-ablation.json', JSON.stringify(out, null, 2));

console.log(`\n=== Edge ablation on ${GID} (${relEdges.length} related edges, ${cases.length} multihop cases, R=${R}) ===`);
console.log(`gold split at full density: NEAR(<=1hop)=${out.meta.near_gold_total}  BRIDGE(>=2hop)=${out.meta.bridge_gold_total}\n`);
console.log('p_removed  edges_kept  gold_reach  bridge_gold_reach  near_gold_reach');
for (const row of curve) console.log(`  ${String(row.p).padEnd(8)} ${String(row.edges_kept).padEnd(11)} ${String(row.gold_reach).padEnd(11)} ${String(row.bridge_gold_reach).padEnd(18)} ${row.near_gold_reach}`);
console.log('\nwrote /tmp/e13-edge-ablation.json');
