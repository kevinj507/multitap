import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import { _setAdapterForTests } from '../src/auth/index.js';
import { makeHeaderAuthAdapter } from './__support__/test_auth.js';

let app;
let pool;

async function makeUser(p, suffix, email) {
  const r = await p.query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('test-header', $1, $2, $1) RETURNING *`,
    [suffix, email || `${suffix}@test.local`],
  );
  return r.rows[0];
}

async function addMember(p, graphId, userId, role = 'editor') {
  await p.query(
    `INSERT INTO graph_members (graph_id, user_id, role) VALUES ($1, $2, $3)`,
    [graphId, userId, role],
  );
}

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  _setAdapterForTests(makeHeaderAuthAdapter());
});

describe('GET members', () => {
  let owner, member, stranger, graph;

  beforeEach(async () => {
    owner = await makeUser(pool, 'm-owner');
    member = await makeUser(pool, 'm-member');
    stranger = await makeUser(pool, 'm-stranger');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('owned', $1, 'none') RETURNING *`,
      [owner.id],
    );
    graph = g.rows[0];
    await addMember(pool, graph.id, member.id, 'editor');
  });

  it('returns members + pending in one payload', async () => {
    // Add a pending row.
    await pool.query(
      `INSERT INTO pending_members (graph_id, email, role)
       VALUES ($1, 'someone@example.com', 'viewer')`,
      [graph.id],
    );

    const res = await request(app)
      .get(`/api/graphs/${graph.id}/members`)
      .set('X-Test-User-Id', 'm-owner');
    expect(res.status).toBe(200);
    expect(res.body.members.length).toBe(1);
    expect(res.body.members[0].user_id).toBe(member.id);
    expect(res.body.members[0].role).toBe('editor');
    expect(res.body.members[0].display_name).toBe('m-member');
    expect(res.body.pending.length).toBe(1);
    expect(res.body.pending[0].email).toBe('someone@example.com');
    expect(res.body.pending[0].role).toBe('viewer');
  });

  it('stranger cannot list on a restricted (anon_role=none) graph', async () => {
    const res = await request(app)
      .get(`/api/graphs/${graph.id}/members`)
      .set('X-Test-User-Id', 'm-stranger');
    expect(res.status).toBe(403);
  });
});

describe('POST member (add by email)', () => {
  let owner, graph;

  beforeEach(async () => {
    owner = await makeUser(pool, 'add-owner');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('owned', $1, 'none') RETURNING *`,
      [owner.id],
    );
    graph = g.rows[0];
  });

  it('adds a pending row when the email has no existing account', async () => {
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/members`)
      .set('X-Test-User-Id', 'add-owner')
      .send({ email: 'newcomer@example.com', role: 'viewer' });
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('pending');
    expect(res.body.pending.email).toBe('newcomer@example.com');
    expect(res.body.pending.role).toBe('viewer');
  });

  it('promotes directly to graph_members when the email already has a user', async () => {
    await makeUser(pool, 'preexisting', 'has-account@example.com');
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/members`)
      .set('X-Test-User-Id', 'add-owner')
      .send({ email: 'has-account@example.com', role: 'editor' });
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('member');
    expect(res.body.member.role).toBe('editor');
  });

  it('case-insensitive email matching', async () => {
    await makeUser(pool, 'caseuser', 'CASE@example.com');
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/members`)
      .set('X-Test-User-Id', 'add-owner')
      .send({ email: 'case@example.com', role: 'viewer' });
    expect(res.body.kind).toBe('member');
  });

  it('rejects bad email', async () => {
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/members`)
      .set('X-Test-User-Id', 'add-owner')
      .send({ email: 'not-an-email', role: 'viewer' });
    expect(res.status).toBe(400);
  });

  it('rejects bad role', async () => {
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/members`)
      .set('X-Test-User-Id', 'add-owner')
      .send({ email: 'x@example.com', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('rejects owner adding self', async () => {
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/members`)
      .set('X-Test-User-Id', 'add-owner')
      .send({ email: 'add-owner@test.local', role: 'viewer' });
    expect(res.status).toBe(400);
  });

  it('non-owner cannot add members', async () => {
    await makeUser(pool, 'add-stranger');
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/members`)
      .set('X-Test-User-Id', 'add-stranger')
      .send({ email: 'x@example.com', role: 'viewer' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE member / pending', () => {
  let owner, member, graph;

  beforeEach(async () => {
    owner = await makeUser(pool, 'del-owner');
    member = await makeUser(pool, 'del-member');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('owned', $1, 'none') RETURNING *`,
      [owner.id],
    );
    graph = g.rows[0];
    await addMember(pool, graph.id, member.id, 'editor');
    await pool.query(
      `INSERT INTO pending_members (graph_id, email, role)
       VALUES ($1, 'pending@example.com', 'viewer')`,
      [graph.id],
    );
  });

  it('owner can kick a real member', async () => {
    const res = await request(app)
      .delete(`/api/graphs/${graph.id}/members/${member.id}`)
      .set('X-Test-User-Id', 'del-owner');
    expect(res.status).toBe(200);

    const write = await request(app)
      .post(`/api/graphs/${graph.id}/tasks`)
      .set('X-Test-User-Id', 'del-member')
      .send({ content: '---\ntitle: nope\nstatus: todo\n---\n' });
    expect(write.status).toBe(403);
  });

  it('owner can cancel a pending invite', async () => {
    const res = await request(app)
      .delete(`/api/graphs/${graph.id}/members/pending/${encodeURIComponent('pending@example.com')}`)
      .set('X-Test-User-Id', 'del-owner');
    expect(res.status).toBe(200);
    expect(res.body.removed.email).toBe('pending@example.com');
  });

  it('owner cannot kick themselves through this route', async () => {
    const res = await request(app)
      .delete(`/api/graphs/${graph.id}/members/${owner.id}`)
      .set('X-Test-User-Id', 'del-owner');
    expect(res.status).toBe(400);
  });
});

describe('auto-claim pending on sign-in', () => {
  it('pending invite for an email converts to a member row on next sign-in', async () => {
    const owner = await makeUser(pool, 'pc-owner');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('owned', $1, 'none') RETURNING *`,
      [owner.id],
    );
    const gid = g.rows[0].id;

    // Owner adds someone by email (no account yet).
    await request(app)
      .post(`/api/graphs/${gid}/members`)
      .set('X-Test-User-Id', 'pc-owner')
      .send({ email: 'pc-newcomer@test.local', role: 'editor' });

    // Newcomer signs in for the first time — the test adapter creates a user
    // with email = `<provider_user_id>@test.local` (see __support__/test_auth.js).
    // Any signed-in request triggers verifyAuth → claimPendingByEmail.
    await request(app)
      .get(`/api/graphs/${gid}`)
      .set('X-Test-User-Id', 'pc-newcomer');

    const member = await pool.query(
      `SELECT gm.role FROM graph_members gm
        JOIN users u ON u.id = gm.user_id
       WHERE gm.graph_id = $1 AND u.email = $2`,
      [gid, 'pc-newcomer@test.local'],
    );
    expect(member.rows.length).toBe(1);
    expect(member.rows[0].role).toBe('editor');

    // Pending row consumed.
    const pending = await pool.query(
      'SELECT 1 FROM pending_members WHERE graph_id = $1 AND email = $2',
      [gid, 'pc-newcomer@test.local'],
    );
    expect(pending.rows.length).toBe(0);
  });
});
