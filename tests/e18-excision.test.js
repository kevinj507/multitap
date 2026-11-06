// E18.6 — EXCISION: the one way bytes leave the append-only log.
//
// Two verbs, never one. DELETE /tasks/:id is an event that KEEPS its pre-image
// (tests/e18-capture.test.js T3): history is the product. Excision is the
// rare, owner-only, reason-required act for bytes that must not exist, and it
// is enforced in the database, not in the route:
//
//   * one `node.excised` event is appended (subject = the node, actor, reason,
//     counts, `node_present`, and `after` = the live meta/content_sha when the
//     node still exists — never a body);
//   * every EARLIER event of that subject is blanked to a marker: the payload
//     minus after/before/changes/reason/intent, plus `excised: true` and
//     `excised_by_seq` — so seq, kind, both clocks, actor, cause_id, kinds,
//     node_kind and version all survive. History keeps its SHAPE;
//   * gt_events_append_only admits EXACTLY that marker, tied to a `node.excised`
//     event for the same subject later in the log, under `gt.excising`, and
//     raises 0A000 on everything else — including a no-op rewrite;
//   * `payload_hash` (a salted commitment stamped at insert) survives the
//     blanking and `payload_salt` does not, so an external anchor over the
//     envelope + hash stays valid while the erased bytes cannot be brute-forced.
//
// Every assertion below is a case of one of those four.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;
let canonicalJson;
let stateSha;
let verifySnapshot;
let EVENT_KINDS;

beforeAll(async () => {
  // MUST precede the import of app.js: src/db.js reads DATABASE_URL once.
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
  ({ canonicalJson, stateSha } = await import('../src/events/fold.js'));
  ({ verifySnapshot } = await import('../src/events/snapshot.js'));
  ({ EVENT_KINDS } = await import('../src/events/kinds.js'));
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-excision') RETURNING id");
  gid = g.rows[0].id;
});

// ── fixtures ────────────────────────────────────────────────────────────────

// The string that must not survive. Distinctive so a `LIKE` over every payload
// in the graph is a complete search, not a spot check.
const SECRET = 'sk-live-EXCISE-ME-4242';

const node = (title, body = '') => `---\ntitle: ${title}\nstatus: todo\n---\n${body}`;
const tasksUrl = (g = gid) => `/api/graphs/${g}/tasks`;

async function events(g = gid) {
  const { rows } = await pool.query(
    `SELECT seq, kind, subject_kind, subject_id, cause_id, actor, request_id, txid,
            learned_at, happened_at, payload, payload_hash, payload_salt
       FROM events WHERE graph_id = $1 ORDER BY seq`,
    [g],
  );
  return rows;
}

async function makeTask(title, body, g = gid) {
  const res = await request(app).post(tasksUrl(g)).send({ content: node(title, body) });
  expect(res.status).toBe(201);
  return res.body;
}

async function patchTask(id, title, body) {
  const res = await request(app).patch(`${tasksUrl()}/${id}`).send({ content: node(title, body) });
  expect(res.status).toBe(200);
  return res.body;
}

function excise(id, body = { reason: 'legal request #1' }, headers = {}, g = gid) {
  let q = request(app).post(`${tasksUrl(g)}/${id}/excise`);
  for (const [k, v] of Object.entries(headers)) q = q.set(k, v);
  return q.send(body);
}

async function graphAt(seq, g = gid) {
  const res = await request(app).get(`/api/graphs/${g}/graph?asOfSeq=${seq}`);
  expect(res.status).toBe(200);
  return res.body;
}

const nodeIn = (view, id) => (view.nodes ?? []).find((n) => Number(n.id) === Number(id)) ?? null;

async function secretCount(g = gid) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM events WHERE graph_id = $1 AND payload::text LIKE $2`,
    [g, `%${SECRET}%`],
  );
  return rows[0].n;
}

// Under the SAME provider the header adapter (tests/__support__/test_auth.js)
// upserts with, so `X-Test-User-Id: <provider_user_id>` resolves to THIS row
// rather than minting a second, unrelated user.
async function makeUser(suffix) {
  const r = await pool.query(
    `INSERT INTO users (provider, provider_user_id, email)
     VALUES ('test-header', $1, $2) RETURNING *`,
    [`pid-${suffix}`, `${suffix}@test.local`],
  );
  return r.rows[0];
}

// The marker gt_excise_node writes, built the same way, so the trigger tests
// can hand the trigger a PERFECT marker and vary exactly one thing.
const MARKER_SQL = `(payload - 'after' - 'before' - 'changes' - 'reason' - 'intent')
                    || jsonb_build_object('excised', true, 'excised_by_seq', $2::bigint)`;

// ── the vocabulary ──────────────────────────────────────────────────────────

describe('E18.6 — vocabulary', () => {
  it('node.excised is in EVENT_KINDS and in the schema CHECK', async () => {
    expect(EVENT_KINDS).toContain('node.excised');
    const { rows } = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'events_kind_valid'`,
    );
    expect(rows[0].def).toContain("'node.excised'");
  });
});

// ── the commitment ──────────────────────────────────────────────────────────

describe('E18.6 — payload commitment', () => {
  it('every event is stamped with a salt and a hash that recomputes from the stored row', async () => {
    await makeTask('A', 'body');
    const rows = await events();
    expect(rows.length).toBeGreaterThan(0);
    for (const e of rows) {
      expect(e.payload_salt).toMatch(/^[0-9a-f]{32}$/);
      expect(e.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    }
    const { rows: chk } = await pool.query(
      `SELECT bool_and(payload_hash = encode(sha256(convert_to(payload_salt || payload::text, 'UTF8')), 'hex')) AS ok
         FROM events WHERE graph_id = $1`,
      [gid],
    );
    expect(chk[0].ok).toBe(true);
  });
});

// ── excising a node that no longer exists (the common case) ─────────────────

describe('E18.6 — excising a deleted node', () => {
  it('blanks every earlier event to the marker, keeps the shape, and the bytes are gone', async () => {
    const a = await makeTask('A', `the key is ${SECRET}`);
    await patchTask(a.id, 'A', `still ${SECRET} here`);
    const del = await request(app).delete(`${tasksUrl()}/${a.id}`);
    expect(del.status).toBe(200);

    const before = await events();
    expect(before.map((e) => e.kind)).toEqual(['node.created', 'node.patched', 'node.removed']);
    expect(await secretCount()).toBeGreaterThan(0);

    const res = await excise(a.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      seq: 4,
      node_present: false,
      excised_count: 3,
      excised_seq_min: 1,
      excised_seq_max: 3,
      genesis: { rewritten: false, reason: 'not_in_genesis' },
    });

    const after = await events();
    expect(after.map((e) => Number(e.seq))).toEqual([1, 2, 3, 4]);
    expect(await secretCount()).toBe(0);

    for (let i = 0; i < 3; i++) {
      const was = before[i];
      const now = after[i];
      // The marker.
      expect(now.payload.excised).toBe(true);
      expect(now.payload.excised_by_seq).toBe(4);
      for (const k of ['after', 'before', 'changes', 'reason', 'intent']) {
        expect(now.payload).not.toHaveProperty(k);
      }
      // The shape.
      expect(now.payload.kinds).toEqual(was.payload.kinds);
      expect(now.payload.op).toBe(was.payload.op);
      expect(now.payload.table).toBe(was.payload.table);
      expect(now.payload.version).toBe(was.payload.version);
      expect(now.kind).toBe(was.kind);
      expect(now.actor).toEqual(was.actor);
      expect(now.request_id).toBe(was.request_id);
      expect(String(now.txid)).toBe(String(was.txid));
      expect(new Date(now.learned_at).getTime()).toBe(new Date(was.learned_at).getTime());
      expect(new Date(now.happened_at).getTime()).toBe(new Date(was.happened_at).getTime());
      // The commitment survives; the salt does not.
      expect(now.payload_hash).toBe(was.payload_hash);
      expect(now.payload_salt).toBeNull();
    }

    const rec = after[3];
    expect(rec.kind).toBe('node.excised');
    expect(Number(rec.subject_id)).toBe(a.id);
    expect(rec.payload).toMatchObject({
      v: 1, op: 'EXCISE', table: 'events', kinds: ['node.excised'],
      reason: 'legal request #1', node_present: false,
      excised_count: 3, excised_seq_min: 1, excised_seq_max: 3, after: null,
    });
    expect(rec.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rec.payload_salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('asOf shows the placeholder while the node lived and nothing after its delete', async () => {
    const a = await makeTask('A', SECRET);
    const patched = await patchTask(a.id, 'A renamed', 'x');
    await request(app).delete(`${tasksUrl()}/${a.id}`);
    expect((await excise(a.id)).status).toBe(200);

    const at1 = nodeIn(await graphAt(1), a.id);
    expect(at1).not.toBeNull();
    expect(at1.meta).toEqual({ title: '[excised]', excised: true });
    expect(at1.title).toBe('[excised]');
    expect(at1.version).toBe(a.version);

    // The marker keeps `version`, so a blanked patch still folds as the bump
    // it was — the shape survives even though the bytes did not.
    const at2 = nodeIn(await graphAt(2), a.id);
    expect(at2.meta).toEqual({ title: '[excised]', excised: true });
    expect(at2.version).toBe(patched.version);

    expect(nodeIn(await graphAt(3), a.id)).toBeNull();
    expect(nodeIn(await graphAt(4), a.id)).toBeNull();
  });

  it('the readers that walk the log tolerate the marker', async () => {
    const a = await makeTask('A', SECRET);
    await request(app).delete(`${tasksUrl()}/${a.id}`);
    expect((await excise(a.id)).status).toBe(200);
    // A deleted node's worldline is the ordinary 404 it always was — not a 500
    // from a reader tripping over a payload with no `after`.
    expect((await request(app).get(`${tasksUrl()}/${a.id}/worldline`)).status).toBe(404);

    const b = await makeTask('B', SECRET);
    await patchTask(b.id, 'B', 'clean');
    expect((await excise(b.id)).status).toBe(200);
    const wl = await request(app).get(`${tasksUrl()}/${b.id}/worldline`);
    expect(wl.status).toBe(200);
    const ch = await request(app).get(`/api/graphs/${gid}/changes`);
    expect([200, 204, 404]).toContain(ch.status);
    const live = await request(app).get(`/api/graphs/${gid}/graph`);
    expect(live.status).toBe(200);
  });
});

// ── excising a node that still exists ───────────────────────────────────────

describe('E18.6 — excising a live node', () => {
  it('re-declares the present in the record so HEAD still folds to the live row', async () => {
    const b = await makeTask('B', `draft with ${SECRET}`);
    const cleaned = await patchTask(b.id, 'B', 'clean body');

    const res = await excise(b.id, { reason: 'pasted a key, since removed' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ seq: 3, node_present: true, excised_count: 2 });
    expect(await secretCount()).toBe(0);

    // The live row is untouched.
    const live = await request(app).get(`${tasksUrl()}/${b.id}`);
    expect(live.status).toBe(200);
    expect(live.body.content).toContain('clean body');
    expect(live.body.version).toBe(cleaned.version);

    // The record carries meta and a digest — never a body.
    const rec = (await events())[2];
    expect(rec.kind).toBe('node.excised');
    expect(rec.payload.after).toMatchObject({ meta: { title: 'B' }, version: cleaned.version });
    expect(rec.payload.after).not.toHaveProperty('content');
    const { rows } = await pool.query(
      `SELECT encode(sha256(convert_to(content, 'UTF8')), 'hex') AS sha FROM tasks WHERE id = $1`,
      [b.id],
    );
    expect(rec.payload.after.content_sha).toBe(rows[0].sha);

    // Before the excision: the placeholder. At HEAD: the live node.
    expect(nodeIn(await graphAt(1), b.id).meta).toEqual({ title: '[excised]', excised: true });
    expect(nodeIn(await graphAt(2), b.id).meta).toEqual({ title: '[excised]', excised: true });
    const head = nodeIn(await graphAt(3), b.id);
    expect(head.meta.title).toBe('B');
    expect(head.meta.excised).toBeUndefined();
    expect(head.version).toBe(cleaned.version);
  });

  it('a later excision blanks the earlier record\'s after and reason, never its envelope', async () => {
    const b = await makeTask('B', SECRET);
    expect((await excise(b.id, { reason: 'first' })).status).toBe(200); // seq 2
    await patchTask(b.id, 'B2', 'more');                                  // seq 3
    const res = await excise(b.id, { reason: 'second' });                 // seq 4
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ seq: 4, node_present: true, excised_count: 2, excised_seq_min: 2, excised_seq_max: 3 });

    const rows = await events();
    const first = rows[1];
    expect(first.kind).toBe('node.excised');
    expect(first.payload.excised).toBe(true);
    expect(first.payload.excised_by_seq).toBe(4);
    expect(first.payload).not.toHaveProperty('after');
    expect(first.payload).not.toHaveProperty('reason');
    // The audit envelope is intact.
    expect(first.payload).toMatchObject({ kinds: ['node.excised'], node_present: true, excised_count: 1 });
    expect(Number(first.seq)).toBe(2);

    const second = rows[3];
    expect(second.payload.after.meta.title).toBe('B2');
    expect(second.payload.reason).toBe('second');

    // Between the two records the node existed with no recoverable state.
    expect(nodeIn(await graphAt(2), b.id).meta).toEqual({ title: '[excised]', excised: true });
    expect(nodeIn(await graphAt(3), b.id).meta).toEqual({ title: '[excised]', excised: true });
    expect(nodeIn(await graphAt(4), b.id).meta.title).toBe('B2');
  });
});

// ── the trigger: the marker, and nothing else ───────────────────────────────

describe('E18.6 — gt_events_append_only admits the marker and nothing else', () => {
  // A graph with: D created (seq 1), E created (seq 2), E excised (seq 3, a
  // node.excised for subject E). Row 1 (subject D) is the row every attempt
  // below tries to touch.
  let d;
  let e;
  beforeEach(async () => {
    d = await makeTask('D', 'd');
    e = await makeTask('E', 'e');
    expect((await excise(e.id)).status).toBe(200);
  });

  async function inTx(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('gt.excising', $1, true)", [gid]);
      await fn(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  it('a plain UPDATE and a DELETE still raise 0A000', async () => {
    await expect(
      pool.query(`UPDATE events SET payload = '{}'::jsonb WHERE graph_id = $1 AND seq = 1`, [gid]),
    ).rejects.toMatchObject({ code: '0A000' });
    await expect(
      pool.query('DELETE FROM events WHERE graph_id = $1 AND seq = 1', [gid]),
    ).rejects.toMatchObject({ code: '0A000' });
  });

  it('a no-op rewrite raises 0A000 without gt.excising', async () => {
    await expect(
      pool.query('UPDATE events SET payload = payload WHERE graph_id = $1 AND seq = 1', [gid]),
    ).rejects.toMatchObject({ code: '0A000' });
  });

  it('under gt.excising, a marker of the wrong shape raises 0A000', async () => {
    await expect(inTx((c) =>
      c.query(
        `UPDATE events SET payload = jsonb_build_object('excised', true, 'excised_by_seq', 3), payload_salt = NULL
          WHERE graph_id = $1 AND seq = 1`,
        [gid],
      ),
    )).rejects.toMatchObject({ code: '0A000' });
  });

  it('a perfect marker that keeps its salt raises 0A000', async () => {
    await expect(inTx((c) =>
      c.query(`UPDATE events SET payload = ${MARKER_SQL} WHERE graph_id = $1 AND seq = 1`, [gid, 3]),
    )).rejects.toMatchObject({ code: '0A000' });
  });

  it('a perfect marker naming an excision for a DIFFERENT subject raises 0A000', async () => {
    // seq 3 is E's excision; row 1 is D.
    await expect(inTx((c) =>
      c.query(`UPDATE events SET payload = ${MARKER_SQL}, payload_salt = NULL WHERE graph_id = $1 AND seq = 1`, [gid, 3]),
    )).rejects.toMatchObject({ code: '0A000' });
  });

  it('a perfect marker naming a non-excision event raises 0A000', async () => {
    await expect(inTx((c) =>
      c.query(`UPDATE events SET payload = ${MARKER_SQL}, payload_salt = NULL WHERE graph_id = $1 AND seq = 1`, [gid, 2]),
    )).rejects.toMatchObject({ code: '0A000' });
  });

  it('a perfect marker naming an EARLIER seq raises 0A000', async () => {
    // Excise D for real (seq 4), then try to point row 4's own marker at itself
    // and row 1 at something before it.
    expect((await excise(d.id)).status).toBe(200);
    await expect(inTx((c) =>
      c.query(`UPDATE events SET payload = ${MARKER_SQL}, payload_salt = NULL WHERE graph_id = $1 AND seq = 4`, [gid, 4]),
    )).rejects.toMatchObject({ code: '0A000' });
  });

  it('the marker that gt_excise_node writes IS admitted, and only alongside a real excision', async () => {
    // Prove the exception is reachable from SQL at all: D's real excision at
    // seq 4 lets row 1 be re-marked with the identical marker.
    expect((await excise(d.id)).status).toBe(200);
    await inTx((c) =>
      c.query(`UPDATE events SET payload = ${MARKER_SQL}, payload_salt = NULL WHERE graph_id = $1 AND seq = 1`, [gid, 4]),
    );
    const rows = await events();
    expect(rows[0].payload.excised_by_seq).toBe(4);
  });

  it('touching any other column under gt.excising raises 0A000', async () => {
    expect((await excise(d.id)).status).toBe(200);
    await expect(inTx((c) =>
      c.query(
        `UPDATE events SET payload = ${MARKER_SQL}, payload_salt = NULL, kind = 'node.patched'
          WHERE graph_id = $1 AND seq = 1`,
        [gid, 4],
      ),
    )).rejects.toMatchObject({ code: '0A000' });
    await expect(inTx((c) =>
      c.query(
        `UPDATE events SET payload = ${MARKER_SQL}, payload_salt = NULL, payload_hash = 'ff'
          WHERE graph_id = $1 AND seq = 1`,
        [gid, 4],
      ),
    )).rejects.toMatchObject({ code: '0A000' });
  });

  it('the backfill exception only fills a NULL hash; a set hash cannot be replaced', async () => {
    await expect(
      pool.query(`UPDATE events SET payload_hash = repeat('0', 64) WHERE graph_id = $1 AND seq = 1`, [gid]),
    ).rejects.toMatchObject({ code: '0A000' });
  });
});

// ── who may excise ──────────────────────────────────────────────────────────

describe('E18.6 — owner-only, human-only, reason-required', () => {
  it('on an owned graph: anonymous and editor-members are refused; an agent is refused; the owner may', async () => {
    const owner = await makeUser('owner');
    const editor = await makeUser('editor');
    const g = (await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('owned', $1, 'none') RETURNING id`,
      [owner.id],
    )).rows[0].id;
    await pool.query(
      `INSERT INTO graph_members (graph_id, user_id, role) VALUES ($1, $2, 'editor')`,
      [g, editor.id],
    );
    const t = (await request(app)
      .post(tasksUrl(g))
      .set('X-Test-User-Id', owner.provider_user_id)
      .send({ content: node('T', SECRET) })).body;
    expect(t.id).toBeDefined();

    expect((await excise(t.id, undefined, {}, g)).status).toBe(403);
    expect((await excise(t.id, undefined, { 'X-Test-User-Id': editor.provider_user_id }, g)).status).toBe(403);
    const agent = await excise(t.id, undefined, {
      'X-Test-User-Id': owner.provider_user_id,
      'X-Writer-Type': 'agent',
    }, g);
    expect(agent.status).toBe(403);
    expect(agent.body.error).toMatch(/human/);
    // Nothing happened: the log is exactly the create.
    expect((await events(g)).map((x) => x.kind)).toEqual(['node.created']);
    expect(await secretCount(g)).toBe(1);

    const ok = await excise(t.id, undefined, { 'X-Test-User-Id': owner.provider_user_id }, g);
    expect(ok.status).toBe(200);
    expect(ok.body.node_present).toBe(true);
    expect(await secretCount(g)).toBe(0);
    const rec = (await events(g))[1];
    expect(rec.kind).toBe('node.excised');
    expect(rec.actor.type).toBe('human');
  });

  it('a missing or blank reason is a 400 and writes nothing', async () => {
    const a = await makeTask('A', 'a');
    expect((await excise(a.id, {})).status).toBe(400);
    expect((await excise(a.id, { reason: '   ' })).status).toBe(400);
    expect((await excise(a.id, { reason: 'x'.repeat(2001) })).status).toBe(400);
    expect((await events()).map((x) => x.kind)).toEqual(['node.created']);
  });

  it('a node with no live row and no history is a 404', async () => {
    const res = await excise(999999);
    expect(res.status).toBe(404);
    expect(await events()).toEqual([]);
  });
});

// ── genesis: the one non-derivable row ──────────────────────────────────────

describe('E18.6 — the genesis snapshot', () => {
  it('a node born before the log has its genesis entry rewritten, and the snapshot still verifies', async () => {
    // A pre-log node: written with capture off, so the log never saw it, and
    // its state lives ONLY in genesis — exactly the row excision must reach.
    const client = await pool.connect();
    let id;
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('gt.capture', 'off', true)");
      const r = await client.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [gid, node('Pre-log title with a name', 'old body'), JSON.stringify({ title: 'Pre-log title with a name', status: 'todo' })],
      );
      id = r.rows[0].id;
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    expect(await events()).toEqual([]);

    const state = {
      v: 1,
      nodes: [{ id, meta: { title: 'Pre-log title with a name', status: 'todo' }, version: 1, external_id: 'slug-with-name', content_sha: 'deadbeef', created_at: '2026-01-01T00:00:00.000Z' }],
      edges: [],
    };
    await pool.query(
      `UPDATE graph_snapshots SET state = $2::jsonb, state_sha = $3, node_count = 1
        WHERE graph_id = $1 AND axis = 'learned' AND kind = 'genesis'`,
      [gid, canonicalJson(state), stateSha(state)],
    );
    // Read it BEFORE the excision so the derived cache holds seq 0; the
    // placeholder assertion after the excision is then also the proof that
    // the route dropped the cache rather than serving the pinned old bytes.
    expect(nodeIn(await graphAt(0), id).meta.title).toBe('Pre-log title with a name');

    const res = await excise(id, { reason: 'name in title' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ node_present: true, excised_count: 0, genesis: { rewritten: true } });

    const { rows } = await pool.query(
      `SELECT state FROM graph_snapshots WHERE graph_id = $1 AND axis = 'learned' AND kind = 'genesis'`,
      [gid],
    );
    const entry = rows[0].state.nodes.find((n) => Number(n.id) === id);
    expect(entry).toEqual({
      id, meta: { title: '[excised]', excised: true }, version: 1,
      external_id: null, content_sha: null, created_at: '2026-01-01T00:00:00.000Z',
    });
    expect((await verifySnapshot(pool, gid, 0)).ok).toBe(true);
    expect(nodeIn(await graphAt(0), id).meta).toEqual({ title: '[excised]', excised: true });
    // The live row is the present, and the record re-declared it.
    expect(nodeIn(await graphAt(1), id).meta.title).toBe('Pre-log title with a name');
  });
});
