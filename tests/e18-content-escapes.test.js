// E18.1 REGRESSION — node bodies that contain backslashes.
//
// The event log digests every body it records. The first implementation did
// that with `COALESCE(content,'')::bytea`, and a text -> bytea CAST parses its
// input as bytea ESCAPE text: `\d`, `C:\Users`, `\alpha` are all invalid escape
// sequences, so the cast raises 22P02 (invalid input syntax for type bytea).
// Inside gt_content_change that error propagated out of the row trigger and
// FAILED THE WRITE — every edit to such a node would have 500'd — and inside
// the genesis backfill it aborted the graph entirely.
//
// This went undetected by the whole suite because no fixture body had ever
// contained a backslash. It was caught by running the backfill against a copy
// of the production database, where it broke 118 nodes across 10 of 65 graphs,
// this project's own build graph among them.
//
// The fix is convert_to(text, 'UTF8'), which is the encoding conversion that
// was always meant: it cannot fail, it agrees byte-for-byte with the cast on
// every input the cast accepts, and it matches what Node's
// createHash('sha256').update(text) hashes on the JS side.
import { getTestPool } from './setup.js';

// Bodies that the old cast choked on. Each is a real shape from the production
// corpus rather than a synthetic escape.
const NASTY = {
  'a regex': String.raw`match \d+ digits and \s whitespace`,
  'a windows path': String.raw`open C:\Users\kevin\notes.md`,
  'LaTeX': String.raw`the bound \alpha \leq \beta holds`,
  'a lone trailing backslash': 'line ends with a backslash \\',
  'an escaped backslash': String.raw`literal \\ pair`,
  'a bytea-shaped escape': String.raw`looks like \x41 but is text`,
  'a NUL-shaped escape': String.raw`looks like \000 but is text`,
  'markdown line breaks': 'first\\\nsecond',
};

let pool;
let sha256;

beforeAll(async () => {
  pool = getTestPool();
  ({ createHash: sha256 } = await import('node:crypto'));
});

const jsSha = (text) => sha256('sha256').update(text, 'utf8').digest('hex');

async function makeGraph() {
  return (await pool.query(`INSERT INTO graphs (name) VALUES ('escapes') RETURNING id`)).rows[0].id;
}
const body = (extra) => `---\ntitle: t\nstatus: todo\n---\n${extra}`;

describe('E18.1 — bodies containing backslashes', () => {
  for (const [label, payload] of Object.entries(NASTY)) {
    it(`gt_content_change digests ${label} without raising`, async () => {
      const r = await pool.query(`SELECT gt_content_change($1, $2) AS c`, [body(payload), body(payload + ' edited')]);
      expect(r.rows[0].c.to_sha).toMatch(/^[0-9a-f]{64}$/);
      expect(r.rows[0].c.from_sha).toMatch(/^[0-9a-f]{64}$/);
    });

    it(`a node holding ${label} can be created, edited and deleted`, async () => {
      const gid = await makeGraph();
      const ins = await pool.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, '{"title":"t","status":"todo"}'::jsonb) RETURNING id`,
        [gid, body(payload)],
      );
      const id = ins.rows[0].id;
      // The edit is the case that used to fail: BOTH the old and the new body
      // pass through the digest, so either side containing a backslash raised.
      await expect(
        pool.query(`UPDATE tasks SET content = $2 WHERE id = $1`, [id, body(payload + '\nmore ' + payload)]),
      ).resolves.toBeDefined();
      await expect(pool.query(`DELETE FROM tasks WHERE id = $1`, [id])).resolves.toBeDefined();

      const kinds = (await pool.query(
        `SELECT kind FROM events WHERE graph_id = $1 ORDER BY seq`, [gid],
      )).rows.map((r) => r.kind);
      expect(kinds).toEqual(['node.created', 'node.patched', 'node.removed']);
    });

    it(`the SQL digest of ${label} equals the JS digest`, async () => {
      // Load-bearing: src/events/fold.js hashes bodies in JS and the genesis
      // backfill hashes them in SQL. A genesis node and the same node after its
      // first edit are only comparable if the two agree.
      const text = body(payload);
      const r = await pool.query(`SELECT encode(sha256(convert_to($1, 'UTF8')), 'hex') AS sha`, [text]);
      expect(r.rows[0].sha).toBe(jsSha(text));
    });
  }

  it('the old ::bytea cast really does raise on these bodies — the bug is real', async () => {
    // Pins WHY the code reads convert_to(). If a future edit reverts to the
    // cast, the tests above go red; this one explains what they mean.
    await expect(
      pool.query(`SELECT sha256($1::text::bytea)`, [String.raw`match \d+ digits`]),
    ).rejects.toMatchObject({ code: '22P02' });
  });

  it('multibyte UTF-8 hashes identically in SQL and JS', async () => {
    const text = body('héllo — naïve café 日本語 🌱');
    const r = await pool.query(`SELECT encode(sha256(convert_to($1, 'UTF8')), 'hex') AS sha`, [text]);
    expect(r.rows[0].sha).toBe(jsSha(text));
  });

  it('the genesis backfill covers a graph whose bodies contain backslashes', async () => {
    const { backfillGenesisAll } = await import('../src/events/snapshot.js');
    const gid = await makeGraph();
    // A PRE-LOG graph, which is the only shape the seq-0 backfill is for: rows
    // in `tasks`, no events (gt.capture='off', the documented hatch), and no
    // seq-0 row from the gt_seed_genesis trigger. With events present the
    // backfill correctly refuses to stamp the live cut at seq 0 and lands a
    // late genesis at the head instead (tests/e18-genesis.test.js).
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('gt.capture', 'off', true)");
      await client.query(
        `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, '{"title":"t","status":"todo"}'::jsonb)`,
        [gid, body(String.raw`C:\Users\kevin and \d+`)],
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    await pool.query(`DELETE FROM graph_snapshots WHERE graph_id = $1`, [gid]);

    const res = await backfillGenesisAll(pool, { log: () => {} });
    expect(res.failed).toBe(0);
    expect(res.errors).toEqual([]);

    const g = await pool.query(
      `SELECT state FROM graph_snapshots WHERE graph_id = $1 AND kind = 'genesis' AND seq = 0`, [gid],
    );
    expect(g.rows).toHaveLength(1);
    expect(g.rows[0].state.nodes[0].content_sha).toMatch(/^[0-9a-f]{64}$/);
  });
});
