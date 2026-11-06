// E18.5 — /ready and the dormant set.
//
// A DORMANT ALTERNATIVE MUST NOT LEAK INTO THE WORK QUEUE AS LIVE WORK, and
// NOTHING MAY AUTO-FLIP A STATUS. Those two pull in opposite directions and the
// resolution is exact:
//
//   * the exclusion filters RESULT ROWS ONLY. It must NEVER move into the
//     recursive `prereqs` CTE — dropping a dormant PREREQUISITE from that walk
//     would treat it as SATISFIED and silently auto-unblock its dependents.
//     `a dormant prerequisite still blocks` below is that regression.
//   * it is DEFAULT-ON with `?includeDormant=1` as the way back, so the change
//     is auditable rather than silent.
//   * no row is written, no status is changed, and reopening the decision moves
//     the DERIVATION back — not a flag.
//
// The CASE 3 regression at the bottom is the measured one: the dormant subtree
// already falls out for free while the alternative is un-done, so the exclusion
// looks unnecessary until a human marks the alternative `done` — a plausible way
// to say "we are not doing this" — at which point the ENTIRE branch leaks into
// the queue.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { BRANCH_PURPOSE, committedDecisionIds, dormantIds } from '../src/branches.js';

let app;
let pool;
let gid;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-ready-dormant') RETURNING id");
  gid = g.rows[0].id;
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

async function mkNode(title, extra = {}) {
  const res = await request(app).post(`/api/graphs/${gid}/tasks`)
    .send({ content: node({ title, status: 'todo', ...extra }) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

async function mkEdge(source, target, purpose, meta = undefined) {
  const res = await request(app).post(`/api/graphs/${gid}/edges`)
    .send({ source_id: source, target_id: target, purpose, ...(meta ? { meta } : {}) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

async function setStatus(id, title, status, extra = {}) {
  const res = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
    .send({ content: node({ title, status, ...extra }) });
  expect(res.status).toBe(200);
}

const ready = async (query = '') => {
  const res = await request(app).get(`/api/graphs/${gid}/tasks/ready${query}`);
  expect(res.status).toBe(200);
  return res.body.map((t) => Number(t.id));
};

// D (decision, committed) --related to--> A (chosen) / B (alternative)
// substrate (done) --required for--> A, B
// A --required for--> workA ;  B --required for--> workB --required for--> deepB
// free: an unrelated live task
async function fixture() {
  const d = await mkNode('storage engine', { type: 'decision' });
  const a = await mkNode('Timescale');
  const b = await mkNode('ClickHouse');
  const substrate = await mkNode('ingest requirement', { status: 'done' });
  const workA = await mkNode('hypertable migration');
  const workB = await mkNode('clickhouse spike');
  const deepB = await mkNode('clickhouse ops runbook');
  const free = await mkNode('unrelated live task');
  await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'chosen' } });
  await mkEdge(d, b, BRANCH_PURPOSE, { branch: { role: 'alternative' } });
  await mkEdge(substrate, a, 'required for');
  await mkEdge(substrate, b, 'required for');
  await mkEdge(a, workA, 'required for');
  await mkEdge(b, workB, 'required for');
  await mkEdge(workB, deepB, 'required for');
  await setStatus(d, 'storage engine', 'todo', {
    type: 'decision', decided_at: '2026-03-01T00:00:00.000Z',
  });
  return { d, a, b, substrate, workA, workB, deepB, free };
}

describe('E18.5 /ready excludes the dormant branch', () => {
  it('drops the un-chosen option node itself — the leak the subtree rule misses', async () => {
    const f = await fixture();
    const ids = await ready();
    expect(ids).toContain(f.a);
    expect(ids).toContain(f.free);
    expect(ids).not.toContain(f.b);
    expect(ids).not.toContain(f.workB);
    expect(ids).not.toContain(f.deepB);
  });

  it('?includeDormant=1 returns them — the exclusion is auditable, not silent', async () => {
    const f = await fixture();
    const ids = await ready('?includeDormant=1');
    expect(ids).toContain(f.b);
    // The SUBTREE is still absent, and for an unrelated reason: workB's
    // prerequisite (B) is not done. That is the accident the exclusion exists
    // to stop relying on.
    expect(ids).not.toContain(f.workB);
  });

  it('CASE 3: marking the ALTERNATIVE done does not leak the branch', async () => {
    const f = await fixture();
    await setStatus(f.b, 'ClickHouse', 'done');
    const excluded = await ready();
    expect(excluded).not.toContain(f.workB);
    expect(excluded).not.toContain(f.deepB);
    expect(excluded).toContain(f.a);
    // ...and with the flag, the whole branch is back, which is what the old
    // behaviour was on EVERY call.
    const included = await ready('?includeDormant=1');
    expect(included).toContain(f.workB);
  });

  it('a DORMANT PREREQUISITE STILL BLOCKS — the exclusion never enters the CTE', async () => {
    const f = await fixture();
    // A live task that depends on a dormant one. If the exclusion had moved into
    // the recursive prereqs CTE, workB would vanish from the walk, read as
    // SATISFIED, and this task would be handed out as ready work — an auto-
    // unblock, with no human act anywhere.
    const dependent = await mkNode('migrate off clickhouse');
    await mkEdge(f.workB, dependent, 'required for');
    const ids = await ready();
    expect(ids).not.toContain(dependent);
    const withFlag = await ready('?includeDormant=1');
    expect(withFlag).not.toContain(dependent);
    // The blocker is reported as the blocker, unchanged.
    const blockers = await request(app).get(`/api/graphs/${gid}/tasks/${dependent}/blockers`);
    expect(blockers.body.map((t) => Number(t.id))).toContain(f.workB);
  });

  it('the shared substrate is never dormant', async () => {
    const f = await fixture();
    await setStatus(f.substrate, 'ingest requirement', 'todo');
    const ids = await ready();
    expect(ids).toContain(f.substrate);
  });

  it('REOPENING puts the alternative back in /ready', async () => {
    const f = await fixture();
    expect(await ready()).not.toContain(f.b);
    await setStatus(f.d, 'storage engine', 'todo', { type: 'decision', decided_at: null });
    const ids = await ready();
    expect(ids).toContain(f.b);
    expect(ids).toContain(f.a);
  });

  it('nothing was written: no status moved and no event was emitted', async () => {
    const f = await fixture();
    const snap = async () => ({
      graph: (await pool.query('SELECT version, updated_at FROM graphs WHERE id = $1', [gid])).rows[0],
      tasks: (await pool.query(
        'SELECT id, version, updated_at, meta FROM tasks WHERE graph_id = $1 ORDER BY id', [gid],
      )).rows,
      head: (await pool.query(
        'SELECT COALESCE(MAX(seq), 0) AS s FROM events WHERE graph_id = $1', [gid],
      )).rows[0].s,
    });
    const before = await snap();
    await ready();
    await ready('?includeDormant=1');
    expect(await snap()).toEqual(before);
    expect(f.d).toBeGreaterThan(0);
  });
});

describe('E18.5 the SQL form and the FOLD form agree at head', () => {
  it('same dormant set both ways', async () => {
    const f = await fixture();
    // Fold form, off the live /graph payload (which IS the fold at head).
    const view = await request(app).get(`/api/graphs/${gid}/graph`);
    const { dormant } = dormantIds(view.body.links, committedDecisionIds(view.body.nodes));

    // SQL form, exactly as /ready runs it.
    const { notDormantSql } = await import('../src/branches.js');
    const all = await pool.query(
      `SELECT id FROM tasks t WHERE t.graph_id = $1 AND NOT (${notDormantSql('t')}) ORDER BY id`,
      [gid],
    );
    expect(all.rows.map((r) => Number(r.id))).toEqual([...dormant].sort((a, b) => a - b));
    expect([...dormant].sort((a, b) => a - b)).toEqual([f.b, f.workB, f.deepB].sort((a, b) => a - b));
  });

  it('and they agree after a reopen, too', async () => {
    const f = await fixture();
    await setStatus(f.d, 'storage engine', 'todo', { type: 'decision', decided_at: null });
    const view = await request(app).get(`/api/graphs/${gid}/graph`);
    const { dormant } = dormantIds(view.body.links, committedDecisionIds(view.body.nodes));
    const { notDormantSql } = await import('../src/branches.js');
    const all = await pool.query(
      `SELECT id FROM tasks t WHERE t.graph_id = $1 AND NOT (${notDormantSql('t')}) ORDER BY id`,
      [gid],
    );
    expect(all.rows.length).toBe(0);
    expect(dormant.size).toBe(0);
  });

  it('the dormancy term is scoped to its own graph', async () => {
    const f = await fixture();
    const other = await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id");
    const otherGid = other.rows[0].id;
    const res = await request(app).get(`/api/graphs/${otherGid}/tasks/ready`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    // The first graph is unaffected.
    expect(await ready()).toContain(f.a);
  });
});
