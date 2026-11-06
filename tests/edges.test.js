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

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('t') RETURNING id");
  gid = g.rows[0].id;
  // Insert A, B, C with predictable ids 1, 2, 3 (truncate restarts identity).
  const [cA, mA] = taskRow('A');
  const [cB, mB] = taskRow('B');
  const [cC, mC] = taskRow('C');
  await pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3), ($1, $4, $5), ($1, $6, $7)`,
    [gid, cA, mA, cB, mB, cC, mC]
  );
});

const edgesUrl = () => `/api/graphs/${gid}/edges`;

describe('Edge CRUD', () => {
  describe('POST /api/graphs/:gid/edges', () => {
    it('should create a dependency edge', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 2, purpose: 'required for' });
      expect(res.status).toBe(201);
      expect(res.body.source_id).toBe(1);
      expect(res.body.target_id).toBe(2);
      expect(res.body.type).toBe('dependency');
      expect(res.body.graph_id).toBe(gid);
    });

    it('should create a related edge', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 3, purpose: 'related to' });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('related');
    });

    it('should create an edge with curve metadata (legacy number)', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 2, purpose: 'required for', meta: { curve: 42.123 } });
      expect(res.status).toBe(201);
      // Legacy numbers normalize to {distance, weight: 0.5} on write.
      expect(res.body.meta.curve).toEqual({ distance: 42.12, weight: 0.5 });
    });

    it('should create an edge with curve {distance, weight}', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({
          source_id: 1,
          target_id: 2,
          purpose: 'required for',
          meta: { curve: { distance: -50, weight: 0.25 } },
        });
      expect(res.status).toBe(201);
      expect(res.body.meta.curve).toEqual({ distance: -50, weight: 0.25 });
    });

    it('should reject curve.weight out of range', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({
          source_id: 1,
          target_id: 2,
          purpose: 'required for',
          meta: { curve: { distance: 10, weight: 1.5 } },
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/weight/i);
    });

    it('should create an edge with color metadata', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 2, purpose: 'required for', meta: { color: '#253F55' } });
      expect(res.status).toBe(201);
      expect(res.body.meta.color).toBe('#253F55');
    });

    it('should reject edge with missing source_id', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({ target_id: 2, purpose: 'required for' });
      expect(res.status).toBe(400);
    });

    it('should reject edge with missing target_id', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, purpose: 'required for' });
      expect(res.status).toBe(400);
    });

    it('should reject edge with invalid type', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 2, purpose: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should reject duplicate edge', async () => {
      await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 2, purpose: 'required for' });
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 2, purpose: 'required for' });
      expect(res.status).toBe(409);
    });

    it('should reject self-referencing edge', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 1, purpose: 'required for' });
      expect(res.status).toBe(400);
    });

    it('should reject edge referencing non-existent task', async () => {
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 9999, purpose: 'required for' });
      expect(res.status).toBe(400);
    });

    it('should reject edge referencing a task in another graph', async () => {
      const otherGid = (
        await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id")
      ).rows[0].id;
      const r = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [otherGid, taskRow('Outside')[0], taskRow('Outside')[1]]
      );
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: r.rows[0].id, purpose: 'required for' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/this graph/i);
    });

    it('should detect and reject cycles for dependency edges', async () => {
      await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 2, purpose: 'required for' });
      await request(app)
        .post(edgesUrl())
        .send({ source_id: 2, target_id: 3, purpose: 'required for' });
      const res = await request(app)
        .post(edgesUrl())
        .send({ source_id: 3, target_id: 1, purpose: 'required for' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cycle/i);
    });

    it('should allow cycles for related edges', async () => {
      const r1 = await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 2, purpose: 'related to' });
      const r2 = await request(app)
        .post(edgesUrl())
        .send({ source_id: 2, target_id: 3, purpose: 'related to' });
      const r3 = await request(app)
        .post(edgesUrl())
        .send({ source_id: 3, target_id: 1, purpose: 'related to' });
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      expect(r3.status).toBe(201);
    });
  });

  describe('POST /api/graphs/:gid/edges (concurrency)', () => {
    it('should not allow two concurrent inserts to create a cycle', async () => {
      // Pre-existing chain: A → B
      await pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
        [gid]
      );
      const [r1, r2] = await Promise.all([
        request(app)
          .post(edgesUrl())
          .send({ source_id: 2, target_id: 3, purpose: 'required for' }),
        request(app)
          .post(edgesUrl())
          .send({ source_id: 3, target_id: 2, purpose: 'required for' }),
      ]);
      const successes = [r1, r2].filter((r) => r.status === 201).length;
      expect(successes).toBeLessThanOrEqual(1);

      const cycle = await pool.query(`
        WITH RECURSIVE chain AS (
          SELECT source_id AS start, target_id AS node FROM edges WHERE type = 'dependency'
          UNION
          SELECT c.start, e.target_id FROM edges e
          JOIN chain c ON e.source_id = c.node
          WHERE e.type = 'dependency'
        )
        SELECT 1 FROM chain WHERE node = start LIMIT 1
      `);
      expect(cycle.rows).toHaveLength(0);
    });
  });

  describe('GET /api/graphs/:gid/edges', () => {
    it('should return empty array when no edges', async () => {
      const res = await request(app).get(edgesUrl());
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return only edges in this graph', async () => {
      await pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency'), ($1, 2, 3, 'related')",
        [gid]
      );
      const otherGid = (
        await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id")
      ).rows[0].id;
      // Insert tasks + edge in another graph
      const [c, m] = taskRow('X');
      const oA = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [otherGid, c, m]
      );
      const oB = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [otherGid, c, m]
      );
      await pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, $2, $3, 'dependency')",
        [otherGid, oA.rows[0].id, oB.rows[0].id]
      );
      const res = await request(app).get(edgesUrl());
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('PATCH /api/graphs/:gid/edges/:id', () => {
    it('should detect and reject cycles introduced by edge re-targeting', async () => {
      // Build chain A → B → C (edge ids 1 and 2)
      await request(app)
        .post(edgesUrl())
        .send({ source_id: 1, target_id: 2, purpose: 'required for' });
      await request(app)
        .post(edgesUrl())
        .send({ source_id: 2, target_id: 3, purpose: 'required for' });
      // Re-target edge 1 (A→B) to C→B. Resulting graph: C→B (id 1), B→C (id 2).
      // Path B→C→B is a cycle.
      const res = await request(app)
        .patch(`${edgesUrl()}/1`)
        .send({ source_id: 3, target_id: 2 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cycle/i);
    });

    it('should reject non-integer id with 400', async () => {
      const res = await request(app)
        .patch(`${edgesUrl()}/abc`)
        .send({ meta: { curve: 1 } });
      expect(res.status).toBe(400);
    });

    it('should update curve metadata without changing endpoints', async () => {
      await pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
        [gid]
      );
      const res = await request(app)
        .patch(`${edgesUrl()}/1`)
        .send({ meta: { curve: { distance: -65, weight: 0.7 } } });
      expect(res.status).toBe(200);
      expect(res.body.source_id).toBe(1);
      expect(res.body.target_id).toBe(2);
      expect(res.body.meta.curve).toEqual({ distance: -65, weight: 0.7 });
    });

    it('should update color metadata without changing endpoints', async () => {
      await pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
        [gid]
      );
      const res = await request(app)
        .patch(`${edgesUrl()}/1`)
        .send({ meta: { color: '#3D4525' } });
      expect(res.status).toBe(200);
      expect(res.body.source_id).toBe(1);
      expect(res.body.target_id).toBe(2);
      expect(res.body.meta.color).toBe('#3D4525');
    });

    it('should reject invalid curve metadata', async () => {
      await pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
        [gid]
      );
      const res = await request(app)
        .patch(`${edgesUrl()}/1`)
        .send({ meta: { curve: 9999 } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/curve/i);
    });

    it('should reject invalid color metadata', async () => {
      await pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
        [gid]
      );
      const res = await request(app)
        .patch(`${edgesUrl()}/1`)
        .send({ meta: { color: 'blue' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/color/i);
    });

    it('should return 410 Gone when patching an edge from another graph', async () => {
      const otherGid = (
        await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id")
      ).rows[0].id;
      const [c, m] = taskRow('Y');
      const oA = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [otherGid, c, m]
      );
      const oB = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [otherGid, c, m]
      );
      const oE = await pool.query(
        `INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, $2, $3, 'dependency') RETURNING id`,
        [otherGid, oA.rows[0].id, oB.rows[0].id]
      );
      const res = await request(app)
        .patch(`${edgesUrl()}/${oE.rows[0].id}`)
        .send({ meta: { curve: 5 } });
      expect(res.status).toBe(410);
    });
  });

  describe('DELETE /api/graphs/:gid/edges/:id', () => {
    it('should delete an edge', async () => {
      await pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
        [gid]
      );
      const del = await request(app).delete(`${edgesUrl()}/1`);
      expect(del.status).toBe(200);
      const res = await request(app).get(edgesUrl());
      expect(res.body).toHaveLength(0);
    });

    it('should return 404 for non-existent edge', async () => {
      const res = await request(app).delete(`${edgesUrl()}/9999`);
      expect(res.status).toBe(404);
    });

    it('should reject non-integer id with 400', async () => {
      const res = await request(app).delete(`${edgesUrl()}/abc`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/graphs/:gid/edges/bulk', () => {
    it('should insert all edges in a valid batch', async () => {
      const res = await request(app)
        .post(`${edgesUrl()}/bulk`)
        .send({
          edges: [
            { source_id: 1, target_id: 2, purpose: 'required for' },
            { source_id: 2, target_id: 3, purpose: 'required for' },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.edges).toHaveLength(2);
      const list = await request(app).get(edgesUrl());
      expect(list.body).toHaveLength(2);
    });

    it('should rollback the whole batch when one closes a cycle', async () => {
      // Pre-existing dep chain 1→2→3.
      await pool.query(
        `INSERT INTO edges (graph_id, source_id, target_id, type) VALUES
          ($1, 1, 2, 'dependency'), ($1, 2, 3, 'dependency')`,
        [gid]
      );
      const res = await request(app)
        .post(`${edgesUrl()}/bulk`)
        .send({
          edges: [
            { source_id: 3, target_id: 1, purpose: 'required for' },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cycle/i);
      expect(res.body.failedAt).toBe(0);
      const list = await request(app).get(edgesUrl());
      // Original 2 edges only, no rollback leak.
      expect(list.body).toHaveLength(2);
    });

    it('should detect a multi-edge cycle within the same batch', async () => {
      const res = await request(app)
        .post(`${edgesUrl()}/bulk`)
        .send({
          edges: [
            { source_id: 1, target_id: 2, purpose: 'required for' },
            { source_id: 2, target_id: 3, purpose: 'required for' },
            { source_id: 3, target_id: 1, purpose: 'required for' },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cycle/i);
      const list = await request(app).get(edgesUrl());
      expect(list.body).toHaveLength(0);
    });

    it('should rollback on duplicate within batch', async () => {
      const res = await request(app)
        .post(`${edgesUrl()}/bulk`)
        .send({
          edges: [
            { source_id: 1, target_id: 2, purpose: 'related to' },
            { source_id: 1, target_id: 2, purpose: 'related to' },
          ],
        });
      expect(res.status).toBe(409);
      expect(res.body.failedAt).toBe(1);
      const list = await request(app).get(edgesUrl());
      expect(list.body).toHaveLength(0);
    });

    it('should reject empty batch', async () => {
      const res = await request(app).post(`${edgesUrl()}/bulk`).send({ edges: [] });
      expect(res.status).toBe(400);
    });

    it('should reject batch with cross-graph endpoint', async () => {
      const otherGid = (
        await pool.query("INSERT INTO graphs (name) VALUES ('o') RETURNING id")
      ).rows[0].id;
      const [c, m] = taskRow('Outside');
      const o = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
        [otherGid, c, m]
      );
      const res = await request(app)
        .post(`${edgesUrl()}/bulk`)
        .send({
          edges: [
            { source_id: 1, target_id: o.rows[0].id, purpose: 'required for' },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/this graph/i);
    });
  });
});
