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

function taskRow(title) {
  const content = `---\ntitle: ${title}\nstatus: todo\n---\n`;
  const meta = JSON.stringify({ title, status: 'todo' });
  return [content, meta];
}

// Graph (arrows = execution order, source is prerequisite of target):
// A → B → D
// A → C → D
// D -- E (related)
// Inserted via TRUNCATE+RESTART so task ids are 1..5 deterministically.
beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('t') RETURNING id");
  gid = g.rows[0].id;
  for (const t of ['A', 'B', 'C', 'D', 'E']) {
    const [c, m] = taskRow(t);
    await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3)`,
      [gid, c, m]
    );
  }
  await pool.query(
    `INSERT INTO edges (graph_id, source_id, target_id, type) VALUES
      ($1, 1, 2, 'dependency'),
      ($1, 1, 3, 'dependency'),
      ($1, 2, 4, 'dependency'),
      ($1, 3, 4, 'dependency'),
      ($1, 4, 5, 'related')`,
    [gid]
  );
});

const tasksUrl = () => `/api/graphs/${gid}/tasks`;
const graphUrl = () => `/api/graphs/${gid}/graph`;

describe('Graph queries', () => {
  describe('GET /api/graphs/:gid/tasks/:id/subtasks (prerequisites)', () => {
    it('should return all prerequisites of task D', async () => {
      const res = await request(app).get(`${tasksUrl()}/4/subtasks`);
      expect(res.status).toBe(200);
      const ids = res.body.map((t) => t.id).sort();
      expect(ids).toEqual([1, 2, 3]); // A, B, C
    });

    it('should return empty for a root node with no prerequisites', async () => {
      const res = await request(app).get(`${tasksUrl()}/1/subtasks`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).get(`${tasksUrl()}/9999/subtasks`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for non-integer id', async () => {
      const res = await request(app).get(`${tasksUrl()}/abc/subtasks`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/graphs/:gid/tasks/:id/ancestors (dependents)', () => {
    it('should return all dependents of task A', async () => {
      const res = await request(app).get(`${tasksUrl()}/1/ancestors`);
      expect(res.status).toBe(200);
      const ids = res.body.map((t) => t.id).sort();
      expect(ids).toEqual([2, 3, 4]); // B, C, D
    });

    it('should return empty for an end-goal node', async () => {
      const res = await request(app).get(`${tasksUrl()}/4/ancestors`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).get(`${tasksUrl()}/9999/ancestors`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for non-integer id', async () => {
      const res = await request(app).get(`${tasksUrl()}/abc/ancestors`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/graphs/:gid/tasks/leaves', () => {
    it('should return tasks with no incoming dependency edges', async () => {
      const res = await request(app).get(`${tasksUrl()}/leaves`);
      expect(res.status).toBe(200);
      const ids = res.body.map((t) => t.id).sort();
      expect(ids).toEqual([1, 5]);
    });

    it('should return all tasks when no dependency edges exist', async () => {
      await pool.query('DELETE FROM edges');
      const res = await request(app).get(`${tasksUrl()}/leaves`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5);
    });
  });

  // Graph: A→B→D, A→C→D, D--E (related). Statuses set per-test.
  describe('GET /api/graphs/:gid/tasks/ready', () => {
    it('should return roots with no prerequisites (default todo statuses)', async () => {
      const res = await request(app).get(`${tasksUrl()}/ready`);
      expect(res.status).toBe(200);
      // A has no prereqs; E only has a 'related' edge so no dep prereqs.
      // B, C, D all have unfinished prereqs → not ready.
      const ids = res.body.map((t) => t.id).sort();
      expect(ids).toEqual([1, 5]);
    });

    it('should treat review as not-yet-done', async () => {
      // A is in review — its dependents B and C remain blocked.
      await pool.query(
        `UPDATE tasks SET meta = jsonb_set(meta, '{status}', '"review"') WHERE id = 1`
      );
      const res = await request(app).get(`${tasksUrl()}/ready`);
      const ids = res.body.map((t) => t.id).sort();
      expect(ids).toEqual([5]); // E only — no transitive readiness through review
    });

    it('should propagate readiness as prereqs become done', async () => {
      // Mark A done → B and C become ready (their only prereq is A).
      await pool.query(
        `UPDATE tasks SET meta = jsonb_set(meta, '{status}', '"done"') WHERE id = 1`
      );
      const res = await request(app).get(`${tasksUrl()}/ready`);
      const ids = res.body.map((t) => t.id).sort();
      expect(ids).toEqual([2, 3, 5]); // B, C, E
    });

    it('excludes a confidence-bearing node (a finding is not an open question)', async () => {
      // E (id 5) is an unblocked todo, so it is "ready" — until it carries a
      // confidence value. A confidence-bearing node is a claim/finding, not an
      // open question; the role predicate (open question = todo with NO
      // confidence) means it must drop out of /ready even while still at todo.
      // This guards the knowledge-node leak for legacy rows that were never
      // re-statused, not just well-formed new writes.
      await pool.query(
        `UPDATE tasks SET meta = jsonb_set(meta, '{confidence}', '0.8') WHERE id = 5`
      );
      const res = await request(app).get(`${tasksUrl()}/ready`);
      const ids = res.body.map((t) => t.id).sort();
      expect(ids).toEqual([1]); // only the open question A; E is now a finding
    });
  });

  describe('GET /api/graphs/:gid/tasks/:id/blockers', () => {
    it('should return all recursive non-done prereqs', async () => {
      const res = await request(app).get(`${tasksUrl()}/4/blockers`);
      expect(res.status).toBe(200);
      const ids = res.body.map((t) => t.id).sort();
      expect(ids).toEqual([1, 2, 3]); // A, B, C
    });

    it('should exclude prereqs already marked done', async () => {
      await pool.query(
        `UPDATE tasks SET meta = jsonb_set(meta, '{status}', '"done"') WHERE id IN (1, 2)`
      );
      const res = await request(app).get(`${tasksUrl()}/4/blockers`);
      const ids = res.body.map((t) => t.id).sort();
      expect(ids).toEqual([3]); // only C remains
    });

    it('should still include review-status prereqs (not done yet)', async () => {
      await pool.query(
        `UPDATE tasks SET meta = jsonb_set(meta, '{status}', '"done"') WHERE id IN (1, 2)`
      );
      await pool.query(
        `UPDATE tasks SET meta = jsonb_set(meta, '{status}', '"review"') WHERE id = 3`
      );
      const res = await request(app).get(`${tasksUrl()}/4/blockers`);
      const ids = res.body.map((t) => t.id);
      expect(ids).toEqual([3]); // C in review still blocks
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).get(`${tasksUrl()}/9999/blockers`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/graphs/:gid/tasks/:id/unblocks', () => {
    it("should identify D as unblocked when finishing C (B is done)", async () => {
      // A done, B done, C in review. Finishing C makes D ready.
      await pool.query(
        `UPDATE tasks SET meta = jsonb_set(meta, '{status}', '"done"') WHERE id IN (1, 2)`
      );
      await pool.query(
        `UPDATE tasks SET meta = jsonb_set(meta, '{status}', '"review"') WHERE id = 3`
      );
      const res = await request(app).get(`${tasksUrl()}/3/unblocks`);
      const ids = res.body.map((t) => t.id);
      expect(ids).toEqual([4]); // D
    });

    it("should return empty when other prereqs aren't done", async () => {
      // Only A done; B still blocking D.
      await pool.query(
        `UPDATE tasks SET meta = jsonb_set(meta, '{status}', '"done"') WHERE id = 1`
      );
      const res = await request(app).get(`${tasksUrl()}/2/unblocks`);
      // B → D, but D's other prereq C is still todo. So finishing B doesn't unblock D.
      expect(res.body).toEqual([]);
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).get(`${tasksUrl()}/9999/unblocks`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/graphs/:gid/graph/shortest-path', () => {
    it('should find shortest path between two tasks', async () => {
      const res = await request(app).get(`${graphUrl()}/shortest-path?from=1&to=4`);
      expect(res.status).toBe(200);
      expect(res.body.path).toHaveLength(3);
      expect(res.body.path[0]).toBe(1);
      expect(res.body.path[2]).toBe(4);
      expect(res.body.cost).toBe(2);
    });

    it('should return empty path for disconnected tasks', async () => {
      const [c, m] = taskRow('F');
      await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3)`,
        [gid, c, m]
      );
      const res = await request(app).get(`${graphUrl()}/shortest-path?from=1&to=6`);
      expect(res.status).toBe(200);
      expect(res.body.path).toEqual([]);
    });

    it('should return 400 if from or to is missing', async () => {
      const res = await request(app).get(`${graphUrl()}/shortest-path?from=1`);
      expect(res.status).toBe(400);
    });

    it('should return 400 if from or to is not a valid integer', async () => {
      const res = await request(app).get(`${graphUrl()}/shortest-path?from=abc&to=def`);
      expect(res.status).toBe(400);
    });

    it('should not cross graphs', async () => {
      const otherGid = (
        await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id")
      ).rows[0].id;
      const [c, m] = taskRow('Z');
      const z1 = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [otherGid, c, m]
      );
      const z2 = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [otherGid, c, m]
      );
      await pool.query(
        `INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, $2, $3, 'dependency')`,
        [otherGid, z1.rows[0].id, z2.rows[0].id]
      );
      // Try to find path between two tasks in 'other' graph using `gid` URL: should not find them.
      const res = await request(app).get(
        `${graphUrl()}/shortest-path?from=${z1.rows[0].id}&to=${z2.rows[0].id}`
      );
      expect(res.status).toBe(200);
      expect(res.body.path).toEqual([]);
    });
  });

  describe('GET /api/graphs/:gid/graph', () => {
    it('should return graph data with nodes and links', async () => {
      const res = await request(app).get(graphUrl());
      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(5);
      expect(res.body.links).toHaveLength(5);
      const node = res.body.nodes.find((n) => n.id === 1);
      expect(node.title).toBe('A');
      expect(node.status).toBe('todo');
      const link = res.body.links.find((l) => l.source === 1 && l.target === 2);
      expect(link.type).toBe('dependency');
      expect(link.meta).toEqual({});
    });

    it('should not include nodes/links from other graphs', async () => {
      const otherGid = (
        await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id")
      ).rows[0].id;
      const [c, m] = taskRow('Z');
      await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3)`,
        [otherGid, c, m]
      );
      const res = await request(app).get(graphUrl());
      expect(res.body.nodes).toHaveLength(5);
    });

    it('should return empty graph when no data', async () => {
      await pool.query('TRUNCATE tasks, edges RESTART IDENTITY CASCADE');
      const res = await request(app).get(graphUrl());
      expect(res.status).toBe(200);
      expect(res.body.nodes).toEqual([]);
      expect(res.body.links).toEqual([]);
    });
  });
});
