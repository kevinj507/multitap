// E17 adaptive-decisions tests (plan nodes 3989/3990/3991 on the Multitap
// plan graph). Covers E17.1 (`decided_at` reserved field + merge protection),
// E17.2 (POST /decisions/at-risk — the status-independent decision re-check
// queue), E17.3 (frontier decision-inherited importance + significance
// tie-break), and the E17 CHAIN test that gates `done`: a decision cluster
// whose ground goes stale must surface in BOTH /frontier and
// /decisions/at-risk while the decision sits at status done.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { validateMeta, applyDefaults } from '../src/markdown.js';

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
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e17') RETURNING id");
  gid = g.rows[0].id;
});

const tasksUrl = () => `/api/graphs/${gid}/tasks`;
const atRiskUrl = () => `/api/graphs/${gid}/decisions/at-risk`;
const frontierUrl = () => `/api/graphs/${gid}/frontier`;

const node = (meta, body = '') => {
  const fm = Object.entries(meta).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
  return `---\n${fm}\n---\n${body}`;
};

// Insert a node directly (meta + content kept consistent the way the routes
// write them), with explicit control of updated_at so changedSinceDecision
// tests don't race the clock. Returns the id.
async function insNode(meta, { updatedAt } = {}) {
  const m = { status: 'todo', ...meta };
  const { rows } = await pool.query(
    `INSERT INTO tasks (graph_id, content, meta, updated_at)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW())) RETURNING id`,
    [gid, node(m), JSON.stringify(m), updatedAt ?? null],
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

const PAST = '2020-01-01T00:00:00Z'; // safely before any decided_at used below
const STALE = '2000-01-01T00:00:00Z';
const FRESH = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
const DECIDED = '2026-01-01T00:00:00Z'; // after PAST, before NOW()

// A healthy ground: fresh, confident, last edited before the decision.
const healthyGround = () =>
  insNode({ title: 'Ground', status: 'review', confidence: 0.9, verified_at: FRESH }, { updatedAt: PAST });

// ─────────────────────── E17.1: decided_at reserved field ───────────────────
describe('E17.1 decided_at validation + defaults', () => {
  const base = { title: 'D' };
  it('accepts a parseable ISO decided_at, rejects malformed', () => {
    expect(validateMeta({ ...base, decided_at: '2026-07-23' })).toBeNull();
    expect(validateMeta({ ...base, decided_at: '2026-07-23T12:00:00Z' })).toBeNull();
    expect(validateMeta({ ...base, decided_at: 'not-a-date' })).toMatch(/decided_at/);
    expect(validateMeta({ ...base, decided_at: '2026-13-45' })).toMatch(/decided_at/);
    expect(validateMeta({ ...base, decided_at: null })).toBeNull(); // explicit clear allowed
  });
  it('applyDefaults coerces a decided_at Date to a canonical ISO string', () => {
    const out = applyDefaults({ title: 'D', decided_at: new Date('2026-07-23T12:00:00Z') });
    expect(out.decided_at).toBe('2026-07-23T12:00:00.000Z');
  });
  it('POST stores decided_at; malformed is a 400', async () => {
    const ok = await request(app).post(tasksUrl())
      .send({ content: node({ title: 'D', type: 'decision', decided_at: DECIDED }) });
    expect(ok.status).toBe(201);
    expect(ok.body.meta.decided_at).toBe(DECIDED);
    const bad = await request(app).post(tasksUrl())
      .send({ content: node({ title: 'D', decided_at: 'someday' }) });
    expect(bad.status).toBe(400);
  });
});

describe('E17.1 decided_at merge protection', () => {
  it('agent PATCH that omits decided_at preserves it; explicit null clears', async () => {
    const t = await request(app).post(tasksUrl()).set('X-Writer-Type', 'agent')
      .send({ content: node({ title: 'D', type: 'decision', status: 'done', decided_at: DECIDED }) });
    expect(t.status).toBe(201);
    // Body rewrite omitting decided_at (and type — which is NOT protected, so
    // the writer must re-state it, same as the documented `reference` rule).
    const omit = await request(app).patch(`${tasksUrl()}/${t.body.id}`).set('X-Writer-Type', 'agent').send({
      content: node({ title: 'D revised', type: 'decision', status: 'done' }),
      base_version: t.body.version,
      base_content: t.body.content,
    });
    expect(omit.status).toBe(200);
    expect(omit.body.meta.decided_at).toBe(DECIDED); // survived the omit
    const cleared = await request(app).patch(`${tasksUrl()}/${t.body.id}`).set('X-Writer-Type', 'agent').send({
      content: node({ title: 'D revised', type: 'decision', status: 'done', decided_at: null }),
      base_version: omit.body.version,
      base_content: omit.body.content,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.meta.decided_at == null).toBe(true); // escape hatch
  });
});

// ─────────────────────── E17.2: /decisions/at-risk ──────────────────────────
describe('E17.2 /decisions/at-risk', () => {
  it('empty graph → empty queue', async () => {
    const res = await request(app).post(atRiskUrl()).send({});
    expect(res.status).toBe(200);
    expect(res.body.atRisk).toEqual([]);
    // E18.4 added `includeSuperseded` (default false) to this echo: a
    // superseded decision is history, not a live commitment, so it is excluded
    // by default and the answer must say which question it answered.
    expect(res.body.params).toEqual({
      staleDays: 90, lowConfidenceBelow: 0.5, maxResults: 50, includeSuperseded: false,
    });
  });

  it('a decision on healthy grounds is NOT at risk (no noise on day one)', async () => {
    const d = await insNode({ title: 'D', type: 'decision', status: 'done', decided_at: DECIDED });
    await insEdge(await healthyGround(), d, 'supports');
    const res = await request(app).post(atRiskUrl()).send({});
    expect(res.body.atRisk).toEqual([]);
  });

  it('flags each risk kind on the offending ground', async () => {
    const d = await insNode({ title: 'D', type: 'decision', status: 'done', decided_at: DECIDED });
    const stale = await insNode({ title: 'S', status: 'review', confidence: 0.9, verified_at: STALE }, { updatedAt: PAST });
    const lowConf = await insNode({ title: 'L', status: 'review', confidence: 0.3, verified_at: FRESH }, { updatedAt: PAST });
    const contra = await insNode({ title: 'C', status: 'review', confidence: 0.9, verified_at: FRESH }, { updatedAt: PAST });
    const attacker = await insNode({ title: 'A', status: 'review', confidence: 0.8, verified_at: FRESH }, { updatedAt: PAST });
    const pivoted = await insNode({ title: 'P (requirement)', status: 'done' }); // plain node, edited NOW > decided_at
    await insEdge(stale, d, 'supports');
    await insEdge(lowConf, d, 'supports');
    await insEdge(contra, d, 'supports');
    await insEdge(attacker, contra, 'contradicts');
    await insEdge(pivoted, d, 'required for');
    const res = await request(app).post(atRiskUrl()).send({});
    expect(res.status).toBe(200);
    expect(res.body.atRisk).toHaveLength(1);
    const dec = res.body.atRisk[0];
    expect(dec.id).toBe(d);
    expect(dec.status).toBe('done'); // status-independence: done does not suppress
    const kindsBy = Object.fromEntries(dec.reasons.map((r) => [r.id, r.kinds]));
    expect(kindsBy[stale]).toEqual(['stale']);
    expect(kindsBy[lowConf]).toEqual(['lowConfidence']);
    expect(kindsBy[contra]).toEqual(['contradicted']);
    expect(kindsBy[pivoted]).toEqual(['changedSinceDecision']); // plain node: not stale-scoped, IS pivot-scoped
  });

  it('a plain ground edited before the decision is quiet; missing decided_at falls back to created_at', async () => {
    // decided_at present: requirement edited BEFORE it → no risk.
    const d1 = await insNode({ title: 'D1', type: 'decision', decided_at: DECIDED });
    await insEdge(await insNode({ title: 'R1', status: 'done' }, { updatedAt: PAST }), d1, 'supports');
    // decided_at absent: decision CREATED long ago, ground edited after → risk.
    const d2 = await insNode({ title: 'D2', type: 'decision' });
    await pool.query('UPDATE tasks SET created_at = $2 WHERE id = $1', [d2, PAST]);
    await insEdge(await insNode({ title: 'R2', status: 'done' }), d2, 'supports');
    const res = await request(app).post(atRiskUrl()).send({});
    const ids = res.body.atRisk.map((x) => x.id);
    expect(ids).toEqual([d2]);
    expect(res.body.atRisk[0].reasons[0].kinds).toEqual(['changedSinceDecision']);
  });

  it('only supports/required-for edges are grounds — related-to does not put a decision at risk', async () => {
    const d = await insNode({ title: 'D', type: 'decision', decided_at: DECIDED });
    const stale = await insNode({ title: 'S', status: 'review', confidence: 0.9, verified_at: STALE }, { updatedAt: PAST });
    await insEdge(stale, d, 'related to');
    const res = await request(app).post(atRiskUrl()).send({});
    expect(res.body.atRisk).toEqual([]);
  });

  it('a contradicted decision surfaces even with no wired grounds', async () => {
    const d = await insNode({ title: 'D', type: 'decision', status: 'done', decided_at: DECIDED });
    const rival = await insNode({ title: 'New evidence', status: 'review', confidence: 0.8, verified_at: FRESH }, { updatedAt: PAST });
    await insEdge(rival, d, 'contradicts');
    const res = await request(app).post(atRiskUrl()).send({});
    expect(res.body.atRisk).toHaveLength(1);
    expect(res.body.atRisk[0]).toMatchObject({ id: d, selfContradicted: true, reasons: [] });
  });

  it('ranks by blast radius (out-degree) and validates params', async () => {
    const small = await insNode({ title: 'small', type: 'decision', decided_at: DECIDED });
    const big = await insNode({ title: 'big', type: 'decision', decided_at: DECIDED });
    const stale1 = await insNode({ title: 'S1', status: 'review', confidence: 0.9, verified_at: STALE }, { updatedAt: PAST });
    const stale2 = await insNode({ title: 'S2', status: 'review', confidence: 0.9, verified_at: STALE }, { updatedAt: PAST });
    await insEdge(stale1, small, 'supports');
    await insEdge(stale2, big, 'supports');
    for (let i = 0; i < 3; i++) {
      await insEdge(big, await insNode({ title: `build ${i}` }), 'required for');
    }
    const res = await request(app).post(atRiskUrl()).send({});
    expect(res.body.atRisk.map((x) => x.id)).toEqual([big, small]);
    expect(res.body.atRisk[0].importance).toBe(3);
    expect((await request(app).post(atRiskUrl()).send({ staleDays: 'x' })).status).toBe(400);
    expect((await request(app).post(atRiskUrl()).send({ maxResults: 0 })).status).toBe(400);
    expect((await request(app).post(atRiskUrl()).send({ lowConfidenceBelow: 2 })).status).toBe(400);
  });
});

// ─────────────────────── E17.3: frontier fixes ──────────────────────────────
describe('E17.3 frontier inherited importance + significance tie-break', () => {
  it('a claim supporting a decision inherits the decision out-degree (one hop)', async () => {
    // Claim → decision → three build tasks. Direct out-degree 1 (below the
    // default minImportance 2); inherited = 1 + 3 = 4.
    const claim = await insNode({ title: 'claim', status: 'review', confidence: 0.3, verified_at: FRESH });
    const d = await insNode({ title: 'D', type: 'decision', decided_at: DECIDED });
    await insEdge(claim, d, 'supports');
    for (let i = 0; i < 3; i++) await insEdge(d, await insNode({ title: `build ${i}` }), 'required for');
    // Control: same shape through a PLAIN hub inherits nothing.
    const claim2 = await insNode({ title: 'claim2', status: 'review', confidence: 0.3, verified_at: FRESH });
    const hub = await insNode({ title: 'plain hub' });
    await insEdge(claim2, hub, 'supports');
    for (let i = 0; i < 3; i++) await insEdge(hub, await insNode({ title: `h ${i}` }), 'required for');
    const res = await request(app).post(frontierUrl()).send({});
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.frontier.map((f) => [f.id, f]));
    expect(byId[claim]).toMatchObject({ importance: 4, lowConfidence: true });
    expect(byId[claim2]).toBeUndefined(); // direct out-degree 1 < default 2, no inheritance via a plain hub
  });

  it('equal importance breaks ties by significance (unset last)', async () => {
    const hi = await insNode({ title: 'hi', status: 'review', confidence: 0.9, verified_at: STALE, significance: 0.9 });
    const none = await insNode({ title: 'none', status: 'review', confidence: 0.9, verified_at: STALE });
    const lo = await insNode({ title: 'lo', status: 'review', confidence: 0.9, verified_at: STALE, significance: 0.2 });
    const res = await request(app).post(frontierUrl()).send({ minImportance: 0 });
    const order = res.body.frontier.map((f) => f.id);
    expect(order).toEqual([hi, lo, none]);
  });
});

// ─────────────────────── E17 CHAIN (gates done) ─────────────────────────────
// Replays the motivating audit: a committed (done) decision grounded in one
// finding, gating one build task. While healthy → both queues quiet. The
// finding goes stale → the finding surfaces on /frontier AT DEFAULTS (via
// inherited importance) AND the decision surfaces on /decisions/at-risk,
// done-status notwithstanding. An agent body-rewrite cannot wipe decided_at.
describe('E17 chain: stale ground resurfaces a done decision end-to-end', () => {
  it('healthy → quiet; aged → both queues fire; decided_at survives a rewrite', async () => {
    const finding = await insNode(
      { title: 'engine benchmark finding', status: 'done', confidence: 0.65, verified_at: FRESH, significance: 0.8 },
      { updatedAt: PAST },
    );
    const decision = await request(app).post(tasksUrl()).set('X-Writer-Type', 'agent').send({
      content: node({ title: 'engine = DuckDB', type: 'decision', status: 'done', decided_at: DECIDED }),
    });
    const d = decision.body.id;
    const build = await insNode({ title: 'build the storage layer' });
    await insEdge(finding, d, 'supports');
    await insEdge(d, build, 'required for');

    // Phase 1 — healthy: nothing to re-check, no at-risk noise.
    expect((await request(app).post(frontierUrl()).send({})).body.frontier).toEqual([]);
    expect((await request(app).post(atRiskUrl()).send({})).body.atRisk).toEqual([]);

    // Phase 2 — the finding ages past staleDays.
    await pool.query(
      `UPDATE tasks SET meta = meta || '{"verified_at":"${STALE}"}' WHERE id = $1`,
      [finding],
    );
    const fr = await request(app).post(frontierUrl()).send({});
    expect(fr.body.frontier.map((f) => f.id)).toContain(finding); // importance 1 + 1 (inherited) = 2 ≥ default 2
    const ar = await request(app).post(atRiskUrl()).send({});
    expect(ar.body.atRisk).toHaveLength(1);
    expect(ar.body.atRisk[0]).toMatchObject({ id: d, status: 'done' });
    expect(ar.body.atRisk[0].reasons.map((r) => r.id)).toContain(finding);

    // Phase 3 — an agent rewrite of the decision body omits decided_at: it
    // survives (merge protection), so the pivot detector keeps its baseline.
    const rewrite = await request(app).patch(`${tasksUrl()}/${d}`).set('X-Writer-Type', 'agent').send({
      content: node({ title: 'engine = DuckDB', type: 'decision', status: 'done' }, 'Rationale rewritten.'),
      base_version: decision.body.version,
      base_content: decision.body.content,
    });
    expect(rewrite.status).toBe(200);
    expect(rewrite.body.meta.decided_at).toBe(DECIDED);
    expect((await request(app).post(atRiskUrl()).send({})).body.atRisk).toHaveLength(1); // still watching
  });
});
