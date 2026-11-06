// E18.5 — GET /api/graphs/:gid/decisions/:id/branches.
//
// The two things asserted hardest here:
//
//   * NOTHING AUTO-FLIPS A STATUS, and it is structural rather than promised:
//     the handler issues SELECTs and holds no transaction. graphs.version, every
//     tasks.updated_at and MAX(events.seq) are captured before the call and
//     compared after — the assertions are copied from
//     tests/e18-doubt-route.test.js.
//   * THE CACHE HEADER. `?asOfSeq=` pins an immutable prefix and is the ONE
//     reconstruction that may sit in a cache; everything else resolves against a
//     wall clock whose answer changes as the log grows, and a seq PAST the head
//     is clamped, so the same URL answers differently the moment anyone writes.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { BRANCH_PURPOSE } from '../src/branches.js';

let app;
let pool;
let gid;
let resetDerivedCache;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  resetDerivedCache = (await import('../src/derivedCache.js'))._resetDerivedCacheForTests;
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-branches') RETURNING id");
  gid = g.rows[0].id;
  resetDerivedCache();
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

async function mkNode(title, extra = {}, body = '') {
  const res = await request(app)
    .post(`/api/graphs/${gid}/tasks`)
    .send({ content: node({ title, status: 'todo', ...extra }, body) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

async function mkEdge(source, target, purpose, meta = undefined) {
  const res = await request(app)
    .post(`/api/graphs/${gid}/edges`)
    .send({ source_id: source, target_id: target, purpose, ...(meta ? { meta } : {}) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

const branches = (id, query = '') =>
  request(app).get(`/api/graphs/${gid}/decisions/${id}/branches${query}`);

// Commit a decision the way a human does — by SETTING decided_at on a node that
// did not have it. That is what makes gt_classify_node emit `decision.made`; a
// node CREATED already carrying the scalar emits `node.created` and nothing
// else, which is the `scalar` basis and a different test.
async function commit(id, title, at = '2026-03-01T00:00:00.000Z') {
  const res = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
    .send({ content: node({ title, type: 'decision', status: 'todo', decided_at: at }) });
  expect(res.status).toBe(200);
  return res;
}

// D --related to--> A (chosen) / B (alternative)
// req --required for--> A, B      (shared substrate)
// A --required for--> workA
// B --required for--> workB
async function fixture({ decide = true } = {}) {
  const d = await mkNode('storage engine', { type: 'decision' });
  const a = await mkNode('Timescale');
  const b = await mkNode('ClickHouse');
  const req = await mkNode('must ingest 100k rows/s', { status: 'done' });
  const workA = await mkNode('hypertable migration');
  const workB = await mkNode('clickhouse spike');
  await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'chosen' } });
  await mkEdge(d, b, BRANCH_PURPOSE, { branch: { role: 'alternative' } });
  await mkEdge(req, a, 'required for');
  await mkEdge(req, b, 'required for');
  await mkEdge(a, workA, 'required for');
  await mkEdge(b, workB, 'required for');
  if (decide) await commit(d, 'storage engine');
  return { d, a, b, req, workA, workB };
}

describe('E18.5 GET /branches', () => {
  it('names the options, their roles and their branches', async () => {
    const f = await fixture();
    const res = await branches(f.d);
    expect(res.status).toBe(200);
    expect(res.body.decision.state).toBe('committed');
    expect(res.body.options.map((o) => [o.node_id, o.role])).toEqual([
      [f.a, 'chosen'], [f.b, 'alternative'],
    ]);
    const alt = res.body.options.find((o) => o.node_id === f.b);
    expect(alt.overlay.node_ids).toEqual([f.b, f.workB].sort((x, y) => x - y));
    expect(alt.overlay.fabricated).toBe(false);
    expect(alt.overlay.empty).toBe(false);
    expect(alt.dormant).toBe(true);
    expect(res.body.options.find((o) => o.node_id === f.a).dormant).toBe(false);
  });

  it('derives the dormant set and leaves the shared substrate live', async () => {
    const f = await fixture();
    const res = await branches(f.d);
    expect(res.body.dormant.node_ids).toEqual([f.b, f.workB].sort((x, y) => x - y));
    expect(res.body.dormant.node_ids).not.toContain(f.req);
    expect(res.body.dormant.contested).toEqual([]);
  });

  it('names CONTESTED nodes rather than applying the rule silently', async () => {
    const f = await fixture();
    const shared = await mkNode('index tuning');
    await mkEdge(f.a, shared, 'required for');
    await mkEdge(f.b, shared, 'required for');
    const res = await branches(f.d);
    expect(res.body.dormant.contested).toEqual([shared]);
    expect(res.body.dormant.node_ids).not.toContain(shared);
  });

  it('reports the contingency closure with hops and chains', async () => {
    const f = await fixture();
    const res = await branches(f.d);
    expect(res.body.contingency.root).toBe(f.d);
    // Both roads and everything under them: reopening the decision puts every
    // option back in play. The FIRST hop is the option edge itself — `edges`
    // carries UNIQUE(source_id, target_id), so a decision cannot ALSO be wired
    // to its own option by `required for` (409), and a walk over `required for`
    // alone would report an empty blast radius.
    // Ordered by hops, then id: the two options first, then their work.
    expect(res.body.contingency.nodes.map((n) => n.id)).toEqual([f.a, f.b, f.workA, f.workB]);
    expect(res.body.contingency.count).toBe(4);
    const deep = res.body.contingency.nodes.find((n) => n.id === f.workB);
    expect(deep.hops).toBe(2);
    expect(deep.chain.map((h) => h.purpose)).toEqual(['related to', 'required for']);
    expect(deep.chain[0].from).toBe(f.d);
    expect(deep.chain[1].to).toBe(f.workB);
    expect(deep.dormant).toBe(true);
    expect(res.body.contingency.truncated).toBe(false);
    // A `related to` edge that is NOT one of this decision's options is never
    // traversed: the adjacency is the filter.
    const stray = await mkNode('stray note');
    await mkEdge(f.workA, stray, 'related to');
    const after = await branches(f.d);
    expect(after.body.contingency.nodes.map((n) => n.id)).not.toContain(stray);
  });

  it('a decision with no branch edges is a 200 with no options, not a 404', async () => {
    const d = await mkNode('lonely', { type: 'decision' });
    const res = await branches(d);
    expect(res.status).toBe(200);
    expect(res.body.options).toEqual([]);
    expect(res.body.dormant.count).toBe(0);
  });

  it('404s a node that does not exist', async () => {
    const res = await branches(999999);
    expect(res.status).toBe(404);
  });

  it('400s a bad id and a bad rectangle knob', async () => {
    expect((await branches('abc')).status).toBe(400);
    const f = await fixture();
    expect((await branches(f.d, '?axis=sideways')).status).toBe(400);
    expect((await branches(f.d, '?axis=happened')).status).toBe(400);   // needs asOf
    expect((await branches(f.d, '?maxDepth=0')).status).toBe(400);
    expect((await branches(f.d, '?maxDepth=nope')).status).toBe(400);
  });

  it('echoes its params', async () => {
    const f = await fixture();
    const res = await branches(f.d, '?maxDepth=4&maxResults=2&chainLimit=3');
    expect(res.body.params).toEqual({
      axis: 'learned', asOf: null, asOfSeq: null, known: null,
      maxDepth: 4, maxNodes: 2000, maxResults: 2, chainLimit: 3,
    });
  });
});

describe('E18.5 /branches is a rectangle read', () => {
  it('?asOfSeq= before the branch existed shows no options', async () => {
    const d = await mkNode('storage engine', { type: 'decision', decided_at: '2026-03-01T00:00:00Z' });
    const early = await pool.query('SELECT MAX(seq) AS s FROM events WHERE graph_id = $1', [gid]);
    const a = await mkNode('Timescale');
    await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'chosen' } });

    const then = await branches(d, `?asOfSeq=${Number(early.rows[0].s)}`);
    expect(then.status).toBe(200);
    expect(then.body.options).toEqual([]);
    const now = await branches(d);
    expect(now.body.options.length).toBe(1);
  });

  it('caches a pinned prefix and refuses to cache a clamped or live one', async () => {
    const f = await fixture();
    const head = await pool.query('SELECT MAX(seq) AS s FROM events WHERE graph_id = $1', [gid]);
    const headSeq = Number(head.rows[0].s);
    expect((await branches(f.d)).headers['cache-control']).toBe('no-store');
    expect((await branches(f.d, `?asOfSeq=${headSeq}`)).headers['cache-control'])
      .toBe('private, max-age=600');
    // Past the head: clamped, so the same URL answers differently after any
    // write. That is the one case the immutability argument does not hold.
    expect((await branches(f.d, `?asOfSeq=${headSeq + 500}`)).headers['cache-control'])
      .toBe('no-store');
  });

  it('role_at_decision comes from the commitment seq, and a re-tag shows BOTH', async () => {
    const f = await fixture();
    const res = await branches(f.d);
    const chosen = res.body.options.find((o) => o.node_id === f.a);
    expect(chosen.role).toBe('chosen');
    expect(chosen.role_at_decision).toBe('chosen');
    expect(chosen.stale_role).toBe(false);

    // Re-tag the alternative as chosen WITHOUT touching the decision.
    const edges = await pool.query(
      `SELECT id FROM edges WHERE graph_id = $1 AND source_id = $2 AND target_id = $3`,
      [gid, f.d, f.b],
    );
    await request(app).patch(`/api/graphs/${gid}/edges/${edges.rows[0].id}`)
      .send({ meta: { branch: { role: 'chosen' } } });

    const after = await branches(f.d);
    const alt = after.body.options.find((o) => o.node_id === f.b);
    expect(alt.role).toBe('chosen');
    expect(alt.role_at_decision).toBe('alternative');
  });
});

describe('E18.5 reopening, through /branches', () => {
  it('lifts dormancy, keeps the roles, and flags the stale one', async () => {
    const f = await fixture();
    const before = await branches(f.d);
    expect(before.body.dormant.count).toBe(2);
    expect(before.body.decision.state).toBe('committed');

    // Reopen: clear decided_at. Nothing else changes.
    const cur = await request(app).get(`/api/graphs/${gid}/tasks/${f.d}`);
    await request(app).patch(`/api/graphs/${gid}/tasks/${f.d}`)
      .send({ content: node({ title: 'storage engine', type: 'decision', status: 'todo', decided_at: null }) });

    const after = await branches(f.d);
    expect(after.body.decision.state).toBe('reopened');
    expect(after.body.dormant.count).toBe(0);
    // ROLES ARE NOT AUTO-FLIPPED. The tension is reported, not resolved.
    expect(after.body.options.map((o) => o.role)).toEqual(['chosen', 'alternative']);
    expect(after.body.options.find((o) => o.node_id === f.a).stale_role).toBe(true);
    expect(after.body.decision.reopened_seq).toBeGreaterThan(after.body.decision.decision_seq);
    expect(cur.status).toBe(200);
  });
});

describe('E18.5 /branches never writes', () => {
  it('leaves graphs.version, every tasks.updated_at and MAX(events.seq) untouched', async () => {
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
    const res = await branches(f.d);
    expect(res.status).toBe(200);
    const after = await snap();
    expect(after).toEqual(before);
  });
});
