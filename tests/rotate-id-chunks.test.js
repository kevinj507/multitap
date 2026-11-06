// Renaming a graph's id (POST /api/graphs/:id/rotate-id) on a graph that has
// been indexed for semantic search. task_chunks.graph_id must follow the
// rename as tasks.graph_id and edges.graph_id do; before the fix the
// constraint had no ON UPDATE CASCADE and the rename failed with a 500.
// Skipped where pgvector is absent (no task_chunks table).
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let applySchema;
let hasChunks = false;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  app = (await import('../src/app.js')).default;
  ({ applySchema } = await import('../src/db.js'));
  pool = getTestPool();
  hasChunks = (await pool.query("SELECT to_regclass('task_chunks') AS t")).rows[0].t !== null;
});

async function indexedGraph() {
  const g = await request(app).post('/api/graphs').send({ name: 'indexed' });
  const t = await request(app)
    .post(`/api/graphs/${g.body.id}/tasks`)
    .send({ content: '---\ntitle: a\nstatus: todo\n---\nbody' });
  await pool.query(
    `INSERT INTO task_chunks (task_id, graph_id, chunk_index, chunk_text, content_sha, embedding_model)
     VALUES ($1, $2, 0, 'a body', 'sha', 'test-model')`,
    [t.body.id, g.body.id],
  );
  return { gid: g.body.id, taskId: t.body.id };
}

const updateRule = async () =>
  (await pool.query(
    `SELECT confupdtype FROM pg_constraint
      WHERE conrelid = 'task_chunks'::regclass AND conname = 'task_chunks_graph_id_fkey'`,
  )).rows[0]?.confupdtype;

describe('rotate-id on a graph with search chunks', () => {
  it('renames the graph and carries its chunks to the new id', async () => {
    if (!hasChunks) return;
    const { gid, taskId } = await indexedGraph();
    const rot = await request(app).post(`/api/graphs/${gid}/rotate-id`);
    expect(rot.status).toBe(200);
    const { rows } = await pool.query('SELECT graph_id FROM task_chunks WHERE task_id = $1', [taskId]);
    expect(rows).toEqual([{ graph_id: rot.body.id }]);
  });

  it('a database created before the fix is corrected when the schema is applied', async () => {
    if (!hasChunks) return;
    // The constraint as the first version of the table declared it.
    await pool.query('ALTER TABLE task_chunks DROP CONSTRAINT task_chunks_graph_id_fkey');
    await pool.query(
      `ALTER TABLE task_chunks ADD CONSTRAINT task_chunks_graph_id_fkey
         FOREIGN KEY (graph_id) REFERENCES graphs(id) ON DELETE CASCADE`,
    );
    expect(await updateRule()).toBe('a');
    const { gid } = await indexedGraph();
    expect((await request(app).post(`/api/graphs/${gid}/rotate-id`)).status).toBe(500);

    await applySchema(pool);
    expect(await updateRule()).toBe('c');
    expect((await request(app).post(`/api/graphs/${gid}/rotate-id`)).status).toBe(200);
  });

  it('deleting a graph still removes its chunks', async () => {
    if (!hasChunks) return;
    const { gid, taskId } = await indexedGraph();
    expect((await request(app).delete(`/api/graphs/${gid}`)).status).toBeLessThan(300);
    const { rows } = await pool.query('SELECT 1 FROM task_chunks WHERE task_id = $1', [taskId]);
    expect(rows).toHaveLength(0);
  });
});
