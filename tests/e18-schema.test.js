// E18.1 — the event log's schema-level guarantees.
//
// This file pins the properties that make the log trustworthy at all, and that
// nothing above the database can restore once they are broken:
//
//   * the schema is re-runnable through the REAL applySchema() path (the whole
//     file as ONE multi-statement pool.query — the shape src/db.js:15-20 uses
//     on every boot and tests/setup.js uses on every run);
//   * `learned_at` is a SERVER fact — a writer can backdate `happened_at`
//     (world time) but can never falsify when we LEARNED something;
//   * the log is append-only — UPDATE and DELETE both raise 0A000;
//   * `seq` is gapless and commit-ordered, which is the single property that
//     makes `?since=` polling safe and "cache derived views keyed by event seq"
//     sound rather than approximately sound;
//   * `gt_ctx()` is the only GUC reader, because a raw
//     current_setting(k,true)::timestamptz raises 22007 on the SECOND request
//     of a pooled connection (Postgres leaves a committed SET LOCAL as '',
//     not unset);
//   * capture FAILS OPEN: a write that arrives with no context still produces a
//     complete event stamped actor.type='system'. A missing actor is an
//     incomplete record; a missing event is a corrupted fold.
//
// It deliberately writes rows with raw SQL rather than through the routes —
// route-level capture is STEP 2's subject. That raw SQL is itself the point:
// under trigger capture, even a writer that never touched the HTTP layer is
// recorded.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { EVENT_KINDS } from '../src/events/kinds.js';

let pool;
let applySchema;
let gid;

// The genesis substrate, byte-for-byte. `gt_seed_genesis` writes this literal
// for every new graph; STEP 3's canonicalJson(emptyState()) MUST produce this
// exact string, and STEP 7's backfill MUST agree with it, or a snapshot chain
// verified in JS will not match one written by the database.
const GENESIS_STATE_JSON = '{"v":1,"nodes":[],"edges":[]}';
const GENESIS_STATE_SHA = '2c8358757dc8a60ccf34027708d7835d2761f65d68cdc40a5abf360a2aac9274';

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  const db = await import('../src/db.js');
  applySchema = db.applySchema;
  pool = getTestPool();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18') RETURNING id");
  gid = g.rows[0].id;
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

async function insTask(meta = { title: 'A', status: 'todo' }, client = pool) {
  const m = { status: 'todo', ...meta };
  const { rows } = await client.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
    [gid, node(m), JSON.stringify(m)],
  );
  return rows[0].id;
}

// A raw event row. Everything the BEFORE-INSERT stamp trigger owns
// (learned_at, txid, the backdated flag) is deliberately supplied WRONG here so
// the tests can prove the trigger overrides it.
function rawEvent(client, seq, { happenedAt = 'NOW()', learnedAt = "'1999-01-01T00:00:00Z'" } = {}) {
  return client.query(
    `INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                         subject_kind, subject_id, txid, payload)
     VALUES ($1, $2, ${happenedAt}, ${learnedAt}, '{"type":"system"}'::jsonb,
             'node.patched', 'node', 1, 0, '{}'::jsonb)
     RETURNING *`,
    [gid, seq],
  );
}

const eventsOf = async (graphId = gid) =>
  (
    await pool.query(
      'SELECT seq, kind, actor, subject_kind, subject_id, cause_id, payload, learned_at, happened_at, txid'
        + ' FROM events WHERE graph_id = $1 ORDER BY seq',
      [graphId],
    )
  ).rows;

describe('E18.1 schema — apply path', () => {
  it('applies cleanly twice through applySchema() (one multi-statement query)', async () => {
    // Not `psql -f`: the boot path is a single targetPool.query(wholeFile), i.e.
    // one implicit transaction, and that is the shape that can fail (55P04 on a
    // same-transaction enum use, a CHECK declared only inside CREATE TABLE IF
    // NOT EXISTS, ...) while a statement-at-a-time apply succeeds.
    await expect(applySchema(pool)).resolves.toBeUndefined();
    await expect(applySchema(pool)).resolves.toBeUndefined();

    const objects = await pool.query(
      `SELECT to_regclass('events') AS ev,
              to_regclass('graph_snapshots') AS snap,
              to_regproc('gt_next_seq') AS nextseq,
              to_regproc('gt_ctx') AS ctx`,
    );
    expect(objects.rows[0]).toEqual({
      ev: 'events',
      snap: 'graph_snapshots',
      nextseq: 'gt_next_seq',
      ctx: 'gt_ctx',
    });
  });

  it('carries no foreign key from events/graph_snapshots to graphs', async () => {
    // Deliberate: an ON DELETE CASCADE FK wipes the history at the exact moment
    // it becomes the only record of the graph. The price is paid in
    // tests/setup.js, which must TRUNCATE both tables by name.
    const { rows } = await pool.query(
      `SELECT conrelid::regclass::text AS tbl
         FROM pg_constraint
        WHERE contype = 'f' AND conrelid IN ('events'::regclass, 'graph_snapshots'::regclass)`,
    );
    expect(rows).toEqual([]);
  });

  it('keeps EVENT_KINDS in lockstep with the events_kind_valid CHECK', async () => {
    // The JS vocabulary and the database's are two copies of one list. This is
    // the cheapest possible guard against E18.2/E18.4 updating only one.
    const { rows } = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = 'events_kind_valid'`,
    );
    expect(rows).toHaveLength(1);
    const inCheck = [...rows[0].def.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]);
    expect(inCheck.slice().sort()).toEqual(EVENT_KINDS.slice().sort());
  });
});

describe('E18.1 schema — the two clocks', () => {
  it('forces learned_at to server time over a direct INSERT of 1999-01-01', async () => {
    const before = Date.now();
    const { rows } = await rawEvent(pool, 1, { learnedAt: "'1999-01-01T00:00:00Z'" });
    const learned = new Date(rows[0].learned_at).getTime();
    expect(learned).toBeGreaterThanOrEqual(before - 1000);
    expect(learned).toBeLessThanOrEqual(Date.now() + 1000);
    // txid is a server fact too — the 0 we supplied is overwritten.
    expect(Number(rows[0].txid)).toBeGreaterThan(0);
  });

  it('honours a backdated happened_at and flags it so it cannot be disguised', async () => {
    const { rows } = await rawEvent(pool, 1, {
      happenedAt: "'1999-01-01T00:00:00Z'",
      learnedAt: "'1999-01-01T00:00:00Z'",
    });
    expect(new Date(rows[0].happened_at).getUTCFullYear()).toBe(1999);
    expect(new Date(rows[0].learned_at).getUTCFullYear()).toBeGreaterThan(2000);
    expect(rows[0].payload.backdated).toBe(true);
  });
});

describe('E18.1 schema — append-only', () => {
  it('raises 0A000 on a direct UPDATE of an event', async () => {
    await rawEvent(pool, 1);
    await expect(
      pool.query(`UPDATE events SET kind = 'node.created' WHERE graph_id = $1 AND seq = 1`, [gid]),
    ).rejects.toMatchObject({ code: '0A000' });
  });

  it('raises 0A000 on a direct DELETE of an event', async () => {
    await rawEvent(pool, 1);
    await expect(
      pool.query('DELETE FROM events WHERE graph_id = $1 AND seq = 1', [gid]),
    ).rejects.toMatchObject({ code: '0A000' });
    expect(await eventsOf()).toHaveLength(1);
  });

  it('survives the deletion of its own graph', async () => {
    await insTask({ title: 'doomed' });
    await pool.query('DELETE FROM graphs WHERE id = $1', [gid]);
    const kinds = (await eventsOf()).map((r) => r.kind);
    // The whole log outlives the graph, and the tombstone lands BEFORE the
    // per-row events the cascade produces.
    expect(kinds).toEqual(['node.created', 'graph.deleted', 'node.removed']);
  });
});

describe('E18.1 schema — gt_next_seq', () => {
  it('is gapless across a rolled-back transaction', async () => {
    // A rolled-back txn must leave NO hole: the visible prefix being gapless is
    // what lets `?since=<seq>` polling be safe without a settled-horizon hack.
    const alloc = async (client) =>
      Number((await client.query('SELECT gt_next_seq($1) AS s', [gid])).rows[0].s);

    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      expect(await alloc(c)).toBe(1);
      await rawEvent(c, 1);
      await c.query('COMMIT');

      await c.query('BEGIN');
      expect(await alloc(c)).toBe(2);
      await rawEvent(c, 2);
      await c.query('ROLLBACK');

      await c.query('BEGIN');
      expect(await alloc(c)).toBe(2); // reused, not skipped
      await rawEvent(c, 2);
      await c.query('COMMIT');

      await c.query('BEGIN');
      expect(await alloc(c)).toBe(3);
      await rawEvent(c, 3);
      await c.query('COMMIT');
    } finally {
      c.release();
    }

    expect((await eventsOf()).map((r) => Number(r.seq))).toEqual([1, 2, 3]);
  });

  it('serialises two concurrent appenders into 1 then 2, learned_at monotone', async () => {
    // The allocation takes `SELECT 1 FROM graphs WHERE id = gid FOR UPDATE` and
    // holds it to commit, so allocation order IS commit order. That lock is not
    // a new cost: bump_graph_updated_at() already takes it on every task/edge
    // row write, so every writer of this graph already held it.
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      await c1.query('BEGIN');
      await c2.query('BEGIN');

      const s1 = Number((await c1.query('SELECT gt_next_seq($1) AS s', [gid])).rows[0].s);
      expect(s1).toBe(1);
      await rawEvent(c1, s1);

      let settled = false;
      const pending = c2.query('SELECT gt_next_seq($1) AS s', [gid]);
      pending.then(
        () => { settled = true; },
        () => { settled = true; },
      );
      await new Promise((r) => setTimeout(r, 200));
      expect(settled).toBe(false); // blocked on c1's graphs-row lock

      await c1.query('COMMIT');
      const s2 = Number((await pending).rows[0].s);
      expect(s2).toBe(2);
      await rawEvent(c2, s2);
      await c2.query('COMMIT');
    } finally {
      c1.release();
      c2.release();
    }

    const rows = await eventsOf();
    expect(rows.map((r) => Number(r.seq))).toEqual([1, 2]);
    expect(new Date(rows[1].learned_at).getTime()).toBeGreaterThanOrEqual(
      new Date(rows[0].learned_at).getTime(),
    );
  });
});

describe('E18.1 schema — gt_ctx and the pooled-connection trap', () => {
  it('returns null, not the empty string, after a committed SET LOCAL', async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('gt.happened_at', $1, true)`, [
        '2020-05-05T00:00:00.000Z',
      ]);
      await c.query('COMMIT');

      // The trap, reproduced: Postgres leaves the setting as '' for the rest of
      // this pooled session, NOT unset.
      const raw = await c.query(`SELECT current_setting('gt.happened_at', true) AS v`);
      expect(raw.rows[0].v).toBe('');

      // gt_ctx() NULLIFs it, which is the whole reason it is the only accessor.
      const ctx = await c.query(`SELECT gt_ctx('gt.happened_at') AS v`);
      expect(ctx.rows[0].v).toBeNull();

      // And the second "request" on this same connection does not raise 22007 —
      // a raw current_setting(...)::timestamptz would.
      const h = await c.query('SELECT gt_happened_at() AS h');
      expect(h.rows[0].h).toBeInstanceOf(Date);

      await expect(
        c.query(`SELECT current_setting('gt.happened_at', true)::timestamptz`),
      ).rejects.toMatchObject({ code: '22007' });
    } finally {
      c.release();
    }
  });
});

describe('E18.1 schema — capture', () => {
  it('records a bare pool.query write as actor.type=system (fails open)', async () => {
    await insTask({ title: 'anonymous' });
    const rows = await eventsOf();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('node.created');
    expect(rows[0].actor).toEqual({ type: 'system' });
    expect(rows[0].subject_kind).toBe('node');
  });

  it('keeps "from": null in changes — the payload is never jsonb_strip_nulls-ed', async () => {
    // E18.4 needs "this field was previously UNSET" to survive. jsonb_strip_nulls
    // recurses and would erase it.
    const id = await insTask({ title: 'A' });
    await pool.query(
      `UPDATE tasks SET meta = meta || '{"confidence":0.9}'::jsonb, version = version + 1 WHERE id = $1`,
      [id],
    );
    const rows = await eventsOf();
    const patch = rows.at(-1);
    expect(patch.payload.changes['meta.confidence']).toEqual({ from: null, to: 0.9 });
    expect('from' in patch.payload.changes['meta.confidence']).toBe(true);
  });

  it("suppresses under gt.capture='off' and re-enables on the next statement", async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('gt.capture', 'off', true)");
      await insTask({ title: 'invisible' }, c);
      await c.query('COMMIT');
      expect(await eventsOf()).toHaveLength(0);

      // Same connection, next statement: capture is back on by itself, because
      // the setting was transaction-local.
      await insTask({ title: 'visible' }, c);
      expect(await eventsOf()).toHaveLength(1);
    } finally {
      c.release();
    }
  });

  it("ignores a bare set_config('gt.capture','off',true) — it dies with its own statement", async () => {
    await pool.query("SELECT set_config('gt.capture', 'off', true)");
    await insTask({ title: 'still recorded' });
    expect(await eventsOf()).toHaveLength(1);
  });
});

describe('E18.1 schema — genesis', () => {
  it('seeds a seq-0 genesis snapshot for every new graph', async () => {
    const { rows } = await pool.query(
      'SELECT * FROM graph_snapshots WHERE graph_id = $1',
      [gid],
    );
    expect(rows).toHaveLength(1);
    const g = rows[0];
    expect(Number(g.seq)).toBe(0);
    expect(g.kind).toBe('genesis');
    expect(g.axis).toBe('learned');
    expect(g.node_count).toBe(0);
    expect(g.edge_count).toBe(0);
    expect(g.state).toEqual({ v: 1, nodes: [], edges: [] });
    expect(g.state_sha).toBe(GENESIS_STATE_SHA);
  });

  it('pins the genesis literal byte-for-byte (STEP 3 canonicalJson must match)', async () => {
    const { rows } = await pool.query(
      `SELECT encode(sha256($1::bytea), 'hex') AS sha`,
      [GENESIS_STATE_JSON],
    );
    expect(rows[0].sha).toBe(GENESIS_STATE_SHA);
  });

  it('refuses a genesis snapshot anywhere but seq 0', async () => {
    await expect(
      pool.query(
        `INSERT INTO graph_snapshots (graph_id, seq, kind, state, state_sha)
         VALUES ($1, 4, 'genesis', '{}'::jsonb, 'x')`,
        [gid],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
