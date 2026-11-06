// GET /api/graphs/:gid/diagram — validation, derivation, and the read gate.
// Boilerplate from tests/reports-api.test.js (header auth adapter, real DB).
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

const url = (gid, qs) => `/api/graphs/${gid}/diagram${qs ? `?${qs}` : ''}`;

async function makeLegacyGraph() {
  return (await pool.query("INSERT INTO graphs (name) VALUES ('t') RETURNING id")).rows[0].id;
}
async function makeUser(pid) {
  return (await pool.query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('test-header', $1, $2, $1) RETURNING *`,
    [pid, `${pid}@test.local`],
  )).rows[0];
}
async function mkTask(gid, title, meta = {}) {
  const full = { title, status: 'todo', ...meta };
  return (await pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [gid, `---\ntitle: ${title}\n---\n`, JSON.stringify(full)],
  )).rows[0].id;
}
async function mkEdge(gid, source, target, purpose) {
  await pool.query(
    `INSERT INTO edges (graph_id, source_id, target_id, purpose, type) VALUES ($1,$2,$3,$4,$5)`,
    [gid, source, target, purpose, purpose === 'required for' ? 'dependency' : 'related'],
  );
}

describe('diagram API', () => {
  it('returns a pasteable figure for a fan', async () => {
    const gid = await makeLegacyGraph();
    const hub = await mkTask(gid, 'Hub claim');
    const ev = await mkTask(gid, 'Evidence');
    await mkEdge(gid, ev, hub, 'supports');

    const res = await request(app).get(url(gid, `kind=fan&node=${hub}`));
    expect(res.status).toBe(200);
    expect(res.body.markdown.startsWith('<figure class="gt-fig">')).toBe(true);
    expect(res.body.markdown).toContain(`/g/${gid}?node=${hub}`);
    expect(res.body.stats).toMatchObject({ kind: 'fan', seed: hub, shown: 2 });
  });

  it('validates params with 400s before touching the graph', async () => {
    const gid = await makeLegacyGraph();
    expect((await request(app).get(url(gid, 'node=1'))).status).toBe(400); // no kind
    expect((await request(app).get(url(gid, 'kind=pie&node=1'))).status).toBe(400);
    expect((await request(app).get(url(gid, 'kind=fan'))).status).toBe(400); // no node
    expect((await request(app).get(url(gid, 'kind=fan&node=abc'))).status).toBe(400);
    expect((await request(app).get(url(gid, 'kind=fan&node=1&to=2'))).status).toBe(400); // to on fan
    expect((await request(app).get(url(gid, 'kind=chain&node=1&to=x'))).status).toBe(400);
    expect((await request(app).get(url(gid, 'kind=fan&node=1&maxNodes=x'))).status).toBe(400);
  });

  it('clamps maxNodes instead of rejecting it', async () => {
    const gid = await makeLegacyGraph();
    const hub = await mkTask(gid, 'Hub');
    const ids = [];
    for (let i = 0; i < 6; i++) ids.push(await mkTask(gid, `E${i}`));
    for (const id of ids) await mkEdge(gid, id, hub, 'supports');
    const res = await request(app).get(url(gid, `kind=fan&node=${hub}&maxNodes=999`));
    expect(res.status).toBe(200); // clamped to the ceiling, not 400
    expect(res.body.stats.shown).toBe(7);
  });

  it('404s a missing seed and a seed with no qualifying edges', async () => {
    const gid = await makeLegacyGraph();
    const lone = await mkTask(gid, 'Lonely');
    expect((await request(app).get(url(gid, 'kind=fan&node=999999'))).status).toBe(404);
    expect((await request(app).get(url(gid, `kind=fan&node=${lone}`))).status).toBe(404);
    expect((await request(app).get(url(gid, `kind=chain&node=${lone}`))).status).toBe(404);
  });

  it('is read-gated like the graph view', async () => {
    const owner = await makeUser('owner');
    const gid = (await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('owned', $1, 'none') RETURNING id`,
      [owner.id],
    )).rows[0].id;
    const hub = await mkTask(gid, 'Hub');
    const ev = await mkTask(gid, 'Ev');
    await mkEdge(gid, ev, hub, 'supports');

    expect((await request(app).get(url(gid, `kind=fan&node=${hub}`)).set('X-Test-User-Id', 'owner')).status).toBe(200);
    expect((await request(app).get(url(gid, `kind=fan&node=${hub}`))).status).toBe(403); // anon on none
  });
});
