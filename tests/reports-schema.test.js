// E16.1 — reports table + notify trigger migration.
// Verifies the graph-scoped `reports` artifact: existence, idempotency,
// one-per-graph upsert, CHECK constraints, FK cascade + rotate-id, the
// load-bearing ZERO-IMPACT guarantee (report writes never touch the graph),
// and the kind:'report' NOTIFY payloads the reader will live-refresh on.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { getTestPool, TEST_URL } from './setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function taskContent(title) {
  return `---\ntitle: ${title}\nstatus: todo\n---\n`;
}

async function makeGraph(pool, name = 'test') {
  const r = await pool.query('INSERT INTO graphs (name) VALUES ($1) RETURNING id', [name]);
  return r.rows[0].id;
}

// Insert a report with sensible defaults; `over` overrides individual fields.
function insertReport(pool, gid, over = {}) {
  const r = { title: 'T', description: null, body: '', source_graph_version: null, run_id: null, meta: '{}', ...over };
  return pool.query(
    `INSERT INTO reports (graph_id, title, description, body, source_graph_version, run_id, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING *`,
    [gid, r.title, r.description, r.body, r.source_graph_version, r.run_id, r.meta],
  );
}

describe('E16.1 reports schema', () => {
  let pool;
  beforeAll(() => { pool = getTestPool(); });

  it('has a reports table, the notify_on_report_change trigger, and the expected columns', async () => {
    const tbl = await pool.query(`SELECT to_regclass('reports') IS NOT NULL AS exists`);
    expect(tbl.rows[0].exists).toBe(true);

    const trg = await pool.query(
      `SELECT 1 FROM pg_trigger WHERE tgname = 'notify_on_report_change' AND NOT tgisinternal`,
    );
    expect(trg.rows.length).toBe(1);

    const cols = (await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'reports' ORDER BY ordinal_position`,
    )).rows.map((r) => r.column_name);
    expect(cols).toEqual([
      'graph_id', 'title', 'description', 'body', 'source_graph_version',
      'run_id', 'meta', 'generated_at', 'updated_at',
    ]);
  });

  it('re-applying schema.sql is idempotent and leaves reports intact', async () => {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf-8');
    await expect(pool.query(schema)).resolves.toBeTruthy();
    const tbl = await pool.query(`SELECT to_regclass('reports') IS NOT NULL AS exists`);
    expect(tbl.rows[0].exists).toBe(true);
  });

  it('enforces one report per graph (PK) and supports ON CONFLICT upsert', async () => {
    const gid = await makeGraph(pool);
    await insertReport(pool, gid, { title: 'First', body: 'one' });
    // A second plain insert for the same graph must violate the PK.
    await expect(insertReport(pool, gid, { title: 'Dup', body: 'two' })).rejects.toThrow();
    // Upsert replaces the single row in place.
    await pool.query(
      `INSERT INTO reports (graph_id, title, body, meta) VALUES ($1, 'Second', 'three', '{}')
       ON CONFLICT (graph_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = NOW()`,
      [gid],
    );
    const rows = (await pool.query(`SELECT title, body FROM reports WHERE graph_id = $1`, [gid])).rows;
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('Second');
    expect(rows[0].body).toBe('three');
  });

  it('rejects empty/whitespace title, over-long title/description, and non-object meta', async () => {
    const gid = await makeGraph(pool);
    await expect(insertReport(pool, gid, { title: '' })).rejects.toThrow();
    await expect(insertReport(pool, gid, { title: '   ' })).rejects.toThrow();
    await expect(insertReport(pool, gid, { title: 'x'.repeat(201) })).rejects.toThrow();
    await expect(insertReport(pool, gid, { title: 'ok', description: 'd'.repeat(501) })).rejects.toThrow();
    await expect(insertReport(pool, gid, { title: 'ok', meta: '[]' })).rejects.toThrow();
    await expect(insertReport(pool, gid, { title: 'ok', meta: '"str"' })).rejects.toThrow();
    // A valid row still inserts (proves the rejections weren't blanket failures).
    await expect(insertReport(pool, gid, { title: 'ok', description: 'fine', meta: '{"k":1}' })).resolves.toBeTruthy();
  });

  it('cascades on graph delete and follows a rotate-id (ON UPDATE CASCADE)', async () => {
    const gid = await makeGraph(pool);
    await insertReport(pool, gid, { title: 'R' });

    // ON UPDATE CASCADE: rotating graphs.id carries the report's graph_id.
    const newId = 'rotatedgraphid9'; // matches ^[a-z0-9]{4,32}$
    await pool.query(`UPDATE graphs SET id = $1 WHERE id = $2`, [newId, gid]);
    const moved = (await pool.query(`SELECT graph_id FROM reports`)).rows;
    expect(moved.length).toBe(1);
    expect(moved[0].graph_id).toBe(newId);

    // ON DELETE CASCADE: deleting the graph removes its report (no orphans).
    await pool.query(`DELETE FROM graphs WHERE id = $1`, [newId]);
    const remaining = (await pool.query(`SELECT count(*)::int AS c FROM reports`)).rows[0].c;
    expect(remaining).toBe(0);
  });

  it('report writes do NOT bump graphs.updated_at/version or touch tasks/edges (zero-impact)', async () => {
    const gid = await makeGraph(pool);
    // Create tasks + an edge — these DO bump graphs.updated_at via bump_graph_updated_at().
    const t1 = (await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [gid, taskContent('A'), JSON.stringify({ title: 'A', status: 'todo' })],
    )).rows[0].id;
    const t2 = (await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [gid, taskContent('B'), JSON.stringify({ title: 'B', status: 'todo' })],
    )).rows[0].id;
    await pool.query(
      `INSERT INTO edges (graph_id, source_id, target_id, type, purpose)
       VALUES ($1, $2, $3, 'related', 'related to')`,
      [gid, t1, t2],
    );

    const before = (await pool.query(`SELECT updated_at, version FROM graphs WHERE id = $1`, [gid])).rows[0];
    const taskCountBefore = (await pool.query(`SELECT count(*)::int AS c FROM tasks WHERE graph_id = $1`, [gid])).rows[0].c;
    const edgeCountBefore = (await pool.query(`SELECT count(*)::int AS c FROM edges WHERE graph_id = $1`, [gid])).rows[0].c;

    // The load-bearing operations: a report INSERT and UPDATE.
    await insertReport(pool, gid, { title: 'R', body: 'hello' });
    await pool.query(`UPDATE reports SET body = 'updated', updated_at = NOW() WHERE graph_id = $1`, [gid]);

    const after = (await pool.query(`SELECT updated_at, version FROM graphs WHERE id = $1`, [gid])).rows[0];
    const taskCountAfter = (await pool.query(`SELECT count(*)::int AS c FROM tasks WHERE graph_id = $1`, [gid])).rows[0].c;
    const edgeCountAfter = (await pool.query(`SELECT count(*)::int AS c FROM edges WHERE graph_id = $1`, [gid])).rows[0].c;

    expect(after.updated_at.getTime()).toBe(before.updated_at.getTime()); // sidebar order unchanged
    expect(after.version).toBe(before.version); // graph OCC undisturbed
    expect(taskCountAfter).toBe(taskCountBefore);
    expect(edgeCountAfter).toBe(edgeCountBefore);
  });

  it('emits kind:report NOTIFY payloads on insert/update/delete', async () => {
    const gid = await makeGraph(pool);
    const client = new pg.Client({ connectionString: TEST_URL });
    await client.connect();
    const got = [];
    client.on('notification', (msg) => {
      try {
        const p = JSON.parse(msg.payload);
        if (p.kind === 'report') got.push(p);
      } catch { /* ignore non-JSON */ }
    });
    await client.query('LISTEN graph_change');

    await insertReport(pool, gid, { title: 'N' });
    await pool.query(`UPDATE reports SET body = 'x' WHERE graph_id = $1`, [gid]);
    await pool.query(`DELETE FROM reports WHERE graph_id = $1`, [gid]);

    const deadline = Date.now() + 3000;
    while (got.length < 3 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    await client.end();

    expect(got.map((p) => p.op)).toEqual(['INSERT', 'UPDATE', 'DELETE']);
    for (const p of got) {
      expect(p.graph_id).toBe(gid);
      expect(p.id).toBe(gid); // a report's identity IS its graph
      expect(p.kind).toBe('report');
    }
  });
});
