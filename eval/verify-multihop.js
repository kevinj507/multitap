// Two-pass re-check for the E13.2 multi-hop dataset (#459): independently
// (NOT via the endpoint's own code) BFS the live stock graph's related edges and
// confirm every gold node is reachable from `seed` within `min_hops`. Also
// reports each gold node's actual hop-distance and the total reachable-set size
// at min_hops (so #463 knows the budget a full-coverage pack would need).
//
// Run: MULTITAP_BASE_URL=... node eval/verify-multihop.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAgentToken } from './resolve-token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000';
const TOKEN = resolveAgentToken();
const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

const ds = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-context-multihop.json'), 'utf-8'));
const gid = ds.gid_default;

const map = await (await fetch(`${BASE}/api/graphs/${gid}/graph`, { headers })).json();
const titles = new Map(map.nodes.map((n) => [Number(n.id), n.title]));

// undirected related adjacency
const adj = new Map();
for (const l of map.links) {
  if (l.type !== 'related') continue;
  const s = Number(l.source);
  const t = Number(l.target);
  if (!adj.has(s)) adj.set(s, new Set());
  if (!adj.has(t)) adj.set(t, new Set());
  adj.get(s).add(t);
  adj.get(t).add(s);
}

function bfs(seed, maxHops) {
  const dist = new Map([[seed, 0]]);
  let frontier = [seed];
  for (let h = 1; h <= maxHops && frontier.length; h++) {
    const next = [];
    for (const n of frontier) for (const nb of adj.get(n) || []) {
      if (!dist.has(nb)) { dist.set(nb, h); next.push(nb); }
    }
    frontier = next;
  }
  return dist;
}

let allOk = true;
for (const c of ds.cases) {
  const dist = bfs(c.seed, c.min_hops);
  const reachable = dist.size;
  const rows = c.gold_nodes.map((g) => ({ g, d: dist.has(g) ? dist.get(g) : null }));
  const bad = rows.filter((r) => r.d === null || r.d > c.min_hops);
  const maxD = Math.max(...rows.map((r) => r.d ?? 99));
  const ok = bad.length === 0;
  allOk = allOk && ok;
  console.log(`\n${ok ? 'OK ' : 'XX '} ${c.id}  seed=${c.seed} (${titles.get(c.seed)})  min_hops=${c.min_hops}  reachable@${c.min_hops}=${reachable}  goldMaxDist=${maxD}`);
  for (const r of rows) {
    console.log(`     ${r.d === null ? 'UNREACHABLE' : 'd=' + r.d}  ${r.g}  ${titles.get(r.g) ?? '(missing node!)'}`);
  }
  if (bad.length) console.log(`     -> FAIL: ${bad.map((b) => b.g).join(', ')} not within ${c.min_hops} hops`);
}
console.log(`\n${allOk ? 'ALL CASES VERIFIED' : 'SOME CASES FAILED — fix gold_nodes/min_hops'}`);
process.exit(allOk ? 0 : 1);
