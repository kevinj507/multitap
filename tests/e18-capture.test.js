// E18.1 STEP 2 — capture at every mutation site.
//
// STEP 1 installed the row triggers and the append primitive. This file is the
// proof that the two are actually wired together at all 15 places the app
// writes `tasks` or `edges`, and — just as load-bearing — that they are NOT
// wired anywhere they would manufacture noise.
//
// The restated DONE-WHEN, which every assertion below is a case of:
//
//     exactly ONE event per CHANGED row, and ZERO events for unchanged rows.
//
// The literal "one event per mutating route" is impossible under any design:
// `/edges/bulk` writes up to 500 rows and `/batch` up to 1500 in a single HTTP
// request. `request_id` is what groups that fan-out back into one user action.
//
// The four deliberate silences are each a test here, because each one is a
// place a naive log would lie: a claim-lease renewal (an agent renewing every
// few minutes forever), a claim release on a task that already moved on, an
// idempotent `/batch` re-run, and the mass `graph_id` rewrite `rotate-id`
// performs on every row of the graph. All four fall out of the trigger's
// `ch = '{}'` short-circuit rather than a per-site rule — which is why they
// stay true for write paths nobody has written yet.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;
// src/events/context.js imports src/db.js, which reads DATABASE_URL once at
// first import — so it is pulled in dynamically from beforeAll, never at module
// scope. (Same rule tests/access.test.js spells out for app.js.)
let HAPPENED_AT_ERROR;
let HAPPENED_AT_HEADER;
// High-water mark: `events()` reports only what happened after the last
// markLog(), so a site test asserts ONLY its own events. There is no "clear the
// log" — gt_events_append_only refuses DELETE with 0A000 unconditionally, and
// that refusal is the table's whole contract.
let logMark = 0;

beforeAll(async () => {
  // MUST precede the import of app.js: src/db.js reads DATABASE_URL once, at
  // first import, so a static import would bind the wrong database.
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
  const ctx = await import('../src/events/context.js');
  HAPPENED_AT_ERROR = ctx.HAPPENED_AT_ERROR;
  HAPPENED_AT_HEADER = ctx.HAPPENED_AT_HEADER;
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-capture') RETURNING id");
  gid = g.rows[0].id;
  logMark = 0;
});

// ── fixtures ────────────────────────────────────────────────────────────────

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const tasksUrl = (g = gid) => `/api/graphs/${g}/tasks`;
const edgesUrl = (g = gid) => `/api/graphs/${g}/edges`;
const batchUrl = (g = gid) => `/api/graphs/${g}/batch`;

async function events(g = gid, since = g === gid ? logMark : 0) {
  const { rows } = await pool.query(
    `SELECT graph_id, seq, kind, actor, subject_kind, subject_id, cause_id,
            request_id, happened_at, learned_at, payload
       FROM events WHERE graph_id = $1 AND seq > $2 ORDER BY seq`,
    [g, since],
  );
  return rows;
}
const kindsOf = (rows) => rows.map((r) => r.kind);

async function makeTask(title, extra = {}) {
  const res = await request(app)
    .post(tasksUrl())
    .send({ content: node({ title, status: 'todo', ...extra }) });
  expect(res.status).toBe(201);
  return res.body;
}

async function makeEdge(source, target, purpose = 'required for') {
  const res = await request(app)
    .post(edgesUrl())
    .send({ source_id: source, target_id: target, purpose });
  expect(res.status).toBe(201);
  return res.body;
}

// Move the reporting window past everything written so far, so the assertions
// that follow see only the events the site under test produced.
async function markLog() {
  const { rows } = await pool.query(
    'SELECT COALESCE(MAX(seq), 0) AS s FROM events WHERE graph_id = $1',
    [gid],
  );
  logMark = Number(rows[0].s);
}

// ── tasks.js ────────────────────────────────────────────────────────────────

describe('E18.1 capture — src/routes/tasks.js', () => {
  it('T1 POST /tasks — one node.created carrying the post-image', async () => {
    const t = await makeTask('A');
    const rows = await events();
    expect(kindsOf(rows)).toEqual(['node.created']);
    const e = rows[0];
    expect(e.subject_kind).toBe('node');
    expect(Number(e.subject_id)).toBe(t.id);
    expect(e.payload.op).toBe('INSERT');
    expect(e.payload.table).toBe('tasks');
    expect(e.payload.kinds).toEqual(['node.created']);
    expect(e.payload.after.content).toBe(t.content);
    // graph_id is stripped from the payload — it is already the row's key.
    expect(e.payload.after.graph_id).toBeUndefined();
    expect(e.request_id).toBeTruthy();
  });

  it('T1 POST /tasks — a 400 (bad frontmatter) writes NO event', async () => {
    const res = await request(app).post(tasksUrl()).send({ content: '---\ntitle: Bad: colon\n---\n' });
    expect(res.status).toBe(400);
    expect(await events()).toEqual([]);
  });

  it('T1 POST /tasks — an unknown graph is still a 404 from the mount guard', async () => {
    // requireGraphForMethod 404s before the handler runs, so tasks.js:49's
    // 23503 branch is a belt-and-braces path rather than the live one. What
    // matters for STEP 2 is that eventQuery did not change the status: the
    // pg error passthrough itself is pinned in tests/e18-append.test.js and,
    // end-to-end, by the 409 case in the edges block below.
    const res = await request(app)
      .post(tasksUrl('nosuchgraph'))
      .send({ content: node({ title: 'orphan' }) });
    expect(res.status).toBe(404);
    expect(await events('nosuchgraph', 0)).toEqual([]);
  });

  it('T2 PATCH /tasks/:id — a body-only edit is one node.patched with a content diff', async () => {
    const t = await makeTask('A');
    await markLog();
    const res = await request(app)
      .patch(`${tasksUrl()}/${t.id}`)
      .send({ content: node({ title: 'A', status: 'todo' }, 'new body') });
    expect(res.status).toBe(200);

    const rows = await events();
    expect(kindsOf(rows)).toEqual(['node.patched']);
    expect(rows[0].payload.kinds).toEqual(['node.patched']);
    const ch = rows[0].payload.changes;
    expect(Object.keys(ch)).toEqual(['content']);
    expect(ch.content.to).toContain('new body');
    expect(ch.content.from_sha).toMatch(/^[0-9a-f]{64}$/);
  });

  it('T2 PATCH /tasks/:id — a status change is headlined status.changed', async () => {
    const t = await makeTask('A');
    await markLog();
    const res = await request(app)
      .patch(`${tasksUrl()}/${t.id}`)
      .send({ content: node({ title: 'A', status: 'review' }) });
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('status.changed');
    // The content blob changed too (the frontmatter is re-serialized), so
    // node.patched rides along in `kinds` — nothing is discarded, the headline
    // is just the most specific derived kind.
    expect(rows[0].payload.kinds).toEqual(['status.changed', 'node.patched']);
    expect(rows[0].payload.changes['meta.status']).toEqual({ from: 'todo', to: 'review' });
  });

  it('T2 PATCH /tasks/:id — "from": null survives for a field that was unset', async () => {
    // NEVER jsonb_strip_nulls the payload: E18.4 needs "this was previously
    // unset" to tell a first assertion from a revision.
    const t = await makeTask('A');
    await markLog();
    await request(app)
      .patch(`${tasksUrl()}/${t.id}`)
      .send({ content: node({ title: 'A', status: 'todo', confidence: 0.9 }) });

    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('field.set');
    expect(rows[0].payload.changes['meta.confidence']).toEqual({ from: null, to: 0.9 });
    expect('from' in rows[0].payload.changes['meta.confidence']).toBe(true);
  });

  it('T3 DELETE /tasks/:id — one node.removed carrying the pre-image', async () => {
    const t = await makeTask('A');
    await markLog();
    const res = await request(app).delete(`${tasksUrl()}/${t.id}`);
    expect(res.status).toBe(200);

    const rows = await events();
    expect(kindsOf(rows)).toEqual(['node.removed']);
    expect(Number(rows[0].subject_id)).toBe(t.id);
    expect(rows[0].payload.before.content).toBe(t.content);
    expect(rows[0].payload.graph_deleted).toBe(false);
  });

  it('T3 DELETE /tasks/:id — the FK cascade the handler never sees is captured', async () => {
    // The handler returns {deleted: <task id>} and never learns which edges
    // the cascade destroyed. The database does — mid-statement — and the
    // BEFORE-DELETE task trigger is what lets each edge point cause_id at it.
    const hub = await makeTask('hub');
    const a = await makeTask('a');
    const b = await makeTask('b');
    const c = await makeTask('c');
    await makeEdge(a.id, hub.id);
    await makeEdge(hub.id, b.id);
    await makeEdge(hub.id, c.id, 'supports');
    await markLog();

    const res = await request(app).delete(`${tasksUrl()}/${hub.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: hub.id });

    const rows = await events();
    expect(kindsOf(rows)).toEqual([
      'node.removed', 'edge.removed', 'edge.removed', 'edge.removed',
    ]);
    const removedNode = rows[0];
    for (const e of rows.slice(1)) {
      expect(Number(e.cause_id)).toBe(Number(removedNode.seq));
      expect(Number(e.payload.cascade_from)).toBe(hub.id);
      // events_cause_precedes: cause_id < seq, so the cause graph is a strict DAG.
      expect(Number(e.cause_id)).toBeLessThan(Number(e.seq));
    }
    // One HTTP request, one request_id across the whole fan-out.
    expect(new Set(rows.map((r) => r.request_id)).size).toBe(1);
  });

  it('T4 claim RENEWAL — ZERO events', async () => {
    const t = await makeTask('A');
    const acq = await request(app)
      .post(`${tasksUrl()}/${t.id}/claim`)
      .set('X-Writer-Id', 'w1')
      .send({});
    expect(acq.status).toBe(200);
    await markLog();

    const renew = await request(app)
      .post(`${tasksUrl()}/${t.id}/claim`)
      .set('X-Writer-Id', 'w1')
      .send({});
    expect(renew.status).toBe(200);
    expect(renew.body.renewed).toBe(true);
    // claim_* are lease state, not graph facts: drop_cols suppresses them, the
    // diff is empty, nothing is logged. An agent renewing forever is silent.
    expect(await events()).toEqual([]);
  });

  it('T5 claim ACQUIRE — one status.changed with payload.reason = "claim"', async () => {
    const t = await makeTask('A');
    await markLog();
    const res = await request(app)
      .post(`${tasksUrl()}/${t.id}/claim`)
      .set('X-Writer-Id', 'w1')
      .set('X-Writer-Name', 'Otter')
      .send({});
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('status.changed');
    expect(rows[0].payload.reason).toBe('claim');
    expect(rows[0].payload.changes['meta.status']).toEqual({ from: 'todo', to: 'in_progress' });
    expect(rows[0].actor.id).toBe('w1');
  });

  it('T6 claim RELEASE of in_progress work — one status.changed, reason "release"', async () => {
    const t = await makeTask('A');
    await request(app).post(`${tasksUrl()}/${t.id}/claim`).set('X-Writer-Id', 'w1').send({});
    await markLog();

    const res = await request(app).delete(`${tasksUrl()}/${t.id}/claim`).set('X-Writer-Id', 'w1');
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('status.changed');
    expect(rows[0].payload.reason).toBe('release');
    expect(rows[0].payload.changes['meta.status']).toEqual({ from: 'in_progress', to: 'todo' });
  });

  it('T7 claim RELEASE on a task that moved on — ZERO events', async () => {
    const t = await makeTask('A');
    await request(app).post(`${tasksUrl()}/${t.id}/claim`).set('X-Writer-Id', 'w1').send({});
    // A human moves it to review; only the stale lease fields are left to shed.
    await request(app)
      .patch(`${tasksUrl()}/${t.id}`)
      .send({ content: node({ title: 'A', status: 'review' }) });
    await markLog();

    const res = await request(app).delete(`${tasksUrl()}/${t.id}/claim`).set('X-Writer-Id', 'w1');
    expect(res.status).toBe(200);
    // The route bumps `version` on this branch, but that is bookkeeping the
    // event's own seq supersedes — it is in drop_cols, so the diff is empty.
    expect(await events()).toEqual([]);
  });
});

// ── edges.js ────────────────────────────────────────────────────────────────

describe('E18.1 capture — src/routes/edges.js', () => {
  it('E1 POST /edges — one edge.added carrying the post-image', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    await markLog();
    const e = await makeEdge(a.id, b.id);

    const rows = await events();
    expect(kindsOf(rows)).toEqual(['edge.added']);
    expect(rows[0].subject_kind).toBe('edge');
    expect(Number(rows[0].subject_id)).toBe(e.id);
    expect(rows[0].payload.after.source_id).toBe(a.id);
    expect(rows[0].payload.after.target_id).toBe(b.id);
    expect(rows[0].payload.after.purpose).toBe('required for');
  });

  it('E1 POST /edges — a duplicate still 409s: withEventTx rethrows pg errors unchanged', async () => {
    // The whole point of the drop-in contract: the SAME error object reaches
    // the handler (after ROLLBACK), so `err.code === '23505'` keeps working.
    const a = await makeTask('a');
    const b = await makeTask('b');
    await makeEdge(a.id, b.id);
    await markLog();

    const res = await request(app)
      .post(edgesUrl())
      .send({ source_id: a.id, target_id: b.id, purpose: 'required for' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('edge already exists');
    expect(await events()).toEqual([]);
  });

  it('E1 POST /edges — a rejected cycle leaves NO event (the txn rolled back)', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    await makeEdge(a.id, b.id);
    await markLog();

    const res = await request(app)
      .post(edgesUrl())
      .send({ source_id: b.id, target_id: a.id, purpose: 'required for' });
    expect(res.status).toBe(400);
    expect(await events()).toEqual([]);
  });

  it('E2 POST /edges/bulk — one edge.added per row, all sharing one request_id', async () => {
    const ids = [];
    for (const t of ['a', 'b', 'c', 'd']) ids.push((await makeTask(t)).id);
    await markLog();

    const res = await request(app)
      .post(`${edgesUrl()}/bulk`)
      .send({
        edges: [
          { source_id: ids[0], target_id: ids[1], purpose: 'required for' },
          { source_id: ids[1], target_id: ids[2], purpose: 'required for' },
          { source_id: ids[2], target_id: ids[3], purpose: 'supports' },
        ],
      });
    expect(res.status).toBe(201);

    const rows = await events();
    expect(kindsOf(rows)).toEqual(['edge.added', 'edge.added', 'edge.added']);
    expect(new Set(rows.map((r) => r.request_id)).size).toBe(1);
    expect(rows.map((r) => Number(r.subject_id))).toEqual(res.body.edges.map((e) => e.id));
  });

  it('E3 PATCH /edges/:id — a purpose change is edge.retyped', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    const e = await makeEdge(a.id, b.id, 'supports');
    await markLog();

    const res = await request(app).patch(`${edgesUrl()}/${e.id}`).send({ purpose: 'contradicts' });
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('edge.retyped');
    expect(rows[0].payload.kinds).toEqual(['edge.retyped']);
    expect(rows[0].payload.changes.purpose).toEqual({ from: 'supports', to: 'contradicts' });
  });

  it('E3 PATCH /edges/:id — a rewire is edge.rewired, not edge.patched', async () => {
    // A separate kind because E18.4 worldlines need a rewire to close one
    // validity interval and open another.
    const a = await makeTask('a');
    const b = await makeTask('b');
    const c = await makeTask('c');
    const e = await makeEdge(a.id, b.id, 'supports');
    await markLog();

    const res = await request(app).patch(`${edgesUrl()}/${e.id}`).send({ target_id: c.id });
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('edge.rewired');
    expect(rows[0].payload.changes.target_id).toEqual({ from: b.id, to: c.id });
  });

  it('E3 PATCH /edges/:id — a meta-only tweak is edge.patched', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    const e = await makeEdge(a.id, b.id, 'supports');
    await markLog();

    const res = await request(app)
      .patch(`${edgesUrl()}/${e.id}`)
      .send({ meta: { color: '#ff0000' } });
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('edge.patched');
    expect(rows[0].payload.changes['meta.color']).toEqual({ from: null, to: '#ff0000' });
  });

  it('E4 DELETE /edges/:id — one edge.removed, and NO cascade_from', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    const e = await makeEdge(a.id, b.id);
    await markLog();

    const res = await request(app).delete(`${edgesUrl()}/${e.id}`);
    expect(res.status).toBe(200);

    const rows = await events();
    expect(kindsOf(rows)).toEqual(['edge.removed']);
    // Both endpoints still exist, so this is a deliberate unwiring, not a
    // cascade — cascade_from stays null and cause_id is unset.
    expect(rows[0].payload.cascade_from).toBeNull();
    expect(rows[0].cause_id).toBeNull();
    expect(rows[0].payload.before.source_id).toBe(a.id);
  });
});

// ── batch.js ────────────────────────────────────────────────────────────────

describe('E18.1 capture — src/routes/batch.js', () => {
  it('B1/B3 POST /batch — one event per created row, one request_id for the call', async () => {
    const res = await request(app)
      .post(batchUrl())
      .send({
        nodes: [
          { external_id: 'n1', content: node({ title: 'one' }) },
          { external_id: 'n2', content: node({ title: 'two' }) },
        ],
        edges: [{ source: 'n1', target: 'n2', purpose: 'required for' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.created).toEqual({ nodes: 2, edges: 1 });

    const rows = await events();
    expect(kindsOf(rows)).toEqual(['node.created', 'node.created', 'edge.added']);
    expect(new Set(rows.map((r) => r.request_id)).size).toBe(1);
  });

  it('B2/B4 POST /batch — one event per CHANGED row on re-upsert', async () => {
    await request(app)
      .post(batchUrl())
      .send({
        nodes: [
          { external_id: 'n1', content: node({ title: 'one' }) },
          { external_id: 'n2', content: node({ title: 'two' }) },
        ],
        edges: [{ source: 'n1', target: 'n2', purpose: 'supports' }],
      });
    await markLog();

    const res = await request(app)
      .post(batchUrl())
      .send({
        nodes: [
          { external_id: 'n1', content: node({ title: 'one' }, 'a body now') },
          { external_id: 'n2', content: node({ title: 'two' }) }, // unchanged
        ],
        edges: [{ source: 'n1', target: 'n2', purpose: 'contradicts' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.updated).toEqual({ nodes: 1, edges: 1 });
    expect(res.body.unchanged.nodes).toBe(1);

    const rows = await events();
    // n2 changed nothing, so n2 gets NO event — that is the whole rule.
    expect(kindsOf(rows)).toEqual(['node.patched', 'edge.retyped']);
  });

  it('POST /batch — an IDEMPOTENT re-run writes ZERO events', async () => {
    const body = {
      nodes: [
        { external_id: 'n1', content: node({ title: 'one' }) },
        { external_id: 'n2', content: node({ title: 'two' }) },
      ],
      edges: [{ source: 'n1', target: 'n2', purpose: 'required for' }],
    };
    const first = await request(app).post(batchUrl()).send(body);
    expect(first.status).toBe(200);
    await markLog();

    const again = await request(app).post(batchUrl()).send(body);
    expect(again.status).toBe(200);
    expect(again.body.unchanged).toEqual({ nodes: 2, edges: 1 });
    expect(await events()).toEqual([]);
  });

  it('POST /batch — a rolled-back batch (cycle) leaves ZERO events', async () => {
    const res = await request(app)
      .post(batchUrl())
      .send({
        nodes: [
          { external_id: 'n1', content: node({ title: 'one' }) },
          { external_id: 'n2', content: node({ title: 'two' }) },
        ],
        edges: [
          { source: 'n1', target: 'n2', purpose: 'required for' },
          { source: 'n2', target: 'n1', purpose: 'required for' },
        ],
      });
    expect(res.status).toBe(400);
    expect(await events()).toEqual([]);
  });
});

// ── graphs.js ───────────────────────────────────────────────────────────────

describe('E18.1 capture — src/routes/graphs.js', () => {
  it('DELETE /graphs/:id — tombstone FIRST, compact per-row payloads, log survives', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    await makeEdge(a.id, b.id);
    const before = await events();
    expect(before.length).toBe(3);
    const beforeSeqs = before.map((r) => Number(r.seq));
    const totalBefore = Number((await pool.query('SELECT count(*) FROM events')).rows[0].count);

    const res = await request(app).delete(`/api/graphs/${gid}`);
    expect(res.status).toBe(200);

    // The graphs row is gone; events and graph_snapshots carry NO foreign key
    // to graphs precisely so the history outlives it.
    expect((await pool.query('SELECT 1 FROM graphs WHERE id = $1', [gid])).rowCount).toBe(0);
    const rows = await events();
    expect(kindsOf(rows).slice(3)).toEqual(['graph.deleted', 'node.removed', 'node.removed', 'edge.removed']);
    // Every event that existed before the delete is still there, unchanged.
    expect(rows.map((r) => Number(r.seq))).toEqual([...beforeSeqs, 4, 5, 6, 7]);
    const totalAfter = Number((await pool.query('SELECT count(*) FROM events')).rows[0].count);
    expect(totalAfter).toBe(totalBefore + 4);

    const tomb = rows[3];
    expect(tomb.subject_kind).toBe('graph');
    expect(tomb.payload.node_count).toBe(2);
    expect(tomb.payload.edge_count).toBe(1);
    // Per-row payloads go compact: the tombstone already says how big the
    // graph was, and 5,000 pre-images would be pure bloat.
    for (const e of rows.slice(4)) {
      expect(e.payload.graph_deleted).toBe(true);
      expect(e.payload.before).toBeNull();
    }
  });

  it('POST /graphs/:id/rotate-id — ONE graph.id_rotated, nothing stranded, child tables silent', async () => {
    const u = (await pool.query(
      `INSERT INTO users (provider, provider_user_id, email, display_name)
       VALUES ('test-header', 'rot-owner', 'rot-owner@test.local', 'Rot') RETURNING *`,
    )).rows[0];
    const owned = (await pool.query(
      `INSERT INTO graphs (name, owner_user_id) VALUES ('rot', $1) RETURNING id`,
      [u.id],
    )).rows[0].id;
    for (const t of ['a', 'b']) {
      await request(app)
        .post(tasksUrl(owned))
        .set('X-Test-User-Id', 'rot-owner')
        .send({ content: node({ title: t }) });
    }
    const idsBefore = (await pool.query(
      'SELECT seq FROM events WHERE graph_id = $1 ORDER BY seq', [owned],
    )).rows.map((r) => Number(r.seq));
    expect(idsBefore).toEqual([1, 2]);

    const res = await request(app)
      .post(`/api/graphs/${owned}/rotate-id`)
      .set('X-Test-User-Id', 'rot-owner')
      .send({});
    expect(res.status).toBe(200);
    const newId = res.body.id;
    expect(newId).not.toBe(owned);

    // Nothing stranded on the old id — there is no FK to cascade it, so
    // gt_log_graph moves the rows itself.
    expect((await pool.query('SELECT 1 FROM events WHERE graph_id = $1', [owned])).rowCount).toBe(0);
    const rows = await events(newId);
    // The ON UPDATE CASCADE rewrote graph_id on every task and edge row; not
    // one of those produced an event (graph_id is in the loggers' drop_cols).
    expect(kindsOf(rows)).toEqual(['node.created', 'node.created', 'graph.id_rotated']);
    const rot = rows[2];
    expect(rot.subject_kind).toBe('graph');
    expect(rot.payload.changes.graph_id).toEqual({ from: owned, to: newId });
    expect(rot.actor.user_id).toBe(u.id);
  });
});

// ── backdating ──────────────────────────────────────────────────────────────

describe('E18.1 capture — backdating', () => {
  const PAST = '2020-03-04T05:06:07.000Z';

  it('honours happened_at from the JSON body and flags it', async () => {
    const res = await request(app)
      .post(tasksUrl())
      .send({ content: node({ title: 'backdated' }), happened_at: PAST });
    expect(res.status).toBe(201);

    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0].happened_at).toISOString()).toBe(PAST);
    // learned_at is BELIEF time and is accepted from nowhere — the database
    // stamps it with clock_timestamp(), so a backdated claim can never be
    // disguised as something we knew all along.
    expect(new Date(rows[0].learned_at).getTime()).toBeGreaterThan(Date.parse(PAST));
    expect(rows[0].payload.backdated).toBe(true);
  });

  it('honours X-Happened-At on the body-less DELETE routes', async () => {
    const t = await makeTask('A');
    await markLog();
    const res = await request(app)
      .delete(`${tasksUrl()}/${t.id}`)
      .set(HAPPENED_AT_HEADER, PAST);
    expect(res.status).toBe(200);

    const rows = await events();
    expect(kindsOf(rows)).toEqual(['node.removed']);
    expect(new Date(rows[0].happened_at).toISOString()).toBe(PAST);
    expect(rows[0].payload.backdated).toBe(true);
  });

  it('a present-time write is NOT flagged as backdated', async () => {
    await makeTask('A');
    const rows = await events();
    expect(rows[0].payload.backdated).toBeUndefined();
  });

  it('rejects a malformed happened_at with 400 and writes NOTHING', async () => {
    const res = await request(app)
      .post(tasksUrl())
      .send({ content: node({ title: 'nope' }), happened_at: 'yesterday' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(HAPPENED_AT_ERROR);
    expect(await events()).toEqual([]);
    expect((await pool.query('SELECT 1 FROM tasks WHERE graph_id = $1', [gid])).rowCount).toBe(0);
  });

  it('rejects a happened_at more than a day in the future', async () => {
    const far = new Date(Date.now() + 3 * 86400000).toISOString();
    const res = await request(app)
      .post(tasksUrl())
      .send({ content: node({ title: 'nope' }), happened_at: far });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(HAPPENED_AT_ERROR);
    expect(await events()).toEqual([]);
  });

  it('rejects a malformed X-Happened-At on every mutating surface', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    const e = await makeEdge(a.id, b.id);
    await markLog();
    const bad = (r) => r.set(HAPPENED_AT_HEADER, 'not-a-time');

    expect((await bad(request(app).patch(`${tasksUrl()}/${a.id}`)).send({ content: node({ title: 'x' }) })).status).toBe(400);
    expect((await bad(request(app).delete(`${edgesUrl()}/${e.id}`))).status).toBe(400);
    expect((await bad(request(app).post(`${edgesUrl()}/bulk`)).send({ edges: [] })).status).toBe(400);
    expect((await bad(request(app).post(batchUrl())).send({ nodes: [] })).status).toBe(400);
    expect((await bad(request(app).delete(`/api/graphs/${gid}`))).status).toBe(400);
    expect(await events()).toEqual([]);
  });

  it('learned_at is accepted from nowhere — a client-sent value is ignored', async () => {
    const res = await request(app)
      .post(tasksUrl())
      .send({ content: node({ title: 'A' }), learned_at: '1999-01-01T00:00:00.000Z' });
    expect(res.status).toBe(201);
    const rows = await events();
    expect(new Date(rows[0].learned_at).getFullYear()).toBeGreaterThan(2020);
  });
});

// ── the actor matrix ────────────────────────────────────────────────────────

describe('E18.1 capture — actor attribution', () => {
  it('anonymous → type human, no user_id', async () => {
    await makeTask('A');
    const [e] = await events();
    expect(e.actor.type).toBe('human');
    // gt_actor() jsonb_strip_nulls's the object, so an unknown field is ABSENT
    // rather than JSON null — `?? null` is the read idiom.
    expect(e.actor.user_id ?? null).toBeNull();
    expect(e.actor.via ?? null).toBeNull();
  });

  it('X-Writer-Type: agent → type agent, client id and name carried', async () => {
    const res = await request(app)
      .post(tasksUrl())
      .set('X-Writer-Type', 'agent')
      .set('X-Writer-Id', 'sess-7')
      .set('X-Writer-Name', "Quiet Otter's Claude")
      .send({ content: node({ title: 'A' }) });
    expect(res.status).toBe(201);

    const [e] = await events();
    expect(e.actor.type).toBe('agent');
    expect(e.actor.id).toBe('sess-7');
    expect(e.actor.name).toBe("Quiet Otter's Claude");
  });

  it('a session user → type human with the user id', async () => {
    await pool.query(
      `INSERT INTO users (provider, provider_user_id, email, display_name)
       VALUES ('test-header', 'sess-user', 'sess-user@test.local', 'Sessy')`,
    );
    const res = await request(app)
      .post(tasksUrl())
      .set('X-Test-User-Id', 'sess-user')
      .send({ content: node({ title: 'A' }) });
    expect(res.status).toBe(201);

    const [e] = await events();
    expect(e.actor.type).toBe('human');
    expect(e.actor.via).toBe('session');
    // ensureUserRow() rewrites display_name from the adapter's payload on
    // every verify, so the name is the provider id the test adapter supplies.
    expect(e.actor.name).toBe('sess-user');
    const u = await pool.query(`SELECT id FROM users WHERE provider_user_id = 'sess-user'`);
    expect(e.actor.user_id).toBe(u.rows[0].id);
  });

  it('a bearer agent token → type agent, via agent_token, name resolved from the operator', async () => {
    const u = (await pool.query(
      `INSERT INTO users (provider, provider_user_id, email, display_name)
       VALUES ('test-header', 'tok-owner', 'tok-owner@test.local', 'Kevin') RETURNING *`,
    )).rows[0];
    const { createToken } = await import('../src/auth/agent_tokens.js');
    const { token } = await createToken(u.id, 'e18-capture');

    const res = await request(app)
      .post(tasksUrl())
      .set('Authorization', `Bearer ${token}`)
      .send({ content: node({ title: 'A' }) });
    expect(res.status).toBe(201);

    const [e] = await events();
    // A bearer agent token IS an agent even though the client never sent
    // X-Writer-Type: agent — req.writerType alone would have said 'human'.
    expect(e.actor.type).toBe('agent');
    expect(e.actor.via).toBe('agent_token');
    expect(e.actor.name).toBe("Kevin's Claude");
    expect(e.actor.user_id).toBe(u.id);
  });

  it('a direct pool.query write still produces an event, attributed to system', async () => {
    // Fails OPEN: a missing actor is an incomplete record; a missing event is
    // a corrupted fold. Every out-of-band writer (eval scripts, psql, the
    // boot-time backfills in schema.sql) lands here rather than nowhere.
    await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3)`,
      [gid, node({ title: 'raw' }), JSON.stringify({ title: 'raw', status: 'todo' })],
    );
    const [e] = await events();
    expect(e.kind).toBe('node.created');
    expect(e.actor).toEqual({ type: 'system' });
  });
});
