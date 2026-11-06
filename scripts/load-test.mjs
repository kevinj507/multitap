#!/usr/bin/env node
// N-agent concurrency load test (graph node 5130).
//
// Boots a THROWAWAY server (own Postgres DB, own port, search/embedding
// disabled) and hammers it the way a real fleet would after the claim/lease
// work (3829): N workers race GET /tasks/ready → POST /claim → work (PATCHes)
// → flip to review, until the queue drains. Then a second phase measures the
// edge-write path's coarse `LOCK TABLE edges` serialization — same-graph vs
// different-graphs — to quantify the ceiling node 5124 exists to lift.
//
// NEVER points at a live instance: the DB is dropped and recreated every run.
//
// Usage:
//   node scripts/load-test.mjs [--agents 8] [--tasks 120] \
//     [--edge-writers 6] [--edges-per-writer 25] [--port 3199]
//
// Exit code 1 if an integrity invariant fails (double-grab, lost task).

import { spawn } from 'node:child_process';
import pg from 'pg';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) =>
    a.startsWith('--') ? [a.slice(2), Number(all[i + 1])] : null,
  ).filter(Boolean),
);
const AGENTS = args.agents || 8;
const TASKS = args.tasks || 120;
const EDGE_WRITERS = args['edge-writers'] || 6;
const EDGES_PER_WRITER = args['edges-per-writer'] || 25;
const PORT = args.port || 3199;

const ADMIN_URL = 'postgresql://postgres@localhost/postgres';
const DB = 'multitap_loadtest';
const BASE = `http://127.0.0.1:${PORT}`;

// ---------- tiny helpers ----------
const pct = (xs, p) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const stats = (xs) => ({
  n: xs.length,
  mean: xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : 0,
  p50: Math.round(pct(xs, 50) * 10) / 10,
  p95: Math.round(pct(xs, 95) * 10) / 10,
  max: Math.round(Math.max(0, ...xs) * 10) / 10,
});

async function api(method, path, body, writer) {
  const headers = { 'Content-Type': 'application/json' };
  if (writer) {
    headers['X-Writer-Type'] = 'agent';
    headers['X-Writer-Id'] = writer;
    headers['X-Writer-Name'] = writer;
  }
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ms = performance.now() - t0;
  let json = null;
  try { json = await res.json(); } catch { /* 204s etc. */ }
  return { status: res.status, json, ms };
}

// ---------- lifecycle ----------
async function recreateDb() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${DB}`);
  await admin.end();
}

function startServer() {
  // Minimal env on purpose: no EMBEDDING_*/RERANK_* so search stays lexical
  // and no model loads; capped heap so this box's memory stays safe.
  const child = spawn(process.execPath, ['--max-old-space-size=384', 'src/server.js'], {
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      PORT: String(PORT),
      DATABASE_URL: `postgresql://postgres@localhost/${DB}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  return child;
}

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/config`);
      if (r.ok) return;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('load-test server never came up');
}

// ---------- phase 1: fleet drains the queue ----------
async function fleetPhase() {
  const g = await api('POST', '/api/graphs', { name: 'load-fleet' });
  const gid = g.json.id;

  // Seed TASKS independent ready tasks in one batch call (max 500).
  const nodes = Array.from({ length: TASKS }, (_, i) => ({
    external_id: `lt:${i}`,
    content: `---\ntitle: Load task ${i}\nstatus: todo\n---\nwork item ${i}`,
  }));
  const seeded = await api('POST', `/api/graphs/${gid}/batch`, { run_id: 'load-seed', nodes, edges: [] });
  if (seeded.status !== 200) throw new Error(`seed failed: ${JSON.stringify(seeded.json)}`);

  const winners = new Map();       // task id → [worker ids that got a 200 claim]
  const m = {
    ready: [], claim200: [], claim409: [], patch: [], finish: [],
    claims: 0, contentions: 0, emptyPolls: 0,
  };

  async function worker(w) {
    const me = `fleet-${w}`;
    for (;;) {
      const ready = await api('GET', `/api/graphs/${gid}/tasks/ready`);
      m.ready.push(ready.ms);
      const list = ready.json || [];
      if (list.length === 0) { m.emptyPolls++; return; }
      // Everyone goes for the FIRST task — worst-case contention on purpose.
      const target = list[0].id;
      const c = await api('POST', `/api/graphs/${gid}/tasks/${target}/claim`, { ttl_seconds: 120 }, me);
      if (c.status === 200) {
        m.claim200.push(c.ms); m.claims++;
        winners.set(target, [...(winners.get(target) || []), me]);
        // Simulate work: two content PATCHes, then flip to review.
        const cur = c.json.task;
        let content = cur.content;
        for (let i = 0; i < 2; i++) {
          content = `${content}\nprogress ${i} by ${me}`;
          const p = await api('PATCH', `/api/graphs/${gid}/tasks/${target}`, { content }, me);
          m.patch.push(p.ms);
          if (p.status === 200) content = p.json.content;
        }
        const fin = await api('PATCH', `/api/graphs/${gid}/tasks/${target}`,
          { content: content.replace('status: in_progress', 'status: review') }, me);
        m.finish.push(fin.ms);
      } else if (c.status === 409) {
        m.claim409.push(c.ms); m.contentions++;
      } else {
        throw new Error(`unexpected claim status ${c.status}: ${JSON.stringify(c.json)}`);
      }
    }
  }

  const t0 = performance.now();
  await Promise.all(Array.from({ length: AGENTS }, (_, w) => worker(w)));
  const wallMs = performance.now() - t0;

  // Integrity: every task claimed exactly once; every task landed at review.
  const doubleGrabs = [...winners.entries()].filter(([, ws]) => ws.length > 1);
  const final = await api('GET', `/api/graphs/${gid}/tasks`);
  const notReview = (final.json || []).filter((t) => t.meta.status !== 'review');

  return { gid, wallMs, m, doubleGrabs, unfinished: notReview.length, claimed: winners.size };
}

// ---------- phase 2: edge-lock serialization ----------
async function seedEdgeGraph(name, spokes) {
  const g = await api('POST', '/api/graphs', { name });
  const gid = g.json.id;
  const nodes = [
    { external_id: 'hub', content: '---\ntitle: hub\nstatus: todo\n---\n' },
    ...Array.from({ length: spokes }, (_, i) => ({
      external_id: `s${i}`, content: `---\ntitle: spoke ${i}\nstatus: todo\n---\n`,
    })),
  ];
  const r = await api('POST', `/api/graphs/${gid}/batch`, { run_id: 'load-edges', nodes, edges: [] });
  const idOf = new Map(r.json.nodes.map((n) => [n.external_id, n.id]));
  return { gid, hub: idOf.get('hub'), spokes: Array.from({ length: spokes }, (_, i) => idOf.get(`s${i}`)) };
}

async function edgeWriters(graphs) {
  // graphs: one entry per writer (same entry repeated = same-graph mode).
  const lat = [];
  await Promise.all(graphs.map(async ({ gid, hub, spokes }, w) => {
    for (let i = 0; i < EDGES_PER_WRITER; i++) {
      // Unique (source, target) pairs per writer: writer w owns spoke slice.
      const target = spokes[w * EDGES_PER_WRITER + i];
      const r = await api('POST', `/api/graphs/${gid}/edges`,
        { source_id: hub, target_id: target, purpose: 'required for' }, `edge-${w}`);
      if (r.status !== 201) throw new Error(`edge write ${r.status}: ${JSON.stringify(r.json)}`);
      lat.push(r.ms);
    }
  }));
  return lat;
}

async function edgePhase() {
  const total = EDGE_WRITERS * EDGES_PER_WRITER;
  // (a) all writers into ONE graph
  const one = await seedEdgeGraph('load-edges-same', total);
  const t0 = performance.now();
  const sameLat = await edgeWriters(Array.from({ length: EDGE_WRITERS }, () => one));
  const sameWall = performance.now() - t0;
  // (b) each writer into ITS OWN graph — if the table lock were per-graph,
  // this would parallelize; with the global lock it serializes the same way.
  const own = [];
  for (let w = 0; w < EDGE_WRITERS; w++) {
    // Each per-writer graph only needs this writer's slice, but keep the
    // spoke indexing identical to (a) so edgeWriters addresses both the same.
    own.push(await seedEdgeGraph(`load-edges-own-${w}`, total));
  }
  const t1 = performance.now();
  const crossLat = await edgeWriters(own);
  const crossWall = performance.now() - t1;
  return { sameLat, sameWall, crossLat, crossWall };
}

// ---------- run ----------
console.log(`load-test: ${AGENTS} agents × ${TASKS} tasks; ${EDGE_WRITERS} edge writers × ${EDGES_PER_WRITER} edges`);
await recreateDb();
const server = startServer();
let failed = false;
try {
  await waitUp();

  const fleet = await fleetPhase();
  console.log('\n== Fleet phase (claim/lease under contention) ==');
  console.log(`wall-clock: ${Math.round(fleet.wallMs)}ms for ${TASKS} tasks × ${AGENTS} agents`);
  console.log(`claims won: ${fleet.claimed}/${TASKS}   contentions (409s): ${fleet.m.contentions}`);
  console.log(`ready  ${JSON.stringify(stats(fleet.m.ready))}`);
  console.log(`claim✓ ${JSON.stringify(stats(fleet.m.claim200))}`);
  console.log(`claim✗ ${JSON.stringify(stats(fleet.m.claim409))}`);
  console.log(`patch  ${JSON.stringify(stats(fleet.m.patch))}`);
  if (fleet.doubleGrabs.length > 0) {
    failed = true;
    console.error(`INTEGRITY FAIL: double-grabs on tasks: ${JSON.stringify(fleet.doubleGrabs)}`);
  } else {
    console.log('integrity: zero double-grabs ✓');
  }
  if (fleet.unfinished > 0) {
    failed = true;
    console.error(`INTEGRITY FAIL: ${fleet.unfinished} tasks not at review after drain`);
  } else {
    console.log('integrity: every task drained to review ✓');
  }

  const edges = await edgePhase();
  console.log('\n== Edge-lock phase (coarse LOCK TABLE serialization, node 5124) ==');
  console.log(`same graph : ${JSON.stringify(stats(edges.sameLat))} wall=${Math.round(edges.sameWall)}ms`);
  console.log(`own graphs : ${JSON.stringify(stats(edges.crossLat))} wall=${Math.round(edges.crossWall)}ms`);
  const ratio = edges.sameWall / Math.max(1, edges.crossWall);
  console.log(`cross-graph speedup from separate graphs: ${ratio.toFixed(2)}x`
    + (ratio < 1.3 ? '  → lock behaves globally (5124 confirmed: separate graphs do NOT parallelize)' : ''));
} finally {
  server.kill('SIGTERM');
}
process.exit(failed ? 1 : 0);
