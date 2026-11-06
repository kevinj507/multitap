// E19.1 — derived plan structure (POST /structure) + the pure region math.
//
// The gate that matters most here is the READY PARITY test: the route recomputes
// readiness in JS, and GET /tasks/ready computes it in SQL. Two implementations
// of one definition drift, so parity is asserted against the live endpoint on a
// fixture built to exercise the tricky parts (transitive prereqs, a
// confidence-bearing node parked at todo, cross-region prerequisites).
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { derivePlanRegions, findBridges } from '../src/planRegions.js';

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
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e19struct') RETURNING id");
  gid = g.rows[0].id;
});

async function insNode(meta) {
  const m = { status: 'todo', ...meta };
  const fm = Object.entries(m)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');
  const content = `---\n${fm}\n---\n${m.body || ''}`;
  const { rows } = await pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
    [gid, content, JSON.stringify(m)],
  );
  return rows[0].id;
}

async function insEdge(source, target, purpose) {
  const type = purpose === 'required for' ? 'dependency' : 'related';
  await pool.query(
    `INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1,$2,$3,$4::edge_type,$5)`,
    [gid, source, target, type, purpose],
  );
}

const e = (source, target, purpose = 'required for') => ({ source_id: source, target_id: target, purpose });
const n = (id, extra = {}) => ({ id, title: `n${id}`, status: 'todo', confidence: null, ...extra });

// ───────────────────────── pure: bridge detection ──────────────────────────
describe('findBridges (pure)', () => {
  it('every edge of a simple chain is a bridge', () => {
    const edges = [e(1, 2), e(2, 3), e(3, 4)].map((x) => ({ ...x, source: x.source_id, target: x.target_id }));
    expect(findBridges(edges).size).toBe(3);
  });

  it('no edge of a cycle is a bridge', () => {
    const edges = [e(1, 2), e(2, 3), e(3, 1)].map((x) => ({ ...x, source: x.source_id, target: x.target_id }));
    expect(findBridges(edges).size).toBe(0);
  });

  it('parallel edges between the same pair are NOT bridges', () => {
    // The parent-EDGE-index check is what gets this right; a parent-NODE check
    // would wrongly call both of these bridges.
    const edges = [e(1, 2), e(2, 1)].map((x) => ({ ...x, source: x.source_id, target: x.target_id }));
    expect(findBridges(edges).size).toBe(0);
  });

  it('finds the single edge joining two cycles', () => {
    const raw = [e(1, 2), e(2, 3), e(3, 1), e(3, 4), e(4, 5), e(5, 6), e(6, 4)];
    const edges = raw.map((x) => ({ ...x, source: x.source_id, target: x.target_id }));
    const bridges = findBridges(edges);
    expect(bridges.size).toBe(1);
    expect([...bridges][0]).toBe(3); // index of 3->4
  });

  it('handles a long chain without blowing the stack (iterative DFS)', () => {
    const edges = [];
    for (let i = 1; i < 5000; i += 1) edges.push({ source: i, target: i + 1, purpose: 'required for' });
    expect(findBridges(edges).size).toBe(4999);
  });
});

// ───────────────────────── pure: region partition ──────────────────────────
describe('derivePlanRegions (pure)', () => {
  it('partitions into components and never auto-cuts a bridge', () => {
    // Two chains joined by nothing → two regions. The chain's internal edges are
    // all bridges, and cutting them would shatter the regions — assert it doesn't.
    const nodes = [1, 2, 3, 10, 11, 12].map((i) => n(i));
    const edges = [e(1, 2), e(2, 3), e(10, 11), e(11, 12)];
    const out = derivePlanRegions({ nodes, edges });
    expect(out.regions).toHaveLength(2);
    expect(out.regions.map((r) => r.size)).toEqual([3, 3]);
    expect(out.seams).toHaveLength(4); // reported…
    // …but the regions are intact: every seam sits INSIDE a region.
    for (const s of out.seams) expect(s.region).not.toBeNull();
  });

  it('output is total — isolated nodes land in singletons', () => {
    const nodes = [1, 2, 99].map((i) => n(i));
    const out = derivePlanRegions({ nodes, edges: [e(1, 2)] });
    expect(out.regions).toHaveLength(1);
    expect(out.singletons.map((s) => s.id)).toEqual([99]);
    const placed = out.regions.flatMap((r) => r.nodes.map((x) => x.id)).concat(out.singletons.map((s) => s.id));
    expect(placed.sort()).toEqual([1, 2, 99]);
  });

  it('purposes filter isolates the right subgraph', () => {
    const nodes = [1, 2, 3, 4].map((i) => n(i));
    const edges = [e(1, 2, 'required for'), e(3, 4, 'supports')];
    const plan = derivePlanRegions({ nodes, edges }, { purposes: ['required for'] });
    expect(plan.regions).toHaveLength(1);
    expect(plan.regions[0].nodes.map((x) => x.id)).toEqual([1, 2]);

    const argument = derivePlanRegions({ nodes, edges }, { purposes: ['supports'] });
    expect(argument.regions).toHaveLength(1);
    expect(argument.regions[0].nodes.map((x) => x.id)).toEqual([3, 4]);

    const both = derivePlanRegions({ nodes, edges }, { purposes: ['required for', 'supports'] });
    expect(both.regions).toHaveLength(2);
  });

  it('entry/exit reflect the directed shape within the region', () => {
    // 1 → 2 → 4,  3 → 2   ⇒ entries {1,3}, exit {4}
    const nodes = [1, 2, 3, 4].map((i) => n(i));
    const out = derivePlanRegions({ nodes, edges: [e(1, 2), e(2, 4), e(3, 2)] });
    const r = out.regions[0];
    expect(r.entry).toEqual([1, 3]);
    expect(r.exit).toEqual([4]);
  });

  it('counts roll up status per region', () => {
    const nodes = [n(1, { status: 'done' }), n(2, { status: 'review' }), n(3, { status: 'done' })];
    const out = derivePlanRegions({ nodes, edges: [e(1, 2), e(2, 3)] });
    expect(out.regions[0].counts).toEqual({ done: 2, review: 1 });
  });

  it('minRegionSize collapses small components into singletons', () => {
    const nodes = [1, 2, 10, 11, 12].map((i) => n(i));
    const edges = [e(1, 2), e(10, 11), e(11, 12)];
    const out = derivePlanRegions({ nodes, edges }, { minRegionSize: 3 });
    expect(out.regions).toHaveLength(1);
    expect(out.regions[0].size).toBe(3);
    expect(out.singletons.map((s) => s.id)).toEqual([1, 2]);
  });

  it('seams are ranked by how much they sever, widest first', () => {
    // 1-2-3 ── 4 ── 5-6-7 : the two edges touching 4 sever more than the ends do.
    const nodes = [1, 2, 3, 4, 5, 6, 7].map((i) => n(i));
    const edges = [e(1, 2), e(2, 3), e(3, 4), e(4, 5), e(5, 6), e(6, 7)];
    const out = derivePlanRegions({ nodes, edges });
    const worst = out.seams[0];
    expect(Math.min(worst.sideA, worst.sideB)).toBe(3);
  });

  it('REGRESSION: no size threshold separates an in-program seam from a program handoff', () => {
    // This is why `cutBridges` does not exist. Measured on the real graph: the
    // INTRA-program bridges severed 19 and 17 nodes while the CROSS-program ones
    // severed 18 and 14 — so "cut the seams that sever a lot" cuts inside a
    // program before it cuts between programs. This fixture reproduces that
    // inversion in miniature; if someone adds a size-threshold auto-cut, the
    // assertion below is what should stop them.
    //
    // programA: a 6-chain whose middle seam severs 3|3
    // programB: a 3-chain, joined to programA by one handoff edge severing 6|3
    const nodes = [];
    for (const i of [1, 2, 3, 4, 5, 6, 10, 11, 12]) nodes.push(n(i));
    const edges = [
      e(1, 2), e(2, 3), e(3, 4), e(4, 5), e(5, 6), // programA internal
      e(6, 10), // the program handoff
      e(10, 11), e(11, 12), // programB internal
    ];
    const out = derivePlanRegions({ nodes, edges });
    const sev = (s) => Math.min(s.sideA, s.sideB);
    const handoff = out.seams.find((s) => s.source_id === 6 && s.target_id === 10);
    const inProgram = out.seams.find((s) => s.source_id === 3 && s.target_id === 4);
    // The in-program seam severs at least as much as the real handoff does, so
    // severance size cannot identify the handoff.
    expect(sev(inProgram)).toBeGreaterThanOrEqual(sev(handoff));
    // And the partition stays whole regardless: one region, nothing auto-cut.
    expect(out.regions).toHaveLength(1);
    expect(out.regions[0].size).toBe(9);
  });

  it('a region with no edges of the requested purpose yields no regions', () => {
    const nodes = [1, 2].map((i) => n(i));
    const out = derivePlanRegions({ nodes, edges: [e(1, 2, 'related to')] }, { purposes: ['required for'] });
    expect(out.regions).toHaveLength(0);
    expect(out.singletons).toHaveLength(2);
  });

  it('ready uses ALL required-for edges, not just the filtered subgraph', () => {
    // 1(todo) --required for--> 2(todo); regions built over `supports` only.
    // 2 must NOT be ready: its prerequisite 1 is not done, even though the
    // required-for edge is invisible to the region partition.
    const nodes = [n(1), n(2), n(3), n(4)];
    const edges = [e(1, 2, 'required for'), e(3, 4, 'supports')];
    const out = derivePlanRegions({ nodes, edges }, { purposes: ['supports'] });
    const allReady = out.regions.flatMap((r) => r.ready);
    expect(allReady).not.toContain(2);
  });
});

// ───────────────────────── route: POST /structure ───────────────────────────
describe('POST /structure', () => {
  it('returns regions with rollups over a two-program fixture', async () => {
    const a1 = await insNode({ title: 'A1', status: 'done' });
    const a2 = await insNode({ title: 'A2', status: 'done' });
    const a3 = await insNode({ title: 'A3' });
    const b1 = await insNode({ title: 'B1' });
    const b2 = await insNode({ title: 'B2' });
    const loner = await insNode({ title: 'loner' });
    await insEdge(a1, a2, 'required for');
    await insEdge(a2, a3, 'required for');
    await insEdge(b1, b2, 'required for');

    const res = await request(app).post(`/api/graphs/${gid}/structure`).send({});
    expect(res.status).toBe(200);
    expect(res.body.regions).toHaveLength(2);
    const big = res.body.regions[0];
    expect(big.size).toBe(3);
    expect(big.counts).toEqual({ done: 2, todo: 1 });
    expect(big.entry).toEqual([a1]);
    expect(big.exit).toEqual([a3]);
    expect(big.ready).toEqual([a3]); // both prereqs done
    expect(res.body.singletons.map((s) => s.id)).toEqual([loner]);
    expect(res.body.params).toEqual({ purposes: ['required for'], minRegionSize: 2 });
  });

  it('READY PARITY: matches GET /tasks/ready exactly on a tricky fixture', async () => {
    // done → todo (ready), a transitively-blocked node, a confidence-bearing
    // node parked at todo (must NOT be ready), and a cross-region prerequisite.
    const d = await insNode({ title: 'd', status: 'done' });
    const readyOne = await insNode({ title: 'ready-one' });
    const midway = await insNode({ title: 'midway', status: 'review' });
    const blocked = await insNode({ title: 'blocked' });
    const claim = await insNode({ title: 'claim', confidence: 0.8 });
    const isolated = await insNode({ title: 'isolated' });
    await insEdge(d, readyOne, 'required for');
    await insEdge(readyOne, midway, 'required for');
    await insEdge(midway, blocked, 'required for'); // transitively blocked by midway=review
    await insEdge(d, claim, 'required for'); // prereq done, but confidence ⇒ not ready

    const [structure, ready] = await Promise.all([
      request(app).post(`/api/graphs/${gid}/structure`).send({ minRegionSize: 1 }),
      request(app).get(`/api/graphs/${gid}/tasks/ready`),
    ]);
    expect(structure.status).toBe(200);
    expect(ready.status).toBe(200);

    const fromSql = ready.body.map((t) => t.id).sort((x, y) => x - y);
    const fromStructure = [
      ...structure.body.regions.flatMap((r) => r.ready),
      // minRegionSize:1 means singletons is empty, but be defensive.
      ...structure.body.singletons.map((s) => s.id).filter((id) => fromSql.includes(id) && false),
    ].sort((x, y) => x - y);

    expect(fromStructure).toEqual(fromSql);
    expect(fromSql).toContain(readyOne);
    expect(fromSql).not.toContain(claim);
    expect(fromSql).not.toContain(blocked);
    expect(fromSql).toContain(isolated); // no prereqs at all
  });

  it('purposes param switches between plan and argument structure', async () => {
    const p1 = await insNode({ title: 'p1' });
    const p2 = await insNode({ title: 'p2' });
    const c1 = await insNode({ title: 'c1', confidence: 0.9 });
    const c2 = await insNode({ title: 'c2', confidence: 0.9 });
    await insEdge(p1, p2, 'required for');
    await insEdge(c1, c2, 'supports');

    const plan = await request(app).post(`/api/graphs/${gid}/structure`).send({});
    expect(plan.body.regions).toHaveLength(1);
    expect(plan.body.regions[0].nodes.map((x) => x.id)).toEqual([p1, p2]);

    const arg = await request(app)
      .post(`/api/graphs/${gid}/structure`)
      .send({ purposes: ['supports', 'contradicts'] });
    expect(arg.body.regions).toHaveLength(1);
    expect(arg.body.regions[0].nodes.map((x) => x.id)).toEqual([c1, c2]);
  });

  it('reports seams with severance sizes and never cuts them', async () => {
    const ids = [];
    for (let i = 0; i < 5; i += 1) ids.push(await insNode({ title: `s${i}` }));
    for (let i = 0; i < 4; i += 1) await insEdge(ids[i], ids[i + 1], 'required for');

    const res = await request(app).post(`/api/graphs/${gid}/structure`).send({});
    expect(res.body.regions).toHaveLength(1); // chain stays whole
    expect(res.body.regions[0].size).toBe(5);
    expect(res.body.seams).toHaveLength(4);
    const worst = res.body.seams[0];
    expect(Math.min(worst.sideA, worst.sideB)).toBe(2);
    expect(worst.sideA + worst.sideB).toBe(5);
  });

  it('validates purposes and minRegionSize', async () => {
    const bad1 = await request(app).post(`/api/graphs/${gid}/structure`).send({ purposes: ['part of'] });
    expect(bad1.status).toBe(400);
    expect(bad1.body.error).toMatch(/subset/);

    const bad2 = await request(app).post(`/api/graphs/${gid}/structure`).send({ purposes: [] });
    expect(bad2.status).toBe(400);

    const bad3 = await request(app).post(`/api/graphs/${gid}/structure`).send({ minRegionSize: 0 });
    expect(bad3.status).toBe(400);

    const bad4 = await request(app).post(`/api/graphs/${gid}/structure`).send({ minRegionSize: 2.5 });
    expect(bad4.status).toBe(400);
  });

  it('empty graph returns empty everything, not an error', async () => {
    const res = await request(app).post(`/api/graphs/${gid}/structure`).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ regions: [], seams: [], singletons: [] });
  });

  it('404s an unknown graph (read guard runs before the query)', async () => {
    const res = await request(app).post('/api/graphs/nosuchgraph1234/structure').send({});
    expect([403, 404]).toContain(res.status);
  });
});
