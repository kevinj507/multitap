// E18.3 CHAIN — the acceptance scenario, end to end.
//
// THE STORY. We hold a claim about Robinhood's terms, verified in world-JUNE. A
// finding rests on it; a DONE decision rests on the finding. Today an agent
// reads a tweet saying the terms changed in world-MARCH, lands the finding, and
// wires it `supersedes` the old claim — BACKDATED to March, because that is when
// the world moved.
//
// Everything E18.3 claims has to hold at once for this to work:
//
//   * the gate is BELIEF time, or the June check (which did not know about
//     March) silences the March correction and the answer is empty;
//   * a supersession is a SEED, or nothing is weakened at all;
//   * a superseded node is a CONDUCTOR, or the walk stops at the old claim and
//     the finding and the decision — the entire point — are never reached;
//   * the anchor allowlist is positive-only, or the old claim silences itself;
//   * NOTHING AUTO-FLIPS: every status, confidence, verified_at and decided_at
//     is exactly what it was, and the read appends no event.
//
// And the two cursors stay different objects: marking the FEED as read does not
// resolve the DOUBT. Step 8 is the test that says so.
//
// Timestamps are explicit throughout (the e17-decisions.test.js:41 idiom).
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;
let user;

const WORLD_JUNE = '2026-06-04T15:40:45.000Z';
const WORLD_MARCH = '2026-03-11T09:00:00.000Z';

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  user = (await pool.query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('test-header', 'kevin', 'kevin@test.local', 'kevin') RETURNING *`)).rows[0];
  gid = (await pool.query(
    `INSERT INTO graphs (name, owner_user_id) VALUES ('robinhood', $1) RETURNING id`, [user.id])).rows[0].id;
});

// Every value is JSON-quoted: these titles contain colons ("Finding: ...",
// "Decision D19: ..."), and an unquoted colon is a nested mapping in YAML — the
// exact 400 the frontmatter parser names.
const node = (meta) =>
  `---\n${Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n`;
const me = (r) => r.set('X-Test-User-Id', 'kevin');

async function mkNode(meta, happenedAt = undefined) {
  const res = await me(request(app).post(`/api/graphs/${gid}/tasks`))
    .send({ content: node(meta), ...(happenedAt ? { happened_at: happenedAt } : {}) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}
async function mkEdge(source, target, purpose, happenedAt = undefined) {
  const res = await me(request(app).post(`/api/graphs/${gid}/edges`))
    .send({ source_id: source, target_id: target, purpose, ...(happenedAt ? { happened_at: happenedAt } : {}) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}
const doubt = (body = {}) => me(request(app).post(`/api/graphs/${gid}/doubt`)).send(body);
const changes = (q = '') => me(request(app).get(`/api/graphs/${gid}/changes${q}`));
const seen = (seq) => me(request(app).put(`/api/graphs/${gid}/changes/seen`)).send({ seq });

const headSeq = async () =>
  Number((await pool.query('SELECT COALESCE(MAX(seq),0) s FROM events WHERE graph_id = $1', [gid])).rows[0].s);
const taskState = async () =>
  (await pool.query(
    `SELECT id, meta->>'status' AS status, meta->>'confidence' AS confidence,
            meta->>'verified_at' AS verified_at, meta->>'decided_at' AS decided_at,
            updated_at, version
       FROM tasks WHERE graph_id = $1 ORDER BY id`, [gid])).rows;

describe('E18.3 ACCEPTANCE — the Robinhood scenario, end to end', () => {
  it('runs all eight steps', async () => {
    // ── 1. the world before the tweet ───────────────────────────────────────
    const A = await mkNode({ title: 'Robinhood terms (old)', status: 'review', confidence: 0.9 });
    await me(request(app).post(`/api/graphs/${gid}/tasks/${A}/verify`))
      .send({ outcome: 'held', happened_at: WORLD_JUNE });

    const C = await mkNode({ title: 'Finding: fee structure is favourable', status: 'review', confidence: 0.8 });
    const D = await mkNode({
      title: 'Decision D19: entry adapts to turn shape',
      type: 'decision', status: 'done', decided_at: WORLD_JUNE,
    });
    await mkEdge(A, C, 'supports');        // the old claim GROUNDS the finding
    await mkEdge(C, D, 'required for');    // the finding GATES the decision

    // ── 2. nothing is in doubt yet ──────────────────────────────────────────
    const quiet = await doubt();
    expect(quiet.status).toBe(200);
    expect(quiet.body.doubt).toEqual([]);
    expect(quiet.body.triggers).toEqual([]);
    const beforeTweet = await headSeq();

    // ── 3. the tweet lands, BACKDATED to the world it describes ─────────────
    const R = await mkNode({ title: 'Tweet: RH changed its terms in March', type: 'reference', status: 'done' });
    const F = await mkNode({ title: 'Robinhood terms (March revision)', status: 'review', confidence: 0.85 });
    await mkEdge(R, A, 'contradicts', WORLD_MARCH);
    const supersedesEdge = await mkEdge(F, A, 'supersedes', WORLD_MARCH);

    // ── 4. the events the supersession wrote ────────────────────────────────
    const { rows: newEvents } = await pool.query(
      `SELECT seq, kind, subject_kind, subject_id, cause_id, happened_at, payload
         FROM events WHERE graph_id = $1 AND seq > $2 AND kind IN ('edge.added','node.superseded')
         ORDER BY seq`, [gid, beforeTweet]);
    const kinds = newEvents.map((e) => e.kind);
    expect(kinds.slice(-2)).toEqual(['edge.added', 'node.superseded']);
    const edgeEvent = newEvents[newEvents.length - 2];
    const supersedeEvent = newEvents[newEvents.length - 1];
    expect(Number(supersedeEvent.subject_id)).toBe(A);
    expect(Number(supersedeEvent.cause_id)).toBe(Number(edgeEvent.seq));
    // `events_cause_precedes CHECK (cause_id < seq)` — a strict DAG.
    expect(Number(supersedeEvent.cause_id)).toBeLessThan(Number(supersedeEvent.seq));
    expect(Number(supersedeEvent.payload.superseded_by)).toBe(F);
    expect(new Date(supersedeEvent.happened_at).toISOString()).toBe(WORLD_MARCH);
    // The backdate is FLAGGED, never disguised.
    expect(supersedeEvent.payload.backdated).toBe(true);

    // ── 5. THE ANSWER ───────────────────────────────────────────────────────
    const before = await taskState();
    const beforeHead = await headSeq();

    const front = await doubt();
    expect(front.status).toBe(200);
    const ids = front.body.doubt.map((d) => d.id);

    // A is SUPERSEDED: its story ended, and re-checking it is work nobody
    // should be handed. It is absent as an ITEM...
    expect(ids).not.toContain(A);
    // ...and C and D — which rest on it — are BOTH here. This is the whole
    // rung: prune the walk at A and this array is empty.
    expect(ids).toContain(C);
    expect(ids).toContain(D);

    const itemC = front.body.doubt.find((d) => d.id === C);
    const itemD = front.body.doubt.find((d) => d.id === D);

    // The DONE decision surfaces. Status-independence is the point.
    expect(itemD.status).toBe('done');
    expect(itemD.kind).toBe('decision');
    // 1 (supersession seed) x 0.6 (supports) x 1 (required for) = 0.6.
    expect(itemC.weight).toBeCloseTo(0.6, 10);
    expect(itemD.weight).toBeCloseTo(0.6, 10);
    expect(itemC.hops).toBe(1);
    expect(itemD.hops).toBe(2);

    // The chain names the superseded conductor, flagged, so a reader sees
    // "this rests on A, and A has been replaced" without A occupying a row.
    expect(itemC.cause.hops).toEqual([
      { from: A, to: C, edge_id: expect.any(Number), purpose: 'supports', weight: 0.6, from_superseded: true },
    ]);
    expect(itemD.cause.hops[0]).toMatchObject({ from: A, to: C, purpose: 'supports', from_superseded: true });
    expect(itemD.cause.hops[1]).toMatchObject({ from: C, to: D, purpose: 'required for', from_superseded: false });
    expect(itemD.cause.truncated).toBe(false);

    // The trigger names the SUCCESSOR, so the remedy — rewiring onto F — is one
    // click from the answer. It stays a deliberate act with its own event.
    const trigger = front.body.triggers.find((t) => t.kind === 'supersession');
    expect(trigger).toMatchObject({ subject_id: A, superseded_by: F, weight: 1, weight_source: 'magnitude' });
    expect(trigger.seq).toBe(Number(supersedeEvent.seq));
    expect(new Date(trigger.happened_at).toISOString()).toBe(WORLD_MARCH);

    // The June check was of a LATER world than the March correction describes —
    // reported, and it must never suppress.
    expect(front.body.doubt.every((d) => typeof d.verified_after_in_world === 'boolean')).toBe(true);

    // ── 6. NOTHING AUTO-RESOLVED ────────────────────────────────────────────
    expect(await taskState()).toEqual(before);
    expect(await headSeq()).toBe(beforeHead);
    const a = before.find((r) => r.id === A);
    expect(a.status).toBe('review');
    expect(a.confidence).toBe('0.9');
    expect(a.verified_at).toBe(WORLD_JUNE);
    expect(before.find((r) => r.id === D).decided_at).toBe(WORLD_JUNE);
    expect(before.find((r) => r.id === D).status).toBe('done');

    // ── 7. what changed AND what it broke, in one answer ────────────────────
    const feed = await changes(`?since=${beforeTweet}`);
    expect(feed.status).toBe(200);
    expect(feed.body.events.map((e) => e.seq)).toContain(Number(supersedeEvent.seq));
    expect(feed.body.unseen).toBeGreaterThan(0);
    const fedTrigger = feed.body.doubt_triggers.find((t) => t.kind === 'supersession');
    expect(fedTrigger).toMatchObject({ subject_id: A, superseded_by: F });
    expect(fedTrigger.seq).toBe(Number(supersedeEvent.seq));

    // ── 8. the two cursors are DIFFERENT OBJECTS ────────────────────────────
    const head = feed.body.head_seq;
    expect((await seen(head)).status).toBe(200);
    const settled = await changes();
    expect(settled.body.unseen).toBe(0);
    expect(settled.body.cursor.source).toBe('stored');

    // Marking the FEED as read does NOT resolve the DOUBT.
    const still = await doubt();
    const stillIds = still.body.doubt.map((d) => d.id);
    expect(stillIds).toContain(C);
    expect(stillIds).toContain(D);
    expect(still.body.doubt.find((d) => d.id === D).weight).toBeCloseTo(0.6, 10);

    // And the reverse: re-verifying C takes C off the front and does not touch
    // the feed cursor. Re-verifying is a DELIBERATE act with its own event.
    await me(request(app).post(`/api/graphs/${gid}/tasks/${C}/verify`))
      .send({ outcome: 'held', happened_at: '2026-09-12T00:00:00.000Z' });
    const afterRecheck = await doubt();
    expect(afterRecheck.body.doubt.map((d) => d.id)).not.toContain(C);
    // D still rests on A THROUGH C: re-verifying C is not a statement about D.
    expect(afterRecheck.body.doubt.map((d) => d.id)).toContain(D);
    // The feed cursor did not move on its own; there is simply new history.
    const feedAfter = await changes();
    expect(feedAfter.body.cursor.last_seen_seq).toBe(head);
    expect(feedAfter.body.unseen).toBeGreaterThan(0);
  });

  it('MUTATION CHECK: pruning the walk at the superseded node empties the answer', async () => {
    // The test that stops the obvious "optimisation". Built by hand here rather
    // than by editing src/: the doubt front with `scope: 'nodes'` restricted to
    // the superseded node's own descendants is exactly what a prune would
    // delete, so asserting it is NON-EMPTY is asserting the conductor rule.
    const A = await mkNode({ title: 'old', status: 'review', confidence: 0.9 });
    const C = await mkNode({ title: 'rests on old', status: 'review', confidence: 0.8 });
    const F = await mkNode({ title: 'successor', status: 'review', confidence: 0.9 });
    await mkEdge(A, C, 'supports');
    await mkEdge(F, A, 'supersedes', WORLD_MARCH);

    const res = await doubt();
    const ids = res.body.doubt.map((d) => d.id);
    expect(ids).toEqual([C]);
    // Every hop of C's chain passes THROUGH the superseded node. If the walk
    // stopped there, this array would be empty and the rung would be pointless.
    expect(res.body.doubt[0].cause.hops.map((h) => h.from)).toEqual([A]);
    expect(res.body.walk.nodes_visited).toBeGreaterThanOrEqual(2);
  });

  it('the GUC `gt.propagation_weight` seeds ONE weakening at a caller-chosen strength', async () => {
    // A pipeline that knows "this refutation is worth 0.4, not a full 1" says
    // so on the EVENT — the moment a fact was weakened. The standing strength
    // of a RELATION is a different knob (edges.meta.propagation), and the two
    // are not interchangeable: a GUC lands on one event.
    const A = await mkNode({ title: 'A', status: 'review', confidence: 0.9 });
    const B = await mkNode({ title: 'B', status: 'review', confidence: 0.8 });
    await mkEdge(A, B, 'required for');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('gt.propagation_weight', '0.4', true)");
      await client.query(
        `UPDATE tasks SET meta = meta || '{"refuted_at":"2026-09-01T00:00:00.000Z"}'::jsonb WHERE id = $1`, [A]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const res = await doubt();
    const trigger = res.body.triggers[0];
    expect(trigger).toMatchObject({ kind: 'refutation', magnitude: 1, weight: 0.4, weight_source: 'payload' });
    // The seed enters the walk at 0.4 and the hard `required for` edge carries
    // it undiminished.
    expect(res.body.doubt.find((d) => d.id === A).weight).toBeCloseTo(0.4, 10);
    expect(res.body.doubt.find((d) => d.id === B).weight).toBeCloseTo(0.4, 10);
  });
});
