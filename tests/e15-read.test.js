// E15 read-side tests (plan node T-read #2628). Covers B1 (metadata filters on
// /search + /context, incl. the bridge rule), B2 (re-verification frontier),
// B3 (signed-cycle inconsistency scan), plus the B1+B2+B3 CHAIN that gates done.
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
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e15read') RETURNING id");
  gid = g.rows[0].id;
});

// Insert a node with explicit meta, returning its id. Content + meta JSONB are
// kept consistent the way the routes would write them.
async function insNode(meta) {
  const m = { status: 'todo', ...meta };
  const fm = Object.entries(m).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
  const content = `---\n${fm}\n---\n${m.body || ''}`;
  const { rows } = await pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id`,
    [gid, content, JSON.stringify(m)],
  );
  return rows[0].id;
}
// Insert an edge with a purpose (and the derived type), as the route would.
async function insEdge(source, target, purpose) {
  const type = purpose === 'required for' ? 'dependency' : 'related';
  await pool.query(
    `INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1,$2,$3,$4::edge_type,$5)`,
    [gid, source, target, type, purpose],
  );
}

const ISO_STALE = '2000-01-01T00:00:00Z';
const ISO_FRESH = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

// ───────────────────────── B1: filter DSL (pure) ───────────────────────────
describe('B1 compileFilter (pure)', () => {
  it('flat object = implicit AND; comparators + $ne/$in/$nin', () => {
    const f = compileFilter({ confidence: { $gte: 0.7 }, type: { $ne: 'reference' } });
    expect(f.error).toBeUndefined();
    expect(f.match({ confidence: 0.8, type: 'claim' })).toBe(true);
    expect(f.match({ confidence: 0.6, type: 'claim' })).toBe(false); // fails confidence
    expect(f.match({ confidence: 0.9, type: 'reference' })).toBe(false); // fails type
  });
  it('Mongo absent-field semantics', () => {
    // comparators fail an absent field; $ne / $nin match it.
    expect(compileFilter({ confidence: { $gte: 0.5 } }).match({})).toBe(false);
    expect(compileFilter({ type: { $ne: 'reference' } }).match({})).toBe(true);
    expect(compileFilter({ type: { $nin: ['reference'] } }).match({})).toBe(true);
    expect(compileFilter({ type: { $in: ['reference'] } }).match({})).toBe(false);
  });
  it('datetime comparison is chronological', () => {
    const f = compileFilter({ verified_at: { $lt: '2026-01-01T00:00:00Z' } });
    expect(f.match({ verified_at: '2025-06-01T00:00:00Z' })).toBe(true);
    expect(f.match({ verified_at: '2026-06-01T00:00:00Z' })).toBe(false);
  });
  it('$and / $or', () => {
    const f = compileFilter({ $or: [{ confidence: { $gte: 0.9 } }, { type: { $eq: 'reference' } }] });
    expect(f.match({ confidence: 0.95 })).toBe(true);
    expect(f.match({ type: 'reference' })).toBe(true);
    expect(f.match({ confidence: 0.4 })).toBe(false);
  });
  it('bare value = implicit $eq', () => {
    expect(compileFilter({ status: 'review' }).match({ status: 'review' })).toBe(true);
    expect(compileFilter({ status: 'review' }).match({ status: 'todo' })).toBe(false);
  });
  it('invalid filter → error', () => {
    expect(compileFilter({ confidence: { $weird: 1 } }).error).toMatch(/unknown operator/);
    expect(compileFilter({ $and: 'nope' }).error).toMatch(/\$and/);
    expect(compileFilter(42).error).toMatch(/object/);
  });
  it('absent/null filter = match-all', () => {
    expect(compileFilter(undefined).match({})).toBe(true);
    expect(compileFilter(null).match({ anything: 1 })).toBe(true);
  });
});

// ───────────────────────── B1: /search post-filter ─────────────────────────
describe('B1 /search metadata filter', () => {
  it('filters candidates by meta without touching ranking; invalid → 400; absent → unchanged', async () => {
    const hi = await insNode({ title: 'Selenium supply outlook', confidence: 0.9, body: 'selenium demand' });
    const lo = await insNode({ title: 'Selenium rumor outlook', confidence: 0.3, body: 'selenium demand' });
    const search = (filter) => request(app).post(`/api/graphs/${gid}/search`).send({ query: 'selenium', ...(filter !== undefined ? { filter } : {}) });

    const all = await search();
    expect(all.status).toBe(200);
    const allIds = all.body.results.map((r) => Number(r.taskId));
    expect(allIds).toEqual(expect.arrayContaining([hi, lo]));

    const filtered = await search({ confidence: { $gte: 0.7 } });
    expect(filtered.status).toBe(200);
    const ids = filtered.body.results.map((r) => Number(r.taskId));
    expect(ids).toContain(hi);
    expect(ids).not.toContain(lo);
    // Relative order of survivors is unchanged vs the unfiltered ranking.
    const survivorsInAll = allIds.filter((id) => ids.includes(id));
    expect(ids).toEqual(survivorsInAll);

    const bad = await search({ confidence: { $bogus: 1 } });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/invalid filter/);
  });
});

// ───────────────────────── B1: /context bridge rule ────────────────────────
describe('B1 /context filter + bridge rule', () => {
  it('retains a low-confidence node bridging two matching nodes; unfiltered is byte-identical', async () => {
    const m1 = await insNode({ title: 'Foundation A', confidence: 0.9 });
    const bridge = await insNode({ title: 'Shaky middle', confidence: 0.3 });
    const m2 = await insNode({ title: 'Foundation B', confidence: 0.9 });
    const dangling = await insNode({ title: 'Loose end', confidence: 0.2 });
    await insEdge(m1, bridge, 'related to');
    await insEdge(bridge, m2, 'related to');
    await insEdge(m1, dangling, 'related to'); // dangling: only 1 matching neighbor

    const ctx = (filter) => request(app).post(`/api/graphs/${gid}/context`)
      .send({ seeds: [m1], hops: 2, maxNodes: 30, edgeTypes: null, ...(filter ? { filter } : {}) });

    const unfiltered = await ctx();
    expect(unfiltered.status).toBe(200);
    // Pre-B1 node shape: no meta / bridge keys when no filter is given.
    expect(unfiltered.body.nodes.every((n) => !('meta' in n) && !('bridge' in n))).toBe(true);
    expect(unfiltered.body.nodes.map((n) => n.id).sort()).toEqual([m1, bridge, m2, dangling].sort());

    const filtered = await ctx({ confidence: { $gte: 0.7 } });
    expect(filtered.status).toBe(200);
    const byId = new Map(filtered.body.nodes.map((n) => [n.id, n]));
    expect(byId.has(m1)).toBe(true);
    expect(byId.has(m2)).toBe(true);
    expect(byId.has(bridge)).toBe(true); // RETAINED — filter did NOT prune traversal
    expect(byId.get(bridge).bridge).toBe(true);
    expect(byId.get(m1).bridge).toBeUndefined();
    expect(byId.has(dangling)).toBe(false); // only 1 matching neighbor → dropped
    expect(byId.get(m1).meta.confidence).toBe(0.9); // meta surfaced when filtering
  });
});

// ───────────────────────── B2: frontier ────────────────────────────────────
describe('B2 re-verification frontier', () => {
  it('ranks a stale high-OUT-degree foundation in; excludes a stale high-IN-degree leaf', async () => {
    // Foundation supports/required-for 4 theses → out-degree 4.
    const foundation = await insNode({ title: 'Macro foundation', confidence: 0.9, verified_at: ISO_STALE });
    for (let i = 0; i < 4; i++) {
      const thesis = await insNode({ title: `Thesis ${i}` }); // plain task, out of scope
      await insEdge(foundation, thesis, i % 2 ? 'supports' : 'required for');
    }
    // Leaf has 3 references pointing INTO it → in-degree 3, out-degree 0.
    const leaf = await insNode({ title: 'Margin datapoint', confidence: 0.9, verified_at: ISO_STALE });
    for (let i = 0; i < 3; i++) {
      const ref = await insNode({ title: `Ref ${i}`, type: 'reference', confidence: 0.9, verified_at: ISO_FRESH });
      await insEdge(ref, leaf, 'supports');
    }

    const res = await request(app).post(`/api/graphs/${gid}/frontier`).send({});
    expect(res.status).toBe(200);
    const ids = res.body.frontier.map((f) => f.id);
    expect(ids).toContain(foundation); // out-degree 4 ≥ 2 and stale
    expect(ids).not.toContain(leaf); // out-degree 0 < 2 (would be IN-degree 3 under the wrong direction)
    expect(res.body.frontier[0].id).toBe(foundation);
    expect(res.body.frontier[0].importance).toBe(4);
    expect(res.body.frontier[0].stale).toBe(true);
  });

  it('treats absent verified_at as stale; respects param overrides; excludes plain tasks', async () => {
    const f = await insNode({ title: 'Never-verified claim', confidence: 0.8 }); // no verified_at
    const g1 = await insNode({ title: 'rests A' });
    const g2 = await insNode({ title: 'rests B' });
    await insEdge(f, g1, 'supports');
    await insEdge(f, g2, 'supports'); // out-degree 2

    const hit = await request(app).post(`/api/graphs/${gid}/frontier`).send({});
    expect(hit.body.frontier.map((x) => x.id)).toContain(f);
    expect(hit.body.frontier.find((x) => x.id === f).stale).toBe(true);

    // Raise minImportance above its out-degree → excluded.
    const none = await request(app).post(`/api/graphs/${gid}/frontier`).send({ minImportance: 3 });
    expect(none.body.frontier.map((x) => x.id)).not.toContain(f);
    expect(none.body.params.minImportance).toBe(3);

    // A bad param is a 400.
    const bad = await request(app).post(`/api/graphs/${gid}/frontier`).send({ lowConfidenceBelow: 2 });
    expect(bad.status).toBe(400);
  });

  it('fresh, high-confidence, load-bearing node is NOT on the frontier', async () => {
    const fresh = await insNode({ title: 'Recently checked', confidence: 0.9, verified_at: ISO_FRESH });
    const a = await insNode({ title: 'x' });
    const b = await insNode({ title: 'y' });
    await insEdge(fresh, a, 'supports');
    await insEdge(fresh, b, 'supports');
    const res = await request(app).post(`/api/graphs/${gid}/frontier`).send({});
    expect(res.body.frontier.map((x) => x.id)).not.toContain(fresh);
  });
});

// ───────────────────────── B3: inconsistency (pure + route) ─────────────────
describe('B3 signed inconsistency scan (pure)', () => {
  const E = (s, t, p) => ({ source: s, target: t, purpose: p });

  it('flags an odd-contradicts directed cycle', () => {
    // A supports B, B supports C, C contradicts A → 1 contradicts = odd.
    const { inconsistencies } = findSignedInconsistencies([E(1, 2, 'supports'), E(2, 3, 'supports'), E(3, 1, 'contradicts')]);
    expect(inconsistencies.length).toBe(1);
    expect(inconsistencies[0].contradicts).toBe(1);
    expect(inconsistencies[0].balanced).toBe(false);
  });
  it('does NOT flag a balanced (even-contradicts) cycle', () => {
    // A contradicts B, B contradicts A → 2 contradicts = even = balanced.
    const { inconsistencies } = findSignedInconsistencies([E(1, 2, 'contradicts'), E(2, 1, 'contradicts')]);
    expect(inconsistencies).toEqual([]);
  });
  it('does NOT flag a pure-supports cycle (circular reasoning, not contradiction)', () => {
    const { inconsistencies } = findSignedInconsistencies([E(1, 2, 'supports'), E(2, 3, 'supports'), E(3, 1, 'supports')]);
    expect(inconsistencies).toEqual([]);
  });
  it('directed-only: an undirected-only triangle with no directed cycle is not flagged', () => {
    // A→B, A→C, B→C: undirected triangle, but no directed cycle back to any start.
    const { inconsistencies } = findSignedInconsistencies([E(1, 2, 'supports'), E(1, 3, 'contradicts'), E(2, 3, 'supports')]);
    expect(inconsistencies).toEqual([]);
  });
  it('ignores required for / related to edges entirely', () => {
    const { inconsistencies, scanned } = findSignedInconsistencies([
      E(1, 2, 'required for'), E(2, 1, 'related to'), E(1, 3, 'supports'), E(3, 1, 'contradicts'),
    ]);
    expect(inconsistencies.length).toBe(1); // only the 1↔3 signed loop
    expect(scanned.edges).toBe(2); // only the signed edges were scanned
  });
  it('dedups rotations (each directed cycle reported once)', () => {
    const { inconsistencies } = findSignedInconsistencies([E(1, 2, 'supports'), E(2, 3, 'contradicts'), E(3, 1, 'supports')]);
    expect(inconsistencies.length).toBe(1);
  });
  it('respects maxCycles with truncated', () => {
    // Two independent odd loops; cap to 1 → truncated.
    const edges = [
      E(1, 2, 'supports'), E(2, 1, 'contradicts'), // loop 1 (odd)
      E(3, 4, 'supports'), E(4, 3, 'contradicts'), // loop 2 (odd)
    ];
    const { inconsistencies, truncated } = findSignedInconsistencies(edges, { maxCycles: 1 });
    expect(inconsistencies.length).toBe(1);
    expect(truncated).toBe(true);
  });
});

describe('B3 /inconsistencies route', () => {
  it('graph-wide catches an odd loop; per-claim is bounded to cycles through start', async () => {
    const a = await insNode({ title: 'A', confidence: 0.8 });
    const b = await insNode({ title: 'B', confidence: 0.8 });
    const c = await insNode({ title: 'C', confidence: 0.8 });
    const x = await insNode({ title: 'X (uninvolved)', confidence: 0.8 });
    await insEdge(a, b, 'supports');
    await insEdge(b, c, 'supports');
    await insEdge(c, a, 'contradicts'); // odd loop a→b→c→a

    const wide = await request(app).post(`/api/graphs/${gid}/inconsistencies`).send({});
    expect(wide.status).toBe(200);
    expect(wide.body.mode).toBe('graph');
    expect(wide.body.inconsistencies.length).toBe(1);
    expect(wide.body.inconsistencies[0].contradicts).toBe(1);

    const claim = await request(app).post(`/api/graphs/${gid}/inconsistencies`).send({ start: a });
    expect(claim.body.mode).toBe('claim');
    expect(claim.body.inconsistencies.length).toBe(1);

    const none = await request(app).post(`/api/graphs/${gid}/inconsistencies`).send({ start: x });
    expect(none.body.inconsistencies).toEqual([]);

    const missing = await request(app).post(`/api/graphs/${gid}/inconsistencies`).send({ start: 999999 });
    expect(missing.status).toBe(404);
  });
});

// ───────────── CHAIN (T-read #2628 done-gate for B1 + B2 + B3) ──────────────
describe('CHAIN: read-side endpoints answer together over one populated graph', () => {
  it('filtered /search + filtered /context (bridge) + frontier + inconsistency all correct', async () => {
    // A small research graph: two high-confidence findings bridged by a shaky
    // intermediate, a stale load-bearing foundation, and a contradiction loop.
    const f1 = await insNode({ title: 'Tungsten supply tightens', confidence: 0.9, verified_at: ISO_FRESH, body: 'tungsten' });
    const shaky = await insNode({ title: 'Tungsten rumor', confidence: 0.3, verified_at: ISO_FRESH, body: 'tungsten' });
    const f2 = await insNode({ title: 'Tungsten price rises', confidence: 0.85, verified_at: ISO_FRESH, body: 'tungsten' });
    const foundation = await insNode({ title: 'China export policy', confidence: 0.8, verified_at: ISO_STALE, body: 'policy' });

    await insEdge(f1, shaky, 'related to');
    await insEdge(shaky, f2, 'related to');
    await insEdge(foundation, f1, 'supports');
    await insEdge(foundation, f2, 'supports'); // foundation out-degree 2

    // A contradiction loop among three claims.
    const c1 = await insNode({ title: 'Claim one', confidence: 0.7, verified_at: ISO_FRESH });
    const c2 = await insNode({ title: 'Claim two', confidence: 0.7, verified_at: ISO_FRESH });
    await insEdge(c1, c2, 'supports');
    await insEdge(c2, c1, 'contradicts'); // odd loop

    // 1) filtered /search: high-confidence tungsten findings only.
    const s = await request(app).post(`/api/graphs/${gid}/search`).send({ query: 'tungsten', filter: { confidence: { $gte: 0.8 } } });
    const sIds = s.body.results.map((r) => Number(r.taskId));
    expect(sIds).toEqual(expect.arrayContaining([f1, f2]));
    expect(sIds).not.toContain(shaky);

    // 2) filtered /context from f1: shaky retained as a bridge to f2.
    const ctx = await request(app).post(`/api/graphs/${gid}/context`)
      .send({ seeds: [f1], hops: 2, edgeTypes: null, filter: { confidence: { $gte: 0.8 } } });
    const cMap = new Map(ctx.body.nodes.map((n) => [n.id, n]));
    expect(cMap.has(f1) && cMap.has(f2)).toBe(true);
    expect(cMap.get(shaky)?.bridge).toBe(true);

    // 3) frontier: the stale load-bearing foundation surfaces; fresh findings do not.
    const fr = await request(app).post(`/api/graphs/${gid}/frontier`).send({ minImportance: 2 });
    const frIds = fr.body.frontier.map((x) => x.id);
    expect(frIds).toContain(foundation);
    expect(frIds).not.toContain(f1);

    // 4) inconsistency: the c1↔c2 odd loop is flagged.
    const inc = await request(app).post(`/api/graphs/${gid}/inconsistencies`).send({});
    expect(inc.body.inconsistencies.length).toBe(1);
    const loopNodes = inc.body.inconsistencies[0].nodes.sort();
    expect(loopNodes).toEqual([c1, c2].sort());
  });
});
