// Cross-graph search (POST /api/search) — the access-model contract matters
// more than ranking here (#171: "never leak nodes across owners"). Lexical-only
// config (no model providers in tests); ranking quality is covered by the
// per-graph suite + the eval harness.
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

async function makeGraph(name, ownerId) {
  const r = await pool.query(
    `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ($1, $2, 'none') RETURNING *`,
    [name, ownerId],
  );
  return r.rows[0];
}

async function seedTask(gid, title, body) {
  const r = await pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
    [gid, `---\ntitle: ${title}\nstatus: todo\n---\n${body || ''}`, { title, status: 'todo' }],
  );
  return r.rows[0].id;
}

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  _setAdapterForTests(makeHeaderAuthAdapter());
});

describe('POST /api/search (cross-graph)', () => {
  let me, stranger, owned, shared, foreign;

  beforeEach(async () => {
    me = await makeUser(`xg-me-${Date.now()}`);
    stranger = await makeUser(`xg-other-${Date.now()}`);
    owned = await makeGraph('mine', me.id);
    shared = await makeGraph('shared-with-me', stranger.id);
    foreign = await makeGraph('not-mine', stranger.id);
    await pool.query(
      `INSERT INTO graph_members (graph_id, user_id, role) VALUES ($1, $2, 'viewer')`,
      [shared.id, me.id],
    );
    await seedTask(owned.id, 'zephyr engine notes', 'the zephyr token appears here');
    await seedTask(shared.id, 'zephyr shared doc', 'zephyr again');
    await seedTask(foreign.id, 'zephyr SECRET', 'zephyr must never leak');
  });

  it('searches owned + member graphs and NEVER the rest (the leak test)', async () => {
    const res = await request(app)
      .post('/api/search')
      .set('X-Test-User-Id', me.provider_user_id)
      .send({ query: 'zephyr' });
    expect(res.status).toBe(200);
    const graphIds = res.body.results.map((r) => r.graphId);
    expect(graphIds).toContain(owned.id);
    expect(graphIds).toContain(shared.id);
    expect(graphIds).not.toContain(foreign.id);
    // attribution map covers exactly the accessible set
    expect(Object.keys(res.body.graphs).sort()).toEqual([owned.id, shared.id].sort());
    expect(res.body.graphs[owned.id]).toBe('mine');
  });

  it('rejects anonymous callers', async () => {
    const res = await request(app).post('/api/search').send({ query: 'zephyr' });
    expect(res.status).toBe(401);
  });

  it('returns an empty result set for a user with no graphs', async () => {
    const loner = await makeUser(`xg-loner-${Date.now()}`);
    const res = await request(app)
      .post('/api/search')
      .set('X-Test-User-Id', loner.provider_user_id)
      .send({ query: 'zephyr' });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.graphs).toEqual({});
  });

  it('400s on a missing or blank query', async () => {
    const h = ['X-Test-User-Id', me.provider_user_id];
    expect((await request(app).post('/api/search').set(...h).send({})).status).toBe(400);
    expect((await request(app).post('/api/search').set(...h).send({ query: '  ' })).status).toBe(400);
  });

  it('every result carries its graphId and the standard candidate shape', async () => {
    const res = await request(app)
      .post('/api/search')
      .set('X-Test-User-Id', me.provider_user_id)
      .send({ query: 'zephyr' });
    for (const r of res.body.results) {
      expect(r).toHaveProperty('graphId');
      expect(r).toHaveProperty('taskId');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('source');
    }
    expect(res.body.timings).toHaveProperty('total');
  });
});
