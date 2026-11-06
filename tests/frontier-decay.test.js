// E18.2 STEP 5 — /frontier v2: rational decay, and the back-compat gate.
//
// The claim most likely to be quietly wrong is "nothing moves for a graph that
// has no verification data", so this file attacks it three ways, in increasing
// strength:
//
//   (i)   ALGEBRAIC — R(t) = (1 + t/(9S))^-1 hits 0.9 exactly at t = S, so with
//         S_INIT := staleDays and rThreshold := 0.9 the new gate IS the old
//         one. Pinned in tests/e18-stability.test.js.
//   (ii)  EMPIRICAL — the v1 SQL is re-run INSIDE this file as the golden, over
//         the same five parameter sets the production-clone harness uses, and
//         the route's answer must deep-equal it.
//   (iii) STRUCTURAL — PATH A runs today's query OBJECT. A spy on pool.query
//         asserts the v1 SQL text is what actually executed, so no argument
//         about float boundaries or sort collations can reach that path.
//
// The second half is the CHAIN test the rung's Done-when names: a claim that
// has survived repeated spaced re-checks must take LONGER to come back to the
// frontier than one verified once, and a failed check must put it straight back
// at the top. Timestamps are explicit throughout (the e17-decisions.test.js:41
// idiom) — never sleep().
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { isDue, retrievability } from '../src/events/stability.js';

let app;
let pool;
let dbPool;
let gid;
let resetDerivedCache;

const DAY = 86400000;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  dbPool = (await import('../src/db.js')).default;
  resetDerivedCache = (await import('../src/derivedCache.js'))._resetDerivedCacheForTests;
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-frontier') RETURNING id");
  gid = g.rows[0].id;
  // The stability cache is keyed `graphId:verify:<headSeq>` and survives the
  // per-test TRUNCATE, which RESTARTs identities — so two tests would otherwise
  // share an entry. Same rule tests/e18-derived-cache.test.js spells out.
  resetDerivedCache();
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const frontierUrl = (g = gid) => `/api/graphs/${g}/frontier`;

// Insert a node with NO route involvement, exactly as e17-decisions.test.js
// does. It still emits `node.created` (capture is a row trigger), but never a
// verification event — which is the state most real graphs are in.
async function insNode(meta) {
  const m = { status: 'review', ...meta };
  const { rows } = await pool.query(
    'INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id',
    [gid, node(m), JSON.stringify(m)],
  );
  return rows[0].id;
}
async function insEdge(source, target, purpose = 'supports') {
  const type = purpose === 'required for' ? 'dependency' : 'related';
  await pool.query(
    'INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1,$2,$3,$4::edge_type,$5)',
    [gid, source, target, type, purpose],
  );
}
// Give `id` enough out-degree to clear minImportance.
async function makeLoadBearing(id, n = 3) {
  for (let i = 0; i < n; i += 1) {
    const leaf = await insNode({ title: `leaf-${id}-${i}` });
    await insEdge(id, leaf, 'supports');
  }
}
async function verify(id, outcome, happenedAt, extra = {}) {
  const res = await request(app)
    .post(`/api/graphs/${gid}/tasks/${id}/verify`)
    .send({ outcome, happened_at: happenedAt, ...extra });
  expect(res.status).toBe(200);
  return res.body;
}
const post = (body = {}) => request(app).post(frontierUrl()).send(body);

// ── the v1 golden ───────────────────────────────────────────────────────────
// A verbatim copy of the query /frontier ran before E18.2. It lives here so the
// comparison is against the OLD code, not against a restatement of the new
// code's intent.
const V1_GOLDEN = `WITH deg AS (
         SELECT t.id,
                (SELECT count(*) FROM edges e
                  WHERE e.source_id = t.id AND e.graph_id = $1
                    AND e.purpose IN ('required for', 'supports')) AS out_deg
           FROM tasks t WHERE t.graph_id = $1
       ),
       imp AS (
         SELECT d.id,
                d.out_deg + COALESCE(
                  (SELECT sum(dd.out_deg) FROM edges e
                     JOIN tasks td ON td.id = e.target_id
                     JOIN deg dd ON dd.id = e.target_id
                    WHERE e.source_id = d.id AND e.graph_id = $1
                      AND e.purpose IN ('required for', 'supports')
                      AND td.meta->>'type' = 'decision'), 0) AS importance
           FROM deg d
       )
       SELECT t.id, i.importance,
              (t.meta->>'verified_at' IS NULL
                OR (t.meta->>'verified_at')::timestamptz < NOW() - ($3 || ' days')::interval) AS stale,
              (t.meta->>'confidence' IS NOT NULL
                AND (t.meta->>'confidence')::numeric < $4) AS low_confidence
         FROM tasks t
         JOIN imp i ON i.id = t.id
        WHERE t.graph_id = $1
          AND (t.meta->>'confidence' IS NOT NULL OR t.meta->>'type' = 'reference')
          AND i.importance >= $2
          AND (
                t.meta->>'verified_at' IS NULL
                OR (t.meta->>'verified_at')::timestamptz < NOW() - ($3 || ' days')::interval
                OR (t.meta->>'confidence' IS NOT NULL AND (t.meta->>'confidence')::numeric < $4)
          )
        ORDER BY i.importance DESC,
                 (t.meta->>'significance')::numeric DESC NULLS LAST,
                 (t.meta->>'verified_at') ASC NULLS FIRST, t.id ASC
        LIMIT $5`;

// The same five parameter sets the production-clone harness sweeps.
const PARAM_SETS = [
  { minImportance: 2, staleDays: 90, lowConfidenceBelow: 0.5, maxResults: 500 },
  { minImportance: 0, staleDays: 90, lowConfidenceBelow: 0.5, maxResults: 500 },
  { minImportance: 0, staleDays: 30, lowConfidenceBelow: 0.8, maxResults: 500 },
  { minImportance: 1, staleDays: 365, lowConfidenceBelow: 0.5, maxResults: 500 },
  { minImportance: 0, staleDays: 90, lowConfidenceBelow: 0.5, maxResults: 50 },
];

async function golden(p) {
  const { rows } = await pool.query(V1_GOLDEN, [
    gid, p.minImportance, String(p.staleDays), p.lowConfidenceBelow, p.maxResults + 1,
  ]);
  return rows.slice(0, p.maxResults).map((r) => [r.id, Number(r.importance), r.stale, r.low_confidence]);
}
const shape = (body) => body.frontier.map((f) => [f.id, f.importance, f.stale, f.lowConfidence]);

const ago = (days) => new Date(Date.now() - days * DAY).toISOString();

// A spread of nodes that exercises every branch of the v1 predicate.
async function seedCorpus() {
  const ids = {};
  ids.staleHigh = await insNode({ title: 'stale foundation', confidence: 0.9, significance: 0.9, verified_at: ago(400) });
  ids.freshHigh = await insNode({ title: 'fresh foundation', confidence: 0.9, significance: 0.4, verified_at: ago(3) });
  ids.never = await insNode({ title: 'never verified', confidence: 0.7 });
  ids.lowConf = await insNode({ title: 'shaky but fresh', confidence: 0.2, verified_at: ago(1) });
  ids.ref = await insNode({ title: 'a link', type: 'reference', verified_at: ago(200) });
  ids.refFresh = await insNode({ title: 'a fresh link', type: 'reference', verified_at: ago(2) });
  ids.noSig = await insNode({ title: 'no significance', confidence: 0.6, verified_at: ago(120) });
  ids.plain = await insNode({ title: 'plain work node' });        // outside the population
  ids.decision = await insNode({ title: 'a decision', type: 'decision', confidence: 0.8, verified_at: ago(500) });
  for (const key of ['staleHigh', 'freshHigh', 'never', 'lowConf', 'ref', 'noSig', 'decision']) {
    await makeLoadBearing(ids[key], key === 'staleHigh' ? 4 : 2);
  }
  await insEdge(ids.noSig, ids.decision, 'supports');   // E17 inherited importance
  return ids;
}

// ─────────────────────────── (iii) STRUCTURAL ───────────────────────────────

describe('E18.2 frontier — PATH A runs TODAY’S query, verbatim', () => {
  it('a graph with events but ZERO verification events takes the scalar path', async () => {
    await seedCorpus();
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM events WHERE graph_id = $1', [gid]);
    expect(rows[0].n).toBeGreaterThan(0);          // there IS a log
    const spy = vi.spyOn(dbPool, 'query');
    try {
      const res = await post({});
      expect(res.status).toBe(200);
      expect(res.body.model.mode).toBe('scalar');
      expect(res.body.model.verified_nodes).toBe(0);
      expect(res.body.model.head_seq).toBeGreaterThan(0);
      // THE STRUCTURAL GUARANTEE: the v1 SQL string is what executed.
      const texts = spy.mock.calls.map((c) => (typeof c[0] === 'string' ? c[0] : c[0]?.text ?? ''));
      const v1 = texts.filter((t) => t.includes("(t.meta->>'verified_at') ASC NULLS FIRST"));
      expect(v1).toHaveLength(1);
      expect(v1[0]).toContain('LIMIT $5');
      expect(v1[0]).toContain("AND (t.meta->>'confidence' IS NOT NULL OR t.meta->>'type' = 'reference')");
      // ...and the decay path's unfiltered candidate query did NOT run.
      expect(texts.some((t) => t.includes("t.meta->'decay'"))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('an empty log takes PATH A with head_seq null', async () => {
    // No rows at all -> no events at all.
    const res = await post({});
    expect(res.status).toBe(200);
    expect(res.body.model).toEqual({ mode: 'scalar', head_seq: null, verified_nodes: 0 });
    expect(res.body.frontier).toEqual([]);
  });

  it('PATH A still reports every new field, with empty checks', async () => {
    const ids = await seedCorpus();
    const res = await post({ minImportance: 0 });
    const row = res.body.frontier.find((f) => f.id === ids.staleHigh);
    expect(row.checks).toEqual({ held: 0, failed: 0, deliberate: 0, last_at: null, last_outcome: null });
    expect(row.stability).toBe(90);
    expect(row.decays).toBe(true);
    expect(row.refuted_at).toBeNull();
    expect(row.r).toBeCloseTo(retrievability(400, 90), 6);
    expect(row.due_at).toBe(new Date(Date.parse(row.verified_at) + 90 * DAY).toISOString());
    // A node outside the decay population never reaches the frontier at all.
    expect(res.body.frontier.some((f) => f.id === ids.plain)).toBe(false);
  });
});

// ─────────────────────────── (ii) EMPIRICAL ─────────────────────────────────

describe('E18.2 frontier — the v2 answer deep-equals the v1 golden', () => {
  it('PATH A: identical over all five parameter sets', async () => {
    await seedCorpus();
    for (const p of PARAM_SETS) {
      const res = await post(p);
      expect(res.status).toBe(200);
      expect(res.body.model.mode).toBe('scalar');
      expect(shape(res.body)).toEqual(await golden(p));
    }
  });

  it('PATH B: identical when every verified_at came from ONE PATCH per node', async () => {
    // A single hold sets S = S_INIT = staleDays, so the decay path reproduces
    // the scalar path NODE BY NODE, at every staleDays a caller may ask for.
    // This is the honest version of the back-compat claim: it is asserted on
    // the path that actually does the new work, not only on the one that runs
    // the old SQL.
    //
    // The nodes are created WITHOUT verified_at and the scalar is PATCHed in
    // afterwards, because the trigger emits claim.verified only when the value
    // actually MOVES — re-asserting the same timestamp is a no-op, by design.
    const withVerified = {
      staleHigh: { title: 'stale foundation', confidence: 0.9, significance: 0.9, at: 400, deg: 4 },
      freshHigh: { title: 'fresh foundation', confidence: 0.9, significance: 0.4, at: 3, deg: 2 },
      ref: { title: 'a link', type: 'reference', at: 200, deg: 2 },
      refFresh: { title: 'a fresh link', type: 'reference', at: 2, deg: 0 },
      noSig: { title: 'no significance', confidence: 0.6, at: 120, deg: 2 },
    };
    const ids = {};
    ids.never = await insNode({ title: 'never verified', confidence: 0.7 });
    ids.lowConf = await insNode({ title: 'shaky but fresh', confidence: 0.2, verified_at: ago(1) });
    ids.plain = await insNode({ title: 'plain work node' });
    await makeLoadBearing(ids.never, 2);
    await makeLoadBearing(ids.lowConf, 2);
    for (const [key, spec] of Object.entries(withVerified)) {
      const { at, deg, ...meta } = spec;
      const id = await insNode(meta);
      ids[key] = id;
      if (deg) await makeLoadBearing(id, deg);
      const res = await request(app)
        .patch(`/api/graphs/${gid}/tasks/${id}`)
        .send({ content: node({ status: 'review', ...meta, verified_at: ago(at) }) });
      expect(res.status).toBe(200);
    }
    const verified = await pool.query(
      "SELECT count(*)::int AS n FROM events WHERE graph_id = $1 AND payload->'kinds' ? 'claim.verified'",
      [gid],
    );
    expect(verified.rows[0].n).toBe(Object.keys(withVerified).length);

    for (const p of PARAM_SETS) {
      const res = await post(p);
      expect(res.status).toBe(200);
      expect(res.body.model.mode).toBe('decay');          // the new path really ran
      expect(res.body.model.verified_nodes).toBe(5);
      expect(shape(res.body)).toEqual(await golden(p));   // ...and agrees exactly
      // S is S_INIT for every one of them — one hold each.
      for (const row of res.body.frontier) expect(row.stability).toBe(p.staleDays);
    }
  });

  it('a LEGACY node inside PATH B keeps its v1 stale flag, r and position', async () => {
    const ids = await seedCorpus();
    // Only `never` gains verification events; every other node is legacy.
    await verify(ids.never, 'held', ago(10));
    const res = await post({ minImportance: 0 });
    expect(res.body.model.mode).toBe('decay');

    const g = await golden({ minImportance: 0, staleDays: 90, lowConfidenceBelow: 0.5, maxResults: 500 });
    const legacy = g.filter(([id]) => id !== ids.never);
    const got = shape(res.body).filter(([id]) => id !== ids.never);
    expect(got).toEqual(legacy);
    const stale = res.body.frontier.find((f) => f.id === ids.staleHigh);
    expect(stale.stability).toBe(90);                       // S_INIT, per node
    expect(stale.r).toBeCloseTo(retrievability(400, 90), 6);
  });
});

describe('E18.2 frontier — the staleDays boundary does not move', () => {
  it('the SQL interval test and isDue() agree across the boundary, at 0.0001-day steps', async () => {
    // In IEEE-754, R(t = S) < 0.9 is TRUE, so an R-domain gate would flip a
    // node verified exactly staleDays ago. The gate is in the time domain; this
    // is the proof that the two formulations still agree either side of it.
    const nowIso = new Date().toISOString();
    for (let k = -10; k <= 10; k += 1) {
      const offset = 90 + k * 0.0001;
      const at = new Date(Date.parse(nowIso) - offset * DAY).toISOString();
      const { rows } = await pool.query(
        "SELECT ($1::timestamptz < $2::timestamptz - ($3 || ' days')::interval) AS stale",
        [at, nowIso, '90'],
      );
      expect(isDue(offset, 90, { sInitDays: 90 })).toBe(rows[0].stale);
    }
    // ...including the exact boundary, where neither calls it stale.
    const { rows } = await pool.query(
      "SELECT ($1::timestamptz < $2::timestamptz - ($3 || ' days')::interval) AS stale",
      [new Date(Date.parse(nowIso) - 90 * DAY).toISOString(), nowIso, '90'],
    );
    expect(rows[0].stale).toBe(false);
    expect(isDue(90, 90, { sInitDays: 90 })).toBe(false);
  });

  it('a node two seconds inside the window is fresh; two seconds outside is stale', async () => {
    const inside = await insNode({ title: 'inside', confidence: 0.9, verified_at: new Date(Date.now() - 90 * DAY + 2000).toISOString() });
    const outside = await insNode({ title: 'outside', confidence: 0.9, verified_at: new Date(Date.now() - 90 * DAY - 2000).toISOString() });
    await makeLoadBearing(inside);
    await makeLoadBearing(outside);
    await verify(inside, 'held', new Date(Date.now() - 90 * DAY + 2000).toISOString());  // force PATH B

    const res = await post({ minImportance: 0 });
    expect(res.body.model.mode).toBe('decay');
    expect(res.body.frontier.some((f) => f.id === inside)).toBe(false);
    const out = res.body.frontier.find((f) => f.id === outside);
    expect(out.stale).toBe(true);
  });
});

describe('E18.2 frontier — decay: false is the opt-out, and it is not a mute button', () => {
  it('removes a node from the STALE term but never from lowConfidence', async () => {
    const fixed = await insNode({ title: 'a measured constant', confidence: 0.9, decay: false, verified_at: ago(900) });
    const fixedShaky = await insNode({ title: 'a shaky constant', confidence: 0.1, decay: false, verified_at: ago(900) });
    const normal = await insNode({ title: 'an ordinary claim', confidence: 0.9, verified_at: ago(900) });
    for (const id of [fixed, fixedShaky, normal]) await makeLoadBearing(id);

    const res = await post({ minImportance: 0 });
    // Carrying a `decay` key is enough to take the decay path: a shipped field
    // must not be a silent no-op on a graph that has no verification events.
    expect(res.body.model.mode).toBe('decay');

    expect(res.body.frontier.some((f) => f.id === fixed)).toBe(false);
    const shaky = res.body.frontier.find((f) => f.id === fixedShaky);
    expect(shaky.stale).toBe(false);
    expect(shaky.lowConfidence).toBe(true);
    expect(shaky.r).toBe(1);          // R pinned
    expect(shaky.due_at).toBeNull();
    expect(shaky.decays).toBe(false);
    const ord = res.body.frontier.find((f) => f.id === normal);
    expect(ord.stale).toBe(true);
    expect(ord.decays).toBe(true);
  });
});

// ─────────────────────────── THE CHAIN TEST ─────────────────────────────────

describe('E18.2 CHAIN — a repeatedly-confirmed claim takes longer to come back', () => {
  // Two claims of equal importance and significance. X is verified once; Y is
  // verified four times, each check landing exactly one S after the last, which
  // is the spacing that earns the reward. Both last held 100 days ago.
  async function buildPair() {
    const x = await insNode({ title: 'X — checked once', confidence: 0.9, significance: 0.5 });
    const y = await insNode({ title: 'Y — checked four times', confidence: 0.9, significance: 0.5 });
    await makeLoadBearing(x, 3);
    await makeLoadBearing(y, 3);
    // S: 90 -> 108 -> 129.6 -> 155.52; spacings are 90, 108, 129.6 days.
    const last = 100;
    const t4 = last;
    const t3 = t4 + 129.6;
    const t2 = t3 + 108;
    const t1 = t2 + 90;
    for (const d of [t1, t2, t3, t4]) await verify(y, 'held', ago(d));
    await verify(x, 'held', ago(last));
    return { x, y };
  }

  it('Y earns a wider window, and a longer time-to-surface', async () => {
    const { x, y } = await buildPair();
    const res = await post({ minImportance: 0, maxResults: 500 });
    expect(res.body.model.mode).toBe('decay');
    expect(res.body.model.verified_nodes).toBe(2);

    // X is due (age 100 > S 90) and therefore ON the frontier.
    const rowX = res.body.frontier.find((f) => f.id === x);
    expect(rowX).toBeDefined();
    expect(rowX.stale).toBe(true);
    expect(rowX.stability).toBe(90);
    expect(rowX.checks).toMatchObject({ held: 1, failed: 0, deliberate: 1 });

    // Y is NOT — its window is 155.52 days and only 100 have passed. That gap
    // IS the rung's whole claim.
    expect(res.body.frontier.some((f) => f.id === y)).toBe(false);

    // Read Y's derived state off a query that does surface it.
    const all = await post({ minImportance: 0, lowConfidenceBelow: 1, maxResults: 500 });
    const rowY = all.body.frontier.find((f) => f.id === y);
    expect(rowY.stability).toBeCloseTo(155.52, 2);
    expect(rowY.stability).toBeGreaterThan(rowX.stability);
    expect(rowY.checks).toMatchObject({ held: 4, failed: 0, deliberate: 4 });
    expect(rowY.stale).toBe(false);

    // due_at - verified_at: ~155.5 days for Y against exactly 90 for X.
    const windowDays = (row) => (Date.parse(row.due_at) - Date.parse(row.verified_at)) / DAY;
    expect(windowDays(rowY)).toBeCloseTo(155.52, 2);
    const rowXagain = all.body.frontier.find((f) => f.id === x);
    expect(windowDays(rowXagain)).toBeCloseTo(90, 6);
  });

  it('a FAILED check puts Y back at R = 0 and above X immediately', async () => {
    const { x, y } = await buildPair();
    await verify(y, 'failed', new Date().toISOString(), { confidence: 0.2 });

    const res = await post({ minImportance: 0, maxResults: 500 });
    const ids = res.body.frontier.map((f) => f.id);
    expect(ids).toContain(y);
    expect(ids.indexOf(y)).toBeLessThan(ids.indexOf(x));   // r ASC: 0 before X's
    const rowY = res.body.frontier.find((f) => f.id === y);
    expect(rowY.r).toBe(0);
    expect(rowY.stale).toBe(true);
    expect(rowY.verified_at).toBeNull();
    expect(rowY.refuted_at).not.toBeNull();
    // The window collapsed: min(S, S_INIT) * lapseFactor = 90 * 0.1.
    expect(rowY.stability).toBe(9);
    expect(rowY.checks).toMatchObject({ held: 4, failed: 1, last_outcome: 'failed' });

    // ...and v1's own query agrees, without knowing the word "refuted": a
    // cleared verified_at is stale to it too.
    const g = await golden({ minImportance: 0, staleDays: 90, lowConfidenceBelow: 0.5, maxResults: 500 });
    expect(g.find(([id]) => id === y)?.[2]).toBe(true);
  });

  it("rank: 'urgency' trades importance against R; rank: 'tiered' does not", async () => {
    // A low-importance claim that has never been checked (R = 0) against a
    // high-importance one that is fresh (R ~ 1) but low-confidence, so both are
    // on the frontier at once.
    const weakStale = await insNode({ title: 'weak but rotten', confidence: 0.9 });
    const strongFresh = await insNode({ title: 'strong but shaky', confidence: 0.1 });
    await makeLoadBearing(weakStale, 1);
    await makeLoadBearing(strongFresh, 8);
    await verify(strongFresh, 'held', new Date().toISOString());

    const tiered = await post({ minImportance: 0, rank: 'tiered', maxResults: 500 });
    const tIds = tiered.body.frontier.map((f) => f.id);
    expect(tiered.body.params.rank).toBe('tiered');
    expect(tIds.indexOf(strongFresh)).toBeLessThan(tIds.indexOf(weakStale));

    const urgency = await post({ minImportance: 0, rank: 'urgency', maxResults: 500 });
    const uIds = urgency.body.frontier.map((f) => f.id);
    expect(urgency.body.params.rank).toBe('urgency');
    expect(uIds.indexOf(weakStale)).toBeLessThan(uIds.indexOf(strongFresh));
  });

  it('rejects an unknown rank and an out-of-range rThreshold', async () => {
    expect((await post({ rank: 'whatever' })).status).toBe(400);
    expect((await post({ rThreshold: 2 })).status).toBe(400);
    expect((await post({ rThreshold: -1 })).status).toBe(400);
    const ok = await post({});
    expect(ok.body.params).toMatchObject({ rThreshold: 0.9, rank: 'tiered', staleDays: 90 });
  });

  it('a non-default rThreshold takes the decay path and widens the window', async () => {
    const id = await insNode({ title: 'a claim', confidence: 0.9, verified_at: ago(200) });
    await makeLoadBearing(id);
    // At the default it is stale (200 > 90). At rThreshold 0.5 the window is
    // 9 * S = 810 days, so it is not.
    const strict = await post({ minImportance: 0 });
    expect(strict.body.frontier.find((f) => f.id === id).stale).toBe(true);

    const loose = await post({ minImportance: 0, rThreshold: 0.5 });
    expect(loose.body.model.mode).toBe('decay');
    expect(loose.body.frontier.some((f) => f.id === id)).toBe(false);
  });
});

// ─────────────────── the review's decay-and-frontier findings ────────────────
//
// Three route-level regressions. Each one was REPRODUCED against the code as
// shipped before it was written; the numbers quoted are what was observed.
describe('E18.2 frontier — the degenerate and the inverted', () => {
  it('staleDays: 0 keeps v1’s recency order instead of collapsing to id ASC', async () => {
    // D1. `staleDays` is a caller parameter with `min: 0`, and `staleDays: 0`
    // sets S = 0 for every node. There is NO NaN and no division by zero —
    // retrievability() guards `s <= 0` and returns the step function, which is
    // the right meaning: "everything already checked is stale", exactly v1's
    // answer. What DID break is the ORDER: with every R equal to 0 the tiered
    // comparator fell through to `id ASC`.
    //
    // Inserted NEWEST-first, so `id ASC` is the exact REVERSE of the answer.
    // REPRODUCED before the fix: expected 17,13,9,5,1 — got 1,5,9,13,17.
    const ids = [];
    for (const [i, age] of [1, 5, 30, 200, 900].entries()) {
      const id = await insNode({ title: `n${i}`, confidence: 0.9, verified_at: ago(age) });
      await makeLoadBearing(id, 3);
      ids.push({ id, age });
    }
    // One verification event on an importance-0 node is enough to take PATH B,
    // and it cannot itself reach a minImportance-3 frontier.
    const trigger = await insNode({ title: 'trigger', confidence: 0.9 });
    await verify(trigger, 'held', ago(1));

    const oldestFirst = [...ids].sort((a, b) => b.age - a.age).map((x) => x.id);
    for (const staleDays of [90, 1, 0]) {
      const res = await post({ minImportance: 3, staleDays, maxResults: 500 });
      expect(res.status).toBe(200);
      expect(res.body.model.mode).toBe('decay');       // this IS the decay path
      const mine = res.body.frontier.filter((f) => ids.some((x) => x.id === f.id)).map((f) => f.id);
      // ...and it answers the same ORDER the v1 SQL would have, at every
      // staleDays including the degenerate one.
      const v1 = (await golden({ minImportance: 3, staleDays, lowConfidenceBelow: 0.5, maxResults: 500 }))
        .map((r) => r[0]).filter((id) => ids.some((x) => x.id === id));
      expect(mine).toEqual(v1);
      if (staleDays === 0) {
        expect(mine).toEqual(oldestFirst);
        // The collapse itself is real and deliberate — R is 0 for every row.
        for (const f of res.body.frontier) if (f.decays && f.verified_at) expect(f.r).toBe(0);
      }
    }
  });

  it('a FAILED check never makes a claim less urgent, at any staleDays', async () => {
    // D2. `sMinDays` is an absolute 1-day floor; `sInitDays` is `staleDays`.
    // Below staleDays 1 the floor exceeded the caller's own window, so the
    // failed claim got S = 1 against the unchecked twin's S = 0.5.
    // REPRODUCED at staleDays 0.5, age 0.75 d: the FAILED claim answered
    // r = 0.923, stale = FALSE and was ABSENT from the frontier, while its
    // untouched twin answered r = 0.857, stale = TRUE and was present.
    const when = ago(0.75);
    const failed = await insNode({ title: 'failed', confidence: 0.9, verified_at: when });
    const twin = await insNode({ title: 'unchecked', confidence: 0.9, verified_at: when });
    await makeLoadBearing(failed, 3);
    await makeLoadBearing(twin, 3);
    // A failure recorded WITHOUT clearing verified_at — a plain PATCH setting
    // refuted_at. POST /verify clears the scalar, which hides S behind the
    // never-held branch; this is the reachable shape where S is load-bearing.
    const patched = await request(app)
      .patch(`/api/graphs/${gid}/tasks/${failed}`)
      .send({ content: node({ status: 'review', title: 'failed', confidence: 0.9, verified_at: when, refuted_at: new Date().toISOString() }) });
    expect(patched.status).toBe(200);

    for (const staleDays of [0.25, 0.5, 0.99, 1, 2, 90]) {
      const res = await post({ minImportance: 3, staleDays, maxResults: 500 });
      expect(res.body.model.mode).toBe('decay');
      const f = res.body.frontier.find((x) => x.id === failed);
      const t = res.body.frontier.find((x) => x.id === twin);
      expect(res.body.frontier.filter((x) => x.id === failed || x.id === twin)
        .every((x) => x.checks !== undefined)).toBe(true);
      // The twin is the control: whenever IT is on the frontier, the failed
      // claim must be too, and no later than it.
      if (t) {
        expect(f, `failed claim vanished at staleDays ${staleDays}`).toBeDefined();
        expect(f.stability).toBeLessThanOrEqual(t.stability);
        expect(f.r).toBeLessThanOrEqual(t.r);
        const ids = res.body.frontier.map((x) => x.id);
        expect(ids.indexOf(failed)).toBeLessThanOrEqual(ids.indexOf(twin));
      }
      // The failed claim carries the failure in its checks block either way.
      if (f) expect(f.checks).toMatchObject({ failed: 1, last_outcome: 'failed' });
    }
  });

  it('never pulls a verification event’s content diff out of the database', async () => {
    // D3. The verify handler rewrites `content` (meta lives in the
    // frontmatter), so EVERY verification event carries a `changes.content`
    // whose from/to are whole markdown bodies, capped at 128 KB apiece. The
    // fold reads `kinds`, `intent`, `id` and `changes['meta.verified_at']` and
    // nothing else, so all of that crossed the wire to be discarded.
    // REPRODUCED before the fix: the rows the route fetched carried the full
    // body. MEASURED in multitap_test on 1000 synthetic verification events:
    // 209 ms / 17.55 MB of JSON with `SELECT payload`, 106 ms / 0.27 MB with
    // the content diff stripped in SQL.
    const big = 'x'.repeat(40000);
    const id = await insNode({ title: 'a claim', confidence: 0.9 });
    await makeLoadBearing(id, 3);
    await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
      .send({ content: `${node({ status: 'review', title: 'a claim', confidence: 0.9 })}\n${big}` })
      .expect(200);
    await verify(id, 'held', ago(300));
    // The event really does hold a body that size, so the saving is not notional.
    const { rows: ev } = await pool.query(
      `SELECT length(payload -> 'changes' -> 'content' ->> 'to') AS n FROM events
        WHERE graph_id = $1 AND payload -> 'kinds' ? 'claim.verified'`, [gid]);
    expect(Number(ev[0].n)).toBeGreaterThan(40000);

    // Wrap pool.query so the ROWS THAT CAME BACK are observable, not just the
    // SQL that asked for them.
    const seen = [];
    const real = dbPool.query.bind(dbPool);
    const spy = vi.spyOn(dbPool, 'query').mockImplementation(async (...args) => {
      const out = await real(...args);
      const text = typeof args[0] === 'string' ? args[0] : args[0]?.text ?? '';
      if (text.includes("'claim.verified','claim.refuted'")) seen.push(out.rows);
      return out;
    });
    let res;
    try {
      res = await post({ minImportance: 0, maxResults: 500 });
    } finally {
      spy.mockRestore();
    }
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(1);
    // THE ASSERTION: the 40 KB body never entered the process...
    expect(seen[0][0].payload.changes.content).toBeUndefined();
    expect(JSON.stringify(seen[0][0]).length).toBeLessThan(2000);
    // ...and everything checkFromEvent reads is still there, so the fold is
    // unchanged: the node is verified, its window is S_INIT, it is stale at 300
    // days and its checks block counts the hold.
    expect(seen[0][0].payload.kinds).toContain('claim.verified');
    expect(seen[0][0].payload.changes['meta.verified_at']).toBeDefined();
    expect(res.body.model.verified_nodes).toBe(1);
    const row = res.body.frontier.find((f) => f.id === id);
    expect(row.checks).toMatchObject({ held: 1, deliberate: 1, last_outcome: 'held' });
    expect(row.stability).toBe(90);
    expect(row.stale).toBe(true);
  });
});
