// E16.2 — per-graph report API (GET/PUT) + auth gates.
// GET is read-scoped, PUT is edit-scoped (requireGraphForMethod). Auth cases run
// through the real verifyAuth chain via the X-Test-User-Id header adapter.
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

const url = (gid) => `/api/graphs/${gid}/report`;

// A legacy owner-less graph (URL-bearer): read + edit both allowed with no user.
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

describe('report API (GET/PUT /api/graphs/:gid/report)', () => {
  it('PUT then GET round-trips; GET with no report is 404', async () => {
    const gid = await makeLegacyGraph();
    expect((await request(app).get(url(gid))).status).toBe(404);

    const put = await request(app).put(url(gid)).send({ title: 'My Report', description: 'd', body: '# Hello', meta: { k: 1 } });
    expect(put.status).toBe(200);

    const got = await request(app).get(url(gid));
    expect(got.status).toBe(200);
    expect(got.body.title).toBe('My Report');
    expect(got.body.description).toBe('d');
    expect(got.body.body).toBe('# Hello');
    expect(got.body.meta).toEqual({ k: 1 });
  });

  it('validates title/description/meta/source_graph_version and coerces non-string body', async () => {
    const gid = await makeLegacyGraph();
    expect((await request(app).put(url(gid)).send({ title: '' })).status).toBe(400);
    expect((await request(app).put(url(gid)).send({ title: '   ' })).status).toBe(400);
    expect((await request(app).put(url(gid)).send({ title: 'x'.repeat(201) })).status).toBe(400);
    expect((await request(app).put(url(gid)).send({ title: 'ok', description: 'd'.repeat(501) })).status).toBe(400);
    expect((await request(app).put(url(gid)).send({ title: 'ok', meta: [] })).status).toBe(400);
    expect((await request(app).put(url(gid)).send({ title: 'ok', meta: 'x' })).status).toBe(400);
    expect((await request(app).put(url(gid)).send({ title: 'ok', source_graph_version: 'nope' })).status).toBe(400);

    const ok = await request(app).put(url(gid)).send({ title: 'ok', body: 123, source_graph_version: 7 });
    expect(ok.status).toBe(200);
    expect(ok.body.body).toBe(''); // non-string body coerced
    expect(ok.body.source_graph_version).toBe(7);
  });

  it('preserves generated_at + run_id across a second PUT while updated_at advances', async () => {
    const gid = await makeLegacyGraph();
    const first = (await request(app).put(url(gid)).send({ title: 'v1', run_id: 'run-1' })).body;
    await new Promise((r) => setTimeout(r, 10));
    const second = (await request(app).put(url(gid)).send({ title: 'v2' })).body; // omits run_id

    expect(second.generated_at).toBe(first.generated_at); // preserved on UPDATE
    expect(new Date(second.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(first.updated_at).getTime());
    expect(second.run_id).toBe('run-1'); // COALESCE keeps the original
    expect(second.title).toBe('v2');
  });

  it('enforces read/edit auth (owner/editor write, viewer read-only, non-member 403)', async () => {
    const owner = await makeUser('owner');
    const editor = await makeUser('editor');
    const viewer = await makeUser('viewer');
    await makeUser('stranger');
    const gid = await makeOwnedGraph(owner.id, 'none');
    await addMember(gid, editor.id, 'editor');
    await addMember(gid, viewer.id, 'viewer');

    expect((await request(app).put(url(gid)).set('X-Test-User-Id', 'owner').send({ title: 'o' })).status).toBe(200);
    expect((await request(app).put(url(gid)).set('X-Test-User-Id', 'editor').send({ title: 'e' })).status).toBe(200);
    expect((await request(app).put(url(gid)).set('X-Test-User-Id', 'viewer').send({ title: 'v' })).status).toBe(403);
    expect((await request(app).get(url(gid)).set('X-Test-User-Id', 'viewer')).status).toBe(200);
    // Signed-in non-member on a restricted (anon_role:'none') graph: no write.
    expect((await request(app).put(url(gid)).set('X-Test-User-Id', 'stranger').send({ title: 's' })).status).toBe(403);
  });

  it('a legacy owner-less graph keeps URL-bearer PUT (no user header)', async () => {
    const gid = await makeLegacyGraph();
    expect((await request(app).put(url(gid)).send({ title: 'legacy' })).status).toBe(200);
  });

  it('a PUT has zero impact on graphs.updated_at/version and tasks/edges', async () => {
    const gid = await makeLegacyGraph();
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

    const g0 = (await pool.query(`SELECT updated_at, version FROM graphs WHERE id = $1`, [gid])).rows[0];
    const counts = async () => ({
      t: (await pool.query(`SELECT count(*)::int AS c FROM tasks WHERE graph_id = $1`, [gid])).rows[0].c,
      e: (await pool.query(`SELECT count(*)::int AS c FROM edges WHERE graph_id = $1`, [gid])).rows[0].c,
    });
    const c0 = await counts();

    await request(app).put(url(gid)).send({ title: 'R', body: 'x' });   // INSERT
    await request(app).put(url(gid)).send({ title: 'R2', body: 'y' });  // UPDATE

    const g1 = (await pool.query(`SELECT updated_at, version FROM graphs WHERE id = $1`, [gid])).rows[0];
    expect(g1.updated_at.getTime()).toBe(g0.updated_at.getTime());
    expect(g1.version).toBe(g0.version);
    expect(await counts()).toEqual(c0);
  });
});

// E16.6 — GET /report/meta: a body-less existence + staleness probe.
describe('report meta probe (GET /api/graphs/:gid/report/meta)', () => {
  const metaUrl = (gid) => `/api/graphs/${gid}/report/meta`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const bumpTask = (gid, t) => pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [gid, `---\ntitle: ${t}\nstatus: todo\n---\n`, JSON.stringify({ title: t, status: 'todo' })],
  );

  it('returns {exists:false} (200) when the graph has no report', async () => {
    const gid = await makeLegacyGraph();
    const res = await request(app).get(metaUrl(gid));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: false });
  });

  it('returns exists:true with title, timestamps, source_graph_version, a stale boolean, and NO body', async () => {
    const gid = await makeLegacyGraph();
    await sleep(5);
    await request(app).put(url(gid)).send({ title: 'R', body: 'x', source_graph_version: 12 });
    const res = await request(app).get(metaUrl(gid));
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.title).toBe('R');
    expect(res.body.source_graph_version).toBe(12);
    expect(typeof res.body.stale).toBe('boolean');
    expect(res.body).not.toHaveProperty('body');
  });

  it('stale is false for a fresh report, flips true after a graph edit, and a bare report write does NOT clear it', async () => {
    const gid = await makeLegacyGraph();
    await sleep(5);
    await request(app).put(url(gid)).send({ title: 'R', body: 'x' });
    // Report generated AFTER graph creation, no graph edits since → not stale.
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(false);

    // A graph edit: a task insert bumps graphs.updated_at via the trigger.
    await sleep(5);
    await bumpTask(gid, 'A');
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(true);

    // A bare report write preserves generated_at and never touches graphs.updated_at,
    // so staleness must persist — a re-PUT of the same body is not a regeneration.
    await request(app).put(url(gid)).send({ title: 'R2', body: 'y' });
    expect((await request(app).get(metaUrl(gid))).body.stale).toBe(true);
  });

  it('is read-gated (a viewer-member gets 200); HEAD would be edit-gated, which is why the probe is GET /meta', async () => {
    const owner = await makeUser('meta-owner');
    const viewer = await makeUser('meta-viewer');
    const gid = await makeOwnedGraph(owner.id, 'none');
    await addMember(gid, viewer.id, 'viewer');
    await request(app).put(url(gid)).set('X-Test-User-Id', 'meta-owner').send({ title: 'R' });

    expect((await request(app).get(metaUrl(gid)).set('X-Test-User-Id', 'meta-viewer')).status).toBe(200);
    // HEAD classifies as edit under requireGraphForMethod, so a viewer can't use it —
    // exactly why the staleness probe is a GET, not a HEAD.
    expect((await request(app).head(url(gid)).set('X-Test-User-Id', 'meta-viewer')).status).toBe(403);
  });

  it('source_graph_version round-trips through PUT into both GET / and GET /meta', async () => {
    const gid = await makeLegacyGraph();
    await request(app).put(url(gid)).send({ title: 'R', source_graph_version: 99 });
    expect((await request(app).get(url(gid))).body.source_graph_version).toBe(99);
    expect((await request(app).get(metaUrl(gid))).body.source_graph_version).toBe(99);
  });
});

// E16.14 — the reader's degraded states hang off a per-report capability signal
// and the same read/edit gating requireGraphForMethod enforces.
describe('report capability + write gating (E16.14)', () => {
  it('GET /report includes viewer_can_edit — true for owner/editor, false for a viewer', async () => {
    const owner = await makeUser('cap-owner');
    const editor = await makeUser('cap-editor');
    const viewer = await makeUser('cap-viewer');
    const gid = await makeOwnedGraph(owner.id, 'none');
    await addMember(gid, editor.id, 'editor');
    await addMember(gid, viewer.id, 'viewer');
    await request(app).put(url(gid)).set('X-Test-User-Id', 'cap-owner').send({ title: 'R' });

    expect((await request(app).get(url(gid)).set('X-Test-User-Id', 'cap-owner')).body.viewer_can_edit).toBe(true);
    expect((await request(app).get(url(gid)).set('X-Test-User-Id', 'cap-editor')).body.viewer_can_edit).toBe(true);
    expect((await request(app).get(url(gid)).set('X-Test-User-Id', 'cap-viewer')).body.viewer_can_edit).toBe(false);
  });

  it('DELETE is edit-gated: a viewer gets 403, anon gets 403, an editor gets 204', async () => {
    const owner = await makeUser('del-owner');
    const editor = await makeUser('del-editor');
    const viewer = await makeUser('del-viewer');
    const gid = await makeOwnedGraph(owner.id, 'none');
    await addMember(gid, editor.id, 'editor');
    await addMember(gid, viewer.id, 'viewer');
    await request(app).put(url(gid)).set('X-Test-User-Id', 'del-owner').send({ title: 'R' });

    expect((await request(app).delete(url(gid)).set('X-Test-User-Id', 'del-viewer')).status).toBe(403);
    expect((await request(app).delete(url(gid))).status).toBe(403); // anon on a restricted graph
    expect((await request(app).delete(url(gid)).set('X-Test-User-Id', 'del-editor')).status).toBe(204);
  });

  it('an anon viewer of a PUBLIC graph can GET the report (viewer_can_edit:false) but cannot PUT/DELETE', async () => {
    const owner = await makeUser('pub-owner');
    const gid = await makeOwnedGraph(owner.id, 'viewer'); // anon_role viewer → public read
    await request(app).put(url(gid)).set('X-Test-User-Id', 'pub-owner').send({ title: 'R', body: '# hi' });

    const anonGet = await request(app).get(url(gid)); // no auth header
    expect(anonGet.status).toBe(200);
    expect(anonGet.body.viewer_can_edit).toBe(false); // reader shows plain copy, no CTA
    expect((await request(app).put(url(gid)).send({ title: 'x' })).status).toBe(403);
    expect((await request(app).delete(url(gid))).status).toBe(403);
  });
});
