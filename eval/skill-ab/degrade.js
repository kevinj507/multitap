#!/usr/bin/env node
// E13.10.2 (#471) — DEGRADE a throwaway copy so the building agent has real
// connective-tissue work to do. We remove a fraction p of `related` edges, BIASED
// toward the BRIDGE edges (those on shortest paths from search seeds to the >=2-hop
// "bridge" gold) — reusing the edge-ablation mechanism (#468), but DESTRUCTIVELY on
// the COPY (never the shared live graph). Removing bridge edges is what impairs
// multi-hop reachability (the #468 causal finding), so this targets exactly the
// structure the screen measures. Reproducible (seeded). Keeps the remapped gold.
//
// Run: node eval/skill-ab/degrade.js --gid <copy> --remap remap.json [--p 0.45] [--bias 4] [--seed 42]
//   prints { gid, edgesRemoved, reachBefore, reachAfter, ... } to stdout.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, del, post, arg, buildAdj, reachWithin, minDistToSeeds, shortestPathEdges, edgeKey, hashUnit } from './lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GID = arg('gid', null);
const REMAP_FILE = arg('remap', null);
const P = Number(arg('p', '0.45'));
const BIAS = Number(arg('bias', '4'));
const SEED = Number(arg('seed', '42'));
const HOPS = 2, SEED_N = 3;
if (!GID || !REMAP_FILE) { console.error('need --gid and --remap'); process.exit(1); }

const remap = JSON.parse(fs.readFileSync(REMAP_FILE, 'utf-8')).remap;
const old2new = new Map(remap.map((r) => [r.oldId, r.newId]));
const multihop = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dataset-context-multihop.json'), 'utf-8'));
// FROZEN seeds + near/bridge (stock ids) from goldclass.json — avoids 12 live /search
// calls per provision (the burst that OOM-killed the 1.5GB server, #436). Seeds/gold
// are remapped stock->copy ids; the copy preserves bodies so seeds are valid.
const goldClass = JSON.parse(fs.readFileSync(path.join(__dirname, 'frozen/goldclass.json'), 'utf-8')).cases;

const map = await get(`/api/graphs/${GID}/graph`);
const nodeIds = map.nodes.map((n) => Number(n.id));
const newId2title = new Map(remap.map((r) => [r.newId, r.title]));
const titleKeyOf = (e) => {
  const a = newId2title.get(Number(e.source_id)) || String(e.source_id);
  const b = newId2title.get(Number(e.target_id)) || String(e.target_id);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
};
// NOTE: adjacency is built in GET-order (NOT title-sorted) to stay CONSISTENT with
// the mechanism baseline/c1/c2 were degraded under (changing it mid-run shifts which
// bridge edges get the bias -> systematically different bases -> a confound). The
// sampling KEY below is title-based, so the dominant draw is stable; the residual
// per-copy variation (BFS tie-breaks) is just nuisance noise from the same distribution.
const edges = (await get(`/api/graphs/${GID}/edges`)).filter((e) => e.type === 'related');
const adj = buildAdj(nodeIds, edges);

// per-case: frozen seeds + near/bridge, remapped stock->copy
const cases = [];
for (const c of multihop.cases) {
  const gc = goldClass[c.id];
  if (!gc) continue;
  const seeds = gc.seeds.map((s) => old2new.get(s)).filter(Boolean);
  const near = (gc.near || []).map((g) => old2new.get(g)).filter(Boolean);
  const bridge = (gc.bridge || []).map((g) => old2new.get(g)).filter(Boolean);
  const gold = c.gold_nodes.map((g) => old2new.get(g)).filter(Boolean);
  cases.push({ id: c.id, seeds, gold, near, bridge });
}

// collect bridge-path edges (the connective tissue we preferentially cut)
const bridgeEdgeKeys = new Set();
for (const c of cases) for (const g of c.bridge) for (const k of shortestPathEdges(adj, c.seeds, g)) bridgeEdgeKeys.add(k);

function reachStats(curEdges) {
  const a = buildAdj(nodeIds, curEdges);
  let allG = 0, allR = 0, brG = 0, brR = 0, nrG = 0, nrR = 0;
  for (const c of cases) {
    const reach = reachWithin(a, c.seeds, HOPS);
    for (const g of c.gold) { allG++; if (reach.has(g)) allR++; }
    for (const g of c.bridge) { brG++; if (reach.has(g)) brR++; }
    for (const g of c.near) { nrG++; if (reach.has(g)) nrR++; }
  }
  return { gold: +(allR / allG).toFixed(3), bridge: brG ? +(brR / brG).toFixed(3) : null, near: nrG ? +(nrR / nrG).toFixed(3) : null };
}
const reachBefore = reachStats(edges);

// weighted DETERMINISTIC sampling WITHOUT replacement: bridge-path edges BIAS× more
// likely. Efraimidis-Spirakis with a per-edge key = hashUnit(seed|titlePair)^(1/weight)
// — keyed on stable edge identity so the removed set is identical across copies.
const removeN = Math.round(edges.length * P);
const keyed = edges.map((e) => {
  const k = edgeKey(e.source_id, e.target_id);
  const isBridge = bridgeEdgeKeys.has(k);
  const w = isBridge ? BIAS : 1;
  const u = hashUnit(`${SEED}|${titleKeyOf(e)}`);
  return { e, isBridge, key: Math.pow(u, 1 / w) };
}).sort((a, b) => b.key - a.key);
const toRemove = keyed.slice(0, removeN);

for (const { e } of toRemove) await del(`/api/graphs/${GID}/edges/${e.id}`);

const keptEdges = edges.filter((e) => !toRemove.find((r) => r.e.id === e.id));
const reachAfter = reachStats(keptEdges);
const out = {
  gid: GID, p: P, bias: BIAS, seed: SEED,
  edgesBefore: edges.length, edgesRemoved: toRemove.length, edgesAfter: keptEdges.length,
  bridgePathEdges: bridgeEdgeKeys.size, bridgeEdgesRemoved: toRemove.filter((r) => r.isBridge).length,
  near_gold_total: cases.reduce((s, c) => s + c.near.length, 0), bridge_gold_total: cases.reduce((s, c) => s + c.bridge.length, 0),
  reachBefore, reachAfter,
};
console.log(JSON.stringify(out));
