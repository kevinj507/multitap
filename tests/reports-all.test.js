// Cross-graph report rail (GET /api/reports) — E16.5. Like cross-graph search,
// the access-model contract is what matters: the rail must list a graph's
// report ONLY for a viewer who can already see that graph as theirs (owned +
// member), and never leak another owner's report. Mirrors the leak model in
// tests/search-all.test.js; the membership predicate is also E16.13's concern.
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import { _setAdapterForTests } from '../src/auth/index.js';
import { makeHeaderAuthAdapter } from './__support__/test_auth.js';

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

async function makeGraph(name, ownerId, anonRole = 'none') {
  const r = await pool.query(
    `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ($1, $2, $3) RETURNING *`,
    [name, ownerId, anonRole],
  );
  return r.rows[0];
}

async function addMember(gid, userId, role) {
  await pool.query(
    `INSERT INTO graph_members (graph_id, user_id, role) VALUES ($1, $2, $3)`,
    [gid, userId, role],
  );
}

async function seedReport(gid, opts = {}) {
  const { title = `Report ${gid}`, description = null, body = 'report body text', updatedAt = null } = opts;
  const r = await pool.query(
    `INSERT INTO reports (graph_id, title, description, body, updated_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW())) RETURNING *`,
    [gid, title, description, body, updatedAt],
  );
  return r.rows[0];
}

function listAs(userProviderId) {
  const req = request(app).get('/api/reports');
  return userProviderId ? req.set('X-Test-User-Id', userProviderId) : req;
}

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  _setAdapterForTests(makeHeaderAuthAdapter());
});

describe('GET /api/reports (cross-graph report rail)', () => {
  let me, stranger, ownedByMe, sharedViewer, sharedEditor, foreign, legacy;

  beforeEach(async () => {
    me = await makeUser(`rp-me-${Date.now()}`);
    stranger = await makeUser(`rp-other-${Date.now()}`);

    ownedByMe = await makeGraph('mine', me.id);
    sharedViewer = await makeGraph('shared-viewer', stranger.id);
    sharedEditor = await makeGraph('shared-editor', stranger.id);
    // A public graph I'm NOT a member of: readable by URL, but must NOT appear
    // in my rail (the rail is owned+member, not read-based — E16.13 decision).
    foreign = await makeGraph('not-mine', stranger.id, 'viewer');
    // Legacy owner-less graph (no owner, no members): reachable by URL only,
    // never surfaced in a signed-in user's rail.
    legacy = await makeGraph('legacy', null);

    await addMember(sharedViewer.id, me.id, 'viewer');
    await addMember(sharedEditor.id, me.id, 'editor');

    await seedReport(ownedByMe.id);
    await seedReport(sharedViewer.id);
    await seedReport(sharedEditor.id);
    await seedReport(foreign.id, { body: 'this must never leak' });
    await seedReport(legacy.id);
  });

  it('lists owned + editor-member + viewer-member reports, and NEVER others (the leak test)', async () => {
    const res = await listAs(me.provider_user_id);
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.graph_id);
    expect(ids).toContain(ownedByMe.id);
    expect(ids).toContain(sharedViewer.id);
    expect(ids).toContain(sharedEditor.id);
    // A public-but-not-mine graph and a legacy owner-less graph never appear.
    expect(ids).not.toContain(foreign.id);
    expect(ids).not.toContain(legacy.id);
    expect(ids.sort()).toEqual([ownedByMe.id, sharedViewer.id, sharedEditor.id].sort());
  });

  it('never returns another owner’s report (cross-owner isolation)', async () => {
    // stranger owns sharedViewer/sharedEditor/foreign; me owns ownedByMe.
    const strangerRes = await listAs(stranger.provider_user_id);
    const strangerIds = strangerRes.body.map((r) => r.graph_id);
    expect(strangerIds).not.toContain(ownedByMe.id);
    expect(strangerIds.sort()).toEqual(
      [sharedViewer.id, sharedEditor.id, foreign.id].sort(),
    );
  });

  it('returns [] with 200 for an anonymous caller (never 401)', async () => {
    const res = await listAs(null);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns [] for a signed-in user with no owned/member reports', async () => {
    const loner = await makeUser(`rp-loner-${Date.now()}`);
    const res = await listAs(loner.provider_user_id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('each row carries graph_name + graph_updated_at and EXCLUDES body', async () => {
    const res = await listAs(me.provider_user_id);
    for (const row of res.body) {
      expect(row).toHaveProperty('graph_id');
      expect(row).toHaveProperty('title');
      expect(row).toHaveProperty('graph_name');
      expect(row).toHaveProperty('graph_updated_at');
      expect(row).toHaveProperty('updated_at');
      expect(row).not.toHaveProperty('body');
    }
    const mineRow = res.body.find((r) => r.graph_id === ownedByMe.id);
    expect(mineRow.graph_name).toBe('mine');
  });

  it('orders by updated_at DESC, then graph_id DESC', async () => {
    // Fresh isolated pair owned by a dedicated user to control timestamps.
    const u = await makeUser(`rp-order-${Date.now()}`);
    const older = await makeGraph('older', u.id);
    const newer = await makeGraph('newer', u.id);
    await seedReport(older.id, { updatedAt: '2026-01-01T00:00:00Z' });
    await seedReport(newer.id, { updatedAt: '2026-06-01T00:00:00Z' });
    const res = await listAs(u.provider_user_id);
    const ids = res.body.map((r) => r.graph_id);
    expect(ids).toEqual([newer.id, older.id]);
  });
});
