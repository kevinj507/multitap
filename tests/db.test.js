import { getTestPool } from './setup.js';

function taskContent(title) {
  return `---\ntitle: ${title}\nstatus: todo\n---\n`;
}

function taskMeta(title, extra = {}) {
  return JSON.stringify({ title, status: 'todo', ...extra });
}

async function makeGraph(pool, name = 'test') {
  const r = await pool.query(
    'INSERT INTO graphs (name) VALUES ($1) RETURNING id',
    [name]
  );
  return r.rows[0].id;
}

describe('Database schema', () => {
  let pool;

  beforeAll(() => {
    pool = getTestPool();
  });

  it('should connect to the test database', async () => {
    const result = await pool.query('SELECT 1 AS result');
    expect(result.rows[0].result).toBe(1);
  });

  it('should have graphs table with correct columns', async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'graphs' ORDER BY ordinal_position`
    );
    const columns = result.rows.map((r) => r.column_name);
    expect(columns).toEqual([
      'id', 'name', 'description', 'settings', 'created_at', 'updated_at',
      'version', 'last_modified_by', 'owner_user_id', 'anon_role',
    ]);
  });

  it('should have tasks table with graph_id', async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'tasks' ORDER BY ordinal_position`
    );
    const columns = result.rows.map((r) => r.column_name);
    expect(columns).toEqual([
      'id', 'graph_id', 'content', 'meta', 'created_at', 'updated_at',
      'version', 'last_modified_by', 'last_modified_by_user',
      'external_id', 'run_id',
      'claimed_by', 'claimed_by_name', 'claim_expires_at',
    ]);
  });

  it('should have edges table with graph_id', async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'edges' ORDER BY ordinal_position`
    );
    const columns = result.rows.map((r) => r.column_name);
    expect(columns).toEqual([
      'id', 'graph_id', 'source_id', 'target_id', 'type', 'meta', 'created_at',
      'version', 'last_modified_by', 'last_modified_by_user',
      'external_id', 'run_id', 'purpose',
    ]);
  });

  it('should enforce unique constraint on edges(source_id, target_id)', async () => {
    const gid = await makeGraph(pool);
    await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3), ($1, $4, $5)`,
      [gid, taskContent('A'), taskMeta('A'), taskContent('B'), taskMeta('B')]
    );
    await pool.query(
      "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
      [gid]
    );
    await expect(
      pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
        [gid]
      )
    ).rejects.toThrow(/unique/i);
  });

  it('should reject self-referencing edges', async () => {
    const gid = await makeGraph(pool);
    await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3)`,
      [gid, taskContent('A'), taskMeta('A')]
    );
    await expect(
      pool.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 1, 'dependency')",
        [gid]
      )
    ).rejects.toThrow(/check/i);
  });

  it('should cascade delete edges when a task is deleted', async () => {
    const gid = await makeGraph(pool);
    await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3), ($1, $4, $5)`,
      [gid, taskContent('A'), taskMeta('A'), taskContent('B'), taskMeta('B')]
    );
    await pool.query(
      "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
      [gid]
    );
    await pool.query('DELETE FROM tasks WHERE id = 1');
    const result = await pool.query('SELECT * FROM edges');
    expect(result.rows).toHaveLength(0);
  });

  it('should cascade delete tasks and edges when a graph is deleted', async () => {
    const gid = await makeGraph(pool);
    await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3), ($1, $4, $5)`,
      [gid, taskContent('A'), taskMeta('A'), taskContent('B'), taskMeta('B')]
    );
    await pool.query(
      "INSERT INTO edges (graph_id, source_id, target_id, type) VALUES ($1, 1, 2, 'dependency')",
      [gid]
    );
    await pool.query('DELETE FROM graphs WHERE id = $1', [gid]);
    const t = await pool.query('SELECT * FROM tasks');
    const e = await pool.query('SELECT * FROM edges');
    expect(t.rows).toHaveLength(0);
    expect(e.rows).toHaveLength(0);
  });

  it('should bump graphs.updated_at on task change', async () => {
    const gid = await makeGraph(pool);
    // Force created_at and updated_at into the past so we can detect a real bump.
    await pool.query(
      `UPDATE graphs SET created_at = NOW() - interval '1 hour',
                         updated_at = NOW() - interval '1 hour' WHERE id = $1`,
      [gid]
    );
    const before = await pool.query('SELECT updated_at FROM graphs WHERE id = $1', [gid]);

    await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3)`,
      [gid, taskContent('A'), taskMeta('A')]
    );

    const after = await pool.query('SELECT updated_at FROM graphs WHERE id = $1', [gid]);
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThan(
      new Date(before.rows[0].updated_at).getTime()
    );
  });
});
