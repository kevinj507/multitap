import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';

// IMPORTANT: do NOT import access.js (or anything that pulls in db.js) at
// module load time — db.js reads `process.env.DATABASE_URL` once when it's
// first imported, and we set it inside `beforeAll`. Dynamic-import below.
let canRead, canEdit, canManage;
let app;
let pool;

async function makeUser(p, suffix) {
  const r = await p.query(
    `INSERT INTO users (provider, provider_user_id, email)
     VALUES ('test', $1, $2) RETURNING *`,
    [`pid-${suffix}`, `u${suffix}@example.com`],
  );
  return r.rows[0];
}

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  const access = await import('../src/auth/access.js');
  canRead = access.canRead;
  canEdit = access.canEdit;
  canManage = access.canManage;
});

describe('access predicate matrix', () => {
  const legacy = { id: 'g', owner_user_id: null, anon_role: 'none' };
  const restricted = { id: 'g', owner_user_id: 'u1', anon_role: 'none' };
  const linkView = { id: 'g', owner_user_id: 'u1', anon_role: 'viewer' };
  const linkEdit = { id: 'g', owner_user_id: 'u1', anon_role: 'editor' };
  const owner = { id: 'u1' };
  const stranger = { id: 'u2' };
  const viewerMember = { role: 'viewer' };
  const editorMember = { role: 'editor' };

  it('legacy graphs grant all three to everyone', () => {
    expect(canRead(null, legacy)).toBe(true);
    expect(canEdit(null, legacy)).toBe(true);
    expect(canManage(null, legacy)).toBe(true);
    expect(canRead(stranger, legacy)).toBe(true);
    expect(canEdit(stranger, legacy)).toBe(true);
    expect(canManage(stranger, legacy)).toBe(true);
  });

  it('restricted (anon_role=none): owner full, stranger nothing', () => {
    expect(canRead(owner, restricted)).toBe(true);
    expect(canEdit(owner, restricted)).toBe(true);
    expect(canManage(owner, restricted)).toBe(true);
    expect(canRead(stranger, restricted)).toBe(false);
    expect(canEdit(stranger, restricted)).toBe(false);
    expect(canManage(stranger, restricted)).toBe(false);
    expect(canRead(null, restricted)).toBe(false);
    expect(canEdit(null, restricted)).toBe(false);
    expect(canManage(null, restricted)).toBe(false);
  });

  it('anon_role=viewer: anyone can read, only owner+members can edit', () => {
    expect(canRead(null, linkView)).toBe(true);
    expect(canEdit(null, linkView)).toBe(false);
    expect(canManage(null, linkView)).toBe(false);
    expect(canRead(stranger, linkView)).toBe(true);
    expect(canEdit(stranger, linkView)).toBe(false);
    expect(canManage(stranger, linkView)).toBe(false);
  });

  it('anon_role=editor: anyone can read AND edit, but not manage', () => {
    expect(canRead(null, linkEdit)).toBe(true);
    expect(canEdit(null, linkEdit)).toBe(true);
    expect(canManage(null, linkEdit)).toBe(false);
    expect(canRead(stranger, linkEdit)).toBe(true);
    expect(canEdit(stranger, linkEdit)).toBe(true);
    expect(canManage(stranger, linkEdit)).toBe(false);
  });

  it('viewer member can read but not edit; editor member can read and edit', () => {
    expect(canRead(stranger, restricted, viewerMember)).toBe(true);
    expect(canEdit(stranger, restricted, viewerMember)).toBe(false);
    expect(canManage(stranger, restricted, viewerMember)).toBe(false);

    expect(canRead(stranger, restricted, editorMember)).toBe(true);
    expect(canEdit(stranger, restricted, editorMember)).toBe(true);
    expect(canManage(stranger, restricted, editorMember)).toBe(false);
  });
});

describe('route-level enforcement', () => {
  it('anonymous can create a graph and it lands as legacy (no owner)', async () => {
    const res = await request(app).post('/api/graphs').send({ name: 'anon graph' });
    expect(res.status).toBe(201);
    expect(res.body.owner_user_id).toBeNull();
    const writeable = await request(app)
      .post(`/api/graphs/${res.body.id}/tasks`)
      .send({ content: '---\ntitle: t\nstatus: todo\n---\n' });
    expect(writeable.status).toBe(201);
  });

  it('anonymous cannot read a restricted (anon_role=none) owned graph', async () => {
    const u = await makeUser(pool, 'private-owner');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('owned', $1, 'none') RETURNING id`,
      [u.id],
    );
    const res = await request(app).get(`/api/graphs/${g.rows[0].id}`);
    expect(res.status).toBe(403);
  });

  it('anonymous can read on anon_role=viewer but cannot edit', async () => {
    const u = await makeUser(pool, 'viewer-owner');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role)
       VALUES ('pub', $1, 'viewer') RETURNING id`,
      [u.id],
    );
    const gid = g.rows[0].id;
    const read = await request(app).get(`/api/graphs/${gid}`);
    expect(read.status).toBe(200);
    const write = await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .send({ content: '---\ntitle: nope\nstatus: todo\n---\n' });
    expect(write.status).toBe(403);
  });

  it('anonymous CAN edit on anon_role=editor', async () => {
    const u = await makeUser(pool, 'edit-owner');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role)
       VALUES ('edit', $1, 'editor') RETURNING id`,
      [u.id],
    );
    const gid = g.rows[0].id;
    const write = await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .send({ content: '---\ntitle: from-anon\nstatus: todo\n---\n' });
    expect(write.status).toBe(201);
  });

  it('PATCH on an owned graph is rejected for an anonymous caller', async () => {
    const u = await makeUser(pool, 'manage-owner');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id) VALUES ('private', $1) RETURNING id`,
      [u.id],
    );
    const res = await request(app)
      .patch(`/api/graphs/${g.rows[0].id}`)
      .send({ name: 'renamed' });
    expect(res.status).toBe(403);
  });

  it('SSE events endpoint is read-gated', async () => {
    const u = await makeUser(pool, 'sse-owner');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role)
       VALUES ('private', $1, 'none') RETURNING id`,
      [u.id],
    );
    const res = await request(app)
      .get(`/api/graphs/${g.rows[0].id}/events`)
      .timeout({ response: 1000, deadline: 2000 })
      .catch((e) => e);
    expect(res.status).toBe(403);
  });
});

describe('graph listing', () => {
  it('GET /api/graphs anonymous returns empty (no public directory after Phase B5c)', async () => {
    const u = await makeUser(pool, 'list-owner');
    await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('private', $1, 'none')`,
      [u.id],
    );
    await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('viewer', $1, 'viewer')`,
      [u.id],
    );
    const res = await request(app).get('/api/graphs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
