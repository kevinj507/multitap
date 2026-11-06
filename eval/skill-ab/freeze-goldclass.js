#!/usr/bin/env node
// E13.10.2 (#471) — freeze the near/bridge gold classification from the FULL-DENSITY
// source graph (read-only) so the bridge-reachability screen metric is a STABLE,
// comparable quantity across A/B arms. Bridge gold = the >=2-hop multi-hop payload
// (#468). Emits oldId sets keyed by case id; score-coverage.js remaps them per arm.
// Run: node eval/skill-ab/freeze-goldclass.js --src fwmhe8ysfrnx9fw7 --out frozen/goldclass.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, post, arg, buildAdj, minDistToSeeds } from './lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = arg('src', 'fwmhe8ysfrnx9fw7');
const OUT = arg('out', null);
const SEED_N = 3;
const multihop = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dataset-context-multihop.json'), 'utf-8'));

const map = await get(`/api/graphs/${SRC}/graph`);
const edges = (await get(`/api/graphs/${SRC}/edges`)).filter((e) => e.type === 'related');
const adj = buildAdj(map.nodes.map((n) => Number(n.id)), edges);

const out = {};
for (const c of multihop.cases) {
  const { results } = await post(`/api/graphs/${SRC}/search`, { query: c.query });
  const seeds = results.slice(0, SEED_N).map((r) => Number(r.taskId));
  const near = [], bridge = [];
  for (const g of c.gold_nodes) (minDistToSeeds(adj, seeds, g) <= 1 ? near : bridge).push(g);
  out[c.id] = { seeds, near, bridge };
}
const meta = { src: SRC, seedN: SEED_N, n_bridge: Object.values(out).reduce((s, v) => s + v.bridge.length, 0), n_near: Object.values(out).reduce((s, v) => s + v.near.length, 0) };
const payload = { meta, cases: out };
if (OUT) { fs.mkdirSync(path.dirname(path.resolve(__dirname, OUT)), { recursive: true }); fs.writeFileSync(path.resolve(__dirname, OUT), JSON.stringify(payload, null, 2)); }
console.log(JSON.stringify({ meta, sample: Object.fromEntries(Object.entries(out).slice(0, 2)) }));
