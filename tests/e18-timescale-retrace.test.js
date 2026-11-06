// E18.5 — THE CHAIN TEST. Retracing a real decision, end to end.
//
// The fixture mirrors the trading graph's storage-engine decision: a shared
// requirement and two findings fan into two options (Timescale chosen,
// ClickHouse the road not taken, with two spikes actually recorded under it),
// contingent work hangs off the chosen option, a confidence-bearing prediction
// and a once-verified benchmark are wired into the decision, the decision is
// COMMITTED, the prediction is later REFUTED with `cause_id` pointing at the
// commitment, and finally the decision is REOPENED and its body rewritten.
//
// One scenario, and it asserts the whole rung:
//
//   1. the contingency closure is the blast radius of reopening;
//   2. the ClickHouse overlay is EXACTLY the two recorded spikes — no fabricated
//      counterfactual, and the chosen branch is not mirrored into it;
//   3. the confrontation reconstructs the context at the SEQ of `decision.made`
//      and not at the backdatable `decided_at`;
//   4. the prediction pairs with its refutation, `via: fate` and `via: cause`
//      reported SEPARATELY;
//   5. the benchmark is pointed at with `ran: false`;
//   6. the dormant branch never reached /ready, and NOTHING auto-flipped;
//   7. after the reopen the `decision.made` event is BYTE-IDENTICAL and the
//      original rationale is still readable FROM THE LOG — asserted against the
//      log, never against the current row, which by then says something else.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { BRANCH_PURPOSE } from '../src/branches.js';

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
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('trading-retrace') RETURNING id");
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

async function mkEdge(source, target, purpose, meta = undefined) {
  const res = await request(app).post(`/api/graphs/${gid}/edges`)
    .send({ source_id: source, target_id: target, purpose, ...(meta ? { meta } : {}) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

const DECISION_BODY = [
  'We are choosing Timescale.',
  '',
  'Compression on our shape is the binding constraint, and the 12x finding is',
  'what the choice rests on. ClickHouse ingests faster; we do not need that.',
].join('\n');

const REWRITTEN_BODY = 'Actually we are reconsidering. Ingest turned out to be the constraint.';

const T_BENCH = '2026-02-01T00:00:00.000Z';
const T_DECIDE = '2026-03-01T00:00:00.000Z';
const T_REFUTE = '2026-06-01T00:00:00.000Z';

async function scenario() {
  // ── the shared substrate ────────────────────────────────────────────────
  const req = await mkNode('must sustain 100k rows/s ingest', { status: 'done' });
  const findTs = await mkNode('Timescale compresses 12x on our shape', { confidence: 0.8 });
  const findCh = await mkNode('ClickHouse ingests 1.2M rows/s', { confidence: 0.9 });
  const bench = await mkNode('ingest throughput bench', { type: 'reference' });

  // ── the decision and its two roads ──────────────────────────────────────
  const d = await mkNode('storage engine', { type: 'decision' }, DECISION_BODY);
  const ts = await mkNode('Timescale');
  const ch = await mkNode('ClickHouse');

  const workA = await mkNode('hypertable migration');
  const workA2 = await mkNode('continuous aggregates');
  const spike1 = await mkNode('clickhouse ingest spike');
  const spike2 = await mkNode('clickhouse ops cost note', { confidence: 0.5 });

  await mkEdge(req, ts, 'required for');
  await mkEdge(req, ch, 'required for');
  await mkEdge(findTs, d, 'supports');      // THE PREDICTION
  await mkEdge(findCh, d, 'supports');
  await mkEdge(bench, d, 'supports');       // THE BENCHMARK
  await mkEdge(d, ts, BRANCH_PURPOSE, { branch: { role: 'chosen' } });
  await mkEdge(d, ch, BRANCH_PURPOSE, { branch: { role: 'alternative' } });
  await mkEdge(ts, workA, 'required for');
  await mkEdge(workA, workA2, 'required for');
  await mkEdge(ch, spike1, 'required for');
  await mkEdge(ch, spike2, 'required for');

  // ── the benchmark was run ONCE, before the decision ──────────────────────
  await request(app).post(`/api/graphs/${gid}/tasks/${bench}/verify`)
    .send({ outcome: 'held', happened_at: T_BENCH });

  // ── T0: the commitment ───────────────────────────────────────────────────
  const committed = await request(app).patch(`/api/graphs/${gid}/tasks/${d}`)
    .send({ content: node({ title: 'storage engine', type: 'decision', status: 'todo',
                            decided_at: T_DECIDE }, DECISION_BODY) });
  expect(committed.status).toBe(200);
  const madeRows = await pool.query(
    `SELECT seq FROM events WHERE graph_id = $1 AND subject_id = $2
       AND payload -> 'kinds' ? 'decision.made' ORDER BY seq DESC LIMIT 1`,
    [gid, d],
  );
  const decisionSeq = Number(madeRows.rows[0].seq);

  // ── after T0: the prediction is refuted, BECAUSE OF the decision ─────────
  const refuted = await request(app).post(`/api/graphs/${gid}/tasks/${findTs}/verify`)
    .send({ outcome: 'failed', happened_at: T_REFUTE, cause_id: decisionSeq });
  expect(refuted.status).toBe(200);

  return { req, findTs, findCh, bench, d, ts, ch, workA, workA2, spike1, spike2, decisionSeq };
}

const branches = (id, query = '') =>
  request(app).get(`/api/graphs/${gid}/decisions/${id}/branches${query}`);
const confront = (id, body = {}) =>
  request(app).post(`/api/graphs/${gid}/decisions/${id}/confrontation`).send(body);

describe('E18.5 retracing the storage-engine decision', () => {
  it('runs the whole scenario', async () => {
    const s = await scenario();

    // ── 1. the branches, the overlay, the contingency closure ─────────────
    const view = await branches(s.d);
    expect(view.status).toBe(200);
    expect(view.body.decision.state).toBe('committed');
    expect(view.body.decision.decision_seq).toBe(s.decisionSeq);
    expect(view.body.decision.decided_at).toBe(T_DECIDE);

    const chosen = view.body.options.find((o) => o.node_id === s.ts);
    const alternative = view.body.options.find((o) => o.node_id === s.ch);
    expect(chosen.role).toBe('chosen');
    expect(alternative.role).toBe('alternative');

    // 2. THE ROAD NOT TAKEN: exactly the two spikes that were actually
    //    recorded, their two edges, and nothing else. The chosen branch is NOT
    //    mirrored into it with the names swapped, and nothing is invented.
    expect(alternative.overlay.node_ids).toEqual([s.ch, s.spike1, s.spike2].sort((a, b) => a - b));
    expect(alternative.overlay.work_count).toBe(2);
    expect(alternative.overlay.edge_count).toBe(2);
    expect(alternative.overlay.fabricated).toBe(false);
    expect(alternative.overlay.basis).toBe('log-projection');
    expect(alternative.overlay.empty).toBe(false);
    expect(alternative.overlay.node_ids).not.toContain(s.ts);
    expect(alternative.overlay.node_ids).not.toContain(s.workA);
    // The shared requirement is UPSTREAM of both roads, so it is in neither
    // overlay and in no dormant set.
    expect(alternative.overlay.node_ids).not.toContain(s.req);
    expect(chosen.overlay.node_ids).toEqual([s.ts, s.workA, s.workA2].sort((a, b) => a - b));

    // The dormant set: the alternative and its exclusive subtree.
    expect(view.body.dormant.node_ids).toEqual([s.ch, s.spike1, s.spike2].sort((a, b) => a - b));
    expect(view.body.dormant.contested).toEqual([]);
    expect(view.body.dormant.node_ids).not.toContain(s.req);

    // The blast radius of reopening: both roads and everything under them.
    expect(view.body.contingency.count).toBe(6);
    const contingent = new Map(view.body.contingency.nodes.map((n) => [n.id, n]));
    expect([...contingent.keys()].sort((a, b) => a - b))
      .toEqual([s.ts, s.ch, s.workA, s.workA2, s.spike1, s.spike2].sort((a, b) => a - b));
    expect(contingent.get(s.workA2).hops).toBe(3);
    expect(contingent.get(s.workA2).chain.map((h) => h.purpose))
      .toEqual([BRANCH_PURPOSE, 'required for', 'required for']);
    expect(contingent.get(s.spike1).dormant).toBe(true);
    expect(contingent.get(s.workA).dormant).toBe(false);
    expect(view.body.contingency.truncated).toBe(false);

    // ── 3/4/5. the confrontation ──────────────────────────────────────────
    const conf = await confront(s.d);
    expect(conf.status).toBe(200);

    // The context is pinned at the SEQ of decision.made — not at `decided_at`,
    // which is a world-time scalar any writer may backdate.
    expect(conf.body.context.basis).toBe('event_seq');
    expect(conf.body.context.axis).toBe('learned');
    expect(conf.body.context.as_of.seq).toBe(s.decisionSeq);
    expect(conf.body.context.as_of.requested).toBe(s.decisionSeq);
    expect(conf.body.context.complete).toBe(true);
    // ...and the world-time reading is reported beside it, not instead of it.
    expect(conf.body.context.world_at_decision.axis).toBe('happened');
    expect(conf.body.context.world_at_decision.requested).toBe(T_DECIDE);

    // The prediction pairs with its refutation. TWO MECHANISMS, TWO ROWS, one
    // event: `fate` is "what happened to the thing we relied on", `cause` is
    // "this was recorded because of that decision". They are never merged.
    const prediction = conf.body.grounds.find((g) => g.id === s.findTs);
    expect(prediction.prediction).toBe(true);
    expect(prediction.prediction_basis).toBe('confidence');
    expect(prediction.present_at_decision).toBe(true);
    expect(prediction.confidence_at_decision).toBe(0.8);
    expect(prediction.status).toBe('contradicted_since');
    expect(prediction.outcomes.map((o) => o.via).sort()).toEqual(['cause', 'fate']);
    expect(new Set(prediction.outcomes.map((o) => o.seq)).size).toBe(1);
    expect(prediction.outcomes.every((o) => o.seq > s.decisionSeq)).toBe(true);
    expect(prediction.outcomes.find((o) => o.via === 'fate').kind).toBe('claim.refuted');

    // The finding recorded while exploring the ROAD NOT TAKEN is still a live
    // ground of the decision and is simply unconfronted — it did not become
    // false when we chose Timescale.
    const chFinding = conf.body.grounds.find((g) => g.id === s.findCh);
    expect(chFinding.status).toBe('unconfronted');
    expect(conf.body.limits.silence_is_not_vindication).toBe(true);

    // The empirical leg is POINTED AT and never run.
    const bench = conf.body.benchmark.find((b) => b.id === s.bench);
    expect(bench).toBeTruthy();
    expect(bench.rerunnable).toBe(true);
    expect(bench.ran).toBe(false);
    expect(bench.check_count).toBe(1);
    expect(bench.last_check.happened_at).toBe(T_BENCH);
    expect(bench.decay).toBe(true);
    expect(typeof bench.retrievability).toBe('number');
    expect(conf.body.limits).toEqual({
      counterfactual: false,
      benchmark_run: false,
      verdict: false,
      silence_is_not_vindication: true,
      context_complete: true,
    });

    // The rationale is provably unchanged — by sha, not by trust.
    expect(conf.body.rationale.unchanged_since_decision).toBe(true);
    expect(conf.body.rationale.content_sha_at_decision)
      .toBe(conf.body.rationale.content_sha_now);
    expect(conf.body.rationale.text_recoverable).toBe(true);

    // ── 6. the dormant branch never reached the work queue ────────────────
    const readyBefore = await request(app).get(`/api/graphs/${gid}/tasks/ready`);
    const readyIds = readyBefore.body.map((t) => Number(t.id));
    expect(readyIds).toContain(s.ts);
    expect(readyIds).not.toContain(s.ch);
    expect(readyIds).not.toContain(s.spike1);
    // spike2 carries a confidence, so it is a claim and was never ready work.
    expect(readyIds).not.toContain(s.spike2);

    // NOTHING AUTO-FLIPPED: every status is exactly what a human left it as.
    const statuses = await pool.query(
      `SELECT id, meta ->> 'status' AS status FROM tasks WHERE graph_id = $1 ORDER BY id`, [gid],
    );
    const byId = new Map(statuses.rows.map((r) => [Number(r.id), r.status]));
    expect(byId.get(s.ch)).toBe('todo');
    expect(byId.get(s.spike1)).toBe('todo');
    expect(byId.get(s.ts)).toBe('todo');

    // ── 7. the reopen ─────────────────────────────────────────────────────
    const madeBefore = await pool.query(
      'SELECT to_jsonb(e) AS row FROM events e WHERE graph_id = $1 AND seq = $2',
      [gid, s.decisionSeq],
    );

    // Reopening is CLEARING the scalar — the same act gt_classify_node reads as
    // `decision.reopened`. The body is left exactly as it was.
    const reopened = await request(app).patch(`/api/graphs/${gid}/tasks/${s.d}`)
      .send({ content: node({ title: 'storage engine', type: 'decision', status: 'todo' },
                             DECISION_BODY) });
    expect(reopened.status).toBe(200);
    // ...and then somebody rewrites the body, which is the case append-only does
    // NOT protect against and must therefore be made VISIBLE.
    await request(app).patch(`/api/graphs/${gid}/tasks/${s.d}`)
      .send({ content: node({ title: 'storage engine', type: 'decision', status: 'todo' },
                             REWRITTEN_BODY) });

    // THE DECISION EVENT IS BYTE-IDENTICAL. `events` raises 0A000 on UPDATE and
    // DELETE; a `decision.reopened` event is an ADDITION and cannot alter its
    // predecessor.
    const madeAfter = await pool.query(
      'SELECT to_jsonb(e) AS row FROM events e WHERE graph_id = $1 AND seq = $2',
      [gid, s.decisionSeq],
    );
    expect(madeAfter.rows[0].row).toEqual(madeBefore.rows[0].row);

    // THE ORIGINAL RATIONALE IS STILL READABLE — FROM THE LOG, not from the row,
    // which by now says something else entirely.
    const original = await pool.query(
      `SELECT payload -> 'changes' -> 'content' ->> 'to' AS body,
              payload -> 'changes' -> 'content' ->> 'to_sha' AS sha
         FROM events WHERE graph_id = $1 AND seq = $2`,
      [gid, s.decisionSeq],
    );
    expect(original.rows[0].body).toContain('We are choosing Timescale.');
    const live = await pool.query('SELECT content FROM tasks WHERE id = $1', [s.d]);
    expect(live.rows[0].content).toContain(REWRITTEN_BODY);
    expect(live.rows[0].content).not.toContain('We are choosing Timescale.');

    const afterConf = await confront(s.d);
    expect(afterConf.body.decision.state).toBe('reopened');
    expect(afterConf.body.decision.reopened_events.length).toBe(1);
    expect(afterConf.body.decision.decision_event.seq).toBe(s.decisionSeq);
    // The sha comparison is the claim that is actually provable, and it now says
    // the body MOVED — without the view ever substituting today's text for the
    // original.
    expect(afterConf.body.rationale.content_sha_at_decision).toBe(original.rows[0].sha);
    expect(afterConf.body.rationale.unchanged_since_decision).toBe(false);
    expect(afterConf.body.rationale.text_recoverable).toBe(true);
    expect(afterConf.body.rationale.text_source_event_seq).toBe(s.decisionSeq);
    // The context leg still reconstructs at the ORIGINAL commitment's seq.
    expect(afterConf.body.context.as_of.seq).toBe(s.decisionSeq);
    expect(afterConf.body.context.basis).toBe('event_seq');

    // ── dormancy has LIFTED, and no row moved to make it happen ───────────
    const afterBranches = await branches(s.d);
    expect(afterBranches.body.decision.state).toBe('reopened');
    expect(afterBranches.body.dormant.count).toBe(0);
    // ROLES ARE NOT AUTO-FLIPPED. The tension is REPORTED.
    expect(afterBranches.body.options.map((o) => [o.node_id, o.role])).toEqual([
      [s.ts, 'chosen'], [s.ch, 'alternative'],
    ]);
    expect(afterBranches.body.options.find((o) => o.node_id === s.ts).stale_role).toBe(true);
    expect(afterBranches.body.options.find((o) => o.node_id === s.ch).stale_role).toBe(false);
    // ...and the role AT THE DECISION is still readable beside the current one.
    expect(afterBranches.body.options.find((o) => o.node_id === s.ts).role_at_decision)
      .toBe('chosen');

    const readyAfter = await request(app).get(`/api/graphs/${gid}/tasks/ready`);
    expect(readyAfter.body.map((t) => Number(t.id))).toContain(s.ch);

    // The statuses are STILL exactly what the human left them as: reopening
    // moved a DERIVATION, not a row.
    const after = await pool.query(
      `SELECT id, meta ->> 'status' AS status FROM tasks WHERE graph_id = $1 ORDER BY id`, [gid],
    );
    expect(after.rows.map((r) => r.status)).toEqual(statuses.rows.map((r) => r.status));
  });

  it('the overlay at a rectangle BEFORE the spikes existed does not contain them', async () => {
    const s = await scenario();
    // Pin to the seq at which the ClickHouse option node was created: its
    // spikes do not exist yet, so the road not taken is genuinely empty there —
    // and the view says so rather than back-filling it from today.
    const created = await pool.query(
      `SELECT seq FROM events WHERE graph_id = $1 AND subject_id = $2 AND kind = 'node.created'`,
      [gid, s.ch],
    );
    const seq = Number(created.rows[0].seq);
    const view = await branches(s.d, `?asOfSeq=${seq}`);
    expect(view.status).toBe(200);
    // No option edges existed yet at that seq either, so there is no branch to
    // describe at all — which is the honest answer, not an empty plan.
    expect(view.body.options).toEqual([]);
    expect(view.body.dormant.count).toBe(0);
    expect(view.headers['cache-control']).toBe('private, max-age=600');
  });
});
