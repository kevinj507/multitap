// E15.T-leak (#2629) — leak / unintended-consequence checks. Proves the E15
// additions never (a) pollute search ranking, (b) wipe a canvas-owned UI key on
// any new write path, or (c) break a legacy/plain graph that has none of the
// new fields.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
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
beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e15leak') RETURNING id");
  gid = g.rows[0].id;
});

// JSON.stringify every value so strings are quoted — a bare `#abcdef` would
// otherwise start a YAML comment, and a bare colon would break the mapping.
// (Production serializes via YAML.stringify, which quotes the same way.)
const node = (meta, body = '') => {
  const fm = Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return `---\n${fm}\n---\n${body}`;
};
const post = (path, body, writer) => {
  let r = request(app).post(`/api/graphs/${gid}${path}`);
  if (writer) r = r.set('X-Writer-Type', writer);
  return r.send(body);
};

describe('T-leak: structured fields do not pollute search ranking', () => {
  it('identical indexed text scores identically with vs without confidence/verified_at/significance/type', async () => {
    const body = 'molybdenum smelter throughput climbed in the second quarter';
    const plain = (await post('/tasks', { content: node({ title: 'Plain note', status: 'review' }, body) })).body;
    const rich = (await post('/tasks', {
      content: node({ title: 'Rich note', status: 'review', confidence: 0.9, verified_at: '2026-06-24T00:00:00Z', significance: 0.8, type: 'reference' }, body),
    })).body;

    const res = await post('/search', { query: 'molybdenum smelter throughput' });
    expect(res.status).toBe(200);
    const byId = new Map(res.body.results.map((r) => [Number(r.taskId), r.score]));
    expect(byId.has(plain.id)).toBe(true);
    expect(byId.has(rich.id)).toBe(true);
    // Same indexed text ⇒ same score: the structured meta fields are not indexed.
    expect(byId.get(rich.id)).toBeCloseTo(byId.get(plain.id), 10);
  });
});

describe('T-leak: every new write path preserves canvas UI keys', () => {
  it('batch node re-upsert that omits x/y/color/background-image keeps them', async () => {
    // Seed a node with UI keys via direct insert (as the canvas would persist them).
    const content = node({ title: 'Pinned', status: 'todo', x: 12.5, y: -7, color: '#abcdef', 'background-image': '/api/graphs/x/uploads/y' });
    const ins = await pool.query(
      `INSERT INTO tasks (graph_id, content, meta, external_id, last_modified_by) VALUES ($1,$2,$3,'n1','human') RETURNING id`,
      [gid, content, JSON.stringify({ title: 'Pinned', status: 'todo', x: 12.5, y: -7, color: '#abcdef', 'background-image': '/api/graphs/x/uploads/y' })],
    );
    const id = ins.rows[0].id;
    // Agent re-upserts the same external_id with a body rewrite that omits the UI keys.
    const res = await post('/batch', { nodes: [{ external_id: 'n1', content: node({ title: 'Pinned (revised)', status: 'todo' }) }] }, 'agent');
    expect(res.status).toBe(200);
    const row = res.body.nodes[0];
    expect(row.meta.x).toBe(12.5);
    expect(row.meta.y).toBe(-7);
    expect(row.meta.color).toBe('#abcdef');
    expect(row.meta['background-image']).toBe('/api/graphs/x/uploads/y');
    expect(row.id).toBe(id);
  });

  it('edge purpose PATCH preserves user color + curve; batch edge upsert does too', async () => {
    await post('/tasks', { content: node({ title: 'A' }) });
    await post('/tasks', { content: node({ title: 'B' }) });
    const e = (await post('/edges', { source_id: 1, target_id: 2, purpose: 'related to', meta: { color: '#112233', curve: { distance: 25, weight: 0.4 } } })).body;
    // Concurrent bump so the merge path runs, then an agent flips the purpose omitting meta.
    await post('/edges', { source_id: 1, target_id: 2 }).then(() => {}); // no-op create attempt (dup) — ignore
    const patched = await request(app).patch(`/api/graphs/${gid}/edges/${e.id}`)
      .set('X-Writer-Type', 'agent')
      .send({ purpose: 'supports', base_version: e.version, base_row: e });
    // base_version === current (no concurrent write) → simple path; UI keys come from base_row.meta.
    expect(patched.status).toBe(200);
    expect(patched.body.purpose).toBe('supports');
    expect(patched.body.meta.color).toBe('#112233');
    expect(patched.body.meta.curve).toEqual({ distance: 25, weight: 0.4 });

    // Batch edge upsert that omits meta keeps the protected edge meta.
    const b = await post('/batch', { edges: [{ source: 1, target: 2, purpose: 'contradicts' }] }, 'agent');
    expect(b.status).toBe(200);
    const be = b.body.edges[0];
    expect(be.purpose).toBe('contradicts');
    expect(be.meta.color).toBe('#112233');
    expect(be.meta.curve).toEqual({ distance: 25, weight: 0.4 });
  });
});

describe('T-leak: legacy / plain graphs are unaffected', () => {
  it('a graph with no reserved fields loads through every endpoint', async () => {
    const a = (await post('/tasks', { content: node({ title: 'Legacy A', status: 'todo' }, 'tungsten') })).body;
    const b = (await post('/tasks', { content: node({ title: 'Legacy B', status: 'todo' }, 'tungsten') })).body;
    await post('/edges', { source_id: a.id, target_id: b.id, purpose: 'related to' });

    expect((await request(app).get(`/api/graphs/${gid}/graph`)).status).toBe(200);
    expect((await post('/search', { query: 'tungsten' })).status).toBe(200);
    expect((await post('/context', { seeds: [a.id], hops: 2, edgeTypes: null })).status).toBe(200);

    const fr = await post('/frontier', {});
    expect(fr.status).toBe(200);
    expect(fr.body.frontier).toEqual([]); // no confidence-bearing nodes
    const inc = await post('/inconsistencies', {});
    expect(inc.status).toBe(200);
    expect(inc.body.inconsistencies).toEqual([]); // no signed edges

    // Selection/presence path still works on a plain graph.
    const sel = await request(app).post(`/api/graphs/${gid}/selection`)
      .set('X-Writer-Type', 'agent').set('X-Writer-Id', '11111111-1111-1111-1111-111111111111')
      .send({ node_ids: [a.id], edge_ids: [], editing: { kind: 'node', id: a.id }, cursor_anchor: { kind: 'node', id: a.id } });
    expect(sel.status).toBeLessThan(400);
  });
});
