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
  for (const [k, v] of Object.entries(opts)) {
    if (!['description', 'status', 'body'].includes(k)) lines.push(`${k}: ${v}`);
  }
  const body = opts.body || '';
  return `---\n${lines.join('\n')}\n---\n${body}`;
}

const tasksUrl = () => `/api/graphs/${gid}/tasks`;

describe('Task CRUD', () => {
  describe('POST /api/graphs/:gid/tasks', () => {
    it('should create a task with title only', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: md('My task') });
      expect(res.status).toBe(201);
      expect(res.body.meta.title).toBe('My task');
      expect(res.body.meta.status).toBe('todo');
      expect(res.body.id).toBeDefined();
      expect(res.body.graph_id).toBe(gid);
    });

    it('should create a task with all fields', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: md('Full', { description: 'desc', status: 'in_progress' }) });
      expect(res.status).toBe(201);
      expect(res.body.meta.title).toBe('Full');
      expect(res.body.meta.description).toBe('desc');
      expect(res.body.meta.status).toBe('in_progress');
    });

    it('should preserve custom fields in meta', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: md('Custom', { priority: 'high', assignee: 'alice' }) });
      expect(res.status).toBe(201);
      expect(res.body.meta.priority).toBe('high');
      expect(res.body.meta.assignee).toBe('alice');
    });

    it('should preserve markdown body', async () => {
      const content = md('With body', { body: '\n## Notes\n\nSome details here\n' });
      const res = await request(app)
        .post(tasksUrl())
        .send({ content });
      expect(res.status).toBe(201);
      expect(res.body.content).toContain('## Notes');
      expect(res.body.content).toContain('Some details here');
    });

    it('should reject a task without content', async () => {
      const res = await request(app).post(tasksUrl()).send({});
      expect(res.status).toBe(400);
    });

    it('should reject a task without title', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: '---\nstatus: todo\n---\n' });
      expect(res.status).toBe(400);
    });

    it('should reject a task with invalid status', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: md('Bad', { status: 'invalid' }) });
      expect(res.status).toBe(400);
    });

    it('should accept review as a valid status', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: md('Pending review', { status: 'review' }) });
      expect(res.status).toBe(201);
      expect(res.body.meta.status).toBe('review');
    });

    it('should reject a task with title > 100 chars', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: md('x'.repeat(101)) });
      expect(res.status).toBe(400);
    });

    it('should accept a task with a 100 char title', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: md('x'.repeat(100)) });
      expect(res.status).toBe(201);
    });

    it('should reject a task with description > 200 chars', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: md('Bad', { description: 'x'.repeat(201) }) });
      expect(res.status).toBe(400);
    });

    it('should default status to todo', async () => {
      const res = await request(app)
        .post(tasksUrl())
        .send({ content: '---\ntitle: Minimal\n---\n' });
      expect(res.status).toBe(201);
      expect(res.body.meta.status).toBe('todo');
    });

    it('should return 404 when graph does not exist', async () => {
      const res = await request(app)
        .post('/api/graphs/9999/tasks')
        .send({ content: md('Orphan') });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/graphs/:gid/tasks', () => {
    it('should return empty array when no tasks', async () => {
      const res = await request(app).get(tasksUrl());
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return all tasks in this graph only', async () => {
      const otherGid = (
        await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id")
      ).rows[0].id;
      for (const t of ['A', 'B', 'C']) {
        await pool.query(
          `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3)`,
          [gid, md(t), JSON.stringify({ title: t, status: 'todo' })]
        );
      }
      // Task in another graph should not show up
      await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3)`,
        [otherGid, md('Other'), JSON.stringify({ title: 'Other', status: 'todo' })]
      );
      const res = await request(app).get(tasksUrl());
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });
  });

  describe('GET /api/graphs/:gid/tasks/:id', () => {
    it('should return a single task by id', async () => {
      const create = await request(app)
        .post(tasksUrl())
        .send({ content: md('Find me') });
      const res = await request(app).get(`${tasksUrl()}/${create.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.title).toBe('Find me');
    });

    it('should return 404 for non-existent id', async () => {
      const res = await request(app).get(`${tasksUrl()}/9999`);
      expect(res.status).toBe(404);
    });

    it('should return 404 when task belongs to another graph (isolation)', async () => {
      const otherGid = (
        await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id")
      ).rows[0].id;
      const r = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [otherGid, md('Other'), JSON.stringify({ title: 'Other', status: 'todo' })]
      );
      const res = await request(app).get(`${tasksUrl()}/${r.rows[0].id}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/graphs/:gid/tasks/:id', () => {
    it('should update a task via new content', async () => {
      const create = await request(app).post(tasksUrl()).send({ content: md('Old') });
      const res = await request(app)
        .patch(`${tasksUrl()}/${create.body.id}`)
        .send({ content: md('Updated') });
      expect(res.status).toBe(200);
      expect(res.body.meta.title).toBe('Updated');
    });

    it('should update status', async () => {
      const create = await request(app).post(tasksUrl()).send({ content: md('Task') });
      const res = await request(app)
        .patch(`${tasksUrl()}/${create.body.id}`)
        .send({ content: md('Task', { status: 'done' }) });
      expect(res.status).toBe(200);
      expect(res.body.meta.status).toBe('done');
    });

    it('should set updated_at on update', async () => {
      const r = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta, created_at)
         VALUES ($1, $2, $3, NOW() - interval '1 hour') RETURNING id`,
        [gid, md('Task'), JSON.stringify({ title: 'Task', status: 'todo' })]
      );
      const res = await request(app)
        .patch(`${tasksUrl()}/${r.rows[0].id}`)
        .send({ content: md('Changed') });
      expect(res.status).toBe(200);
      const created = new Date(res.body.created_at);
      const updated = new Date(res.body.updated_at);
      expect(updated.getTime()).toBeGreaterThan(created.getTime());
    });

    it('should return 410 Gone for a task that no longer exists', async () => {
      // The route can't distinguish "never existed" from "was deleted" without
      // an audit table. 410 is correct for the deleted case (the actual concern
      // for OCC clients) and acceptable for never-existed.
      const res = await request(app)
        .patch(`${tasksUrl()}/9999`)
        .send({ content: md('Nope') });
      expect(res.status).toBe(410);
    });
  });

  describe('DELETE /api/graphs/:gid/tasks/:id', () => {
    it('should delete a task', async () => {
      const create = await request(app).post(tasksUrl()).send({ content: md('Delete me') });
      const del = await request(app).delete(`${tasksUrl()}/${create.body.id}`);
      expect(del.status).toBe(200);
      const get = await request(app).get(`${tasksUrl()}/${create.body.id}`);
      expect(get.status).toBe(404);
    });

    it('should return 404 for non-existent id', async () => {
      const res = await request(app).delete(`${tasksUrl()}/9999`);
      expect(res.status).toBe(404);
    });
  });

  describe('invalid :id', () => {
    it('GET returns 400 for non-integer id', async () => {
      const res = await request(app).get(`${tasksUrl()}/abc`);
      expect(res.status).toBe(400);
    });

    it('PATCH returns 400 for non-integer id', async () => {
      const res = await request(app)
        .patch(`${tasksUrl()}/abc`)
        .send({ content: md('X') });
      expect(res.status).toBe(400);
    });

    it('DELETE returns 400 for non-integer id', async () => {
      const res = await request(app).delete(`${tasksUrl()}/abc`);
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown :gid', async () => {
      // Phase B: requireGraphForMethod returns 404 for missing graphs before
      // the handler runs (was 200 + [] under Phase A's "graph absent → empty
      // list" permissive behavior).
      const res = await request(app).get('/api/graphs/zzzzzzzz/tasks');
      expect(res.status).toBe(404);
    });
  });
});
