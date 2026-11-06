// E18.5 — THE CONFRONTATION VIEW: decision-time grounds against what the log
// has recorded since.
//
// The pairing itself is the subject. Five things it must never do, each with its
// own regression here:
//
//   * INVENT A PREDICTION. Nothing in the corpus marks one, so the default is a
//     decision-time ground that is CONFIDENCE-BEARING and everything else is
//     returned with `prediction: false`. The view LABELS; it never invents.
//   * MERGE THE THREE MECHANISMS. `fate` / `cause` / `edge` mean different
//     things and are reported separately under `via`.
//   * READ SILENCE AS VINDICATION. A ground nobody checked is `unconfronted`,
//     and `limits.silence_is_not_vindication` says so in the payload.
//   * DISCARD AN UNPAIRED OUTCOME. The decision had consequences nobody
//     predicted, and that list is the most interesting thing in the view.
//   * RENDER "WE CANNOT SEE THAT FAR BACK" AS "IT DID NOT EXIST". When the
//     reconstruction is incomplete, `present_at_decision` is null, never false.
//
// (The design sketched this as a pure unit test. The pairing lives in the route
// handler — it is three SQL reads joined to one reconstruction — so it is
// exercised through the route, with the pure halves already pinned by
// tests/e18-overlay.test.js and tests/e18-contingency.test.js.)
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
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-confront') RETURNING id");
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

async function patchNode(id, meta, body = '') {
  const res = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
    .send({ content: node(meta, body) });
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

// ground (confidence 0.8) --supports--> D
// plain  (no confidence)  --required for--> D
// then D is committed by SETTING decided_at.
async function fixture() {
  const d = await mkNode('storage engine', { type: 'decision' }, 'because compression');
  const ground = await mkNode('compression >= 10x on our shape', { confidence: 0.8 });
  const plain = await mkNode('migration runbook', { status: 'done' });
  await mkEdge(ground, d, 'supports');
  await mkEdge(plain, d, 'required for');
  await patchNode(d, { title: 'storage engine', type: 'decision', status: 'todo',
    decided_at: '2026-03-01T00:00:00.000Z' }, 'because compression');
  return { d, ground, plain, decisionSeq: await seqOfDecision(d) };
}

describe('E18.5 the context leg', () => {
  it('reconstructs at the SEQ of decision.made, not at the backdatable scalar', async () => {
    const f = await fixture();
    const res = await confront(f.d);
    expect(res.status).toBe(200);
    expect(res.body.context.basis).toBe('event_seq');
    expect(res.body.context.axis).toBe('learned');
    expect(res.body.context.as_of.seq).toBe(f.decisionSeq);
    expect(res.body.decision.decision_event.seq).toBe(f.decisionSeq);
    expect(res.body.context.complete).toBe(true);
    // The world-time reading is reported BESIDE it and never instead of it.
    expect(res.body.context.world_at_decision.axis).toBe('happened');
    expect(res.body.context.world_at_decision.requested).toBe('2026-03-01T00:00:00.000Z');
  });

  it('falls back to the SCALAR basis for a node created already decided', async () => {
    // Every node in the corpus predates the log, so this is the common case for
    // existing data: the INSERT logger writes `node.created` and no
    // `decision.made` exists to pin a seq to.
    const d = await mkNode('legacy decision', {
      type: 'decision', decided_at: '2026-02-01T00:00:00.000Z',
    });
    const res = await confront(d);
    expect(res.body.context.basis).toBe('scalar');
    expect(res.body.context.axis).toBe('happened');
    expect(res.body.decision.decision_event).toBe(null);
    expect(res.body.decision.state).toBe('committed');
  });

  it('reports basis `none` and no outcomes for a node that was never decided', async () => {
    const d = await mkNode('undecided', { type: 'decision' });
    const ground = await mkNode('a ground', { confidence: 0.4 });
    await mkEdge(ground, d, 'supports');
    const res = await confront(d);
    expect(res.body.context.basis).toBe('none');
    expect(res.body.context.no_decision_point).toBe(true);
    expect(res.body.decision.state).toBe('never_decided');
    // The grounds are still listed — from the head state — and nothing is
    // confronted, because there is no moment to confront them against.
    expect(res.body.grounds.map((g) => g.id)).toEqual([ground]);
    expect(res.body.grounds[0].outcomes).toEqual([]);
    expect(res.body.confronted).toEqual({
      grounds: 1, returned: 1, predictions: 1, with_outcomes: 0, unconfronted: 1,
    });
  });

  it('present_at_decision is NULL, never false, when the context is incomplete', async () => {
    const f = await fixture();
    const late = await mkNode('a ground added after the fact', { confidence: 0.3 });
    await mkEdge(late, f.d, 'supports');

    const complete = await confront(f.d);
    expect(complete.body.context.complete).toBe(true);
    expect(complete.body.grounds.find((g) => g.id === late).present_at_decision).toBe(false);
    expect(complete.body.grounds.find((g) => g.id === f.ground).present_at_decision).toBe(true);

    // Destroy the genesis substrate: the reconstruction can no longer account
    // for the world before seq 1 and says so. "Cannot see" must not harden into
    // "did not exist".
    await pool.query("DELETE FROM graph_snapshots WHERE graph_id = $1 AND kind = 'genesis'", [gid]);
    resetDerivedCache();
    const blind = await confront(f.d);
    expect(blind.body.context.as_of.pre_history_approximation).toBe(true);
    expect(blind.body.context.complete).toBe(false);
    expect(blind.body.limits.context_complete).toBe(false);
    for (const g of blind.body.grounds) expect(g.present_at_decision).toBe(null);
  });
});

describe('E18.5 prediction identification', () => {
  it('a confidence-bearing decision-time ground is the default prediction', async () => {
    const f = await fixture();
    const res = await confront(f.d);
    const ground = res.body.grounds.find((g) => g.id === f.ground);
    expect(ground.prediction).toBe(true);
    expect(ground.prediction_basis).toBe('confidence');
    expect(ground.confidence_at_decision).toBe(0.8);
    const plain = res.body.grounds.find((g) => g.id === f.plain);
    expect(plain.prediction).toBe(false);
    expect(plain.prediction_basis).toBe(null);
  });

  it('predictionTypes NARROWS by meta.type and is empty by default', async () => {
    const f = await fixture();
    const typed = await mkNode('throughput forecast', { type: 'forecast' });
    await mkEdge(typed, f.d, 'supports');
    await patchNode(f.d, { title: 'storage engine', type: 'decision', status: 'todo',
      decided_at: '2026-03-02T00:00:00.000Z' }, 'because compression');

    const plain = await confront(f.d);
    expect(plain.body.grounds.find((g) => g.id === typed).prediction).toBe(false);
    expect(plain.body.params.predictionTypes).toEqual([]);

    const narrowed = await confront(f.d, { predictionTypes: ['forecast'] });
    const row = narrowed.body.grounds.find((g) => g.id === typed);
    expect(row.prediction).toBe(true);
    expect(row.prediction_basis).toBe('type');
  });

  it('400s a malformed predictionTypes rather than coercing it', async () => {
    const f = await fixture();
    expect((await confront(f.d, { predictionTypes: 'forecast' })).status).toBe(400);
    expect((await confront(f.d, { predictionTypes: [1] })).status).toBe(400);
    expect((await confront(f.d, { maxResults: 0 })).status).toBe(400);
  });
});

describe('E18.5 pairing a ground against what the log recorded since', () => {
  it('a REFUTATION since the decision is `via: fate` and contradicted_since', async () => {
    const f = await fixture();
    const res0 = await confront(f.d);
    expect(res0.body.grounds.find((g) => g.id === f.ground).status).toBe('unconfronted');
    expect(res0.body.limits.silence_is_not_vindication).toBe(true);

    await request(app).post(`/api/graphs/${gid}/tasks/${f.ground}/verify`)
      .send({ outcome: 'failed', happened_at: '2026-06-01T00:00:00.000Z' });

    const res = await confront(f.d);
    const ground = res.body.grounds.find((g) => g.id === f.ground);
    expect(ground.status).toBe('contradicted_since');
    expect(ground.outcomes.map((o) => [o.via, o.kind]))
      .toEqual([['fate', 'claim.refuted']]);
    expect(ground.outcomes[0].boundary).toBe('seq');
    expect(ground.outcomes[0].seq).toBeGreaterThan(f.decisionSeq);
  });

  it('a RE-VERIFICATION since the decision is confirmed_since', async () => {
    const f = await fixture();
    await request(app).post(`/api/graphs/${gid}/tasks/${f.ground}/verify`)
      .send({ outcome: 'held', happened_at: '2026-06-01T00:00:00.000Z' });
    const res = await confront(f.d);
    expect(res.body.grounds.find((g) => g.id === f.ground).status).toBe('confirmed_since');
  });

  it('a CONFIDENCE DROP is changed_since — and a rise is not an outcome at all', async () => {
    const f = await fixture();
    await patchNode(f.ground, { title: 'compression >= 10x on our shape', status: 'todo', confidence: 0.4 });
    const dropped = await confront(f.d);
    const ground = dropped.body.grounds.find((g) => g.id === f.ground);
    expect(ground.status).toBe('changed_since');
    expect(ground.outcomes.map((o) => o.kind)).toEqual(['field.set']);
    expect(ground.confidence_at_decision).toBe(0.8);
    expect(ground.confidence_now).toBe(0.4);

    // THE PREFILTER IS NOT THE PREDICATE: a confidence RISE is also `field.set`
    // by the index's reckoning, and weakening() is what refuses it.
    const f2 = await fixture();
    await patchNode(f2.ground, { title: 'compression >= 10x on our shape', status: 'todo', confidence: 0.95 });
    const risen = await confront(f2.d);
    expect(risen.body.grounds.find((g) => g.id === f2.ground).outcomes).toEqual([]);
    expect(risen.body.grounds.find((g) => g.id === f2.ground).status).toBe('unconfronted');
  });

  it('a `contradicts` edge added since is `via: edge`, reported separately', async () => {
    const f = await fixture();
    const rival = await mkNode('compression is 3x in practice', { confidence: 0.7 });
    await mkEdge(rival, f.ground, 'contradicts');
    const res = await confront(f.d);
    const ground = res.body.grounds.find((g) => g.id === f.ground);
    expect(ground.status).toBe('contradicted_since');
    expect(ground.outcomes.map((o) => o.via)).toEqual(['edge']);
    expect(ground.outcomes[0].purpose).toBe('contradicts');
  });

  it('a `cause`-wired event is reported as its OWN mechanism, never merged', async () => {
    const f = await fixture();
    // The writer opted in: this refutation was recorded BECAUSE OF the decision.
    await request(app).post(`/api/graphs/${gid}/tasks/${f.ground}/verify`)
      .send({ outcome: 'failed', happened_at: '2026-06-01T00:00:00.000Z', cause_id: f.decisionSeq });
    const res = await confront(f.d);
    const ground = res.body.grounds.find((g) => g.id === f.ground);
    const vias = ground.outcomes.map((o) => o.via).sort();
    expect(vias).toEqual(['cause', 'fate']);
    // Same event, two mechanisms, two rows — because the two facts are
    // different: one is "what happened to the ground", the other is "this was
    // recorded because of the decision".
    const seqs = new Set(ground.outcomes.map((o) => o.seq));
    expect(seqs.size).toBe(1);
  });

  it('UNPAIRED outcomes are listed, never discarded', async () => {
    const f = await fixture();
    const consequence = await mkNode('rewrite the ingest pipeline');
    // Wired to the decision only by cause: nobody predicted it.
    await patchNode(consequence, { title: 'rewrite the ingest pipeline', status: 'in_progress' });
    await request(app).patch(`/api/graphs/${gid}/tasks/${consequence}`)
      .send({ content: node({ title: 'rewrite the ingest pipeline', status: 'done' }),
              cause_id: f.decisionSeq });
    const res = await confront(f.d);
    expect(res.body.unpaired_outcomes.length).toBeGreaterThan(0);
    expect(res.body.unpaired_outcomes.some((o) => o.node_id === consequence)).toBe(true);
    expect(res.body.unpaired_outcomes.every((o) => o.via === 'cause')).toBe(true);
    // ...and it did NOT get attached to an unrelated ground.
    for (const g of res.body.grounds) {
      expect(g.outcomes.every((o) => o.node_id === g.id)).toBe(true);
    }
  });

  it('an event BEFORE the decision is not an outcome of it', async () => {
    const d = await mkNode('storage engine', { type: 'decision' });
    const ground = await mkNode('early claim', { confidence: 0.8 });
    await mkEdge(ground, d, 'supports');
    await request(app).post(`/api/graphs/${gid}/tasks/${ground}/verify`)
      .send({ outcome: 'failed', happened_at: '2026-01-01T00:00:00.000Z' });
    await patchNode(d, { title: 'storage engine', type: 'decision', status: 'todo',
      decided_at: '2026-03-01T00:00:00.000Z' });
    const res = await confront(d);
    expect(res.body.grounds[0].status).toBe('unconfronted');
    expect(res.body.grounds[0].outcomes).toEqual([]);
  });
});

describe('E18.5 the benchmark leg is POINTED AT, never run', () => {
  it('names a checked, decay-eligible ground with ran: false', async () => {
    const f = await fixture();
    await request(app).post(`/api/graphs/${gid}/tasks/${f.ground}/verify`)
      .send({ outcome: 'held', happened_at: '2026-02-01T00:00:00.000Z' });
    await patchNode(f.d, { title: 'storage engine', type: 'decision', status: 'todo',
      decided_at: '2026-03-05T00:00:00.000Z' }, 'because compression');

    const res = await confront(f.d);
    const bench = res.body.benchmark.find((b) => b.id === f.ground);
    expect(bench).toBeTruthy();
    expect(bench.rerunnable).toBe(true);
    expect(bench.ran).toBe(false);
    expect(bench.check_count).toBeGreaterThanOrEqual(1);
    expect(bench.retrievability).toBeGreaterThan(0);
    expect(bench.retrievability).toBeLessThanOrEqual(1);
    expect(bench.decay).toBe(true);
    expect(res.body.limits.benchmark_run).toBe(false);
  });

  it('a ground that was never checked is not re-runnable, and is left out', async () => {
    const f = await fixture();
    const res = await confront(f.d);
    expect(res.body.benchmark).toEqual([]);
  });

  it('the call writes nothing at all — no event, no status, no version bump', async () => {
    const f = await fixture();
    await request(app).post(`/api/graphs/${gid}/tasks/${f.ground}/verify`)
      .send({ outcome: 'held', happened_at: '2026-02-01T00:00:00.000Z' });
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
    const res = await confront(f.d);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(await snap()).toEqual(before);
  });
});

describe('E18.5 the limits block', () => {
  it('is present, machine-readable and constant', async () => {
    const f = await fixture();
    const res = await confront(f.d);
    expect(res.body.limits).toEqual({
      counterfactual: false,
      benchmark_run: false,
      verdict: false,
      silence_is_not_vindication: true,
      context_complete: true,
    });
    // `limits.verdict: false` is the ONLY place the word appears: no ground, no
    // outcome and no benchmark row carries a judgement of its own.
    for (const g of res.body.grounds) {
      expect(Object.keys(g)).not.toContain('verdict');
      expect(Object.keys(g)).not.toContain('was_right');
    }
    expect(res.body.decision.verdict).toBeUndefined();
  });

  it('404s an id that is not in this graph', async () => {
    expect((await confront(999999)).status).toBe(404);
    expect((await request(app).post(`/api/graphs/${gid}/decisions/abc/confrontation`).send({})).status)
      .toBe(400);
  });
});
