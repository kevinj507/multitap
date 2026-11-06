import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
});

beforeEach(async () => {
  const r = await pool.query("INSERT INTO graphs (name) VALUES ('t') RETURNING id");
  gid = r.rows[0].id;
});

function md(title, opts = {}) {
  const lines = [`title: ${title}`];
  if (opts.description) lines.push(`description: ${opts.description}`);
  lines.push(`status: ${opts.status || 'todo'}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

const tasksUrl = () => `/api/graphs/${gid}/tasks`;
const edgesUrl = () => `/api/graphs/${gid}/edges`;
const graphUrl = () => `/api/graphs/${gid}/graph`;

describe('API integration', () => {
  it('should support full task lifecycle', async () => {
    const create = await request(app)
      .post(tasksUrl())
      .send({ content: md('Lifecycle task') });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const update1 = await request(app)
      .patch(`${tasksUrl()}/${id}`)
      .send({ content: md('Lifecycle task', { status: 'in_progress' }) });
    expect(update1.body.meta.status).toBe('in_progress');

    const update2 = await request(app)
      .patch(`${tasksUrl()}/${id}`)
      .send({ content: md('Lifecycle task', { status: 'done' }) });
    expect(update2.body.meta.status).toBe('done');

    const get = await request(app).get(`${tasksUrl()}/${id}`);
    expect(get.body.meta.status).toBe('done');
  });

  it('should build a dependency graph and find leaves', async () => {
    const a = await request(app).post(tasksUrl()).send({ content: md('A') });
    const b = await request(app).post(tasksUrl()).send({ content: md('B') });
    const c = await request(app).post(tasksUrl()).send({ content: md('C') });

    await request(app)
      .post(edgesUrl())
      .send({ source_id: a.body.id, target_id: b.body.id, purpose: 'required for' });
    await request(app)
      .post(edgesUrl())
      .send({ source_id: a.body.id, target_id: c.body.id, purpose: 'required for' });

    const leaves = await request(app).get(`${tasksUrl()}/leaves`);
    const ids = leaves.body.map((t) => t.id).sort();
    expect(ids).toEqual([a.body.id]);

    // ?fields=id trims rows to bare ids (what the canvas highlighter uses);
    // same rows, no content/meta payload.
    const slim = await request(app).get(`${tasksUrl()}/leaves?fields=id`);
    expect(slim.status).toBe(200);
    expect(slim.body).toEqual([{ id: a.body.id }]);
  });

  it('should prevent cycles in dependencies', async () => {
    const a = await request(app).post(tasksUrl()).send({ content: md('A') });
    const b = await request(app).post(tasksUrl()).send({ content: md('B') });
    const c = await request(app).post(tasksUrl()).send({ content: md('C') });

    await request(app)
      .post(edgesUrl())
      .send({ source_id: a.body.id, target_id: b.body.id, purpose: 'required for' });
    await request(app)
      .post(edgesUrl())
      .send({ source_id: b.body.id, target_id: c.body.id, purpose: 'required for' });

    const cycle = await request(app)
      .post(edgesUrl())
      .send({ source_id: c.body.id, target_id: a.body.id, purpose: 'required for' });
    expect(cycle.status).toBe(400);
    expect(cycle.body.error).toMatch(/cycle/i);
  });

  it('should cascade delete: removing a task removes its edges', async () => {
    const a = await request(app).post(tasksUrl()).send({ content: md('A') });
    const b = await request(app).post(tasksUrl()).send({ content: md('B') });

    await request(app)
      .post(edgesUrl())
      .send({ source_id: a.body.id, target_id: b.body.id, purpose: 'required for' });

    await request(app).delete(`${tasksUrl()}/${a.body.id}`);

    const edges = await request(app).get(edgesUrl());
    expect(edges.body).toHaveLength(0);
  });

  it('should cascade delete: removing a graph removes its tasks and edges', async () => {
    const a = await request(app).post(tasksUrl()).send({ content: md('A') });
    const b = await request(app).post(tasksUrl()).send({ content: md('B') });
    await request(app)
      .post(edgesUrl())
      .send({ source_id: a.body.id, target_id: b.body.id, purpose: 'required for' });

    const del = await request(app).delete(`/api/graphs/${gid}`);
    expect(del.status).toBe(200);

    const tasksLeft = await pool.query('SELECT * FROM tasks');
    const edgesLeft = await pool.query('SELECT * FROM edges');
    expect(tasksLeft.rows).toHaveLength(0);
    expect(edgesLeft.rows).toHaveLength(0);
  });

  it('should return full graph for visualization', async () => {
    const a = await request(app).post(tasksUrl()).send({ content: md('A') });
    const b = await request(app).post(tasksUrl()).send({ content: md('B') });
    await request(app)
      .post(edgesUrl())
      .send({ source_id: a.body.id, target_id: b.body.id, purpose: 'required for' });

    const graph = await request(app).get(graphUrl());
    expect(graph.status).toBe(200);
    expect(graph.body.nodes).toHaveLength(2);
    expect(graph.body.links).toHaveLength(1);
    expect(graph.body.links[0].source).toBe(a.body.id);
    expect(graph.body.links[0].target).toBe(b.body.id);
  });

  it('should find shortest path', async () => {
    const a = await request(app).post(tasksUrl()).send({ content: md('A') });
    const b = await request(app).post(tasksUrl()).send({ content: md('B') });
    const c = await request(app).post(tasksUrl()).send({ content: md('C') });
    const d = await request(app).post(tasksUrl()).send({ content: md('D') });

    await request(app).post(edgesUrl()).send({ source_id: a.body.id, target_id: b.body.id, purpose: 'required for' });
    await request(app).post(edgesUrl()).send({ source_id: b.body.id, target_id: d.body.id, purpose: 'required for' });
    await request(app).post(edgesUrl()).send({ source_id: a.body.id, target_id: c.body.id, purpose: 'required for' });
    await request(app).post(edgesUrl()).send({ source_id: c.body.id, target_id: d.body.id, purpose: 'required for' });

    const res = await request(app).get(
      `${graphUrl()}/shortest-path?from=${a.body.id}&to=${d.body.id}`
    );
    expect(res.body.path).toHaveLength(3);
    expect(res.body.path[0]).toBe(a.body.id);
    expect(res.body.path[2]).toBe(d.body.id);
    expect(res.body.cost).toBe(2);
  });

  it('should serve static files', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  describe('selection routes', () => {
    const selUrl = () => `/api/graphs/${gid}/selection`;

    it('POST without X-Writer-Id returns 400', async () => {
      const res = await request(app).post(selUrl()).send({ node_ids: [1] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/X-Writer-Id/);
    });

    it('POST with X-Writer-Id returns 204 and snapshot reflects it', async () => {
      const post = await request(app)
        .post(selUrl())
        .set('X-Writer-Id', 'w-api-test')
        .send({ node_ids: [1, 2], editing: { kind: 'node', id: 1 } });
      expect(post.status).toBe(204);
      const snap = await request(app).get(selUrl());
      expect(snap.status).toBe(200);
      expect(snap.body).toHaveLength(1);
      expect(snap.body[0]).toMatchObject({
        writer_id: 'w-api-test',
        node_ids: [1, 2],
        editing: { kind: 'node', id: 1 },
      });
    });

    it('DELETE clears the selection (idempotent)', async () => {
      await request(app)
        .post(selUrl())
        .set('X-Writer-Id', 'w-del')
        .send({ node_ids: [1] });
      const del1 = await request(app).delete(`${selUrl()}/w-del`);
      expect(del1.status).toBe(204);
      const del2 = await request(app).delete(`${selUrl()}/w-del`);
      expect(del2.status).toBe(204); // idempotent
      const snap = await request(app).get(selUrl());
      expect(snap.body).toEqual([]);
    });
  });

  describe('prefs API (anon paths)', () => {
    it('GET /api/me/prefs without auth → 401', async () => {
      const r = await request(app).get('/api/me/prefs');
      expect(r.status).toBe(401);
    });
    it('PUT /api/me/prefs without auth → 401', async () => {
      const r = await request(app).put('/api/me/prefs').send({ agent_follow_default: false });
      expect(r.status).toBe(401);
    });
    it('GET /api/graphs/:gid/prefs/me without auth → 401', async () => {
      const r = await request(app).get(`/api/graphs/${gid}/prefs/me`);
      expect(r.status).toBe(401);
    });
    it('PUT /api/graphs/:gid/prefs/me without auth → 401', async () => {
      const r = await request(app).put(`/api/graphs/${gid}/prefs/me`).send({ agent_follow: true });
      expect(r.status).toBe(401);
    });
  });
});
