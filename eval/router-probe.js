#!/usr/bin/env node
// E13 router probe — does a CHEAP, query-time STRUCTURAL signal separate
// "connected-neighborhood / multi-hop" queries (where context-pack C beats
// search-only A, per #463/#464) from "scattered / distributed-relevance"
// queries (where flat search A wins, per #463's reasoning set)?
//
// The signal must use ONLY what's available at runtime: a single /search call
// + the /graph adjacency. NO gold seeds, NO labels. We mirror the DEPLOYED pack
// (seedTopK=3, hops=2 over related edges): "would a hops=2 pack grown from the
// top search hits recapture the rest of the top search hits?" If the relevant
// mass clusters into one k-hop neighborhood -> context-pack; if it scatters
// across the graph -> flat search.
//
// Labeled classes (both on the stock data graph fwmhe8ysfrnx9fw7):
//   neighborhood = 12 multihop cases (known C-wins)
//   scattered    = 8 reasoning cases (known A-wins)
//   direct       = 10 direct cases (single-node; tie) — sanity third point
//
// Deterministic: hits the LIVE warm endpoint's /search + /graph only; spins up
// NO 2nd in-process model (#436). Run:
//   MULTITAP_BASE_URL=http://127.0.0.1:3000 node eval/router-probe.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAgentToken } from './resolve-token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000';
const TOKEN = resolveAgentToken();
const HJSON = { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };
const K = Number(process.env.ROUTER_TOPK || 10);   // top search hits to assess (≈ tight pack node count)
const SEED_N = 3;                                  // mirror deployed seedTopK=3
const HOPS = 2;                                    // mirror deployed pack hops=2

const post = async (u, b) => { const r = await fetch(`${BASE}${u}`, { method: 'POST', headers: HJSON, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`${u} ${r.status} ${await r.text()}`); return r.json(); };
const get = async (u) => { const r = await fetch(`${BASE}${u}`, { headers: HJSON }); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); };

const multihop = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-context-multihop.json'), 'utf-8'));
const coverage = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-context-coverage.json'), 'utf-8'));
const GID = multihop.gid_default;

// ---- build related adjacency from /graph ----
const map = await get(`/api/graphs/${GID}/graph`);
const adj = new Map();
for (const n of map.nodes) adj.set(Number(n.id), new Set());
for (const l of map.links) {
  if (l.type !== 'related') continue;
  const s = Number(l.source), t = Number(l.target);
  if (adj.has(s) && adj.has(t)) { adj.get(s).add(t); adj.get(t).add(s); }
}
// nodes within `k` related-hops of `seed` (inclusive of seed)
function within(seed, k) {
  const seen = new Set([seed]); let frontier = [seed];
  for (let d = 0; d < k; d++) {
    const next = [];
    for (const u of frontier) for (const v of (adj.get(u) || [])) if (!seen.has(v)) { seen.add(v); next.push(v); }
    frontier = next;
  }
  return seen;
}
// hop distance a->b over related edges, capped
function hops(a, b, cap = 6) {
  if (a === b) return 0;
  const seen = new Set([a]); let frontier = [a];
  for (let d = 1; d <= cap; d++) {
    const next = [];
    for (const u of frontier) for (const v of (adj.get(u) || [])) { if (v === b) return d; if (!seen.has(v)) { seen.add(v); next.push(v); } }
    frontier = next;
  }
  return Infinity;
}

// ---- per-query structural signals (runtime-only: search hits + adjacency) ----
async function probe(query) {
  const { results } = await post(`/api/graphs/${GID}/search`, { query });
  const ranked = results.map((r) => Number(r.taskId));
  const topK = ranked.slice(0, K);
  const seeds = topK.slice(0, SEED_N);
  // PRIMARY: capture@hops2 from top-3 seeds — fraction of the OTHER top-K hits a
  // deployed pack (seedTopK=3, hops=2) would pull into the seed neighborhood.
  let cover = new Set();
  for (const s of seeds) for (const id of within(s, HOPS)) cover.add(id);
  const rest = topK.filter((id) => !seeds.includes(id));
  const capture3 = rest.length ? rest.filter((id) => cover.has(id)).length / rest.length : 1;
  // SECONDARY 1: single-seed capture (top-1 only) — weaker, fails 2-endpoint Qs.
  const cov1 = within(topK[0], HOPS);
  const capture1 = topK.length > 1 ? topK.slice(1).filter((id) => cov1.has(id)).length / (topK.length - 1) : 1;
  // SECONDARY 2: largest H-hop-connected cluster among the top-K hits / K.
  // (Do the relevant hits collapse into ONE neighborhood within the pack's reach?)
  const H = HOPS + 1; // allow a bridge node between two endpoint clusters (mirrors 3-hop gold)
  const parent = new Map(topK.map((id) => [id, id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (let i = 0; i < topK.length; i++) for (let j = i + 1; j < topK.length; j++) {
    if (hops(topK[i], topK[j], H) <= H) { parent.set(find(topK[i]), find(topK[j])); }
  }
  const sizes = {};
  for (const id of topK) { const r = find(id); sizes[r] = (sizes[r] || 0) + 1; }
  const largestClusterFrac = topK.length ? Math.max(...Object.values(sizes)) / topK.length : 0;
  return { capture3: +capture3.toFixed(3), capture1: +capture1.toFixed(3), largestClusterFrac: +largestClusterFrac.toFixed(3), topK };
}

const classes = [
  { label: 'neighborhood', cases: multihop.cases.map((c) => ({ id: c.id, query: c.query })) },
  { label: 'scattered', cases: coverage.cases.filter((c) => c.kind === 'reasoning').map((c) => ({ id: c.id, query: c.query })) },
  { label: 'direct', cases: coverage.cases.filter((c) => c.kind === 'direct').map((c) => ({ id: c.id, query: c.query })) },
];

const rows = [];
for (const cls of classes) for (const c of cls.cases) {
  const s = await probe(c.query);
  rows.push({ class: cls.label, id: c.id, capture3: s.capture3, capture1: s.capture1, largestClusterFrac: s.largestClusterFrac });
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
function classStats(label, sig) { const xs = rows.filter((r) => r.class === label).map((r) => r[sig]); return { n: xs.length, mean: +mean(xs).toFixed(3), std: +std(xs).toFixed(3), min: +Math.min(...xs).toFixed(3), max: +Math.max(...xs).toFixed(3), values: xs }; }

// Threshold separation: best single threshold of `sig` splitting neighborhood (high) vs scattered (low).
function bestThreshold(sig) {
  const nb = rows.filter((r) => r.class === 'neighborhood').map((r) => r[sig]);
  const sc = rows.filter((r) => r.class === 'scattered').map((r) => r[sig]);
  const cand = [...new Set([...nb, ...sc])].sort((a, b) => a - b);
  let best = { thr: null, acc: 0, tp: 0, tn: 0 };
  for (let i = 0; i < cand.length; i++) {
    const thr = cand[i];
    const tp = nb.filter((x) => x >= thr).length;   // neighborhood correctly = high
    const tn = sc.filter((x) => x < thr).length;    // scattered correctly = low
    const acc = (tp + tn) / (nb.length + sc.length);
    if (acc > best.acc) best = { thr, acc: +acc.toFixed(3), tp, tn, n_nb: nb.length, n_sc: sc.length };
  }
  return best;
}

const out = {
  meta: { gid: GID, base: BASE, topK: K, seedN: SEED_N, hops: HOPS, signal_primary: 'capture3' },
  perClass: {
    capture3: { neighborhood: classStats('neighborhood', 'capture3'), scattered: classStats('scattered', 'capture3'), direct: classStats('direct', 'capture3') },
    capture1: { neighborhood: classStats('neighborhood', 'capture1'), scattered: classStats('scattered', 'capture1'), direct: classStats('direct', 'capture1') },
    largestClusterFrac: { neighborhood: classStats('neighborhood', 'largestClusterFrac'), scattered: classStats('scattered', 'largestClusterFrac'), direct: classStats('direct', 'largestClusterFrac') },
  },
  separation_nb_vs_scattered: { capture3: bestThreshold('capture3'), capture1: bestThreshold('capture1'), largestClusterFrac: bestThreshold('largestClusterFrac') },
  rows,
};
fs.writeFileSync('/tmp/e13-router-probe.json', JSON.stringify(out, null, 2));

// ---- print summary ----
console.log(`\n=== Router probe (topK=${K}, seedN=${SEED_N}, hops=${HOPS}) on ${GID} ===`);
for (const sig of ['capture3', 'capture1', 'largestClusterFrac']) {
  console.log(`\n[${sig}]`);
  for (const cl of ['neighborhood', 'scattered', 'direct']) {
    const s = out.perClass[sig][cl];
    console.log(`  ${cl.padEnd(13)} n=${s.n}  mean=${s.mean}  std=${s.std}  range=[${s.min}, ${s.max}]`);
  }
  const b = out.separation_nb_vs_scattered[sig];
  console.log(`  -> best threshold ${b.thr}: acc=${b.acc} (neighborhood≥thr ${b.tp}/${b.n_nb}, scattered<thr ${b.tn}/${b.n_sc})`);
}
console.log('\nPer-query:');
for (const r of rows) console.log(`  ${r.class.padEnd(13)} ${r.id.padEnd(8)} capture3=${r.capture3}  capture1=${r.capture1}  cluster=${r.largestClusterFrac}`);
console.log('\nwrote /tmp/e13-router-probe.json');
