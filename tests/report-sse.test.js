// E16.8 — reader mode live-refresh over SSE. A report write must reach a
// subscribed client as a kind:'report' frame WITHOUT masquerading as a graph
// edit: it emits NO tasks/edges frames and never bumps graphs.updated_at /
// version. Unlike the in-process presence broadcast (tests/presence.test.js),
// this rides the DB-backed LISTEN/NOTIFY path in src/sse.js, so delivery is
// asynchronous across Postgres connections — we POLL the captured frames rather
// than assume a synchronous broadcast. Setup mirrors tests/reports-all.test.js
// (header-auth adapter) and tests/presence.test.js (subscribe + fakeRes.write).
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import { _setAdapterForTests } from '../src/auth/index.js';
import { makeHeaderAuthAdapter } from './__support__/test_auth.js';
import { subscribe, unsubscribe } from '../src/sse.js';

let app;
let pool;

async function makeUser(suffix) {
  const r = await pool.query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('test-header', $1, $2, $1) RETURNING *`,
    [suffix, `${suffix}@test.local`],
  );
  return r.rows[0];
}

async function makeGraph(name, ownerId) {
  const r = await pool.query(
    `INSERT INTO graphs (name, owner_user_id) VALUES ($1, $2) RETURNING *`,
    [name, ownerId],
  );
  return r.rows[0];
}

// Parse captured SSE frames ('data: <json>\n\n') into payload objects.
function parseFrames(frames) {
  return frames
    .map((f) => f.match(/^data: (.+)\n\n$/))
    .filter(Boolean)
    .map((m) => JSON.parse(m[1]));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll `pred` until it returns truthy or the timeout elapses. NOTIFY crosses DB
// connections asynchronously — we can't assume the frame is present the instant
// the PUT resolves.
async function waitFor(pred, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return true;
    await sleep(25);
  }
  return !!pred();
}

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  // Importing app.js runs startSse(), which opens the single LISTEN connection
  // against DATABASE_URL (set above to the test DB) — the connection our NOTIFY
  // must reach. That LISTEN connects asynchronously; a NOTIFY fired before it is
  // established would be lost. Warm up: fire pg_notify on a sentinel graph_id we
  // subscribe and wait until it round-trips, proving the pipe is live before any
  // test issues writes.
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  _setAdapterForTests(makeHeaderAuthAdapter());

  const warmId = 'sse-warmup';
  const warmFrames = [];
  const warmRes = { write: (c) => warmFrames.push(String(c)) };
  subscribe(warmId, warmRes);
  const start = Date.now();
  while (warmFrames.length === 0 && Date.now() - start < 4000) {
    await pool.query(
      "SELECT pg_notify('graph_change', json_build_object('graph_id', $1::text, 'kind', 'warmup')::text)",
      [warmId],
    );
    await sleep(50);
  }
  unsubscribe(warmId, warmRes);
});

describe('report write over SSE (E16.8)', () => {
  let owner;
  let graph;

  beforeEach(async () => {
    owner = await makeUser(`rp-sse-owner-${Date.now()}`);
    graph = await makeGraph('sse-report-graph', owner.id);
  });

  it('emits one kind:report frame, no tasks/edges frames, and never bumps graphs.updated_at/version', async () => {
    const frames = [];
    const fakeRes = { write: (chunk) => frames.push(String(chunk)) };
    subscribe(graph.id, fakeRes);

    // Snapshot the graph row BEFORE the report write. The load-bearing half of
    // "zero impact": a report write must not move updated_at or version.
    const before = await pool.query(
      'SELECT updated_at, version FROM graphs WHERE id = $1',
      [graph.id],
    );

    // Owner PUT (report writes need `edit`; the owner qualifies) via header auth.
    // No X-Writer-Id is set, so no implicit presence frame fires — the only frame
    // this can produce is the report notify.
    const put = await request(app)
      .put(`/api/graphs/${graph.id}/report`)
      .set('X-Test-User-Id', owner.provider_user_id)
      .send({ title: 'Live report', description: 'd', body: '# Hello' });
    expect(put.status).toBe(200);

    // NOTIFY is delivered asynchronously across DB connections — poll for it.
    const arrived = await waitFor(
      () => parseFrames(frames).some((e) => e.graph_id === graph.id && e.kind === 'report'),
    );

    unsubscribe(graph.id, fakeRes);

    const events = parseFrames(frames).filter((e) => e.graph_id === graph.id);
    const reportFrames = events.filter((e) => e.kind === 'report');

    expect(arrived).toBe(true);
    // Exactly one frame for this graph, tagged the singular 'report' (NOT 'reports').
    expect(reportFrames).toHaveLength(1);
    expect(reportFrames[0].kind).toBe('report');
    // ZERO graph-edit frames — a report write must never look like a task/edge edit.
    expect(events.filter((e) => e.kind === 'tasks')).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'edges')).toHaveLength(0);

    // The graph row is byte-for-byte unchanged after the report write.
    const after = await pool.query(
      'SELECT updated_at, version FROM graphs WHERE id = $1',
      [graph.id],
    );
    expect(after.rows[0].version).toBe(before.rows[0].version);
    expect(after.rows[0].updated_at.getTime()).toBe(before.rows[0].updated_at.getTime());
  });
});
