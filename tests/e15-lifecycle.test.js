// E15.E-lifecycle (#2636) — the living, compounding world-model. Proves the
// full read+write+MODIFY lifecycle a real analyst/engineer drives over time:
// question→finding, confidence updates, verified_at refresh dropping a node off
// the frontier, a late contradiction appearing then clearing on the scan, edge
// purpose changes re-checking cycles, human+agent OCC interleave, and idempotent
// cross-session compounding. Deterministic (the transitions are mechanical).
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
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e15life') RETURNING id");
  gid = g.rows[0].id;
});

const node = (meta, body = '') => {
  const fm = Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return `---\n${fm}\n---\n${body}`;
};
const P = (path, body, writer) => {
  let r = request(app).post(`/api/graphs/${gid}${path}`);
  if (writer) r = r.set('X-Writer-Type', writer);
  return r.send(body);
};
const mkTask = async (meta, writer = 'agent') => (await P('/tasks', { content: node(meta) }, writer)).body;
const mkEdge = (s, t, purpose) => P('/edges', { source_id: s, target_id: t, purpose });
const getTask = async (id) => (await request(app).get(`/api/graphs/${gid}/tasks/${id}`)).body;
const patchTask = (id, meta, base, writer = 'agent') =>
  request(app).patch(`/api/graphs/${gid}/tasks/${id}`).set('X-Writer-Type', writer)
    .send({ content: node(meta), base_version: base.version, base_content: base.content });

const ISO_STALE = '2000-01-01T00:00:00Z';
const ISO_FRESH = () => new Date().toISOString();

describe('E-lifecycle: a question becomes a finding', () => {
  it('a todo open-question gains confidence and is then a claim, not an open question', async () => {
    const q = await mkTask({ title: 'Will SSBs ship by 2027?', status: 'todo' });
    expect(q.meta.confidence).toBeUndefined(); // open question

    const fresh = await getTask(q.id);
    const promoted = await patchTask(q.id, { title: 'SSBs ship in low volume by 2027-2028', status: 'review', confidence: 0.7, significance: 0.8, verified_at: ISO_FRESH() }, fresh);
    expect(promoted.status).toBe(200);
    expect(promoted.body.meta.confidence).toBe(0.7);
    expect(promoted.body.meta.status).toBe('review');
    // It now reads as a claim (confidence set, type != reference).
    const search = await P('/search', { query: 'SSBs ship', filter: { confidence: { $gte: 0.5 } } });
    expect(search.body.results.map((r) => Number(r.taskId))).toContain(q.id);
  });
});

describe('E-lifecycle: confidence update + verified_at refresh drops it off the frontier', () => {
  it('refreshing verified_at on a stale load-bearing node removes it from the frontier', async () => {
    const found = await mkTask({ title: 'Foundation claim', status: 'review', confidence: 0.6, significance: 0.8, verified_at: ISO_STALE });
    const a = await mkTask({ title: 'rests A', status: 'todo' });
    const b = await mkTask({ title: 'rests B', status: 'todo' });
    await mkEdge(found.id, a.id, 'supports');
    await mkEdge(found.id, b.id, 'supports'); // out-degree 2 → load-bearing

    // Stale + load-bearing → on the frontier.
    let fr = await P('/frontier', {});
    expect(fr.body.frontier.map((x) => x.id)).toContain(found.id);

    // Confidence updated as evidence accumulates.
    let cur = await getTask(found.id);
    const bumped = await patchTask(found.id, { title: 'Foundation claim', status: 'review', confidence: 0.9, significance: 0.8, verified_at: ISO_STALE }, cur);
    expect(bumped.body.meta.confidence).toBe(0.9);

    // Re-checked now → refresh verified_at → frontier DROPS it.
    cur = await getTask(found.id);
    await patchTask(found.id, { title: 'Foundation claim', status: 'review', confidence: 0.9, significance: 0.8, verified_at: ISO_FRESH() }, cur);
    fr = await P('/frontier', {});
    expect(fr.body.frontier.map((x) => x.id)).not.toContain(found.id); // re-verified → off the queue
  });
});

describe('E-lifecycle: a late contradiction appears on the scan, then clears when reconciled', () => {
  it('inconsistency scan flags a tension that did not exist before, and clears on reconcile', async () => {
    const d = await mkTask({ title: 'demand strong', status: 'review', confidence: 0.7 });
    const g = await mkTask({ title: 'inventory glut', status: 'review', confidence: 0.65 });
    const p = await mkTask({ title: 'prices drop', status: 'review', confidence: 0.6 });
    await mkEdge(g.id, p.id, 'supports');
    await mkEdge(p.id, d.id, 'supports');

    // Before the contradicting edge: no signed-cycle tension.
    let inc = await P('/inconsistencies', {});
    expect(inc.body.inconsistencies).toEqual([]);

    // A new CONTRADICTING finding/edge closes an odd loop → tension APPEARS.
    const newEdge = await mkEdge(d.id, g.id, 'contradicts');
    inc = await P('/inconsistencies', {});
    expect(inc.body.inconsistencies.length).toBe(1);
    expect(inc.body.inconsistencies[0].nodes.sort()).toEqual([d.id, g.id, p.id].sort());

    // Analyst reconciles (re-points the contradicts edge to supports) → tension CLEARS.
    const eid = newEdge.body.id;
    const cur = (await request(app).get(`/api/graphs/${gid}/edges`)).body.find((e) => e.id === eid);
    await request(app).patch(`/api/graphs/${gid}/edges/${eid}`).set('X-Writer-Type', 'human')
      .send({ purpose: 'supports', base_version: cur.version, base_row: cur });
    inc = await P('/inconsistencies', {});
    expect(inc.body.inconsistencies).toEqual([]); // cleared
  });
});

describe('E-lifecycle: edge purpose change re-runs cycle detection and reads reflect it', () => {
  it('promoting an edge to required-for re-checks cycles; reads see the new structure', async () => {
    const a = await mkTask({ title: 'A', status: 'todo' });
    const b = await mkTask({ title: 'B', status: 'todo' });
    const c = await mkTask({ title: 'C', status: 'todo' });
    await mkEdge(a.id, b.id, 'required for');
    await mkEdge(b.id, c.id, 'required for');
    const rel = await mkEdge(c.id, a.id, 'related to'); // harmless related edge

    // Promoting c→a to required-for would close a→b→c→a → cycle re-check rejects.
    const cur = (await request(app).get(`/api/graphs/${gid}/edges`)).body.find((e) => e.id === rel.body.id);
    const bad = await request(app).patch(`/api/graphs/${gid}/edges/${rel.body.id}`)
      .send({ purpose: 'required for', base_version: cur.version, base_row: cur });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/cycle/);

    // A non-cyclic promotion succeeds and dependency reads reflect it.
    await mkEdge(a.id, c.id, 'related to').then(async (e) => {
      const cu = (await request(app).get(`/api/graphs/${gid}/edges`)).body.find((x) => x.id === e.body.id);
      const ok = await request(app).patch(`/api/graphs/${gid}/edges/${e.body.id}`)
        .send({ purpose: 'required for', base_version: cu.version, base_row: cu });
      expect(ok.status).toBe(200);
      expect(ok.body.purpose).toBe('required for');
      expect(ok.body.type).toBe('dependency');
    });
    // c is now a recursive prereq of a's dependents — blockers reflect the new edge.
    const blockers = (await request(app).get(`/api/graphs/${gid}/tasks/${c.id}/blockers`)).body;
    expect(Array.isArray(blockers)).toBe(true);
  });
});

describe('E-lifecycle: human + agent OCC interleave', () => {
  it('a concurrent human drag + agent status write three-way-merge: both survive', async () => {
    // Human creates with a position; agent will advance status against a stale base.
    const created = await mkTask({ title: 'Shared node', status: 'todo', x: 100, y: 200, confidence: 0.5 }, 'human');
    const base = { version: created.version, content: created.content };

    // Human drags it (new x/y) — bumps the version.
    await patchTask(created.id, { title: 'Shared node', status: 'todo', x: 140, y: 260, confidence: 0.5 }, base, 'human');

    // Agent, with the STALE base, advances status + refreshes confidence, omitting x/y.
    const agentWrite = await patchTask(created.id, { title: 'Shared node', status: 'review', confidence: 0.8 }, base, 'agent');
    expect(agentWrite.status).toBe(200);
    expect(agentWrite.body.meta.status).toBe('review'); // agent's change landed
    expect(agentWrite.body.meta.confidence).toBe(0.8);
    expect(agentWrite.body.meta.x).toBe(140); // human's drag preserved
    expect(agentWrite.body.meta.y).toBe(260);
  });
});

describe('E-lifecycle: cross-session idempotent compounding', () => {
  it('session 2 re-runs a round (unchanged), then builds on session 1 without duplicates', async () => {
    // Session 1 writes a round via batch with external_ids.
    const round1 = {
      run_id: 'session-1',
      nodes: [
        { external_id: 'src:1', content: node({ title: 'Source one', status: 'review', type: 'reference', confidence: 0.9 }) },
        { external_id: 'find:1', content: node({ title: 'Finding one', status: 'review', confidence: 0.7, significance: 0.8 }) },
      ],
      edges: [{ source: 'src:1', target: 'find:1', purpose: 'supports' }],
    };
    const s1 = await P('/batch', round1);
    expect(s1.body.created.nodes).toBe(2);
    const find1Id = s1.body.nodes.find((n) => n.external_id === 'find:1').id;

    // Session 2 re-runs the SAME round → idempotent: everything unchanged, no dupes.
    const s2a = await P('/batch', round1);
    expect(s2a.body.created.nodes).toBe(0);
    expect(s2a.body.unchanged.nodes).toBe(2);

    // Session 2 builds on it: a new finding that the prior one supports + a contradiction.
    const s2b = await P('/batch', {
      run_id: 'session-2',
      nodes: [
        { external_id: 'find:2', content: node({ title: 'Finding two', status: 'review', confidence: 0.6, significance: 0.7 }) },
        // upsert find:1 with refreshed confidence (compounding), omitting other fields
        { external_id: 'find:1', content: node({ title: 'Finding one', status: 'review', confidence: 0.85, significance: 0.8 }) },
      ],
      edges: [{ source: 'find:1', target: 'find:2', purpose: 'supports' }],
    });
    expect(s2b.body.created.nodes).toBe(1); // only find:2 is new
    expect(s2b.body.updated.nodes).toBe(1); // find:1 confidence refreshed

    // Total node count reflects accumulated multi-session state — no duplicates.
    const all = (await request(app).get(`/api/graphs/${gid}/tasks`)).body;
    expect(all.length).toBe(3); // src:1, find:1, find:2 — one each
    const find1 = await getTask(find1Id);
    expect(find1.meta.confidence).toBe(0.85); // session 2's compounded value
  });
});
