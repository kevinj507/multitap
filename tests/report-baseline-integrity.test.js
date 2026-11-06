// E16.12 — staleness BASELINE integrity guard.
//
// Staleness (E16.6) means "the report is older than the latest graph change,"
// with graphs.updated_at as the baseline. The load-bearing invariant: a report
// write must NEVER bump graphs.updated_at. If it did, a freshly generated report
// would read as instantly stale (the graph would look newer than the report it
// just produced) and the ask-to-update gate would misfire. E16.1 gave `reports`
// its OWN trigger (notify_report_change) that only pg_notify's kind:'report' and
// never UPDATEs graphs — this file is the dedicated contract test for that
// isolation. It overlaps the E16.6 probe tests on purpose but focuses on:
//   - report writes (INSERT + UPDATE) leave graphs.updated_at/version untouched;
//   - the report notify is isolated (exactly one kind:report frame, ZERO
//     tasks/edges frames) over the real LISTEN/NOTIFY path in src/sse.js;
//   - the staleness baseline holds for the TASK path AND the EDGE path (E16.6
//     only exercised tasks) AND a graph rename (any graph write counts);
//   - a report re-write does NOT clear staleness.
//
// Setup mirrors tests/reports-api.test.js (header-auth adapter, getTestPool) and
// tests/report-sse.test.js (subscribe + fakeRes.write over the DB NOTIFY pipe).
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import { _setAdapterForTests } from '../src/auth/index.js';
import { makeHeaderAuthAdapter } from './__support__/test_auth.js';
import { subscribe, unsubscribe } from '../src/sse.js';

let app;
let pool;

const url = (gid) => `/api/graphs/${gid}/report`;
const metaUrl = (gid) => `/api/graphs/${gid}/report/meta`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A legacy owner-less graph (URL-bearer): both read + edit allowed with no user,
// so a report PUT needs no auth header — keeps the baseline assertions focused
// on the trigger behavior rather than the auth chain.
async function makeLegacyGraph(name = 'baseline') {
  return (await pool.query('INSERT INTO graphs (name) VALUES ($1) RETURNING id', [name])).rows[0].id;
}

// Insert a task directly — fires bump_graph_updated_at() (the shared trigger on
// tasks/edges), which is what MUST move graphs.updated_at for the report to go
// stale. Returns the new task id (needed to wire an edge).
async function insertTask(gid, title) {
  return (await pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [gid, `---\ntitle: ${title}\nstatus: todo\n---\n`, JSON.stringify({ title, status: 'todo' })],
  )).rows[0].id;
}

async function insertEdge(gid, sourceId, targetId) {
  return (await pool.query(
    `INSERT INTO edges (graph_id, source_id, target_id, type, purpose)
     VALUES ($1, $2, $3, 'related', 'related to') RETURNING id`,
    [gid, sourceId, targetId],
  )).rows[0].id;
}

async function graphRow(gid) {
  return (await pool.query('SELECT updated_at, version FROM graphs WHERE id = $1', [gid])).rows[0];
}

// Parse captured SSE frames ('data: <json>\n\n') into payload objects.
function parseFrames(frames) {
  return frames
    .map((f) => f.match(/^data: (.+)\n\n$/))
    .filter(Boolean)
    .map((m) => JSON.parse(m[1]));
}

// NOTIFY crosses DB connections asynchronously — poll rather than assume the
// frame lands the instant the PUT resolves.
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
  // against the test DB — the connection our report NOTIFY must reach. That
  // LISTEN connects asynchronously; a NOTIFY fired before it is established would
  // be lost. Warm up on a sentinel graph_id until a frame round-trips, proving
  // the pipe is live before the isolation test writes. (Copied from
  // tests/report-sse.test.js.)
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  _setAdapterForTests(makeHeaderAuthAdapter());

  const warmId = 'baseline-warmup';
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

describe('report write leaves the staleness baseline (graphs.updated_at) untouched', () => {
  it('a report PUT (INSERT then UPDATE) does not move graphs.updated_at or graphs.version', async () => {
    const gid = await makeLegacyGraph();
    const before = await graphRow(gid);

    // INSERT (first PUT) — the notify_report_change trigger fires but must not
    // touch graphs.
    expect((await request(app).put(url(gid)).send({ title: 'R1', body: 'x' })).status).toBe(200);
    // UPDATE (second PUT) — the ON CONFLICT DO UPDATE branch, same isolation.
    await sleep(5);
    expect((await request(app).put(url(gid)).send({ title: 'R2', body: 'y' })).status).toBe(200);

    const after = await graphRow(gid);
    expect(after.updated_at.getTime()).toBe(before.updated_at.getTime());
    expect(after.version).toBe(before.version);
  });

  it('the report notify is isolated: exactly one kind:report frame, ZERO tasks/edges frames', async () => {
    const gid = await makeLegacyGraph();
    const frames = [];
    const fakeRes = { write: (chunk) => frames.push(String(chunk)) };
    subscribe(gid, fakeRes);

    // URL-bearer PUT on a legacy graph: no writer identity, so the only frame
    // this can produce is the report notify from notify_report_change().
    const put = await request(app).put(url(gid)).send({ title: 'Live', body: '# hi' });
    expect(put.status).toBe(200);

    const arrived = await waitFor(
      () => parseFrames(frames).some((e) => e.graph_id === gid && e.kind === 'report'),
    );
    unsubscribe(gid, fakeRes);

    const events = parseFrames(frames).filter((e) => e.graph_id === gid);
    expect(arrived).toBe(true);
    // Exactly one frame, tagged the singular 'report' (NOT 'reports'), whose id
    // is the graph_id — a report's identity IS its graph.
    const reportFrames = events.filter((e) => e.kind === 'report');
    expect(reportFrames).toHaveLength(1);
    expect(reportFrames[0].id).toBe(gid);
    // The report write must never masquerade as a graph edit.
    expect(events.filter((e) => e.kind === 'tasks')).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'edges')).toHaveLength(0);
  });

  // E16.18 — the notify-isolation contract must also hold on the UPDATE branch a
  // regenerate takes (ON CONFLICT DO UPDATE), not just the first-PUT INSERT. The
  // trigger fires on INSERT OR UPDATE OR DELETE and is column-agnostic, so
  // moving generated_at must still emit exactly one report frame and zero
  // task/edge frames.
  it('a regenerate PUT (UPDATE branch) keeps the notify isolated: one report frame, ZERO tasks/edges', async () => {
    const gid = await makeLegacyGraph();

    // Subscribe BEFORE the INSERT, then wait for the INSERT's own frame and
    // discard it. src/sse.js resolves subscribers.get(graph_id) at DELIVERY
    // time, not at emit time, so a notify fired before subscribe() can still
    // land in this subscriber's window once the event loop is busy — which
    // made the "exactly one frame" assertion below intermittently see two.
    // Draining the INSERT frame first closes that window without weakening
    // anything the test asserts. (Proven: a notify emitted with no subscriber
    // attached is delivered to one that attaches 250ms later.)
    const frames = [];
    const fakeRes = { write: (chunk) => frames.push(String(chunk)) };
    subscribe(gid, fakeRes);

    await request(app).put(url(gid)).send({ title: 'First', body: 'x' }); // INSERT
    await waitFor(() => parseFrames(frames).some((e) => e.graph_id === gid && e.kind === 'report'));
    frames.length = 0;

    const put = await request(app).put(url(gid)).send({ title: 'Regen', body: 'y', regenerated: true }); // UPDATE
    expect(put.status).toBe(200);

    const arrived = await waitFor(
      () => parseFrames(frames).some((e) => e.graph_id === gid && e.kind === 'report'),
    );
    unsubscribe(gid, fakeRes);

    const events = parseFrames(frames).filter((e) => e.graph_id === gid);
    expect(arrived).toBe(true);
    expect(events.filter((e) => e.kind === 'report')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'tasks')).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'edges')).toHaveLength(0);
  });
});

describe('staleness baselines off graphs.updated_at (GET /report/meta)', () => {
  it('a report generated after the last change is NOT stale; a later TASK write flips it stale', async () => {
    const gid = await makeLegacyGraph();
    await sleep(5);
    await request(app).put(url(gid)).send({ title: 'R', body: 'x' });
    // No graph change since generation → fresh.
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(false);

    // A task INSERT bumps graphs.updated_at via bump_graph_updated_at().
    await sleep(5);
    await insertTask(gid, 'A');
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(true);
  });

  it('an EDGE write ALSO flips a fresh report stale (E16.6 only covered the task path)', async () => {
    const gid = await makeLegacyGraph();
    // Wire the nodes BEFORE generating the report so the edge below is the only
    // graph change after generation — the report must be fresh when created.
    const a = await insertTask(gid, 'A');
    const b = await insertTask(gid, 'B');
    await sleep(5);
    await request(app).put(url(gid)).send({ title: 'R', body: 'x' });
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(false);

    // An edge INSERT fires the same shared trigger → graphs.updated_at moves.
    await sleep(5);
    await insertEdge(gid, a, b);
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(true);
  });

  it('a graph RENAME also flips a fresh report stale — any graph write counts', async () => {
    const gid = await makeLegacyGraph('before');
    await sleep(5);
    await request(app).put(url(gid)).send({ title: 'R', body: 'x' });
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(false);

    // The staleness baseline is graphs.updated_at, so ANY write that bumps it —
    // task writes, edge writes, AND a plain rename/settings change — counts as a
    // graph change. This is intended: the reader banner asks to refresh after any
    // graph edit, not only structural task/edge edits. The PATCH /graphs route's
    // rename path does `SET name = ..., updated_at = NOW()`; we exercise that same
    // bump directly to keep the assertion off the OCC/manage-permission plumbing.
    await sleep(5);
    await pool.query('UPDATE graphs SET name = $1, updated_at = NOW() WHERE id = $2', ['after', gid]);
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(true);
  });

  it('a report re-write does NOT clear staleness (generated_at + graphs.updated_at both preserved)', async () => {
    const gid = await makeLegacyGraph();
    await sleep(5);
    const first = (await request(app).put(url(gid)).send({ title: 'R', body: 'x' })).body;

    // Make the graph newer than the report, then snapshot the baseline.
    await sleep(5);
    await insertTask(gid, 'A');
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(true);
    const baseline = await graphRow(gid);

    // Re-PUT the report: generated_at is preserved (set only on INSERT) and the
    // report trigger never touches graphs — so a re-write is NOT a regeneration
    // and staleness must persist.
    await sleep(5);
    const second = (await request(app).put(url(gid)).send({ title: 'R2', body: 'y' })).body;
    expect(second.generated_at).toBe(first.generated_at);

    const afterRewrite = await graphRow(gid);
    expect(afterRewrite.updated_at.getTime()).toBe(baseline.updated_at.getTime());
    expect(afterRewrite.version).toBe(baseline.version);
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(true);
  });

  // E16.18 — the opt-in counterpart to the test above. `regenerated: true`
  // declares a genuine regeneration built from the current graph, so the PUT
  // resets generated_at to NOW() and the report is fresh again — the escape
  // from the "stale flag latches forever" trap without a DELETE-then-PUT.
  it('a regeneration (regenerated: true) resets generated_at and clears staleness', async () => {
    const gid = await makeLegacyGraph();
    await sleep(5);
    const first = (await request(app).put(url(gid)).send({ title: 'R', body: 'x' })).body;

    // Make the graph newer than the report → stale.
    await sleep(5);
    await insertTask(gid, 'A');
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(true);
    const baseline = await graphRow(gid);

    // Regenerate: generated_at advances past the graph's last change, so the
    // report reads fresh again.
    await sleep(5);
    const regen = (await request(app).put(url(gid)).send({ title: 'R2', body: 'y', regenerated: true })).body;
    expect(new Date(regen.generated_at).getTime()).toBeGreaterThan(new Date(first.generated_at).getTime());

    // The graph baseline is STILL untouched — a report write (even a
    // regeneration) never bumps graphs.updated_at/version; only generated_at
    // moved, and it's now newer than the graph, so stale is false.
    const afterRegen = await graphRow(gid);
    expect(afterRegen.updated_at.getTime()).toBe(baseline.updated_at.getTime());
    expect(afterRegen.version).toBe(baseline.version);
    const meta = (await request(app).get(metaUrl(gid))).body;
    expect(new Date(meta.generated_at).getTime()).toBeGreaterThan(new Date(meta.graph_updated_at).getTime());
    expect(meta.stale).toBe(false);
  });

  it('regenerated must be a boolean (400 on a non-boolean string/number)', async () => {
    const gid = await makeLegacyGraph();
    for (const bad of ['yes', 1, 0]) {
      const res = await request(app).put(url(gid)).send({ title: 'R', body: 'x', regenerated: bad });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/regenerated must be a boolean/);
    }
  });

  // null is treated as absent (default false = preserve the clock), matching the
  // handler's other optional fields — a client serializer that emits null for an
  // unset boolean must NOT get a 400.
  it('regenerated: null is accepted and behaves as the default re-write (preserves generated_at)', async () => {
    const gid = await makeLegacyGraph();
    await sleep(5);
    const first = (await request(app).put(url(gid)).send({ title: 'R', body: 'x' })).body;
    await sleep(5);
    const res = await request(app).put(url(gid)).send({ title: 'R2', body: 'y', regenerated: null });
    expect(res.status).toBe(200);
    expect(res.body.generated_at).toBe(first.generated_at);
  });

  // Guard the default: a PUT that OMITS regenerated must behave exactly like the
  // historical re-write (preserve generated_at) — this is what keeps the
  // narration-scrub / typo-fix re-PUT from silently resetting the clock.
  it('omitting regenerated preserves generated_at (default is a re-write, not a regen)', async () => {
    const gid = await makeLegacyGraph();
    await sleep(5);
    const first = (await request(app).put(url(gid)).send({ title: 'R', body: 'x' })).body;
    await sleep(5);
    const second = (await request(app).put(url(gid)).send({ title: 'R2', body: 'y' })).body;
    expect(second.generated_at).toBe(first.generated_at);
    const third = (await request(app).put(url(gid)).send({ title: 'R3', body: 'z', regenerated: false })).body;
    expect(third.generated_at).toBe(first.generated_at);
  });
});

describe('GET /report/meta exposes the staleness baseline', () => {
  it('returns graph_updated_at equal to the graph current updated_at', async () => {
    const gid = await makeLegacyGraph();
    await sleep(5);
    await request(app).put(url(gid)).send({ title: 'R', body: 'x' });

    const g = await graphRow(gid);
    const res = await request(app).get(metaUrl(gid));
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    // Both the report timestamps AND the graph last-change timestamp are present,
    // so a client can compute "report older than graph" without guessing.
    expect(res.body).toHaveProperty('generated_at');
    expect(res.body).toHaveProperty('graph_updated_at');
    expect(new Date(res.body.graph_updated_at).getTime()).toBe(g.updated_at.getTime());
  });

  it('graph_updated_at tracks the latest graph change (advances after a task write)', async () => {
    const gid = await makeLegacyGraph();
    await sleep(5);
    await request(app).put(url(gid)).send({ title: 'R', body: 'x' });
    const t0 = new Date((await request(app).get(metaUrl(gid))).body.graph_updated_at).getTime();

    await sleep(5);
    await insertTask(gid, 'A');
    const meta = (await request(app).get(metaUrl(gid))).body;
    const t1 = new Date(meta.graph_updated_at).getTime();
    expect(t1).toBeGreaterThan(t0);
    // graph_updated_at now newer than the report → stale, consistent with the flag.
    expect(new Date(meta.generated_at).getTime()).toBeLessThan(t1);
    expect(meta.stale).toBe(true);
  });
});
