// E18.3 STEP 4 — the personal cursor: GET /changes and PUT /changes/seen.
//
// The trap this file exists to pin is IMPLICIT-ON-READ. A client polling every
// 5 s with a read that advances the cursor shows each change to exactly one
// poll and then loses it — racily, depending on whether the tab was focused
// when the poll fired. Reading NEVER moves the cursor, and the double-GET test
// is what says so.
//
// The second is the 4283-live-edges rule on a new column: a cursor write names
// `last_seen_seq` and nothing else, so `agent_follow` stays `null` for a user
// who never toggled it — which is exactly why that column lost its NOT NULL.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let dbPool;
let applySchema;
let gid;
let owner;
// src/routes/changes.js reaches src/db.js — imported inside beforeAll.
let SEEN_AHEAD_ERROR;
let CURSOR_ANONYMOUS_ERROR;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  dbPool = (await import('../src/db.js')).default;
  applySchema = (await import('../src/db.js')).applySchema;
  const changes = await import('../src/routes/changes.js');
  SEEN_AHEAD_ERROR = changes.SEEN_AHEAD_ERROR;
  CURSOR_ANONYMOUS_ERROR = changes.CURSOR_ANONYMOUS_ERROR;
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  owner = (await pool.query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('test-header', 'changes-owner', 'changes-owner@test.local', 'changes-owner') RETURNING *`,
  )).rows[0];
  gid = (await pool.query(
    `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('e18-changes', $1, 'viewer') RETURNING id`,
    [owner.id],
  )).rows[0].id;
});

const node = (meta) =>
  `---\n${Object.entries(meta).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')}\n---\n`;

const changesUrl = (g = gid) => `/api/graphs/${g}/changes`;
const asOwner = (r) => r.set('X-Test-User-Id', 'changes-owner');

async function mkNode(title, extra = {}) {
  const res = await asOwner(request(app).post(`/api/graphs/${gid}/tasks`))
    .send({ content: node({ title, status: 'review', ...extra }) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

const get = (q = '') => asOwner(request(app).get(changesUrl() + q));
const seen = (seq) => asOwner(request(app).put(`${changesUrl()}/seen`)).send({ seq });

describe('E18.3 the cursor — first visit, stored, and what a GET does NOT do', () => {
  it('with no row, source is "head" and unseen is 0 — the history is not "new"', async () => {
    await mkNode('A');
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.cursor).toMatchObject({ stored: true, last_seen_seq: null, source: 'head', degraded: null });
    expect(res.body.unseen).toBe(0);
    expect(res.body.events).toEqual([]);
    // ...and the GET did not write one.
    const { rows } = await pool.query('SELECT * FROM user_graph_prefs WHERE user_id = $1', [owner.id]);
    expect(rows).toHaveLength(0);
  });

  it('?since=0 is the explicit way to ask for the whole history', async () => {
    await mkNode('A');
    const res = await get('?since=0');
    expect(res.body.cursor.source).toBe('request');
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.since).toBe(0);
  });

  it('PUT /seen then GET reports source "stored" and unseen = head - seq', async () => {
    await mkNode('A');
    const head = (await get('?since=0')).body.head_seq;
    const put = await seen(head);
    expect(put.status).toBe(200);
    expect(put.body.last_seen_seq).toBe(head);
    expect(put.body.unseen).toBe(0);

    await mkNode('B');
    const after = await get();
    expect(after.body.cursor).toMatchObject({ source: 'stored', last_seen_seq: head });
    expect(after.body.unseen).toBe(after.body.head_seq - head);
    expect(after.body.events.every((e) => e.seq > head)).toBe(true);
    expect(after.body.events.length).toBeGreaterThan(0);
  });

  it('A GET DOES NOT MOVE THE CURSOR — two consecutive reads are identical', async () => {
    // The polling trap, pinned. Make a GET advance the cursor and this fails.
    await mkNode('A');
    await seen(1);
    await mkNode('B');
    const first = await get();
    const second = await get();
    expect(second.body.unseen).toBe(first.body.unseen);
    expect(second.body.cursor.last_seen_seq).toBe(first.body.cursor.last_seen_seq);
    expect(second.body.events.map((e) => e.seq)).toEqual(first.body.events.map((e) => e.seq));
  });

  it('GREATEST: a late PUT with a lower seq cannot rewind the cursor', async () => {
    await mkNode('A');
    await mkNode('B');
    const head = (await get('?since=0')).body.head_seq;
    expect(head).toBeGreaterThan(1);
    await seen(head);
    const backwards = await seen(1);
    expect(backwards.status).toBe(200);
    expect(backwards.body.last_seen_seq).toBe(head);
    // Idempotent under retry.
    expect((await seen(head)).body.last_seen_seq).toBe(head);
  });

  it('PUT above head_seq is a 400 and leaves the cursor alone', async () => {
    await mkNode('A');
    const head = (await get('?since=0')).body.head_seq;
    await seen(head);
    const ahead = await seen(head + 50);
    expect(ahead.status).toBe(400);
    expect(ahead.body.error).toBe(SEEN_AHEAD_ERROR);
    expect((await get()).body.cursor.last_seen_seq).toBe(head);
    expect((await seen(-1)).status).toBe(400);
    expect((await asOwner(request(app).put(`${changesUrl()}/seen`)).send({ seq: 'x' })).status).toBe(400);
  });
});

describe('E18.3 the cursor and agent_follow are independent fields', () => {
  it('a cursor write does NOT invent an agent_follow — it stays null', async () => {
    // The rule that cost 4283 live edges their meaning, on a new column. This
    // is why user_graph_prefs.agent_follow lost its NOT NULL.
    await mkNode('A');
    const put = await seen(1);
    expect(put.status).toBe(200);
    expect(put.body.agent_follow).toBeNull();
    const prefs = await asOwner(request(app).get(`/api/graphs/${gid}/prefs/me`));
    expect(prefs.status).toBe(200);
    expect(prefs.body).toEqual({ agent_follow: null });
  });

  it('setting agent_follow does not clear last_seen_seq, and vice versa', async () => {
    await mkNode('A');
    await seen(1);
    const toggled = await asOwner(request(app).put(`/api/graphs/${gid}/prefs/me`)).send({ agent_follow: false });
    expect(toggled.status).toBe(200);
    expect((await get()).body.cursor.last_seen_seq).toBe(1);

    await mkNode('B');
    const head = (await get('?since=0')).body.head_seq;
    await seen(head);
    const prefs = await asOwner(request(app).get(`/api/graphs/${gid}/prefs/me`));
    expect(prefs.body.agent_follow).toBe(false);
  });
});

describe('E18.3 anonymous viewers degrade honestly', () => {
  it('GET works with degraded: "anonymous"; PUT is 501, not 401', async () => {
    await mkNode('A');
    const res = await request(app).get(changesUrl() + '?since=0');
    expect(res.status).toBe(200);
    expect(res.body.cursor).toMatchObject({ stored: false, degraded: 'anonymous', source: 'request' });
    expect(res.body.events.length).toBeGreaterThan(0);

    // 501 and not 401 because they are AUTHORISED to read — the server simply
    // has nowhere to put the value — and the body names the fallback.
    const put = await request(app).put(`${changesUrl()}/seen`).send({ seq: 1 });
    expect(put.status).toBe(501);
    expect(put.body.error).toBe(CURSOR_ANONYMOUS_ERROR);
  });

  it('a signed-in user on a LEGACY owner-less graph still gets a stored cursor', async () => {
    // The constraint is SIGNED-IN, not OWNED: user_graph_prefs carries no
    // ownership predicate and canRead admits a legacy graph unconditionally.
    const legacy = (await pool.query("INSERT INTO graphs (name) VALUES ('legacy') RETURNING id")).rows[0].id;
    await pool.query(
      "INSERT INTO tasks (graph_id, content, meta) VALUES ($1, 'x', '{\"title\":\"t\"}'::jsonb)", [legacy]);
    const put = await request(app).put(`${changesUrl(legacy)}/seen`).set('X-Test-User-Id', 'changes-owner').send({ seq: 1 });
    expect(put.status).toBe(200);
    const res = await request(app).get(changesUrl(legacy)).set('X-Test-User-Id', 'changes-owner');
    expect(res.body.cursor).toMatchObject({ stored: true, source: 'stored', last_seen_seq: 1, degraded: null });
  });
});

describe('E18.3 the diff itself', () => {
  it('summarises by kind and by actor, counts touched nodes and edges, and names doubt triggers', async () => {
    const a = await mkNode('A', { confidence: 0.9 });
    const b = await mkNode('B', { confidence: 0.8 });
    const mark = (await get('?since=0')).body.head_seq;
    await asOwner(request(app).post(`/api/graphs/${gid}/edges`)).send({ source_id: a, target_id: b, purpose: 'supports' });
    await asOwner(request(app).post(`/api/graphs/${gid}/tasks/${a}/verify`))
      .send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await get(`?since=${mark}`);
    expect(res.body.summary.by_kind['edge.added']).toBe(1);
    expect(res.body.summary.by_kind['claim.refuted']).toBe(1);
    expect(res.body.summary.nodes_touched).toBe(1);
    expect(res.body.summary.edges_touched).toBe(1);
    expect(res.body.summary.by_actor[0].count).toBeGreaterThan(0);
    // ONE window, two answers: what changed AND what it broke.
    expect(res.body.doubt_triggers).toHaveLength(1);
    expect(res.body.doubt_triggers[0]).toMatchObject({ kind: 'refutation', subject_id: a, weight: 1 });
  });

  it('by_actor keeps a whole name, spaces and all, and an absent name as null', async () => {
    const mark = (await get('?since=0')).body.head_seq;
    for (let i = 0; i < 2; i++) {
      await asOwner(request(app).post(`/api/graphs/${gid}/tasks`))
        .set('X-Writer-Name', 'Kevin Joo')
        .send({ content: node({ title: `named ${i}`, status: 'review' }) });
    }
    await pool.query(
      "INSERT INTO tasks (graph_id, content, meta) VALUES ($1, 'x', '{\"title\":\"by the system\"}'::jsonb)", [gid]);

    const res = await get(`?since=${mark}`);
    const actors = res.body.summary.by_actor;
    expect(actors[0]).toEqual({ type: 'human', name: 'Kevin Joo', count: 2 });
    expect(actors.some((a) => a.name === 'Kevin')).toBe(false);
    expect(actors).toContainEqual({ type: 'system', name: null, count: 1 });
  });

  it('events are shapeEvent() verbatim — the same reader, not a second one', async () => {
    await mkNode('A');
    const viaChanges = (await get('?since=0')).body.events;
    const viaLog = (await asOwner(request(app).get(`/api/graphs/${gid}/events?since=0&format=json`))).body.events;
    expect(viaChanges).toEqual(viaLog);
  });

  it('paginates with limit, flags truncation, and next_seen_seq resumes correctly', async () => {
    for (let i = 0; i < 5; i += 1) await mkNode(`n${i}`);
    const page = await get('?since=0&limit=2');
    expect(page.body.events).toHaveLength(2);
    expect(page.body.truncated).toBe(true);
    expect(page.body.next_seen_seq).toBe(page.body.events[1].seq);
    const rest = await get(`?since=${page.body.next_seen_seq}`);
    expect(rest.body.events[0].seq).toBe(page.body.events[1].seq + 1);
    expect(rest.body.truncated).toBe(false);
    expect(rest.body.next_seen_seq).toBe(rest.body.head_seq);
    expect((await get('?since=abc')).status).toBe(400);
    expect((await get('?limit=0')).status).toBe(400);
  });

  it('sets Cache-Control: no-store — the log grows, a cached page goes stale', async () => {
    expect((await get()).headers['cache-control']).toBe('no-store');
  });
});

describe('E18.3 the schema widening', () => {
  it('applySchema is idempotent on a database already holding a cursor row', async () => {
    await mkNode('A');
    await seen(1);
    await applySchema(dbPool);
    await applySchema(dbPool);
    const { rows } = await pool.query(
      'SELECT last_seen_seq FROM user_graph_prefs WHERE user_id = $1 AND graph_id = $2', [owner.id, gid]);
    expect(Number(rows[0].last_seen_seq)).toBe(1);
  });

  it('agent_follow is nullable and the CHECK on last_seen_seq is in place', async () => {
    const { rows } = await pool.query(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_name = 'user_graph_prefs' AND column_name = 'agent_follow'`);
    expect(rows[0].is_nullable).toBe('YES');
    const check = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'ugp_last_seen_seq_sane'`);
    expect(check.rows[0].def).toContain('last_seen_seq');
    await expect(pool.query(
      'INSERT INTO user_graph_prefs (user_id, graph_id, last_seen_seq) VALUES ($1,$2,-5)', [owner.id, gid],
    )).rejects.toThrow();
  });
});

describe('E18.3 the cursor write survives the graph disappearing under it', () => {
  // REGRESSION — this used to be a bare 500 with no JSON body at all.
  //
  // requireGraph('read') loads the graph and takes NO LOCK on it, and the
  // cursor upsert runs in no transaction, so a concurrent DELETE /api/graphs/:id
  // — or POST /:id/rotate-id, which UPDATEs graphs.id — commits inside that
  // window and the FK check raises 23503 on user_graph_prefs_graph_id_fkey.
  // 404 is what requireGraph itself answers a moment later, so the client sees
  // one story instead of "500 now, 404 on retry".
  //
  // The race is DETERMINISTIC, not slept on: a second connection holds an
  // UNCOMMITTED DELETE, so requireGraph's plain SELECT still sees the row under
  // MVCC while the upsert's FK check blocks on that connection's row lock.
  // Committing the delete is what decides the FK check.
  it('PUT /changes/seen answers 404, not 500, when the graph is deleted mid-request', async () => {
    await mkNode('A');
    const killer = await pool.connect();
    let res;
    try {
      await killer.query('BEGIN');
      await killer.query('DELETE FROM graphs WHERE id = $1', [gid]);
      // `.then()` is what puts a supertest request in flight — without it the
      // COMMIT below would simply precede the whole call and we would be
      // testing the ordinary 404, not the race.
      const inflight = seen(1).then((r) => r);
      await new Promise((r) => setTimeout(r, 300));
      await killer.query('COMMIT');
      res = await inflight;
    } finally {
      killer.release();
    }
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('the ordinary write still succeeds — the guard did not swallow the happy path', async () => {
    await mkNode('A');
    const res = await seen(1);
    expect(res.status).toBe(200);
    expect(res.body.last_seen_seq).toBe(1);
  });
});
