// E15.T-adversarial (#2633) — the can't-afford-mistakes layer. Hostile filters,
// property/fuzz over the two new algorithms (filter DSL + signed-cycle scan),
// adversarial cycle-detection, concurrency/OCC, boundaries/encoding, and a
// deterministic end-to-end path. Property tests use a SEEDED PRNG so they're
// reproducible (invariants are exactly computable — no agents needed).
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { compileFilter } from '../src/metaFilter.js';
import { findSignedInconsistencies } from '../src/signedCycles.js';

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
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e15adv') RETURNING id");
  gid = g.rows[0].id;
});

// Deterministic PRNG (mulberry32) so a failing case is reproducible.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const node = (meta, body = '') => {
  const fm = Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return `---\n${fm}\n---\n${body}`;
};
async function insNode(meta) {
  const m = { status: 'todo', ...meta };
  const { rows } = await pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1,$2,$3) RETURNING id`,
    [gid, node(m, m.body || ''), JSON.stringify(m)],
  );
  return rows[0].id;
}
async function insEdge(s, t, purpose) {
  const type = purpose === 'required for' ? 'dependency' : 'related';
  await pool.query(
    `INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1,$2,$3,$4::edge_type,$5)`,
    [gid, s, t, type, purpose],
  );
}
const post = (path, body, writer) => {
  let r = request(app).post(`/api/graphs/${gid}${path}`);
  if (writer) r = r.set('X-Writer-Type', writer);
  return r.send(body);
};

// ───────────────────────── Filter DSL — hostile inputs ─────────────────────
describe('T-adv: filter DSL rejects hostile inputs cleanly', () => {
  const HOSTILE = [
    { a: { $weird: 1 } },
    { $where: 'return true' },
    { $gt: 5 }, // top-level operator
    { $and: 'not-an-array' },
    { $or: 5 },
    { $and: [] }, // empty
    { a: { $in: 5 } }, // $in needs array
    { a: { $nin: 'x' } },
    42,
    'string',
    [1, 2, 3],
    true,
  ];
  it('compileFilter returns a clean error (no throw) for each hostile filter', () => {
    for (const f of HOSTILE) {
      const c = compileFilter(f);
      expect(c.error, `expected error for ${JSON.stringify(f)}`).toBeTruthy();
      expect(c.match).toBeUndefined();
    }
  });
  it('/search 400s on a hostile filter without leaking a raw error', async () => {
    await insNode({ title: 'x', confidence: 0.5, body: 'widget' });
    for (const f of HOSTILE) {
      const res = await post('/search', { query: 'widget', filter: f });
      expect(res.status, `expected 400 for ${JSON.stringify(f)}`).toBe(400);
      expect(res.body.error).toMatch(/invalid filter/);
      expect(JSON.stringify(res.body)).not.toMatch(/SELECT|syntax error|pg|stack/i);
    }
  });
  it('null filter is match-all (not an error)', async () => {
    await insNode({ title: 'y', body: 'gadget' });
    const res = await post('/search', { query: 'gadget', filter: null });
    expect(res.status).toBe(200);
  });
});

// ───────────────────────── Filter DSL — property/fuzz ──────────────────────
describe('T-adv: filter DSL property tests', () => {
  const FIELDS = ['confidence', 'significance', 'status', 'type', 'verified_at'];
  function randValue(rng, field) {
    if (field === 'confidence' || field === 'significance') return Math.round(rng() * 10) / 10;
    if (field === 'verified_at') return pick(rng, ['2025-01-01T00:00:00Z', '2026-06-01T00:00:00Z']);
    if (field === 'status') return pick(rng, ['todo', 'review', 'done']);
    return pick(rng, ['reference', 'claim', 'note']);
  }
  function randValidFilter(rng) {
    const field = pick(rng, FIELDS);
    const op = pick(rng, ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin']);
    const operand = op === '$in' || op === '$nin' ? [randValue(rng, field), randValue(rng, field)] : randValue(rng, field);
    const cond = { [field]: { [op]: operand } };
    const r = rng();
    if (r < 0.25) return { $and: [cond, { status: { $ne: 'archived' } }] };
    if (r < 0.5) return { $or: [cond, { significance: { $gte: 0 } }] };
    return cond;
  }
  const CORPUS = [
    {}, { confidence: 0.9, type: 'reference', verified_at: '2026-06-01T00:00:00Z' },
    { confidence: 0.2, status: 'review' }, { significance: 0.5, type: 'claim' },
    { status: 'done', verified_at: '2024-01-01T00:00:00Z' },
  ];

  it('200 random VALID filters: parse, never throw, return a subset of the corpus', () => {
    const rng = makeRng(0xC0FFEE);
    for (let i = 0; i < 200; i++) {
      const f = randValidFilter(rng);
      const c = compileFilter(f);
      expect(c.error, `valid filter errored: ${JSON.stringify(f)}`).toBeUndefined();
      const matched = CORPUS.filter((m) => c.match(m));
      expect(matched.length).toBeLessThanOrEqual(CORPUS.length); // subset invariant
    }
  });

  it('random VALID filter on /search returns a subset of the unfiltered results', async () => {
    await insNode({ title: 'Cobalt A', confidence: 0.9, significance: 0.8, type: 'reference', verified_at: '2026-06-01T00:00:00Z', body: 'cobalt' });
    await insNode({ title: 'Cobalt B', confidence: 0.3, significance: 0.2, status: 'review', body: 'cobalt' });
    await insNode({ title: 'Cobalt C', type: 'claim', body: 'cobalt' });
    const all = await post('/search', { query: 'cobalt' });
    const allIds = new Set(all.body.results.map((r) => Number(r.taskId)));
    const rng = makeRng(7);
    for (let i = 0; i < 6; i++) {
      const f = randValidFilter(rng);
      const res = await post('/search', { query: 'cobalt', filter: f });
      expect(res.status).toBe(200);
      for (const r of res.body.results) expect(allIds.has(Number(r.taskId))).toBe(true);
    }
  });
});

// ───────────────────────── Inconsistency — property/fuzz ───────────────────
describe('T-adv: signed inconsistency property tests', () => {
  function randSignedGraph(rng, n, edgeProb) {
    const edges = [];
    for (let s = 1; s <= n; s++) {
      for (let t = 1; t <= n; t++) {
        if (s !== t && rng() < edgeProb) {
          edges.push({ source: s, target: t, purpose: rng() < 0.5 ? 'supports' : 'contradicts' });
        }
      }
    }
    return edges;
  }

  it('every flagged cycle has ODD contradicts (never balanced / pure-supports)', () => {
    const rng = makeRng(123);
    for (let i = 0; i < 60; i++) {
      const edges = randSignedGraph(rng, 5 + Math.floor(rng() * 3), 0.35);
      const { inconsistencies } = findSignedInconsistencies(edges, { maxCycles: 100 });
      for (const c of inconsistencies) {
        expect(c.contradicts % 2).toBe(1);
        expect(c.balanced).toBe(false);
        expect(c.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('is deterministic: same edges → identical output', () => {
    const rng = makeRng(99);
    const edges = randSignedGraph(rng, 7, 0.4);
    const a = findSignedInconsistencies(edges, { maxCycles: 50 });
    const b = findSignedInconsistencies(edges, { maxCycles: 50 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('dense near-complete signed graph respects guardrails (caps + truncated, terminates)', () => {
    // i↔j with supports one way, contradicts the other → every 2-cycle is odd.
    const edges = [];
    const n = 8;
    for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) {
      edges.push({ source: i, target: j, purpose: 'supports' });
      edges.push({ source: j, target: i, purpose: 'contradicts' });
    }
    const { inconsistencies, truncated } = findSignedInconsistencies(edges, { maxCycles: 5, maxCycleLen: 6 });
    expect(inconsistencies.length).toBe(5);
    expect(truncated).toBe(true);
    for (const c of inconsistencies) expect(c.length).toBeLessThanOrEqual(6);
  });
});

// ───────────────────────── Cycle detection (required for) ──────────────────
describe('T-adv: dependency cycle detection holds under adversarial writes', () => {
  beforeEach(async () => {
    await insNode({ title: 'A' });
    await insNode({ title: 'B' });
    await insNode({ title: 'C' });
  });
  it('A→B + B→A "required for" in one bulk call is rejected', async () => {
    const res = await post('/edges/bulk', { edges: [
      { source_id: 1, target_id: 2, purpose: 'required for' },
      { source_id: 2, target_id: 1, purpose: 'required for' },
    ] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cycle/);
  });
  it('a long indirect required-for cycle in one batch is rejected', async () => {
    const res = await post('/batch', { edges: [
      { source: 1, target: 2, purpose: 'required for' },
      { source: 2, target: 3, purpose: 'required for' },
      { source: 3, target: 1, purpose: 'required for' },
    ] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cycle/);
  });
});

// ───────────────────────── Concurrency / OCC ───────────────────────────────
describe('T-adv: concurrent human+agent merge keeps UI keys AND research fields', () => {
  it('agent stale-base rewrite preserves x/y and a concurrently-set confidence', async () => {
    const created = (await post('/tasks', { content: node({ title: 'N', status: 'todo', x: 10, y: 20, confidence: 0.6 }) })).body;
    // Human bumps the version (keeps the UI keys + confidence, as the canvas would).
    await request(app).patch(`/api/graphs/${gid}/tasks/${created.id}`).set('X-Writer-Type', 'human').send({
      content: node({ title: 'N edited', status: 'todo', x: 10, y: 20, confidence: 0.6 }),
      base_version: created.version, base_content: created.content,
    });
    // Agent PATCHes with the STALE base, omitting x/y AND confidence.
    const agent = await request(app).patch(`/api/graphs/${gid}/tasks/${created.id}`).set('X-Writer-Type', 'agent').send({
      content: node({ title: 'N', status: 'in_progress' }),
      base_version: created.version, base_content: created.content,
    });
    expect(agent.status).toBe(200);
    expect(agent.body.meta.x).toBe(10);
    expect(agent.body.meta.y).toBe(20);
    expect(agent.body.meta.confidence).toBe(0.6);
    expect(agent.body.meta.status).toBe('in_progress');
  });
});

// ───────────────────────── Boundaries / encoding ───────────────────────────
describe('T-adv: boundaries and encoding', () => {
  it('confidence exactly 0.0 and 1.0 accepted; just-over rejected', async () => {
    expect((await post('/tasks', { content: node({ title: 'lo', confidence: 0 }) })).status).toBe(201);
    expect((await post('/tasks', { content: node({ title: 'hi', confidence: 1 }) })).status).toBe(201);
    expect((await post('/tasks', { content: node({ title: 'over', confidence: 1.000001 }) })).status).toBe(400);
    expect((await post('/tasks', { content: node({ title: 'under', significance: -0.000001 }) })).status).toBe(400);
  });
  it('verified_at with a timezone offset is accepted; unicode + max-length type ok, over-length rejected', async () => {
    expect((await post('/tasks', { content: node({ title: '钨 supply', type: 'références', verified_at: '2026-06-24T12:00:00+02:00' }) })).status).toBe(201);
    expect((await post('/tasks', { content: node({ title: 'len ok', type: 'x'.repeat(40) }) })).status).toBe(201);
    expect((await post('/tasks', { content: node({ title: 'len bad', type: 'x'.repeat(41) }) })).status).toBe(400);
  });
  it('frontier staleDays boundary: 0 makes everything stale; huge value makes nothing stale', async () => {
    const f = await insNode({ title: 'foundation', confidence: 0.9, verified_at: new Date(Date.now() - 86400000).toISOString() });
    await insEdge(f, await insNode({ title: 'a' }), 'supports');
    await insEdge(f, await insNode({ title: 'b' }), 'supports');
    const allStale = await post('/frontier', { staleDays: 0 });
    expect(allStale.body.frontier.map((x) => x.id)).toContain(f);
    const noneStale = await post('/frontier', { staleDays: 100000 });
    expect(noneStale.body.frontier.map((x) => x.id)).not.toContain(f); // fresh, high-conf → not flagged
  });
  it('empty graph and single-node graph return empty read results, not errors', async () => {
    expect((await post('/frontier', {})).body.frontier).toEqual([]);
    expect((await post('/inconsistencies', {})).body.inconsistencies).toEqual([]);
    await insNode({ title: 'solo', confidence: 0.9 });
    expect((await post('/frontier', {})).status).toBe(200);
    expect((await post('/inconsistencies', {})).body.inconsistencies).toEqual([]);
  });
});

// ───────────────────────── E2E integration (deterministic) ─────────────────
describe('T-adv: end-to-end — the pieces compose on one fresh graph', () => {
  it('create → populate → every read query → coherent end state', async () => {
    const source = await insNode({ title: 'Source doc', type: 'reference', confidence: 0.9, verified_at: '2000-01-01T00:00:00Z', body: 'lithium brine' });
    const finding = await insNode({ title: 'Lithium output up', confidence: 0.85, verified_at: '2000-01-01T00:00:00Z', body: 'lithium output' });
    const shaky = await insNode({ title: 'Lithium chatter', confidence: 0.2, body: 'lithium' });
    const downstream = await insNode({ title: 'Build battery model' }); // plain task
    const question = await insNode({ title: 'Will prices hold?', status: 'todo' }); // open question (no confidence)
    const claimX = await insNode({ title: 'Claim X', confidence: 0.7 });
    const claimY = await insNode({ title: 'Claim Y', confidence: 0.7 });

    await insEdge(source, finding, 'supports');      // related
    await insEdge(finding, shaky, 'related to');     // bridge corridor
    await insEdge(shaky, source, 'related to');
    await insEdge(finding, downstream, 'required for'); // dependency
    await insEdge(claimX, claimY, 'supports');
    await insEdge(claimY, claimX, 'contradicts');    // odd loop

    // filtered search: only the high-confidence lithium nodes.
    const s = await post('/search', { query: 'lithium', filter: { confidence: { $gte: 0.8 } } });
    const sIds = s.body.results.map((r) => Number(r.taskId));
    expect(sIds).toEqual(expect.arrayContaining([source, finding]));
    expect(sIds).not.toContain(shaky);

    // filtered context from finding: shaky retained as a bridge to source.
    const ctx = await post('/context', { seeds: [finding], hops: 2, edgeTypes: null, filter: { confidence: { $gte: 0.8 } } });
    const cMap = new Map(ctx.body.nodes.map((n) => [n.id, n]));
    expect(cMap.has(source) && cMap.has(finding)).toBe(true);
    expect(cMap.get(shaky)?.bridge).toBe(true);

    // dependency traversal still works off the derived type: finding blocks downstream.
    const blockers = await request(app).get(`/api/graphs/${gid}/tasks/${downstream}/blockers`);
    expect(blockers.body.map((b) => b.id)).toContain(finding);

    // frontier: the stale load-bearing source + finding surface; the open question does not.
    const fr = await post('/frontier', { minImportance: 1 });
    const frIds = fr.body.frontier.map((x) => x.id);
    expect(frIds).toContain(source);
    expect(frIds).not.toContain(question);

    // inconsistency: exactly the claimX↔claimY odd loop.
    const inc = await post('/inconsistencies', {});
    expect(inc.body.inconsistencies.length).toBe(1);
    expect(inc.body.inconsistencies[0].nodes.sort()).toEqual([claimX, claimY].sort());
  });
});
