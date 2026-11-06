// E18.2 STEP 4 — POST /api/graphs/:gid/tasks/:id/verify.
//
// The ONE thing E18.2 could not build without a new surface: a check that
// FAILED. A failure is not expressible as a `verified_at` assignment — clearing
// the scalar on a never-verified claim moves nothing, so gt_log_task's
// `ch = '{}'` short-circuit fires and the log records the failure NOWHERE. So
// `failed` writes `refuted_at`, a scalar of its own, which the SQL classifier
// reads as `claim.refuted`.
//
// The second thing this route buys is DELIBERATENESS: `payload.intent` is set
// here and absent on an incidental PATCH, so the log can finally tell "someone
// re-checked this" from "an agent rewrote the node and the timestamp moved".
// `gt.intent` still cannot FABRICATE a kind — gt_headline only promotes one the
// diff already produced — so the outcome stays mechanically derived.
//
// Every assertion below is a case of the E18.1 DONE-WHEN this route inherits:
// exactly ONE event per CHANGED row, and ZERO events for unchanged rows.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;
// src/events/context.js reaches src/db.js, which reads DATABASE_URL once at
// first import — so it is pulled in from beforeAll, never at module scope.
let CAUSE_ID_UNKNOWN_ERROR;
let HAPPENED_AT_ERROR;
let logMark = 0;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
  const ctx = await import('../src/events/context.js');
  CAUSE_ID_UNKNOWN_ERROR = ctx.CAUSE_ID_UNKNOWN_ERROR;
  HAPPENED_AT_ERROR = ctx.HAPPENED_AT_ERROR;
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-verify') RETURNING id");
  gid = g.rows[0].id;
  logMark = 0;
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const tasksUrl = (g = gid) => `/api/graphs/${g}/tasks`;
const verifyUrl = (id, g = gid) => `/api/graphs/${g}/tasks/${id}/verify`;

async function makeTask(title, extra = {}, body = '') {
  const res = await request(app).post(tasksUrl()).send({ content: node({ title, status: 'review', ...extra }, body) });
  expect(res.status).toBe(201);
  return res.body;
}

// There is NO way to clear the log — gt_events_append_only refuses DELETE with
// 0A000 unconditionally — so the window is a per-graph seq high-water mark.
async function markLog() {
  const { rows } = await pool.query('SELECT COALESCE(MAX(seq),0) AS s FROM events WHERE graph_id = $1', [gid]);
  logMark = Number(rows[0].s);
}
async function events() {
  const { rows } = await pool.query(
    `SELECT seq, kind, subject_kind, subject_id, happened_at, payload
       FROM events WHERE graph_id = $1 AND seq > $2 ORDER BY seq`,
    [gid, logMark],
  );
  return rows;
}
const metaOf = async (id) => (await pool.query('SELECT meta, content, version FROM tasks WHERE id = $1', [id])).rows[0];

describe('E18.2 verify route — outcome: held', () => {
  it('emits exactly ONE claim.verified carrying intent and reason', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 }, '# the evidence\n');
    await markLog();
    const at = '2026-06-01T12:00:00.000Z';

    const res = await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', happened_at: at });
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows.map((r) => r.kind)).toEqual(['claim.verified']);
    const e = rows[0];
    // `node.patched` rides along because the frontmatter text changes too.
    expect(e.payload.kinds).toEqual(['claim.verified', 'node.patched']);
    // THE DELIBERATENESS MARKER. Present here, absent on a plain PATCH.
    expect(e.payload.intent).toBe('claim.verified');
    expect(e.payload.reason).toBe('verify');
    expect(new Date(e.happened_at).toISOString()).toBe(at);

    const row = await metaOf(t.id);
    expect(row.meta.verified_at).toBe(at);
    expect(row.meta.refuted_at).toBeUndefined();
    expect(res.body.meta.verified_at).toBe(at);
  });

  it('clears a previous refutation, and the change reads as a verification', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 });
    await request(app).post(verifyUrl(t.id)).send({ outcome: 'failed', happened_at: '2026-05-01T00:00:00.000Z' });
    await markLog();

    const res = await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', happened_at: '2026-06-01T00:00:00.000Z' });
    expect(res.status).toBe(200);
    const rows = await events();
    expect(rows.map((r) => r.kind)).toEqual(['claim.verified']);
    // refuted_at is REMOVED, which gt_diff records as to_present: false.
    expect(rows[0].payload.changes['meta.refuted_at'].to_present).toBe(false);
    const row = await metaOf(t.id);
    expect(row.meta.refuted_at).toBeUndefined();
    expect(row.meta.verified_at).toBe('2026-06-01T00:00:00.000Z');
  });

  it('a repeat held at the same happened_at emits ZERO events and still answers 200', async () => {
    // Idempotence is not special-cased: an identical row produces ch = '{}',
    // which the trigger already suppresses. No new rule.
    const t = await makeTask('A claim', { confidence: 0.8 });
    const at = '2026-06-01T12:00:00.000Z';
    await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', happened_at: at });
    await markLog();

    const again = await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', happened_at: at });
    expect(again.status).toBe(200);
    expect(await events()).toEqual([]);
  });

  it('backdates: a past happened_at is flagged and becomes the scalar', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 });
    await markLog();
    const at = '2024-03-04T00:00:00.000Z';
    await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', happened_at: at });
    const rows = await events();
    expect(rows).toHaveLength(1);
    // learned_at is the one clock a caller can never falsify; happened_at may
    // be backdated, and the payload says so.
    expect(rows[0].payload.backdated).toBe(true);
    expect(new Date(rows[0].happened_at).toISOString()).toBe(at);
    expect(new Date(rows[0].learned_at ?? Date.now()).getTime()).toBeGreaterThan(Date.parse(at));
    expect((await metaOf(t.id)).meta.verified_at).toBe(at);
  });

  it('defaults happened_at to now, and the scalar equals the event time', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 });
    await markLog();
    await request(app).post(verifyUrl(t.id)).send({ outcome: 'held' });
    const rows = await events();
    expect(rows).toHaveLength(1);
    // checkFromEvent()'s `min(verified_at.to, happened_at)` rule and the scalar
    // agree BY CONSTRUCTION, because the route writes one instant to both.
    const meta = (await metaOf(t.id)).meta;
    expect(new Date(rows[0].happened_at).toISOString()).toBe(meta.verified_at);
    expect(rows[0].payload.backdated).toBeUndefined();
  });
});

describe('E18.2 verify route — outcome: failed', () => {
  it('emits exactly ONE claim.refuted and CLEARS verified_at', async () => {
    const t = await makeTask('A claim', { confidence: 0.8, verified_at: '2026-01-01T00:00:00.000Z' });
    await markLog();
    const at = '2026-06-01T12:00:00.000Z';

    const res = await request(app).post(verifyUrl(t.id)).send({ outcome: 'failed', happened_at: at });
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows.map((r) => r.kind)).toEqual(['claim.refuted']);
    const e = rows[0];
    // `node.patched` rides along because the route rewrites the frontmatter,
    // so `content` changes too — the same shape a PATCH that sets verified_at
    // has always produced. `gt_headline` promotes the INTENT, so the `kind`
    // column is claim.refuted, not the first array element.
    expect(e.payload.kinds).toEqual(['claim.refuted', 'node.patched']);
    expect(e.payload.intent).toBe('claim.refuted');
    expect(e.payload.reason).toBe('verify');
    expect(e.payload.changes['meta.refuted_at'].to).toBe(at);
    // Clearing verified_at is what makes v1's frontier query surface a refuted
    // claim as stale WITHOUT knowing the word "refuted".
    expect(e.payload.changes['meta.verified_at'].to_present).toBe(false);

    const row = await metaOf(t.id);
    expect(row.meta.refuted_at).toBe(at);
    expect(row.meta.verified_at).toBeUndefined();
  });

  it('records a failure on a claim that was NEVER verified', async () => {
    // The hole the `refuted_at` scalar exists to close: under "just clear
    // verified_at", this change would be ch = '{}' and record nothing at all.
    const t = await makeTask('Never checked', { confidence: 0.8 });
    await markLog();
    const res = await request(app).post(verifyUrl(t.id)).send({ outcome: 'failed', happened_at: '2026-06-01T00:00:00.000Z' });
    expect(res.status).toBe(200);
    const rows = await events();
    expect(rows.map((r) => r.kind)).toEqual(['claim.refuted']);
    expect(rows[0].payload.changes['meta.verified_at']).toBeUndefined();
  });

  it('collapses "it failed AND confidence drops" into ONE atomic event', async () => {
    const t = await makeTask('A claim', { confidence: 0.9, verified_at: '2026-01-01T00:00:00.000Z' });
    await markLog();
    const res = await request(app)
      .post(verifyUrl(t.id))
      .send({ outcome: 'failed', confidence: 0.2, happened_at: '2026-06-01T00:00:00.000Z' });
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows).toHaveLength(1);
    // The doubt headlines: claim.refuted is built BEFORE field.set.
    expect(rows[0].payload.kinds).toEqual(['claim.refuted', 'field.set', 'node.patched']);
    expect(rows[0].kind).toBe('claim.refuted');
    expect((await metaOf(t.id)).meta.confidence).toBe(0.2);
  });

  it('confidence: null clears the key; an out-of-range confidence is a 400 with NO event', async () => {
    const t = await makeTask('A claim', { confidence: 0.9 });
    await markLog();
    const bad = await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', confidence: 2 });
    expect(bad.status).toBe(400);
    expect(await events()).toEqual([]);

    const ok = await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', confidence: null });
    expect(ok.status).toBe(200);
    expect((await metaOf(t.id)).meta.confidence).toBeUndefined();
  });
});

describe('E18.2 verify route — the guards', () => {
  it('rejects a missing or unknown outcome with 400 and NO event', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 });
    await markLog();
    for (const body of [{}, { outcome: 'maybe' }, { outcome: null }, { outcome: 'HELD' }, { outcome: 1 }]) {
      const res = await request(app).post(verifyUrl(t.id)).send(body);
      expect(res.status).toBe(400);
    }
    expect(await events()).toEqual([]);
  });

  it('rejects a malformed happened_at and a malformed/unknown cause_id, with NO event', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 });
    await markLog();

    const badTime = await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', happened_at: 'tomorrow' });
    expect(badTime.status).toBe(400);
    expect(badTime.body.error).toBe(HAPPENED_AT_ERROR);

    const badCause = await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', cause_id: 99999 });
    expect(badCause.status).toBe(400);
    expect(badCause.body.error).toBe(CAUSE_ID_UNKNOWN_ERROR);

    expect(await events()).toEqual([]);
  });

  it('accepts a real cause_id and records it on the event', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 });
    const { rows: head } = await pool.query('SELECT max(seq) AS s FROM events WHERE graph_id = $1', [gid]);
    await markLog();
    const res = await request(app)
      .post(verifyUrl(t.id))
      .send({ outcome: 'failed', cause_id: Number(head[0].s) });
    expect(res.status).toBe(200);
    const rows = await events();
    expect(Number(rows[0].cause_id ?? rows[0].payload.cause_id ?? head[0].s)).toBe(Number(head[0].s));
  });

  it('410s an unknown task id and 409s a base_version mismatch, with NO event', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 });
    await markLog();

    const gone = await request(app).post(verifyUrl(999999)).send({ outcome: 'held' });
    expect(gone.status).toBe(410);

    const stale = await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', base_version: 99 });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe('version_conflict');

    expect(await events()).toEqual([]);

    const fresh = await request(app).post(verifyUrl(t.id)).send({ outcome: 'held', base_version: t.version });
    expect(fresh.status).toBe(200);
  });

  it('rejects a non-integer task id before touching the database', async () => {
    const res = await request(app).post(verifyUrl('abc')).send({ outcome: 'held' });
    expect(res.status).toBe(400);
  });

  it('NEVER touches the body', async () => {
    const body = '# Evidence\n\nA paragraph with a \\backslash and `code`.\n';
    const t = await makeTask('A claim', { confidence: 0.8 }, body);
    const before = (await metaOf(t.id)).content;
    await request(app).post(verifyUrl(t.id)).send({ outcome: 'failed' });
    await request(app).post(verifyUrl(t.id)).send({ outcome: 'held' });
    const after = (await metaOf(t.id)).content;
    // Frontmatter moved; the body after the closing fence is byte-identical.
    const bodyOf = (c) => c.slice(c.indexOf('\n---\n', 3) + 5);
    expect(bodyOf(after)).toBe(bodyOf(before));
    expect(bodyOf(after)).toBe(body);
  });

  it('is write-gated: a viewer cannot verify, an editor can', async () => {
    // provider/provider_user_id must match what the header auth adapter
    // resolves, or the "owner" request lands as a different user.
    const u = await pool.query(
      `INSERT INTO users (provider, provider_user_id, email, display_name)
       VALUES ('test-header', 'verify-owner', 'verify-owner@test.local', 'verify-owner') RETURNING *`,
    );
    const owner = u.rows[0];
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('gated', $1, 'viewer') RETURNING id`,
      [owner.id],
    );
    const ownedGid = g.rows[0].id;
    const t = await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
      [ownedGid, node({ title: 'C', status: 'review', confidence: 0.8 }), JSON.stringify({ title: 'C', status: 'review', confidence: 0.8 })],
    );
    const tid = t.rows[0].id;

    const anon = await request(app).post(verifyUrl(tid, ownedGid)).send({ outcome: 'held' });
    expect(anon.status).toBe(403);

    const asOwner = await request(app)
      .post(verifyUrl(tid, ownedGid))
      .set('X-Test-User-Id', 'verify-owner')
      .send({ outcome: 'held' });
    expect(asOwner.status).toBe(200);
  });
});

describe('E18.2 verify route — PATCH inference is UNCHANGED', () => {
  it('a PATCH that sets verified_at still emits claim.verified, without an intent', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 });
    await markLog();
    const res = await request(app)
      .patch(`${tasksUrl()}/${t.id}`)
      .send({ content: node({ title: 'A claim', status: 'review', confidence: 0.8, verified_at: '2026-04-04T00:00:00.000Z' }) });
    expect(res.status).toBe(200);

    const rows = await events();
    expect(rows.map((r) => r.kind)).toEqual(['claim.verified']);
    // THE WHOLE DIFFERENCE: deliberate carries an intent, incidental does not.
    expect(rows[0].payload.intent).toBeNull();
    expect(rows[0].payload.reason).toBeNull();
  });

  it('a PATCH may still set refuted_at directly, and it classifies as claim.refuted', async () => {
    const t = await makeTask('A claim', { confidence: 0.8 });
    await markLog();
    const res = await request(app)
      .patch(`${tasksUrl()}/${t.id}`)
      .send({ content: node({ title: 'A claim', status: 'review', confidence: 0.8, refuted_at: '2026-04-04T00:00:00.000Z' }) });
    expect(res.status).toBe(200);
    expect((await events()).map((r) => r.kind)).toEqual(['claim.refuted']);
  });

  it('rejects a malformed refuted_at and a non-boolean decay', async () => {
    const bad = await request(app).post(tasksUrl()).send({ content: node({ title: 'X', refuted_at: 'not-a-date' }) });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/refuted_at/);

    const badDecay = await request(app).post(tasksUrl()).send({ content: node({ title: 'X', decay: 'no' }) });
    expect(badDecay.status).toBe(400);
    expect(badDecay.body.error).toMatch(/decay/);

    const ok = await request(app).post(tasksUrl()).send({ content: node({ title: 'X', decay: false, confidence: 0.5 }) });
    expect(ok.status).toBe(201);
    expect(ok.body.meta.decay).toBe(false);
  });

  it('an agent PATCH that omits refuted_at and decay does NOT wipe them', async () => {
    // Same merge protection verified_at and decided_at already have: a
    // body-rewriting agent re-run must not blind-wipe a structural key.
    const created = await request(app)
      .post(tasksUrl())
      .send({ content: node({ title: 'M', status: 'review', confidence: 0.8, decay: false, refuted_at: '2026-02-02T00:00:00.000Z' }) });
    expect(created.status).toBe(201);
    const t = created.body;

    const rewritten = node({ title: 'M', status: 'review', confidence: 0.8 }, '# rewritten by an agent\n');
    const res = await request(app)
      .patch(`${tasksUrl()}/${t.id}`)
      .set('X-Writer-Type', 'agent')
      .send({ content: rewritten, base_version: t.version, base_content: t.content });
    expect(res.status).toBe(200);
    expect(res.body.meta.decay).toBe(false);
    expect(res.body.meta.refuted_at).toBe('2026-02-02T00:00:00.000Z');
  });
});
