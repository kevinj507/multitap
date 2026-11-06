// E18.1 STEP 2 — the standing guards that keep capture complete.
//
// tests/e18-capture.test.js proves the 15 mutation sites that exist TODAY are
// captured. This file is about the ones that don't exist yet. Two ways the log
// silently rots, and one test each:
//
//  1. A new mutating route (or a revert of an existing one) uses the bare
//     `pool.query` instead of `eventQuery` / `withEventTx`. The row trigger
//     still fires — capture never has a hole — but the event is attributed to
//     'system' rather than to the writer, and `happened_at` / `reason` /
//     `request_id` are all lost. That is a silent downgrade, not a failure, so
//     nothing but a grep will ever notice it. This test IS that grep.
//
//  2. `ALTER TABLE tasks ADD COLUMN …`. The row loggers' `drop_cols` is a
//     DENYLIST: every column NOT named there flows into `payload.changes`.
//     Add a bookkeeping column and every write starts emitting a spurious
//     change entry; add a meaningful one and it silently never gets classified.
//     Either way the build should stop and someone should decide which side of
//     the line the new column is on. Pinning the column set is how it stops.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { getTestPool } from './setup.js';

const ROUTES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'routes',
);

// DML against the two logged tables. `client.query` inside a withEventTx block
// is fine and deliberately not matched — the context is already on that
// connection. It is `pool.query` specifically, the autocommit path with no
// actor, that must not carry these statements.
const DML_AGAINST_LOGGED_TABLES =
  /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:tasks|edges)\b/i;

// Pull out the full argument text of every `pool.query( … )` call by matching
// parentheses, so a SELECT that merely sits a few lines above an unrelated
// DELETE can never be mistaken for one.
function poolQueryCalls(source) {
  const out = [];
  const open = /(?<![\w.$])pool\s*\.\s*query\s*\(/g;
  let m;
  while ((m = open.exec(source)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push({
      text: source.slice(start, i - 1),
      line: source.slice(0, m.index).split('\n').length,
    });
  }
  return out;
}

describe('E18.1 discipline — no unattributed DML against tasks/edges', () => {
  it('detects a violation when there is one (the guard is not a no-op)', () => {
    // A positive control: if the matcher above ever stops matching, the real
    // test below would pass vacuously forever.
    const planted = `const r = await pool.query(\n  'DELETE FROM tasks WHERE id = $1',\n  [id]\n);`;
    const calls = poolQueryCalls(planted);
    expect(calls).toHaveLength(1);
    expect(DML_AGAINST_LOGGED_TABLES.test(calls[0].text)).toBe(true);
  });

  it('does not flag a plain read, or DML against another table', () => {
    const benign = [
      `pool.query('SELECT * FROM tasks WHERE graph_id = $1', [gid])`,
      `pool.query('UPDATE graphs SET version = version + 1 WHERE id = $1', [gid])`,
      `pool.query('DELETE FROM graph_members WHERE graph_id = $1', [gid])`,
    ].join('\n');
    for (const call of poolQueryCalls(benign)) {
      expect(DML_AGAINST_LOGGED_TABLES.test(call.text)).toBe(false);
    }
  });

  it('every src/routes/*.js write to tasks or edges goes through the event context', () => {
    const offenders = [];
    for (const file of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js'))) {
      const source = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
      for (const call of poolQueryCalls(source)) {
        if (DML_AGAINST_LOGGED_TABLES.test(call.text)) {
          offenders.push(`src/routes/${file}:${call.line}`);
        }
      }
    }
    expect(
      offenders,
      `Unattributed DML against tasks/edges. The row trigger still captures the\n`
        + `change, but the event's actor degrades to {"type":"system"} and\n`
        + `happened_at / reason / request_id are lost. Swap pool.query( for\n`
        + `eventQuery(req,  — or withTx( for withEventTx(req, . Offenders:\n  `
        + offenders.join('\n  '),
    ).toEqual([]);
  });

  it('the routes that mutate tasks/edges import the event context', () => {
    // The mirror of the grep above: the four files that write these tables must
    // actually be pulling the primitives in, so a merge that drops the import
    // fails here rather than at runtime.
    for (const file of ['tasks.js', 'edges.js', 'batch.js', 'graphs.js']) {
      const source = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
      expect(source, `${file} must import from ../events/context.js`).toMatch(
        /from '\.\.\/events\/context\.js'/,
      );
    }
  });
});

// `drop_cols` in gt_log_task / gt_log_edge (db/schema.sql) is a DENYLIST, so
// these lists are the other half of that decision and have to be read together.
// When this test fails, do not just paste the new column in: decide first
// whether it is a GRAPH FACT (leave it out of drop_cols — it belongs in the
// log) or BOOKKEEPING like version / updated_at / claim_* (add it to drop_cols
// in db/schema.sql, or every single write starts emitting a change entry for
// it). Then update the list here.
const TASKS_COLUMNS = [
  'claim_expires_at', 'claimed_by', 'claimed_by_name', 'content', 'created_at',
  'external_id', 'graph_id', 'id', 'last_modified_by', 'last_modified_by_user',
  'meta', 'run_id', 'updated_at', 'version',
];
const EDGES_COLUMNS = [
  'created_at', 'external_id', 'graph_id', 'id', 'last_modified_by',
  'last_modified_by_user', 'meta', 'purpose', 'run_id', 'source_id',
  'target_id', 'type', 'version',
];

// Columns the task logger deliberately suppresses. Kept here so the two halves
// of the denylist decision are visible side by side.
const TASKS_DROP_COLS = [
  'id', 'graph_id', 'created_at', 'updated_at', 'version', 'last_modified_by',
  'last_modified_by_user', 'claimed_by', 'claimed_by_name', 'claim_expires_at',
  'meta', 'content',
];
const EDGES_DROP_COLS = [
  'id', 'graph_id', 'created_at', 'version', 'last_modified_by',
  'last_modified_by_user', 'meta',
];

async function columnsOf(table) {
  const { rows } = await getTestPool().query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1
      ORDER BY column_name`,
    [table],
  );
  return rows.map((r) => r.column_name);
}

describe('E18.1 discipline — the logged column set is pinned', () => {
  it('tasks has exactly the columns the denylist was written against', async () => {
    expect(await columnsOf('tasks')).toEqual(TASKS_COLUMNS);
  });

  it('edges has exactly the columns the denylist was written against', async () => {
    expect(await columnsOf('edges')).toEqual(EDGES_COLUMNS);
  });

  it('every dropped column actually exists (the denylist has no dead entries)', async () => {
    // A typo in drop_cols is invisible: `to_jsonb(OLD) - 'verison'` is a no-op
    // and the real column quietly starts appearing in every diff.
    const tasks = await columnsOf('tasks');
    for (const c of TASKS_DROP_COLS) expect(tasks).toContain(c);
    const edges = await columnsOf('edges');
    for (const c of EDGES_DROP_COLS) expect(edges).toContain(c);
  });

  it('the drop_cols arrays in db/schema.sql still match the ones pinned here', () => {
    const schema = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'schema.sql'),
      'utf8',
    );
    const arrays = [...schema.matchAll(/drop_cols TEXT\[\] := ARRAY\[([\s\S]*?)\]/g)].map((m) =>
      [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    );
    expect(arrays).toHaveLength(2); // gt_log_task, then gt_log_edge
    expect(arrays[0]).toEqual(TASKS_DROP_COLS);
    expect(arrays[1]).toEqual(EDGES_DROP_COLS);
  });
});
