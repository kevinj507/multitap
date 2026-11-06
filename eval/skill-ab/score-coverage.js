#!/usr/bin/env node
// E13.10 deterministic coverage/precision scorer (#470). Given a graph (a built or
// enriched throwaway copy) + the title-keyed remap, compute the SCREEN metrics with
// NO agents (plain graph math + the live /search and /context endpoints):
//   - REACHABILITY@hops2 from top-3 search seeds (overall / near / bridge gold)
//     = the CEILING on multi-hop coverage (#468 method).
//   - context-pack COVERAGE@budget + PRECISION/density via the live /context
//     endpoint at the tuned defaults (#463/#464): hops2, alpha0.5, maxNodes 10 & 30.
//   - edge density (related edges / node) — the hairball watch (#463 precision 0.086).
// Gold transfers via remap (oldId->newId); bridge gold is the multi-hop payload.
//
// Run: node eval/skill-ab/score-coverage.js --gid <g> --remap remap.json [--out f.json]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, post, arg, buildAdj, reachWithin, minDistToSeeds } from './lib.js';
import { coverage, setPrecision } from '../metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GID = arg('gid', null);
const REMAP_FILE = arg('remap', null);
const OUT = arg('out', null);
// optional FROZEN near/bridge gold classification (oldIds), computed once on the
// full-density graph so the bridge-reach metric is comparable across arms.
const GOLDCLASS_FILE = arg('goldclass', null);
const goldClass = GOLDCLASS_FILE ? JSON.parse(fs.readFileSync(GOLDCLASS_FILE, 'utf-8')) : null;
const HOPS = 2, SEED_N = 3, ALPHA = 0.5, BODY = 1500;
const MAXN = (arg('maxNodes', '10,30')).split(',').map(Number);
if (!GID || !REMAP_FILE) { console.error('need --gid and --remap'); process.exit(1); }

const remap = JSON.parse(fs.readFileSync(REMAP_FILE, 'utf-8')).remap;
const old2new = new Map(remap.map((r) => [r.oldId, r.newId]));
const multihop = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dataset-context-multihop.json'), 'utf-8'));

const map = await get(`/api/graphs/${GID}/graph`);
const edges = (await get(`/api/graphs/${GID}/edges`)).filter((e) => e.type === 'related');
const nodeIds = map.nodes.map((n) => Number(n.id));
const adj = buildAdj(nodeIds, edges);

// per-case seeds + remapped gold, near/bridge split. Use FROZEN seeds (goldclass)
// to avoid live /search (the OOM-prone burst, #436); fall back to /search only if no
// goldclass. The realized-coverage /context calls below still hit the live path.
const gcCases = goldClass ? goldClass.cases || goldClass : null;
const cases = [];
for (const c of multihop.cases) {
  const gold = c.gold_nodes.map((g) => old2new.get(g)).filter(Boolean);
  const goldSet = new Set(gold.map(String));
  let seeds, near, bridge;
  if (gcCases && gcCases[c.id]) {
    seeds = (gcCases[c.id].seeds || []).map((s) => old2new.get(s)).filter(Boolean);
    near = (gcCases[c.id].near || []).map((g) => old2new.get(g)).filter(Boolean);
    bridge = (gcCases[c.id].bridge || []).map((g) => old2new.get(g)).filter(Boolean);
  } else {
    const { results } = await post(`/api/graphs/${GID}/search`, { query: c.query });
    seeds = results.slice(0, SEED_N).map((r) => Number(r.taskId));
    near = []; bridge = [];
    for (const g of gold) (minDistToSeeds(adj, seeds, g) <= 1 ? near : bridge).push(g);
  }
  cases.push({ id: c.id, query: c.query, seeds, gold, goldSet, near, bridge });
}

// --- reachability ceiling ---
let allG = 0, allR = 0, brG = 0, brR = 0, nrG = 0, nrR = 0;
for (const c of cases) {
  const reach = reachWithin(adj, c.seeds, HOPS);
  for (const g of c.gold) { allG++; if (reach.has(g)) allR++; }
  for (const g of c.bridge) { brG++; if (reach.has(g)) brR++; }
  for (const g of c.near) { nrG++; if (reach.has(g)) nrR++; }
}
const reach = { gold: +(allR / allG).toFixed(3), bridge: brG ? +(brR / brG).toFixed(3) : null, near: nrG ? +(nrR / nrG).toFixed(3) : null, n_bridge: brG, n_near: nrG };

// --- realized context-pack coverage + precision via live /context ---
const packMetrics = {};
for (const maxNodes of MAXN) {
  const covs = [], precs = [], nodeszs = [];
  for (const c of cases) {
    const res = await post(`/api/graphs/${GID}/context`, { query: c.query, hops: HOPS, maxNodes, maxBodyChars: BODY, alpha: ALPHA, seedTopK: SEED_N, edgeTypes: ['related'] });
    const ids = res.nodes.map((n) => Number(n.id));
    covs.push(coverage(ids, c.goldSet));
    precs.push(setPrecision(ids, c.goldSet));
    nodeszs.push(ids.length);
  }
  const m = (a) => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3);
  packMetrics[`maxNodes${maxNodes}`] = { coverage: m(covs), precision: m(precs), avgNodes: m(nodeszs) };
}

const out = {
  gid: GID, nodes: nodeIds.length, related_edges: edges.length,
  edge_density: +(edges.length / nodeIds.length).toFixed(3),
  reachability_hops2: reach,
  context_pack: packMetrics,
};
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
