// E18.5 — THE CONFRONTATION VIEW'S HONESTY CONTRACT.
//
// tests/e18-confrontation-pair.test.js pins the PAIRING. This file pins the
// three ways the pairing was caught lying, each of which is the same lie in a
// different costume: the view said something the log does not support.
//
//   * DIRECTION. `supersedes` is DIRECTED (src/supersession.js: source =
//     SUCCESSOR, target = SUPERSEDED). A ground that REPLACED something else
//     was being reported as having been replaced, and the mirror graph — the
//     ground that genuinely was replaced — produced the SAME top-level status,
//     so two opposite realities were indistinguishable in the field a human
//     reads.
//   * SILENT TRUNCATION. The `via: cause` walk carries ONE global cap shared
//     across every ground. A ground whose outcomes fell off the end came back
//     `unconfronted`, which in this view means "nobody checked".
//   * HEAD STATE AS DECISION-TIME FACT. A node created already carrying
//     `decided_at` and later REOPENED leaves no `decision.made` behind at all,
//     so the basis ladder fell through to `none` — whereupon head state was
//     reported as the decision's context with `context_complete: true` and
//     every outcome leg skipped.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

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
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-honesty') RETURNING id");
  gid = g.rows[0].id;
  resetDerivedCache();
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

async function mkNode(title, extra = {}, body = '') {
  const res = await request(app).post(`/api/graphs/${gid}/tasks`)
    .send({ content: node({ title, status: 'todo', ...extra }, body) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

async function patchNode(id, meta, body = '', extra = {}) {
  const res = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
    .send({ content: node(meta, body), ...extra });
  expect(res.status).toBe(200);
  return res;
}

async function mkEdge(source, target, purpose, extra = {}) {
  const res = await request(app).post(`/api/graphs/${gid}/edges`)
    .send({ source_id: source, target_id: target, purpose, ...extra });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

const confront = (id, body = {}) =>
  request(app).post(`/api/graphs/${gid}/decisions/${id}/confrontation`).send(body);

const seqOfDecision = async (id) => {
  const { rows } = await pool.query(
    `SELECT seq FROM events WHERE graph_id = $1 AND subject_id = $2
       AND payload -> 'kinds' ? 'decision.made' ORDER BY seq DESC LIMIT 1`,
    [gid, id],
  );
  return rows.length ? Number(rows[0].seq) : null;
};

// D <--supports-- G(0.8), then D committed by SETTING decided_at.
async function fixture() {
  const d = await mkNode('storage engine', { type: 'decision' }, 'because compression');
  const ground = await mkNode('compression >= 10x on our shape', { confidence: 0.8 });
  await mkEdge(ground, d, 'supports');
  await patchNode(d, { title: 'storage engine', type: 'decision', status: 'todo',
    decided_at: '2026-03-01T00:00:00.000Z' }, 'because compression');
  return { d, ground, decisionSeq: await seqOfDecision(d) };
}

// ── H1: `supersedes` is DIRECTED ─────────────────────────────────────────────

describe('E18.5 supersedes is directed: the ground that SURVIVED is not "contradicted"', () => {
  it('a ground that SUPERSEDED something else is not reported as replaced', async () => {
    const f = await fixture();
    const z = await mkNode('the thing our ground replaced', { confidence: 0.2 });
    // G is the SOURCE: G replaced Z. `node.superseded` fires on Z, not on G.
    // Nothing bad happened to G at all.
    await mkEdge(f.ground, z, 'supersedes');

    const res = await confront(f.d);
    expect(res.status).toBe(200);
    const ground = res.body.grounds.find((g) => g.id === f.ground);
    expect(ground.outcomes.filter((o) => o.purpose === 'supersedes')).toEqual([]);
    expect(ground.status).toBe('unconfronted');
  });

  it('and the MIRROR graph — the ground genuinely replaced — still is', async () => {
    const f = await fixture();
    const z = await mkNode('the thing that replaced our ground', { confidence: 0.9 });
    // G is the TARGET: Z replaced G. This is the real loss.
    await mkEdge(z, f.ground, 'supersedes');

    const res = await confront(f.d);
    const ground = res.body.grounds.find((g) => g.id === f.ground);
    expect(ground.status).toBe('contradicted_since');
    // Doubly recorded, by two mechanisms that are never merged: `node.superseded`
    // fires on the SUPERSEDED node, and the edge itself is the human assertion.
    expect(ground.outcomes.map((o) => o.via).sort()).toEqual(['edge', 'fate']);
    expect(ground.outcomes.find((o) => o.via === 'edge').purpose).toBe('supersedes');
    expect(ground.outcomes.find((o) => o.via === 'fate').kind).toBe('node.superseded');
  });

  it('THE DECISIVE CHECK: the two opposite realities are distinguishable', async () => {
    const survived = await (async () => {
      const f = await fixture();
      const z = await mkNode('replaced by our ground');
      await mkEdge(f.ground, z, 'supersedes');
      return (await confront(f.d)).body.grounds.find((g) => g.id === f.ground).status;
    })();
    const replaced = await (async () => {
      const f = await fixture();
      const z = await mkNode('replaced our ground');
      await mkEdge(z, f.ground, 'supersedes');
      return (await confront(f.d)).body.grounds.find((g) => g.id === f.ground).status;
    })();
    expect(survived).not.toBe(replaced);
  });

  it('`contradicts` stays SYMMETRIC — at-risk names either direction', async () => {
    const f = await fixture();
    const rival = await mkNode('measured 3x in practice', { confidence: 0.7 });
    await mkEdge(f.ground, rival, 'contradicts');   // ground is the SOURCE
    const res = await confront(f.d);
    const ground = res.body.grounds.find((g) => g.id === f.ground);
    expect(ground.status).toBe('contradicted_since');
    expect(ground.outcomes.map((o) => o.purpose)).toEqual(['contradicts']);
  });
});

// ── H2: the global `via: cause` cap must not manufacture silence ─────────────

describe('E18.5 a capped cause walk says so instead of reporting `unconfronted`', () => {
  // Three events wired to the decision by `cause_id`, the ground's LAST by seq,
  // with maxOutcomes = 1. The walk's single global LIMIT keeps the two earliest
  // and the slice keeps one: the ground's outcome falls off the end.
  async function starved() {
    const f = await fixture();
    const c1 = await mkNode('rewrite the ingest pipeline');
    const c2 = await mkNode('retrain the sizing model');
    for (const [id, title] of [[c1, 'rewrite the ingest pipeline'], [c2, 'retrain the sizing model']]) {
      await patchNode(id, { title, status: 'done' }, '', { cause_id: f.decisionSeq });
    }
    // A STATUS change on the ground: `field.set`-free, so the `fate` leg has
    // nothing to say about it and `cause` is the only mechanism that sees it.
    await patchNode(f.ground, { title: 'compression >= 10x on our shape', status: 'done',
      confidence: 0.8 }, '', { cause_id: f.decisionSeq });
    return f;
  }

  it('the starved ground is NOT reported as unconfronted-in-silence', async () => {
    const f = await starved();
    const res = await confront(f.d, { maxOutcomes: 1 });
    const ground = res.body.grounds.find((g) => g.id === f.ground);
    expect(ground.outcomes_truncated).toBe(true);
    expect(ground.outcomes_truncated_by).toContain('cause_walk_cap');
    expect(res.body.truncated).toBe(true);
    expect(res.body.truncation.cause_walk).toBe(true);
    expect(res.body.truncation.reasons).toContain('cause_walk_capped');
  });

  it('an UNCAPPED answer states that it is complete', async () => {
    const f = await starved();
    const res = await confront(f.d, { maxOutcomes: 50 });
    const ground = res.body.grounds.find((g) => g.id === f.ground);
    expect(ground.status).toBe('changed_since');
    expect(ground.outcomes_truncated).toBe(false);
    expect(ground.outcomes_truncated_by).toEqual([]);
    expect(res.body.truncation.cause_walk).toBe(false);
    expect(res.body.truncation.reasons).toEqual([]);
    expect(res.body.truncated).toBe(false);
  });
});

// ── H3: a reopened decision that never emitted `decision.made` ───────────────

describe('E18.5 a reopened decision is not confronted against HEAD state', () => {
  // D is CREATED already carrying decided_at — which emits `node.created` and
  // no `decision.made` at all — its ground is refuted, and D is then reopened.
  // `decision.reopened` is the only trace the commitment ever existed.
  async function reopened() {
    const d = await mkNode('storage engine', {
      type: 'decision', decided_at: '2026-02-01T00:00:00.000Z',
    }, 'because compression');
    const ground = await mkNode('compression >= 10x on our shape', { confidence: 0.8 });
    await mkEdge(ground, d, 'supports');
    await request(app).post(`/api/graphs/${gid}/tasks/${ground}/verify`)
      .send({ outcome: 'failed', happened_at: '2026-06-01T00:00:00.000Z' });
    // Clearing decided_at is what emits `decision.reopened`.
    await patchNode(d, { title: 'storage engine', type: 'decision', status: 'todo' },
      'because compression');
    return { d, ground };
  }

  it('knows a commitment existed, so it does not claim there was no decision point', async () => {
    const r = await reopened();
    const res = await confront(r.d);
    expect(res.status).toBe(200);
    expect(res.body.decision.state).toBe('reopened');
    expect(res.body.decision.reopened_events.length).toBe(1);
    expect(res.body.context.basis).not.toBe('none');
    expect(res.body.context.no_decision_point).toBe(false);
  });

  it('confronts the ground against the refutation the log is holding', async () => {
    const r = await reopened();
    const res = await confront(r.d);
    const ground = res.body.grounds.find((g) => g.id === r.ground);
    expect(ground.status).toBe('contradicted_since');
    expect(ground.outcomes.map((o) => [o.via, o.kind])).toEqual([['fate', 'claim.refuted']]);
  });

  it('with NO anchor at all, head state is never dressed up as decision-time fact', async () => {
    // No commitment ever: basis stays `none`, and then the view must not report
    // the head grounds as having been present at a moment it cannot locate.
    const d = await mkNode('undecided', { type: 'decision' });
    const ground = await mkNode('a ground', { confidence: 0.4 });
    await mkEdge(ground, d, 'supports');
    const res = await confront(d);
    expect(res.body.context.basis).toBe('none');
    expect(res.body.context.complete).toBe(false);
    expect(res.body.limits.context_complete).toBe(false);
    const g = res.body.grounds.find((x) => x.id === ground);
    expect(g.present_at_decision).toBe(null);
    expect(g.confidence_at_decision).toBe(null);
  });
});
