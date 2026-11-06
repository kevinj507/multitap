// OKF export API (GET /api/graphs/:gid/export) — envelope shape, tar shape,
// and the read-gate auth matrix. Read-scoped at the mount (requireGraph('read')),
// so the matrix mirrors /graph: viewers and anon-viewers can export, strangers
// on restricted graphs cannot.
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import { parseMarkdown } from '../src/markdown.js';

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

const url = (gid) => `/api/graphs/${gid}/export`;

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
async function makeOwnedGraph(ownerId, anonRole = 'none') {
  return (await pool.query(
    `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('owned', $1, $2) RETURNING id`,
    [ownerId, anonRole],
  )).rows[0].id;
}
async function addMember(gid, userId, role) {
  await pool.query(`INSERT INTO graph_members (graph_id, user_id, role) VALUES ($1, $2, $3)`, [gid, userId, role]);
}
async function mkTask(gid, title, extra = {}) {
  const meta = { title, status: 'todo', ...extra };
  return (await pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [gid, `---\ntitle: ${title}\nstatus: ${meta.status}\n---\nBody of ${title}.`, JSON.stringify(meta)],
  )).rows[0].id;
}
async function mkEdge(gid, source, target, purpose) {
  await pool.query(
    `INSERT INTO edges (graph_id, source_id, target_id, purpose, type)
     VALUES ($1, $2, $3, $4, $5)`,
    [gid, source, target, purpose, purpose === 'required for' ? 'dependency' : 'related'],
  );
}

describe('export API (GET /api/graphs/:gid/export)', () => {
  it('returns the JSON envelope with a conformant bundle', async () => {
    const gid = await makeLegacyGraph();
    const a = await mkTask(gid, 'First');
    const b = await mkTask(gid, 'Second');
    await mkEdge(gid, a, b, 'required for');
    await request(app).put(`/api/graphs/${gid}/report`).send({ title: 'Rep', body: '# R' });

    const res = await request(app).get(url(gid));
    expect(res.status).toBe(200);
    expect(res.body.okf_version).toBe('0.2');
    expect(res.body.graph.id).toBe(gid);
    expect(typeof res.body.graph.version).toBe('number');

    const files = res.body.files;
    const paths = Object.keys(files);
    expect(paths).toContain('index.md');
    expect(paths).toContain('log.md');
    expect(paths).toContain('report.md');
    expect(paths).toContain(`tasks/${a}-first.md`);

    // Spot-check one task doc end-to-end through the real parser.
    const doc = parseMarkdown(files[`tasks/${a}-first.md`]);
    expect(doc.frontmatterError).toBeNull();
    expect(doc.meta.type).toBe('task');
    expect(doc.meta.task_status).toBe('todo');
    expect(doc.meta.generated.by).toBeTruthy();
    expect(doc.meta.edges).toEqual([{ to: `tasks/${b}-second`, purpose: 'required for' }]);
    expect(doc.body).toContain(`* Required for: [Second](/tasks/${b}-second.md)`);
  });

  it('?format=tar streams a well-formed ustar attachment', async () => {
    const gid = await makeLegacyGraph();
    await mkTask(gid, 'Only');

    const res = await request(app)
      .get(url(gid) + '?format=tar')
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/x-tar');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="${gid}.okf.tar"`);
    const buf = res.body;
    expect(buf.length % 512).toBe(0);
    expect(buf.subarray(257, 262).toString('ascii')).toBe('ustar');
    expect(buf.subarray(0, buf.indexOf(0)).toString('ascii')).toBe('index.md');
  });

  it('rejects unknown formats with 400', async () => {
    const gid = await makeLegacyGraph();
    const res = await request(app).get(url(gid) + '?format=zip');
    expect(res.status).toBe(400);
  });

  it('is read-gated exactly like the graph view', async () => {
    const owner = await makeUser('owner');
    const viewer = await makeUser('viewer');
    await makeUser('stranger');
    const restricted = await makeOwnedGraph(owner.id, 'none');
    await addMember(restricted, viewer.id, 'viewer');

    expect((await request(app).get(url(restricted)).set('X-Test-User-Id', 'owner')).status).toBe(200);
    expect((await request(app).get(url(restricted)).set('X-Test-User-Id', 'viewer')).status).toBe(200);
    expect((await request(app).get(url(restricted)).set('X-Test-User-Id', 'stranger')).status).toBe(403);
    expect((await request(app).get(url(restricted))).status).toBe(403); // anon

    const open = await makeOwnedGraph(owner.id, 'viewer');
    expect((await request(app).get(url(open))).status).toBe(200); // anon on anon_role:viewer

    const legacy = await makeLegacyGraph();
    expect((await request(app).get(url(legacy))).status).toBe(200); // owner-less URL-bearer
  });

  it('404s an unknown graph and 200s an empty one', async () => {
    expect((await request(app).get(url('nope404nope404xx'))).status).toBe(404);

    const gid = await makeLegacyGraph();
    const res = await request(app).get(url(gid));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.files)).toEqual(['index.md', 'log.md']);
  });
});
