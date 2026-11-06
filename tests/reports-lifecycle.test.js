// E16.11 — report lifecycle at the API level: rotate-id carry, graph-delete
// cascade, DELETE /report semantics, one-per-graph upsert, DELETE auth gates,
// and schema.sql idempotency against a POPULATED database. Complements
// reports-schema.test.js (same guarantees at the SQL layer) by exercising the
// real routes through supertest, and reports-api.test.js (GET/PUT + auth).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const url = (gid) => `/api/graphs/${gid}/report`;

// A legacy owner-less graph (URL-bearer): read/edit/manage all allowed with no
// user — lets lifecycle tests hit rotate-id and graph DELETE without auth setup.
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
async function reportCount(gid) {
  return (await pool.query(`SELECT count(*)::int AS c FROM reports WHERE graph_id = $1`, [gid])).rows[0].c;
}

describe('report lifecycle (E16.11)', () => {
  it('rotate-id carries the report to the new graph id (ON UPDATE CASCADE via the API)', async () => {
    const gid = await makeLegacyGraph();
    expect((await request(app).put(url(gid)).send({ title: 'Carried', body: '# survives rotate' })).status).toBe(200);

    const rotated = await request(app).post(`/api/graphs/${gid}/rotate-id`);
    expect(rotated.status).toBe(200);
    const newId = rotated.body.id;
    expect(newId).not.toBe(gid);

    // The report followed the graph to its new id...
    const got = await request(app).get(url(newId));
    expect(got.status).toBe(200);
    expect(got.body.title).toBe('Carried');
    expect(got.body.body).toBe('# survives rotate');
    // ...and the old id is dead entirely (the whole graph 404s, not just the report).
    expect((await request(app).get(url(gid))).status).toBe(404);
  });

  it('deleting the graph cascades away its report row (no orphans)', async () => {
    const gid = await makeLegacyGraph();
    await request(app).put(url(gid)).send({ title: 'Doomed' });
    expect(await reportCount(gid)).toBe(1);

    expect((await request(app).delete(`/api/graphs/${gid}`)).status).toBe(200);
    // Prove at the table level — no orphaned report survives the graph.
    expect((await pool.query(`SELECT count(*)::int AS c FROM reports`)).rows[0].c).toBe(0);
  });

  it('DELETE /report: 204, then GET 404 (empty-reader state), then DELETE again 404', async () => {
    const gid = await makeLegacyGraph();
    await request(app).put(url(gid)).send({ title: 'Ephemeral' });

    expect((await request(app).delete(url(gid))).status).toBe(204);
    const gone = await request(app).get(url(gid));
    expect(gone.status).toBe(404);
    expect(gone.body).toEqual({ error: 'no report yet' });
    // Nothing left to delete — the repeat DELETE says so rather than lying 204.
    const again = await request(app).delete(url(gid));
    expect(again.status).toBe(404);
    expect(again.body).toEqual({ error: 'no report yet' });
  });

  it('two sequential PUTs leave exactly one row (upsert, not append)', async () => {
    const gid = await makeLegacyGraph();
    expect((await request(app).put(url(gid)).send({ title: 'v1', body: 'one' })).status).toBe(200);
    expect((await request(app).put(url(gid)).send({ title: 'v2', body: 'two' })).status).toBe(200);

    const rows = (await pool.query(`SELECT title, body FROM reports WHERE graph_id = $1`, [gid])).rows;
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('v2');
    expect(rows[0].body).toBe('two');
  });

  it('DELETE is edit-gated: viewer-member 403, editor-member 204', async () => {
    const owner = await makeUser('owner');
    const editor = await makeUser('editor');
    const viewer = await makeUser('viewer');
    const gid = await makeOwnedGraph(owner.id, 'none');
    await addMember(gid, editor.id, 'editor');
    await addMember(gid, viewer.id, 'viewer');
    await request(app).put(url(gid)).set('X-Test-User-Id', 'owner').send({ title: 'Guarded' });

    expect((await request(app).delete(url(gid)).set('X-Test-User-Id', 'viewer')).status).toBe(403);
    expect(await reportCount(gid)).toBe(1); // the 403 really didn't delete
    expect((await request(app).delete(url(gid)).set('X-Test-User-Id', 'editor')).status).toBe(204);
    expect(await reportCount(gid)).toBe(0);
  });

  it('re-applying schema.sql on a POPULATED db is a no-op for existing data', async () => {
    const gid = await makeLegacyGraph();
    // Populate every report-adjacent surface: tasks, an edge, and the report.
    const mkTask = (t) => pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [gid, `---\ntitle: ${t}\nstatus: todo\n---\n`, JSON.stringify({ title: t, status: 'todo' })],
    ).then((r) => r.rows[0].id);
    const a = await mkTask('A');
    const b = await mkTask('B');
    await pool.query(
      `INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1, $2, $3, 'related', 'related to')`,
      [gid, a, b],
    );
    await request(app).put(url(gid)).send({ title: 'Survivor', body: '# still here' });
    const before = (await pool.query(`SELECT * FROM reports WHERE graph_id = $1`, [gid])).rows[0];

    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf-8');
    await expect(pool.query(schema)).resolves.toBeTruthy();

    // The report row survived untouched — same body, same timestamps.
    const after = (await pool.query(`SELECT * FROM reports WHERE graph_id = $1`, [gid])).rows;
    expect(after.length).toBe(1);
    expect(after[0].title).toBe('Survivor');
    expect(after[0].body).toBe('# still here');
    expect(after[0].generated_at.getTime()).toBe(before.generated_at.getTime());
    expect(after[0].updated_at.getTime()).toBe(before.updated_at.getTime());
    // And the rest of the graph is intact too.
    expect((await pool.query(`SELECT count(*)::int AS c FROM tasks WHERE graph_id = $1`, [gid])).rows[0].c).toBe(2);
    expect((await pool.query(`SELECT count(*)::int AS c FROM edges WHERE graph_id = $1`, [gid])).rows[0].c).toBe(1);
  });
});
