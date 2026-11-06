#!/usr/bin/env node
// E13.5 (#462) — context-pack accuracy + time leaderboard. Mirrors
// live-parity.js / run-eval.js: hits the LIVE endpoint so we measure the served
// path against the warm ONNX model (never a 2nd in-process model — 3GB OOM #436).
//
// Strategies (E13.3 / #460):
//   A search-only  — POST /search, take top hits hydrated to a token budget (no traversal).
//   B context-pack pure BFS          — POST /context, alpha=1 (proximity only).
//   C context-pack relevance-weighted — POST /context, alpha<1 (the candidate).
//   D full-graph dump                 — every node (coverage ceiling / token ceiling).
//
// Metrics (eval/metrics.js): COVERAGE@budget = |pack∩gold|/|gold|, set PRECISION,
// token count (countTokens proxy), latency p50/p95. "Equal token budget": for each
// config A is built to C's token count; gap-closure = (cov_C−cov_A)/(1−cov_A).
//
// Efficiency: /search is cached per case (config-independent). B is run
// NODE-seeded with the cached seeds (skips the redundant internal search; same
// seeds as C). C is query-seeded (it needs the search relevance signal to weight).
//
// Run: MULTITAP_BASE_URL=https://context.multitap.sh node eval/context-pack.js
//   --hops 1,2,3 --maxNodes 15,25,40 --alpha 0.5 --bodyChars 1500 [--verbose]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { coverage, setPrecision, countTokens, percentile } from './metrics.js';
import { resolveAgentToken } from './resolve-token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000';
const TOKEN = resolveAgentToken();
const HJSON = { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const HOPS = arg('hops', '1,2,3').split(',').map(Number);
const MAXN = arg('maxNodes', '15,25,40').split(',').map(Number);
const ALPHA = Number(arg('alpha', '0.5'));
const BODY = Number(arg('bodyChars', '1500'));
const SEEDTOPK = Number(arg('seedTopK', '3'));
const VERBOSE = process.argv.includes('--verbose');

const multihop = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-context-multihop.json'), 'utf-8'));
const coverageDs = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-context-coverage.json'), 'utf-8'));
const GID = multihop.gid_default;

async function post(url, body) {
  const r = await fetch(`${BASE}${url}`, { method: 'POST', headers: HJSON, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}
async function get(url) {
  const r = await fetch(`${BASE}${url}`, { headers: HJSON });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

// ── Body cache: every node's title+body, and its clipped token cost ──────────
const map = await get(`/api/graphs/${GID}/graph`);
const allIds = map.nodes.map((n) => Number(n.id));
const bodyCache = new Map();
for (const id of allIds) {
  const t = await get(`/api/graphs/${GID}/tasks/${id}`);
  const title = t.meta?.title || '';
  const body = (t.content || '').replace(/^---[\s\S]*?---\n?/, ''); // strip frontmatter
  bodyCache.set(id, { title, body });
}
function nodeTokens(id, bodyChars) {
  const n = bodyCache.get(id);
  if (!n) return 0;
  const clipped = bodyChars >= 0 && n.body.length > bodyChars ? n.body.slice(0, bodyChars) : n.body;
  return countTokens(`${n.title}\n${clipped}`);
}
function packTokens(ids, bodyChars) {
  return ids.reduce((s, id) => s + nodeTokens(id, bodyChars), 0);
}

// D — full dump cost + coverage (1.0 if gold ⊆ graph).
const FULL_TOKENS = packTokens(allIds, BODY);

// ── Per-case search cache (config-independent) ───────────────────────────────
const searchCache = new Map(); // caseId -> { rankedIds:[ids], seeds:[ids], latency }
async function searchFor(c) {
  if (searchCache.has(c.id)) return searchCache.get(c.id);
  const t0 = Date.now();
  const { results } = await post(`/api/graphs/${GID}/search`, { query: c.query });
  const rankedIds = results.map((r) => Number(r.taskId));
  const seeds = rankedIds.slice(0, SEEDTOPK);
  const v = { rankedIds, seeds, latency: Date.now() - t0 };
  searchCache.set(c.id, v);
  return v;
}

// A — search-only hydrated to a token budget (greedy by rank until >= budget).
function strategyA(rankedIds, budgetTokens, bodyChars) {
  const pack = [];
  let tok = 0;
  for (const id of rankedIds) {
    pack.push(id);
    tok += nodeTokens(id, bodyChars);
    if (tok >= budgetTokens) break;
  }
  return pack;
}

// B/C — context-pack via the live endpoint.
async function contextPack({ c, hops, maxNodes, alpha, nodeSeeded }) {
  const t0 = Date.now();
  const body = { hops, maxNodes, maxBodyChars: BODY, alpha, edgeTypes: ['related'] };
  if (nodeSeeded) { body.seeds = (await searchFor(c)).seeds; }
  else { body.query = c.query; body.seedTopK = SEEDTOPK; }
  const res = await post(`/api/graphs/${GID}/context`, body);
  const ids = res.nodes.map((n) => Number(n.id));
  return { ids, tokens: packTokens(ids, BODY), latency: Date.now() - t0, serverTotal: res.timings?.total ?? null, truncated: res.truncated };
}

function fmt(x, d = 3) { return Number(x).toFixed(d); }
function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0; }

// ── Run one dataset over the sweep ───────────────────────────────────────────
async function runDataset(label, cases) {
  console.log(`\n${'='.repeat(78)}\nDATASET: ${label}  (${cases.length} cases)  ·  bodyChars=${BODY} seedTopK=${SEEDTOPK} alpha_C=${ALPHA}\n${'='.repeat(78)}`);
  for (const c of cases) c._gold = new Set(c.gold_nodes.map(String));

  for (const hops of HOPS) {
    for (const maxNodes of MAXN) {
      // accumulators per strategy
      const acc = { A: [], B: [], C: [], D: [] };
      const prec = { A: [], B: [], C: [], D: [] };
      const toks = { A: [], B: [], C: [], D: [] };
      const nodes = { A: [], B: [], C: [], D: [] };
      const lat = { A: [], B: [], C: [], serverC: [] };
      const gapClosures = [];

      for (const c of cases) {
        const s = await searchFor(c);
        const C = await contextPack({ c, hops, maxNodes, alpha: ALPHA, nodeSeeded: false });
        const B = await contextPack({ c, hops, maxNodes, alpha: 1, nodeSeeded: true });
        const A = strategyA(s.rankedIds, C.tokens, BODY); // matched to C's token budget
        const Aids = A;
        const Dids = allIds;

        const covA = coverage(Aids, c._gold);
        const covB = coverage(B.ids, c._gold);
        const covC = coverage(C.ids, c._gold);
        const covD = coverage(Dids, c._gold);

        acc.A.push(covA); acc.B.push(covB); acc.C.push(covC); acc.D.push(covD);
        prec.A.push(setPrecision(Aids, c._gold)); prec.B.push(setPrecision(B.ids, c._gold));
        prec.C.push(setPrecision(C.ids, c._gold)); prec.D.push(setPrecision(Dids, c._gold));
        toks.A.push(packTokens(Aids, BODY)); toks.B.push(B.tokens); toks.C.push(C.tokens); toks.D.push(FULL_TOKENS);
        nodes.A.push(Aids.length); nodes.B.push(B.ids.length); nodes.C.push(C.ids.length); nodes.D.push(allIds.length);
        lat.A.push(s.latency); lat.B.push(B.latency); lat.C.push(C.latency); lat.serverC.push(C.serverTotal ?? C.latency);
        // gap-closure for this case (guard cov_A==1)
        if (covD - covA > 1e-9) gapClosures.push((covC - covA) / (covD - covA));
        if (VERBOSE) console.log(`   ${c.id}: covA=${fmt(covA,2)} covB=${fmt(covB,2)} covC=${fmt(covC,2)} | tokC=${C.tokens} nC=${C.ids.length}${C.truncated ? ' (trunc)' : ''}`);
      }

      const row = (k) => `cov=${fmt(mean(acc[k]))} prec=${fmt(mean(prec[k]))} nodes=${fmt(mean(nodes[k]),1)} tok=${Math.round(mean(toks[k]))}`;
      console.log(`\n-- hops=${hops} maxNodes=${maxNodes} ${'-'.repeat(40)}`);
      console.log(`  A search-only : ${row('A')}  lat p50/p95=${Math.round(percentile(lat.A,50))}/${Math.round(percentile(lat.A,95))}ms`);
      console.log(`  B pure-BFS    : ${row('B')}  lat p50/p95=${Math.round(percentile(lat.B,50))}/${Math.round(percentile(lat.B,95))}ms`);
      console.log(`  C relweighted : ${row('C')}  lat p50/p95=${Math.round(percentile(lat.C,50))}/${Math.round(percentile(lat.C,95))}ms (server ${Math.round(percentile(lat.serverC,50))}/${Math.round(percentile(lat.serverC,95))})`);
      console.log(`  D full-dump   : ${row('D')}`);
      console.log(`  >> C gap-closure vs A (mean (covC-covA)/(covD-covA)) = ${fmt(mean(gapClosures))}  [bar: multihop >= 0.60]`);
    }
  }
}

console.log(`Context-pack leaderboard · BASE=${BASE} · GID=${GID} · full-dump tokens=${FULL_TOKENS}`);
const direct = coverageDs.cases.filter((c) => c.kind === 'direct');
const reasoning = coverageDs.cases.filter((c) => c.kind === 'reasoning');
await runDataset('MULTI-HOP', multihop.cases);
await runDataset('DIRECT (regression)', direct);
await runDataset('REASONING', reasoning);
console.log('\nDone.');
