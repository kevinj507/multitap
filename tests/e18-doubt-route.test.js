// E18.3 STEP 3 — POST /api/graphs/:gid/doubt.
//
// The two things most likely to be quietly wrong, and both are attacked here:
//
//   * NOTHING MAY AUTO-FLIP A STATUS. Asserted directly, not by inspection:
//     graphs.version, every tasks.updated_at, every node's meta, and
//     MAX(events.seq) are captured before the call and compared after.
//   * THE ANCHOR GATE MUST NOT SILENCE ITS OWN TRIGGER. Reusing E18.2's
//     ['claim.verified','claim.refuted'] allowlist makes a refutation its own
//     anchor by EQUALITY and the refuted node vanishes off the front it just
//     triggered. The regression has its own name below.
//
// Timestamps are explicit throughout (the e17-decisions.test.js:41 idiom),
// never sleep(). src/db.js is imported inside beforeAll, never at module scope.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
// Pure module: reaches no database.
import { DEFAULT_PROPAGATION_WEIGHTS, TRAVERSAL_PURPOSES } from '../src/doubt.js';

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
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-doubt') RETURNING id");
  gid = g.rows[0].id;
  resetDerivedCache();
});

// ── fixtures ────────────────────────────────────────────────────────────────

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const doubtUrl = (g = gid) => `/api/graphs/${g}/doubt`;
const tasksUrl = (g = gid) => `/api/graphs/${g}/tasks`;
const verifyUrl = (id, g = gid) => `/api/graphs/${g}/tasks/${id}/verify`;

async function mkNode(title, extra = {}) {
  const res = await request(app).post(tasksUrl()).send({ content: node({ title, status: 'review', ...extra }) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

async function mkEdge(source, target, purpose = 'supports', meta = undefined) {
  const res = await request(app).post(`/api/graphs/${gid}/edges`)
    .send({ source_id: source, target_id: target, purpose, ...(meta ? { meta } : {}) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

const doubt = async (body = {}, g = gid) => {
  const res = await request(app).post(doubtUrl(g)).send(body);
  return res;
};

const idsOf = (res) => res.body.doubt.map((d) => d.id);
const itemOf = (res, id) => res.body.doubt.find((d) => d.id === id);

// ── the anchor gate ─────────────────────────────────────────────────────────

describe('E18.3 the anchor gate — "since it was last verified or decided"', () => {
  it('THE SELF-SILENCING REGRESSION: a refuted node is on its OWN doubt front', async () => {
    // Adding 'claim.refuted' to ANCHOR_KINDS makes this fail, and that is the
    // whole point of the test. The refutation is the trigger; if it were also
    // the anchor, `trigger.seq > anchor.seq` would be `n > n` — false — and the
    // node would silence itself off the front it just triggered.
    const a = await mkNode('A claim', { confidence: 0.8 });
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await doubt();
    expect(res.status).toBe(200);
    expect(idsOf(res)).toContain(a);
    expect(itemOf(res, a).hops).toBe(0);
    // It had never been verified, so the refutation cleared nothing: source none.
    expect(itemOf(res, a).anchor.source).toBe('none');
    expect(res.body.model.anchor_kinds).toEqual(['claim.verified', 'decision.made']);
  });

  it('a claim.verified AFTER the trigger takes the node off the front, and moves nothing else', async () => {
    const a = await mkNode('A claim', { confidence: 0.8 });
    const b = await mkNode('B rests on A', { confidence: 0.7 });
    const c = await mkNode('C rests on B', { confidence: 0.7 });
    await mkEdge(a, b, 'supports');
    await mkEdge(b, c, 'supports');
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const before = await doubt();
    expect(idsOf(before).sort()).toEqual([a, b, c].sort());

    // Re-check B — AFTER the refutation, so B's anchor now postdates it.
    await request(app).post(verifyUrl(b)).send({ outcome: 'held', happened_at: '2026-09-02T00:00:00.000Z' });

    const after = await doubt();
    expect(idsOf(after)).not.toContain(b);
    // A and C are untouched: C still rests on A THROUGH B, and re-verifying B
    // is not a statement about C.
    expect(idsOf(after).sort()).toEqual([a, c].sort());
    expect(itemOf(after, c).anchor.source).toBe('none');
  });

  it('decision.made is an anchor; decision.reopened is NOT', async () => {
    // Reopening a decision WITHDRAWS a commitment; it does not renew one. A
    // negative event is never a reassurance.
    const a = await mkNode('A claim', { confidence: 0.8 });
    const d = await mkNode('D decision', { type: 'decision', status: 'done' });
    await mkEdge(a, d, 'required for');
    // Decide, then reopen: the LAST positive anchor is the decision.made.
    await request(app).patch(`${tasksUrl()}/${d}`)
      .send({ content: node({ title: 'D decision', type: 'decision', status: 'done', decided_at: '2026-05-01T00:00:00.000Z' }) });
    const anchored = await pool.query(
      `SELECT seq FROM events WHERE graph_id = $1 AND payload->'kinds' ? 'decision.made' ORDER BY seq DESC LIMIT 1`, [gid]);
    const decideSeq = Number(anchored.rows[0].seq);

    await request(app).patch(`${tasksUrl()}/${d}`)
      .send({ content: node({ title: 'D decision', type: 'decision', status: 'done', decided_at: null }) });

    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await doubt();
    const item = itemOf(res, d);
    expect(item).toBeTruthy();
    // The anchor is still the decision.made — the reopen did not become one.
    expect(item.anchor.kind).toBe('decision.made');
    expect(item.anchor.seq).toBe(decideSeq);
    expect(item.anchor.source).toBe('event');
  });

  it('the anchor.source matrix: event / scalar / none', async () => {
    const trigger = await mkNode('T', { confidence: 0.8 });
    const withEvent = await mkNode('has an event', { confidence: 0.7 });
    const withScalar = await mkNode('has only a scalar', { confidence: 0.7, verified_at: '2020-01-01T00:00:00.000Z' });
    const withNothing = await mkNode('has neither', { confidence: 0.7 });
    for (const t of [withEvent, withScalar, withNothing]) await mkEdge(trigger, t, 'required for');
    // Verify one of them BEFORE the trigger, so it has an event anchor but is
    // still on the front (its anchor seq is lower than the trigger's).
    await request(app).post(verifyUrl(withEvent)).send({ outcome: 'held', happened_at: '2026-01-01T00:00:00.000Z' });
    await request(app).post(verifyUrl(trigger)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await doubt();
    expect(itemOf(res, withEvent).anchor).toMatchObject({ source: 'event', kind: 'claim.verified' });
    expect(itemOf(res, withEvent).anchor.seq).toBeGreaterThan(0);
    // The scalar-only node: seq 0, because we do not know WHEN WE LEARNED a
    // pre-log verification and cannot claim it postdates anything. The world
    // time survives, which is what verified_after_in_world needs.
    expect(itemOf(res, withScalar).anchor).toMatchObject({
      source: 'scalar', seq: 0, happened_at: '2020-01-01T00:00:00.000Z',
    });
    expect(itemOf(res, withNothing).anchor).toMatchObject({ source: 'none', seq: 0, happened_at: null });
  });
});

// ── backdating: the axes disagree, and the disagreement is the signal ───────

describe('E18.3 backdating — why the gate is BELIEF time', () => {
  it('a world-March weakening learned TODAY surfaces a world-June verification', async () => {
    const a = await mkNode('Old terms', { confidence: 0.9 });
    // Verified in world-June, and we learned it in June too.
    await request(app).post(verifyUrl(a)).send({ outcome: 'held', happened_at: '2026-06-01T00:00:00.000Z' });
    // The correction describes MARCH; we learn of it now. Backdated weakenings
    // are the NORMAL case for this feature.
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-03-01T00:00:00.000Z' });

    const learned = await doubt();
    const item = itemOf(learned, a);
    expect(item).toBeTruthy();
    // Reported, never filtering: our last check was of a LATER world than the
    // weakening describes, so it MAY already have accounted for it.
    expect(item.verified_after_in_world).toBe(true);
    expect(learned.body.params.axis).toBe('learned');

    // The same question on the world axis answers differently — and the two
    // axes are ALLOWED to disagree; the fold's standing rule is that they must
    // not be reconciled.
    const happened = await doubt({ axis: 'happened' });
    expect(idsOf(happened)).not.toContain(a);
    expect(happened.body.params.axis).toBe('happened');
  });

  it('rejects an unknown axis and an unknown scope with 400', async () => {
    expect((await doubt({ axis: 'wall-clock' })).status).toBe(400);
    expect((await doubt({ scope: 'everything' })).status).toBe(400);
  });
});

// ── supersession: excluded as an item, retained as a conductor ──────────────

describe('E18.3 supersession — a SEED, never a wall', () => {
  async function supersededCluster() {
    const a = await mkNode('A (old fact)', { confidence: 0.9 });
    const b = await mkNode('B rests on A', { confidence: 0.8 });
    const f = await mkNode('F (the successor)', { confidence: 0.9 });
    await mkEdge(a, b, 'supports');
    await mkEdge(f, a, 'supersedes');    // emits node.superseded on A
    return { a, b, f };
  }

  it('the superseded node is ABSENT as an item and PRESENT as a hop in its dependents chains', async () => {
    const { a, b } = await supersededCluster();
    const res = await doubt();
    expect(idsOf(res)).not.toContain(a);
    expect(idsOf(res)).toContain(b);
    const hop = itemOf(res, b).cause.hops[0];
    expect(hop).toMatchObject({ from: a, to: b, purpose: 'supports', from_superseded: true });
  });

  it('includeSuperseded brings the ITEM back and leaves the dependents IDENTICAL', async () => {
    // The conductor path is not flag-controlled. If it ever becomes so, the
    // acceptance scenario returns nothing.
    const { a, b } = await supersededCluster();
    const off = await doubt();
    const on = await doubt({ includeSuperseded: true });
    expect(idsOf(on)).toContain(a);
    expect(itemOf(on, a).superseded).toBe(true);
    expect(itemOf(on, b)).toEqual(itemOf(off, b));
    expect(on.body.params.includeSuperseded).toBe(true);
  });

  it('the trigger names the successor, so the remedy is one click from the answer', async () => {
    const { a, f } = await supersededCluster();
    const res = await doubt();
    const trigger = res.body.triggers.find((t) => t.kind === 'supersession');
    expect(trigger).toMatchObject({ subject_id: a, superseded_by: f, magnitude: 1 });
    // cause_id is the edge event that opened it — E18.4 attached it for exactly
    // this, and `cause_id < seq` is a CHECK.
    expect(trigger.cause_id).toBeLessThan(trigger.seq);
  });
});

// ── nothing auto-flips ──────────────────────────────────────────────────────

describe('E18.3 SURFACE-ONLY — the route cannot flip a status because it never writes one', () => {
  it('graphs.version, every tasks row and MAX(events.seq) are unchanged across a call', async () => {
    const a = await mkNode('A', { confidence: 0.8 });
    const d = await mkNode('D', { type: 'decision', status: 'done' });
    await mkEdge(a, d, 'required for');
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const snapshot = async () => ({
      graph: (await pool.query('SELECT version, updated_at FROM graphs WHERE id = $1', [gid])).rows[0],
      tasks: (await pool.query(
        'SELECT id, meta, content, updated_at, version FROM tasks WHERE graph_id = $1 ORDER BY id', [gid])).rows,
      head: Number((await pool.query('SELECT COALESCE(MAX(seq),0) s FROM events WHERE graph_id = $1', [gid])).rows[0].s),
    });

    const before = await snapshot();
    const res = await doubt();
    expect(res.status).toBe(200);
    // The decision surfaces WHILE status is done — status-independence is the
    // point, and the status stays exactly where it was.
    expect(itemOf(res, d).status).toBe('done');
    const after = await snapshot();
    expect(after).toEqual(before);
  });

  it('sets Cache-Control: no-store', async () => {
    const res = await doubt();
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

// ── transitive vs one-hop ───────────────────────────────────────────────────

describe('E18.3 transitive vs one-hop — the parity claim against E17', () => {
  it('scope:decisions is a transitive SUPERSET of what /decisions/at-risk sees one hop deep', async () => {
    // Ground -> claim -> decision. /decisions/at-risk sees only the DIRECT
    // ground of the decision; the doubt front walks the whole chain.
    const ground = await mkNode('Ground', { confidence: 0.9 });
    // Mid is FRESH and confident, so /decisions/at-risk has no one-hop reason
    // to flag `far` — the only thing that can reach it is the transitive walk.
    const mid = await mkNode('Mid', { confidence: 0.9, verified_at: new Date(Date.now() - 86400000).toISOString() });
    const near = await mkNode('Near ground', { confidence: 0.8 });
    const far = await mkNode('Far decision', { type: 'decision', status: 'done' });
    const nearDecision = await mkNode('Near decision', { type: 'decision', status: 'done' });
    await mkEdge(ground, mid, 'required for');
    await mkEdge(mid, far, 'required for');
    await mkEdge(near, nearDecision, 'required for');
    await request(app).post(verifyUrl(ground)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });
    await request(app).post(verifyUrl(near)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const atRisk = await request(app).post(`/api/graphs/${gid}/decisions/at-risk`).send({});
    const oneHop = atRisk.body.atRisk.map((d) => d.id);
    const transitive = idsOf(await doubt({ scope: 'decisions' }));

    // Both see the decision whose DIRECT ground was refuted...
    expect(oneHop).toContain(nearDecision);
    expect(transitive).toContain(nearDecision);
    // ...only the transitive walk reaches the one two hops away.
    expect(oneHop).not.toContain(far);
    expect(transitive).toContain(far);
    for (const id of transitive) expect([nearDecision, far]).toContain(id);
  });

  it('scope:nodes names the claims and excludes decisions; scope:all returns both', async () => {
    const a = await mkNode('A claim', { confidence: 0.8 });
    const b = await mkNode('B claim', { confidence: 0.8 });
    const d = await mkNode('D', { type: 'decision', status: 'todo' });
    await mkEdge(a, b, 'supports');
    await mkEdge(b, d, 'required for');
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const all = await doubt({ scope: 'all' });
    expect(idsOf(all).sort()).toEqual([a, b, d].sort());
    expect(itemOf(all, a).kind).toBe('claim');
    expect(itemOf(all, d).kind).toBe('decision');
    expect(idsOf(await doubt({ scope: 'nodes' })).sort()).toEqual([a, b].sort());
    expect(idsOf(await doubt({ scope: 'decisions' }))).toEqual([d]);
  });

  it('POST /decisions/at-risk is byte-identical to its pre-rung self on its own parameter sets', async () => {
    // This route is not touched by E18.3 — not one byte, not one params key —
    // so the check is cheap and total.
    const ground = await mkNode('Ground', { confidence: 0.2, verified_at: '2000-01-01T00:00:00.000Z' });
    const d = await mkNode('D', { type: 'decision', status: 'done' });
    await mkEdge(ground, d, 'required for');
    for (const body of [{}, { staleDays: 1 }, { lowConfidenceBelow: 0.9, maxResults: 5 }, { includeSuperseded: true }]) {
      const res = await request(app).post(`/api/graphs/${gid}/decisions/at-risk`).send(body);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['atRisk', 'params', 'truncated']);
      expect(Object.keys(res.body.params).sort())
        .toEqual(['includeSuperseded', 'lowConfidenceBelow', 'maxResults', 'staleDays']);
      expect(Object.keys(res.body.atRisk[0]).sort())
        .toEqual(['decided_at', 'id', 'importance', 'reasons', 'selfContradicted', 'status', 'title']);
      expect(Object.keys(res.body.atRisk[0].reasons[0]).sort()).toEqual(['id', 'kinds', 'title']);
    }
  });
});

// ── the weights, end to end ─────────────────────────────────────────────────

describe('E18.3 NO HARDCODED ATTENUATION — through the route', () => {
  async function chain() {
    const ids = [];
    for (let i = 0; i < 8; i += 1) ids.push(await mkNode(`n${i}`, { confidence: 0.8 }));
    for (let i = 0; i < 7; i += 1) await mkEdge(ids[i], ids[i + 1], 'supports');
    await request(app).post(verifyUrl(ids[0])).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });
    return ids;
  }

  it('the default weights are echoed in params, from the module and nowhere else', async () => {
    await chain();
    const res = await doubt();
    expect(res.body.params.weights).toEqual({ ...DEFAULT_PROPAGATION_WEIGHTS });
    expect(Object.keys(res.body.params.weights).sort()).toEqual([...TRAVERSAL_PURPOSES].sort());
  });

  it('A CALLER-SUPPLIED WEIGHT CHANGES THE FRONT', async () => {
    const ids = await chain();
    const dflt = await doubt();
    const pure = await doubt({ weights: { supports: 1 } });
    const steep = await doubt({ weights: { supports: 0.25 } });
    // 0.6^5 >= 0.05 > 0.6^6, so the default reaches five hops: n0..n5.
    expect(idsOf(dflt).sort()).toEqual(ids.slice(0, 6).sort());
    // No attenuation: the whole chain, every weight 1.
    expect(idsOf(pure).sort()).toEqual(ids.sort());
    expect(pure.body.doubt.every((d) => d.weight === 1)).toBe(true);
    // A steep ripple: 0.25^2 >= 0.05 > 0.25^3, so two hops.
    expect(idsOf(steep).sort()).toEqual(ids.slice(0, 3).sort());
    expect(steep.body.params.weights.supports).toBe(0.25);
  });

  it('A PER-EDGE meta.propagation OVERRIDES THE PER-REQUEST WEIGHT', async () => {
    const a = await mkNode('A', { confidence: 0.8 });
    const viaEdge = await mkNode('via a weighted edge', { confidence: 0.8 });
    const viaRequest = await mkNode('via the request weight', { confidence: 0.8 });
    await mkEdge(a, viaEdge, 'supports', { propagation: 0.9 });
    await mkEdge(a, viaRequest, 'supports');
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await doubt({ weights: { supports: 0.2 } });
    expect(itemOf(res, viaEdge).weight).toBeCloseTo(0.9, 10);
    expect(itemOf(res, viaRequest).weight).toBeCloseTo(0.2, 10);
    // The chain carries the per-hop weight that was actually applied.
    expect(itemOf(res, viaEdge).cause.hops[0].weight).toBeCloseTo(0.9, 10);
  });

  it('rejects a weight outside (0, 1] and an unknown purpose with 400, and answers nothing', async () => {
    for (const weights of [{ supports: 0 }, { supports: -1 }, { supports: 1.5 },
      { supports: '0.5' }, { contradicts: 0.5 }]) {
      const res = await doubt({ weights });
      expect(res.status).toBe(400);
      expect(res.body.doubt).toBeUndefined();
    }
    // A weight > 1 is what would let a `supports` cycle amplify without bound.
    expect((await doubt({ weights: { supports: 1 } })).status).toBe(200);
  });

  it('weightFloor and maxDepth are caller-owned and echoed', async () => {
    const ids = await chain();
    const deep = await doubt({ weightFloor: 1e-9, maxDepth: 64 });
    expect(idsOf(deep).sort()).toEqual(ids.sort());
    expect(deep.body.params.weightFloor).toBe(1e-9);
    const shallow = await doubt({ maxDepth: 2 });
    expect(idsOf(shallow).sort()).toEqual(ids.slice(0, 3).sort());
    expect(shallow.body.walk.stopped_by).toContain('depth');
    expect(shallow.body.truncated).toBe(true);
  });
});

// ── the item's numbers explain the item's chain ─────────────────────────────

describe('E18.3 a returned item is ONE statement: weight, hops and cause agree', () => {
  it('under maxDepth truncation the chain is the path the weight came from', async () => {
    // A -supports-> B (0.6) and A -required for-> C (1) at layer 1. At layer 2,
    // B relaxes to D from the 0.6 record and only THEN C improves B to 1.0 — so
    // B's parent pointer describes a better path than D's weight came from, and
    // D is corrected on layer 3. maxDepth 2 stops before that correction, and
    // the item must still be internally consistent: re-reading B's LIVE pointer
    // printed a 3-hop chain of product 1 beside "weight 0.6, hops 2".
    const a = await mkNode('A', { confidence: 0.8 });
    const b = await mkNode('B', { confidence: 0.8 });
    const c = await mkNode('C', { confidence: 0.8 });
    const d = await mkNode('D', { confidence: 0.8 });
    await mkEdge(a, b, 'supports');
    await mkEdge(a, c, 'required for');
    await mkEdge(b, d, 'required for');
    await mkEdge(c, b, 'required for');
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await doubt({ maxDepth: 2 });
    expect(res.status).toBe(200);
    expect(res.body.truncated).toBe(true);
    expect(res.body.walk.stopped_by).toContain('depth');

    const item = itemOf(res, d);
    expect(item.weight).toBeCloseTo(0.6, 10);
    expect(item.hops).toBe(2);
    expect(item.cause.hops.map((h) => h.from)).toEqual([a, b]);
    // The two numbers a reader acts on and the chain they are printed beside
    // are the SAME path: |chain| is the hop count, and the chain's own per-hop
    // weights multiply back to the weight.
    expect(item.cause.hops).toHaveLength(item.hops);
    expect(item.cause.hops.reduce((acc, h) => acc * h.weight, 1)).toBeCloseTo(item.weight, 10);

    // One layer deeper the walk finds the better path, and BOTH move together.
    const deeper = await doubt({ maxDepth: 3 });
    const better = itemOf(deeper, d);
    expect(better.weight).toBe(1);
    expect(better.hops).toBe(3);
    expect(better.cause.hops.map((h) => h.from)).toEqual([a, c, b]);
    expect(better.cause.hops).toHaveLength(better.hops);
  });

  it('EVERY returned item, on a graph with competing paths, at every depth', async () => {
    const ids = [];
    for (let i = 0; i < 6; i += 1) ids.push(await mkNode(`n${i}`, { confidence: 0.8 }));
    const [n0, n1, n2, n3, n4, n5] = ids;
    await mkEdge(n0, n1, 'supports');
    await mkEdge(n0, n2, 'required for');
    await mkEdge(n1, n3, 'required for');
    await mkEdge(n2, n1, 'required for');
    await mkEdge(n3, n4, 'supports');
    await mkEdge(n2, n5, 'supports');
    await mkEdge(n5, n3, 'required for');
    await request(app).post(verifyUrl(n0)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    for (const maxDepth of [1, 2, 3, 4, 12]) {
      const res = await doubt({ maxDepth });
      for (const item of res.body.doubt) {
        expect(item.cause.hops).toHaveLength(item.hops);
        expect(item.cause.hops.reduce((acc, h) => acc * h.weight, 1)).toBeCloseTo(item.weight, 10);
        for (let i = 1; i < item.cause.hops.length; i += 1) {
          expect(item.cause.hops[i].from).toBe(item.cause.hops[i - 1].to);
        }
        if (item.cause.hops.length) expect(item.cause.hops[0].from).toBe(n0);
        expect(item.cause.hops.at(-1)?.to ?? item.id).toBe(item.id);
      }
    }
  });

  it('a SUB-FLOOR SEED is filtered like everything else it would have doubted', async () => {
    // 0.9 -> 0.88 is magnitude 0.02, under the 0.05 default floor. It used to be
    // returned as an item while B — its dependent across a `required for` edge,
    // weight 1, so exactly as doubtful — was cut by the same floor. The front
    // showed a cause and hid its consequence.
    const a = await mkNode('A', { confidence: 0.9 });
    const b = await mkNode('B', { confidence: 0.8 });
    await mkEdge(a, b, 'required for');
    await request(app).patch(`${tasksUrl()}/${a}`)
      .send({ content: node({ title: 'A', status: 'review', confidence: 0.88 }) });

    const res = await doubt();
    expect(res.status).toBe(200);
    expect(res.body.doubt).toEqual([]);
    // The weakening is still REPORTED — it reached nothing at this floor, and
    // the response says which knob did it.
    expect(res.body.triggers).toHaveLength(1);
    expect(res.body.triggers[0]).toMatchObject({ kind: 'confidence_drop', subject_id: a, reached: 0 });
    expect(res.body.triggers[0].weight).toBeCloseTo(0.02, 10);
    expect(res.body.walk.stopped_by).toContain('floor');
    expect(res.body.walk.nodes_visited).toBe(0);
    expect(res.body.params.weightFloor).toBe(0.05);

    // And the floor is the caller's: lower it and BOTH come back together.
    const all = await doubt({ weightFloor: 1e-9 });
    expect(idsOf(all).sort()).toEqual([a, b].sort());
    expect(itemOf(all, a).weight).toBeCloseTo(0.02, 10);
    expect(itemOf(all, b).weight).toBeCloseTo(0.02, 10);
  });
});

// ── termination on a real cyclic graph ──────────────────────────────────────

describe('E18.3 a `supports` cycle in the DATABASE terminates with no attenuation', () => {
  it('A -> B -> C -> A at weight 1, floor removed, depth 256', async () => {
    const a = await mkNode('A', { confidence: 0.8 });
    const b = await mkNode('B', { confidence: 0.8 });
    const c = await mkNode('C', { confidence: 0.8 });
    await mkEdge(a, b, 'supports');
    await mkEdge(b, c, 'supports');
    await mkEdge(c, a, 'supports');   // storable: `supports` derives type=related
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await doubt({ weights: { supports: 1 }, weightFloor: 1e-9, maxDepth: 256 });
    expect(res.status).toBe(200);
    expect(idsOf(res).sort()).toEqual([a, b, c].sort());
    expect(res.body.truncated).toBe(false);
    expect(res.body.walk.stopped_by).toEqual([]);
    expect(res.body.walk.max_depth_reached).toBeLessThan(256);
  });
});

// ── triggers, chains and truncation ─────────────────────────────────────────

describe('E18.3 the response envelope', () => {
  it('reports every trigger with its reach, and the seed weight source', async () => {
    const a = await mkNode('A', { confidence: 0.8 });
    const b = await mkNode('B', { confidence: 0.8 });
    await mkEdge(a, b, 'required for');
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await doubt();
    expect(res.body.triggers).toHaveLength(1);
    expect(res.body.triggers[0]).toMatchObject({
      kind: 'refutation', magnitude: 1, weight: 1, weight_source: 'magnitude',
      subject_id: a, subject_title: 'A', reached: 2,
    });
    expect(res.body.model.head_seq).toBeGreaterThan(0);
    expect(res.body.walk.nodes_visited).toBe(2);
  });

  it('a confidence DROP seeds at its magnitude; a confidence RISE seeds nothing', async () => {
    const a = await mkNode('A', { confidence: 0.9 });
    const b = await mkNode('B', { confidence: 0.8 });
    await mkEdge(a, b, 'required for');

    await request(app).patch(`${tasksUrl()}/${a}`).send({ content: node({ title: 'A', status: 'review', confidence: 0.4 }) });
    const dropped = await doubt();
    expect(dropped.body.triggers.map((t) => t.kind)).toEqual(['confidence_drop']);
    expect(dropped.body.triggers[0].weight).toBeCloseTo(0.5, 10);
    expect(itemOf(dropped, b).weight).toBeCloseTo(0.5, 10);

    await request(app).patch(`${tasksUrl()}/${a}`).send({ content: node({ title: 'A', status: 'review', confidence: 0.95 }) });
    const risen = await doubt({ since: dropped.body.model.head_seq });
    expect(risen.body.triggers).toEqual([]);
    expect(risen.body.doubt).toEqual([]);
  });

  it('`since` narrows the trigger window', async () => {
    const a = await mkNode('A', { confidence: 0.8 });
    const b = await mkNode('B', { confidence: 0.8 });
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });
    const mark = (await doubt()).body.model.head_seq;
    await request(app).post(verifyUrl(b)).send({ outcome: 'failed', happened_at: '2026-09-02T00:00:00.000Z' });

    expect(idsOf(await doubt()).sort()).toEqual([a, b].sort());
    expect(idsOf(await doubt({ since: mark }))).toEqual([b]);
    expect((await doubt({ since: -1 })).status).toBe(400);
  });

  it('maxResults truncates and says so; the chain is present on every returned item', async () => {
    const a = await mkNode('A', { confidence: 0.8 });
    const kids = [];
    for (let i = 0; i < 5; i += 1) kids.push(await mkNode(`k${i}`, { confidence: 0.8 }));
    for (const k of kids) await mkEdge(a, k, 'required for');
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await doubt({ maxResults: 3 });
    expect(res.body.doubt).toHaveLength(3);
    expect(res.body.truncated).toBe(true);
    for (const item of res.body.doubt) {
      expect(item.cause).toMatchObject({ truncated: false, omitted_hops: 0 });
      expect(Array.isArray(item.cause.hops)).toBe(true);
    }
    expect((await doubt({ maxResults: 0 })).status).toBe(400);
    expect((await doubt({ maxResults: 1.5 })).status).toBe(400);
  });

  it('two triggers reaching one item report an exact trigger_count and the stronger chain', async () => {
    const a = await mkNode('A', { confidence: 0.8 });
    const b = await mkNode('B', { confidence: 0.8 });
    const target = await mkNode('both reach me', { confidence: 0.8 });
    await mkEdge(a, target, 'required for');   // weight 1
    await mkEdge(b, target, 'supports');       // weight 0.6
    await request(app).post(verifyUrl(a)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });
    await request(app).post(verifyUrl(b)).send({ outcome: 'failed', happened_at: '2026-09-01T00:00:00.000Z' });

    const res = await doubt();
    const item = itemOf(res, target);
    expect(item.trigger_count).toBe(2);
    expect(item.weight).toBe(1);
    expect(item.cause.hops[0].from).toBe(a);
  });
});

// ── the read gate ───────────────────────────────────────────────────────────

describe('E18.3 the read gate, mirroring /graph', () => {
  async function makeUser(pid) {
    return (await pool.query(
      `INSERT INTO users (provider, provider_user_id, email, display_name)
       VALUES ('test-header', $1, $2, $1) RETURNING *`, [pid, `${pid}@test.local`])).rows[0];
  }
  const post = (g, user) => {
    const r = request(app).post(doubtUrl(g));
    return user ? r.set('X-Test-User-Id', user).send({}) : r.send({});
  };

  it('owner 200, viewer-member 200, stranger 403, anon 403, anon-viewer 200, legacy 200', async () => {
    const owner = await makeUser('doubt-owner');
    const viewer = await makeUser('doubt-viewer');
    await makeUser('doubt-stranger');
    const restricted = (await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('r', $1, 'none') RETURNING id`, [owner.id])).rows[0].id;
    await pool.query('INSERT INTO graph_members (graph_id, user_id, role) VALUES ($1,$2,$3)', [restricted, viewer.id, 'viewer']);

    expect((await post(restricted, 'doubt-owner')).status).toBe(200);
    expect((await post(restricted, 'doubt-viewer')).status).toBe(200);
    expect((await post(restricted, 'doubt-stranger')).status).toBe(403);
    expect((await post(restricted)).status).toBe(403);

    const open = (await pool.query(
      `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('o', $1, 'viewer') RETURNING id`, [owner.id])).rows[0].id;
    expect((await post(open)).status).toBe(200);

    expect((await post(gid)).status).toBe(200);              // legacy owner-less
    expect((await post('nope404nope404xx')).status).toBe(404);
  });
});

// ── the seed read is BOUNDED ─────────────────────────────────────────────────
//
// The route keeps the newest `maxTriggers` (32) weakenings and throws the rest
// away. It used to FETCH the rest first: `SEEDS_SQL` had no LIMIT, so at the
// default `since: 0` it matched — and deserialised into Node — every
// field.set / claim.refuted / node.superseded event the graph had ever
// recorded. The work was thrown away and grew without bound with the log.
//
// Two things have to hold at once, and they pull against each other:
//
//   * the read must be BOUNDED, which the row-counting test below pins; and
//   * it must return the SAME ANSWER as the unbounded read, which the sparse
//     test pins. The naive bound — one `ORDER BY seq DESC LIMIT 32` — fails
//     that one, because the SQL predicate is a PREFILTER and not the
//     definition: it matches every title edit, and weakening() is what decides.
//     Reproduced before the fix: 40 confidence drops buried under 100 later
//     title edits yield 0 seeds under a naive LIMIT and 32 under the real read.
describe('E18.3 the seed read is bounded and the answer is unchanged', () => {
  let dbPool;

  beforeAll(async () => {
    dbPool = (await import('../src/db.js')).default;
  });

  // Raw event rows, so a long log is cheap to build. `drop` writes the
  // confidence change weakening() classifies as a confidence_drop; otherwise a
  // plain title field.set, which the SQL prefilter matches and weakening()
  // discards — the whole reason a naive LIMIT is wrong.
  async function bulkEvents(n, { drop, subject, startSeq }) {
    const payload = drop
      ? `jsonb_build_object('kinds', jsonb_build_array('field.set'), 'changes',
           jsonb_build_object('meta.confidence', jsonb_build_object('from', 0.9, 'to', 0.4)))`
      : `jsonb_build_object('kinds', jsonb_build_array('field.set'), 'changes',
           jsonb_build_object('meta.title', jsonb_build_object('from', 'a', 'to', 'b')))`;
    await pool.query(
      `INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind,
                           subject_kind, subject_id, txid, payload)
       SELECT $1, $2 + g, NOW(), NOW(), '{"type":"system"}'::jsonb, 'node.patched',
              'node', $3, 0, ${payload}
         FROM generate_series(1, $4) g`,
      [gid, startSeq, subject, n],
    );
  }

  const headOf = async () => Number((await pool.query(
    'SELECT COALESCE(MAX(seq),0) s FROM events WHERE graph_id = $1', [gid])).rows[0].s);

  // Count the event rows the SEED read actually pulls into Node. The fragment
  // is SEEDS_SQL's stripped-payload projection, which no other query in the
  // route uses.
  async function seedRowsPulled(body = {}) {
    const orig = dbPool.query;
    let rows = 0;
    dbPool.query = async function counting(text, params) {
      const r = await orig.call(this, text, params);
      if (typeof text === 'string' && text.includes("payload #- '{changes,content}'")) {
        rows += r.rows.length;
      }
      return r;
    };
    let res;
    try {
      res = await doubt(body);
    } finally {
      dbPool.query = orig;
    }
    expect(res.status).toBe(200);
    return { rows, res };
  }

  it('500 weakenings, cap 32: the read does not pull the whole log into Node', async () => {
    const a = await mkNode('A claim', { confidence: 0.9 });
    await bulkEvents(500, { drop: true, subject: a, startSeq: await headOf() });

    const { rows, res } = await seedRowsPulled();
    // 33 is what settles the answer: 32 triggers plus the one extra row that
    // PROVES truncation. Generous room for a growth step, and still nowhere
    // near the 500+ the unbounded read pulled.
    expect(rows).toBeLessThanOrEqual(64);
    expect(res.body.triggers.length).toBe(32);
    expect(res.body.truncated).toBe(true);
    expect(res.body.walk.stopped_by).toContain('trigger_cap');
    // `trigger_count` is the triggers this answer is built from — always the
    // length of `triggers`, never a number the bounded read cannot know.
    expect(res.body.model.trigger_count).toBe(res.body.triggers.length);
  });

  it('a raised maxTriggers raises the bound with it — the cap is what bounds it', async () => {
    const a = await mkNode('A claim', { confidence: 0.9 });
    await bulkEvents(500, { drop: true, subject: a, startSeq: await headOf() });

    const small = await seedRowsPulled({ maxTriggers: 5 });
    const large = await seedRowsPulled({ maxTriggers: 200 });
    expect(small.res.body.triggers.length).toBe(5);
    expect(large.res.body.triggers.length).toBe(200);
    expect(small.rows).toBeLessThan(large.rows);
    expect(small.rows).toBeLessThanOrEqual(16);
    expect(large.rows).toBeLessThanOrEqual(400);
  });

  it('THE PREFILTER IS NOT THE PREDICATE: 40 drops under 1000 later title edits still give the newest 32 drops', async () => {
    const a = await mkNode('A claim', { confidence: 0.9 });
    const base = await headOf();
    await bulkEvents(40, { drop: true, subject: a, startSeq: base });
    await bulkEvents(1000, { drop: false, subject: a, startSeq: base + 40 });

    const { rows, res } = await seedRowsPulled();
    const seqs = res.body.triggers.map((t) => t.seq);
    // Exactly the newest 32 of the 40 real weakenings — the same answer the
    // unbounded read gave, reached without reading all 1040 rows.
    expect(seqs.length).toBe(32);
    expect(seqs[0]).toBe(base + 9);
    expect(seqs[seqs.length - 1]).toBe(base + 40);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    expect(res.body.truncated).toBe(true);
    // AND THE HONEST COST OF BEING RIGHT: when the weakenings are the OLDEST
    // events under a thousand later title edits, a newest-first read has to
    // reach all the way down to find 33 of them, so this shape reads the whole
    // range — the same rows the unbounded read took, in a few pages instead of
    // one query. Correctness first; the bound pays where weakenings are recent,
    // which is the shape a live graph's doubt front actually has.
    expect(rows).toBe(1040);
  });

  it('under the cap nothing is truncated and every weakening is still a trigger', async () => {
    const a = await mkNode('A claim', { confidence: 0.9 });
    const base = await headOf();
    await bulkEvents(7, { drop: true, subject: a, startSeq: base });
    await bulkEvents(50, { drop: false, subject: a, startSeq: base + 7 });

    const res = await doubt();
    expect(res.status).toBe(200);
    expect(res.body.triggers.map((t) => t.seq)).toEqual(
      Array.from({ length: 7 }, (_, i) => base + 1 + i),
    );
    expect(res.body.truncated).toBe(false);
    expect(res.body.walk.stopped_by).not.toContain('trigger_cap');
    expect(res.body.model.trigger_count).toBe(7);
  });

  it('`since` still bounds the window from below, and the page respects it', async () => {
    const a = await mkNode('A claim', { confidence: 0.9 });
    const base = await headOf();
    await bulkEvents(100, { drop: true, subject: a, startSeq: base });

    const res = await doubt({ since: base + 95 });
    expect(res.status).toBe(200);
    expect(res.body.triggers.map((t) => t.seq)).toEqual([96, 97, 98, 99, 100].map((n) => base + n));
    expect(res.body.truncated).toBe(false);
  });
});
