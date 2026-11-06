// Shared helpers for the E13.10 write-side skill A/B harness (#469/#470).
// All scripts hit the LIVE warm endpoint (never a 2nd in-process model, #436).
import crypto from 'crypto';
import { resolveAgentToken } from '../resolve-token.js';

export const BASE = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000';
const TOKEN = resolveAgentToken();
const WRITER_ID = process.env.MULTITAP_WRITER_ID || crypto.randomUUID();
const WRITER_NAME = process.env.MULTITAP_WRITER_NAME || "Kevin's Claude";

const READ_H = { ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };
const WRITE_H = {
  'Content-Type': 'application/json',
  'X-Writer-Type': 'agent',
  'X-Writer-Id': WRITER_ID,
  'X-Writer-Name': WRITER_NAME,
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __dir = path.dirname(fileURLToPath(import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// optional throttle (ms) between calls — give the 1.5GB ONNX server time to release
// transient inference buffers so a burst doesn't OOM it on the 3GB box (#436).
const THROTTLE = Number(process.env.SKILLAB_THROTTLE_MS || 0);
let healed = 0;
function heal() {
  // server likely OOM-killed (connection refused) — restart via the gateway and wait.
  try { execFileSync('bash', [path.join(__dir, 'ensure-up.sh'), 'check'], { stdio: 'ignore', timeout: 120000 }); healed++; } catch { /* ignore */ }
}
// The 1-core box drops idle keepalive connections under rapid sequential load
// (ECONNRESET) and OOM-kills the server under bursts — retry transient failures with
// backoff, and AUTO-HEAL (restart) on persistent connection failure.
async function req(method, url, body) {
  const headers = method === 'GET' ? { ...READ_H, Connection: 'close' } : { ...WRITE_H, Connection: 'close' };
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  let lastErr;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const r = await fetch(`${BASE}${url}`, init);
      if (r.status >= 500 && r.status !== 501) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      if (!r.ok) throw Object.assign(new Error(`${method} ${url} -> HTTP ${r.status}: ${await r.text()}`), { fatal: true });
      // throttle ONLY the model-loading ops (node create/update embeds; search/context
      // run inference) — these spike the 1.5GB server. Deletes/edges/GETs are cheap DB ops.
      const heavy = /\/search$|\/context$/.test(url) || ((method === 'POST' || method === 'PATCH') && /\/tasks(\/|$)/.test(url));
      if (THROTTLE && heavy) await sleep(THROTTLE);
      return r;
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
      const refused = /ECONNREFUSED|ECONNRESET|fetch failed|socket hang up/i.test(String(e.message));
      if (refused && attempt >= 2) heal(); // server is probably down — restart it
      await sleep(Math.min(8000, 250 * 2 ** attempt));
    }
  }
  throw new Error(`${method} ${url} failed after retries (healed=${healed}): ${lastErr?.message || lastErr}`);
}
export async function get(url) { return (await req('GET', url)).json(); }
export async function post(url, body) { return (await req('POST', url, body)).json(); }
export async function del(url) { return (await req('DELETE', url)).status; }
// search hits the live hybrid pipeline; returns ranked taskIds best-first
export async function searchIds(gid, query) {
  const { results } = await post(`/api/graphs/${gid}/search`, { query });
  return results.map((r) => Number(r.taskId));
}
// strip frontmatter from a content blob
export const stripFm = (s) => (s || '').replace(/^---[\s\S]*?---\n?/, '');
export const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
export const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

// bounded-concurrency map (gentle on the 1-core box; default 5)
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers);
  return out;
}

// deterministic, seedable PRNG (Math.random is banned in workflows; node ok but
// we want reproducible degradations -> mulberry32)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── related-graph adjacency + BFS (shared by degrade.js / score-coverage.js) ──
export function buildAdj(nodeIds, edges) {
  const adj = new Map(nodeIds.map((id) => [Number(id), new Set()]));
  for (const e of edges) {
    const s = Number(e.source_id ?? e.source), t = Number(e.target_id ?? e.target);
    if (adj.has(s) && adj.has(t)) { adj.get(s).add(t); adj.get(t).add(s); }
  }
  return adj;
}
export function reachWithin(adj, seeds, k) {
  const seen = new Set(seeds.map(Number)); let frontier = [...seen];
  for (let d = 0; d < k; d++) {
    const next = [];
    for (const u of frontier) for (const v of (adj.get(u) || [])) if (!seen.has(v)) { seen.add(v); next.push(v); }
    frontier = next;
  }
  return seen;
}
export function minDistToSeeds(adj, seeds, target, cap = 8) {
  const tgt = Number(target);
  if (seeds.map(Number).includes(tgt)) return 0;
  const seen = new Set(seeds.map(Number)); let frontier = [...seen];
  for (let d = 1; d <= cap; d++) {
    const next = [];
    for (const u of frontier) for (const v of (adj.get(u) || [])) { if (v === tgt) return d; if (!seen.has(v)) { seen.add(v); next.push(v); } }
    frontier = next;
  }
  return Infinity;
}
// all edges (as "a-b" keys) lying on a BFS shortest path from any seed to target
export function shortestPathEdges(adj, seeds, target) {
  const tgt = Number(target);
  const prev = new Map(); const seen = new Set(seeds.map(Number));
  let frontier = [...seen]; let found = seeds.map(Number).includes(tgt);
  while (frontier.length && !found) {
    const next = [];
    for (const u of frontier) for (const v of (adj.get(u) || [])) if (!seen.has(v)) {
      seen.add(v); prev.set(v, u); next.push(v); if (v === tgt) { found = true; break; }
    }
    frontier = next;
  }
  if (!found) return [];
  const edges = []; let cur = tgt;
  while (prev.has(cur)) { const p = prev.get(cur); edges.push([Math.min(cur, p), Math.max(cur, p)].join('-')); cur = p; }
  return edges;
}
export const edgeKey = (s, t) => [Math.min(Number(s), Number(t)), Math.max(Number(s), Number(t))].join('-');
// deterministic [0,1) hash of a string (FNV-1a) — lets the degrade pick edges by
// stable IDENTITY (endpoint titles) instead of array order, so two independent
// copies degraded with the same seed get the IDENTICAL degraded base (paired A/B).
export function hashUnit(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 4294967296;
}
