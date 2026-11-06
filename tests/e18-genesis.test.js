// E18.1 STEP 7 — genesis, and the fsck that proves the log and the live tables
// tell the same story.
//
// Genesis is the ONE snapshot that is not derivable from the log: it describes
// the world BEFORE the log existed. Everything else in E18 is a pure function
// of `events`, so everything else can be rebuilt; this row cannot, and that is
// why it gets its own file.
//
// Five things are pinned here, and each one is a place the feature would
// otherwise rot quietly:
//
//  1. THE BACKFILL IS FAITHFUL. A legacy graph's seq-0 substrate, projected,
//     deep-equals `GET /graph`. Not "looks similar" — the same object.
//
//  2. IT IS IDEMPOTENT. A second call writes nothing and does not disturb the
//     row it finds (same sha, same `at`, same `built_at`).
//
//  3. THE RACE IS CLOSED. The genesis base is seq 0, every racing write gets
//     seq >= 1 and is therefore replayed, and the fold is idempotent — so a
//     write that lands AFTER the backfill shows up in `asOf=now`, and one that
//     landed BEFORE it is not double-counted. Both directions are asserted,
//     because a design that only survives one of them is not race-safe.
//
//  4. THE BRIDGE. `stateFromLiveRows` and the fold at head produce BYTE-equal
//     canonical JSON for a graph built entirely through the API. This is the
//     join between the two halves of the system: the materialized present and
//     the replayed past have to be the same graph, or `?asOf=now` is a
//     different answer from `GET /graph` and the whole epic is decorative.
//
//  5. THE FSCK, AND THE WHOLE THESIS. `diffFoldVsLive` returns ok:true after
//     every capture scenario — and STILL returns ok:true after the present is
//     poisoned by a raw `UPDATE tasks SET meta = ...` that no route ever saw.
//     Under handler-authored logging that poison would be an invisible gap.
//     Under trigger capture the poison is itself captured, so the fold tracks
//     it. That test is the standing proof of the reason Proposal A was chosen.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
// src/events/snapshot.js imports only ./fold.js, so it is safe at module scope.
// Anything that reaches src/db.js must wait for beforeAll — see below.
import {
  backfillGenesis,
  backfillGenesisAll,
  diffFoldVsLive,
  foldAtHead,
  lateGenesis,
  stateFromLiveRows,
} from '../src/events/snapshot.js';
import { canonicalJson, stateSha, toGraphPayload } from '../src/events/fold.js';

let app;
let pool;
let gid;
let resetDerivedCache;

beforeAll(async () => {
  // MUST precede the import of app.js: src/db.js reads DATABASE_URL once, at
  // first import, so a static import would bind the wrong database.
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  resetDerivedCache = (await import('../src/derivedCache.js'))._resetDerivedCacheForTests;
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-genesis') RETURNING id");
  gid = g.rows[0].id;
  // Module state survives TRUNCATE; the key is `${graphId}:${seq}` so it cannot
  // leak, but clearing keeps `base.kind` assertions honest (a state cached at
  // the same (graph, seq) reports the base it used THEN).
  resetDerivedCache();
});

// ── fixtures ────────────────────────────────────────────────────────────────

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const graphUrl = (g = gid) => `/api/graphs/${g}/graph`;
const tasksUrl = (g = gid) => `/api/graphs/${g}/tasks`;
const edgesUrl = (g = gid) => `/api/graphs/${g}/edges`;

async function makeTask(meta, g = gid) {
  const res = await request(app)
    .post(tasksUrl(g))
    .send({ content: node({ status: 'todo', ...meta }) });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

async function patchTask(id, meta, g = gid) {
  const res = await request(app)
    .patch(`${tasksUrl(g)}/${id}`)
    .send({ content: node(meta) });
  expect(res.status).toBe(200);
  return res.body;
}

async function makeEdge(source_id, target_id, purpose = 'required for', g = gid) {
  const res = await request(app).post(edgesUrl(g)).send({ source_id, target_id, purpose });
  expect(res.status).toBe(201);
  return res.body;
}

// A graph as it existed BEFORE the event log shipped: rows in tasks/edges, no
// events, no genesis snapshot.
//
// Two tricks are needed, and both are documented escape hatches rather than
// test-only back doors:
//   * `gt.capture='off'` (SET LOCAL, so it dies with the transaction)
//     suppresses the row loggers, which is how the fixture gets rows without
//     events. It is the same hatch db-copy scripts use.
//   * the seq-0 row the gt_seed_genesis AFTER INSERT trigger writes for every
//     NEW graph is deleted afterwards, because a genuinely legacy graph
//     predates that trigger. graph_snapshots is pure cache and carries no
//     append-only guard, so this is a plain DELETE — unlike `events`, where
//     `gt_events_append_only` raises 0A000 unconditionally.
async function legacyGraph({ nodes = 2, edges = true } = {}) {
  const client = await pool.connect();
  let id;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('gt.capture', 'off', true)");
    const g = await client.query("INSERT INTO graphs (name) VALUES ('legacy') RETURNING id");
    id = g.rows[0].id;
    const ids = [];
    for (let i = 1; i <= nodes; i += 1) {
      const meta = { title: `legacy ${i}`, status: 'todo', significance: i / 10 };
      const t = await client.query(
        `INSERT INTO tasks (graph_id, content, meta, external_id, version)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [id, node(meta, `body ${i}`), JSON.stringify(meta), `legacy-${i}`, 3],
      );
      ids.push(t.rows[0].id);
    }
    if (edges && ids.length >= 2) {
      await client.query(
        `INSERT INTO edges (graph_id, source_id, target_id, type, purpose, meta)
         VALUES ($1, $2, $3, 'dependency'::edge_type, 'required for', '{"color":"#ff0000"}'::jsonb)`,
        [id, ids[0], ids[1]],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await pool.query('DELETE FROM graph_snapshots WHERE graph_id = $1', [id]);
  return id;
}

const snapshots = async (g) =>
  (
    await pool.query(
      `SELECT seq, kind, axis, at, built_at, state, state_sha, node_count, edge_count,
              fold_version
         FROM graph_snapshots WHERE graph_id = $1 ORDER BY seq`,
      [g],
    )
  ).rows;

const eventCount = async (g) =>
  Number((await pool.query('SELECT COUNT(*) AS n FROM events WHERE graph_id = $1', [g])).rows[0].n);

// ── 1. the backfill ─────────────────────────────────────────────────────────

describe('E18.1 genesis — the backfill', () => {
  it('writes one seq-0 substrate that projects to exactly GET /graph', async () => {
    const legacy = await legacyGraph();
    expect(await snapshots(legacy)).toEqual([]);
    expect(await eventCount(legacy)).toBe(0);

    const res = await backfillGenesisAll(pool);
    expect(res.failed).toBe(0);
    expect(res.written).toBeGreaterThanOrEqual(1);

    const rows = await snapshots(legacy);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(Number(row.seq)).toBe(0);
    expect(row.kind).toBe('genesis');
    expect(row.axis).toBe('learned');
    expect(row.fold_version).toBe(1);
    expect(row.node_count).toBe(2);
    expect(row.edge_count).toBe(1);
    // The sha is over the CANONICAL form, computed in JS. Never over a SQL-side
    // digest of the jsonb: Postgres orders jsonb keys by (length, bytes) and
    // would produce a different string for the same state.
    expect(row.state_sha).toBe(stateSha(row.state));

    // THE POINT OF THE WHOLE ROW: projected, it IS the live view.
    const live = await request(app).get(graphUrl(legacy));
    expect(live.status).toBe(200);
    expect(toGraphPayload(row.state)).toEqual({ nodes: live.body.nodes, links: live.body.links });

    // And it is byte-identical to the live cut read independently.
    expect(canonicalJson(row.state)).toBe(canonicalJson(await stateFromLiveRows(pool, legacy)));

    // Writing genesis appends NO events. Genesis is a substrate, not an event —
    // that is why the locked v1 kind list has no `graph.genesis`.
    expect(await eventCount(legacy)).toBe(0);
  });

  it('is a no-op on the second call and never disturbs the row it finds', async () => {
    const legacy = await legacyGraph();
    await backfillGenesisAll(pool);
    const before = (await snapshots(legacy))[0];

    const again = await backfillGenesisAll(pool);
    // The candidate query filters graphs that already have a genesis row, so a
    // steady-state boot does not even open a transaction per graph.
    expect(again.graphs).toBe(0);
    expect(again.written).toBe(0);

    // And the direct per-graph call is idempotent too, which is the property
    // that actually matters if two processes boot at once.
    const direct = await backfillGenesis(pool, legacy);
    expect(direct.written).toBe(false);
    expect(direct.reason).toBe('already_present');

    const after = (await snapshots(legacy))[0];
    expect(after.state_sha).toBe(before.state_sha);
    expect(after.at.getTime()).toBe(before.at.getTime());
    expect(after.built_at.getTime()).toBe(before.built_at.getTime());
  });

  it('reports a missing graph instead of throwing', async () => {
    const res = await backfillGenesis(pool, 'nosuchgraphid');
    expect(res).toMatchObject({ written: false, reason: 'graph_missing' });
  });

  it('leaves already-seeded graphs alone (the gt_seed_genesis trigger owns them)', async () => {
    // `gid` was created through a plain INSERT, so the AFTER INSERT trigger has
    // already written its empty substrate. The backfill must not see it as work.
    const rows = await snapshots(gid);
    expect(rows).toHaveLength(1);
    expect(canonicalJson(rows[0].state)).toBe('{"v":1,"nodes":[],"edges":[]}');

    const res = await backfillGenesisAll(pool);
    expect(res.graphs).toBe(0);
  });
});

// ── 2. the race ─────────────────────────────────────────────────────────────

describe('E18.1 genesis — race safety', () => {
  it('includes a write that lands AFTER the backfill', async () => {
    const legacy = await legacyGraph();
    await backfillGenesisAll(pool);

    // The racing write. seq >= 1, so it is in the replay tail no matter when it
    // happened relative to the seq-0 base.
    const fresh = await makeTask({ title: 'after the backfill' }, legacy);

    resetDerivedCache();
    const res = await request(app)
      .get(graphUrl(legacy))
      .query({ asOf: new Date(Date.now() + 60000).toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.as_of.base.kind).toBe('genesis');
    expect(res.body.as_of.base.seq).toBe(0);
    expect(res.body.as_of.events_replayed).toBe(1);
    expect(res.body.nodes.map((n) => n.id).sort((a, b) => a - b)).toContain(fresh.id);

    // asOf=now must deep-equal the live view — the join the whole design rests on.
    const live = await request(app).get(graphUrl(legacy));
    expect(res.body.nodes).toEqual(live.body.nodes);
    expect(res.body.links).toEqual(live.body.links);
  });

  // THE BOOT WINDOW, and the one place a seq-0 genesis must NOT be written.
  //
  // The new binary is up — so the triggers exist and every write is captured —
  // but the backfill has not run yet. `stateFromLiveRows` now reads the state
  // at the HEAD, not the state before event 1. Stamping it at seq 0 makes the
  // substrate encode the effects of events 1..N, and because the fold is
  // forward-only and `to`-only it can never un-apply them: every `?asOf` below
  // the head then answers with changes that had not been learned yet, with
  // `truncated: false` and `pre_history_approximation: false` — no warning at
  // all. Reproduced on a clone of production before the head check: a graph
  // whose only events were `node.created` then `status.changed` reported the
  // post-change state at seq 0.
  //
  // The live cut belongs at the head instead, which is exactly what
  // `lateGenesis` writes.
  it('refuses to stamp the live state at seq 0 once the log has moved', async () => {
    const legacy = await legacyGraph();
    const created = await makeTask({ title: 'during the window' }, legacy);
    await patchTask(created.id, { title: 'during the window', status: 'review' }, legacy);
    const doomed = await makeTask({ title: 'created then destroyed' }, legacy);
    await request(app).delete(`${tasksUrl(legacy)}/${doomed.id}`).expect(200);
    expect(await eventCount(legacy)).toBe(4);

    const res0 = await backfillGenesis(pool, legacy);
    expect(res0).toMatchObject({
      written: true,
      reason: 'head_ahead_of_genesis',
      head_seq: 4,
      seq: 4,
      pre_history_approximation: true,
    });

    // No seq-0 row. The only snapshot is the late genesis AT THE HEAD.
    const rows = await snapshots(legacy);
    expect(rows.map((r) => Number(r.seq))).toEqual([4]);
    expect(rows[0].kind).toBe('periodic');

    // THE DEFECT, stated as an assertion: the state BEFORE the log started must
    // not contain the node the log says was created at seq 1, and must not
    // claim to be exact history. With the poisoned seq-0 genesis this returned
    // both legacy nodes AND `created` (already patched to 'review'), flagged
    // `pre_history_approximation: false`.
    resetDerivedCache();
    const atZero = await request(app).get(graphUrl(legacy)).query({ asOfSeq: 0 });
    expect(atZero.status).toBe(200);
    expect(atZero.body.nodes.map((n) => n.id)).not.toContain(created.id);
    expect(atZero.body.as_of.pre_history_approximation).toBe(true);

    // Mid-history is honest too: at seq 1 the node exists but its status is the
    // one the log recorded THEN, not the one the patch at seq 2 set.
    resetDerivedCache();
    const atOne = await request(app).get(graphUrl(legacy)).query({ asOfSeq: 1 });
    const node1 = atOne.body.nodes.find((n) => n.id === created.id);
    expect(node1).toBeTruthy();
    expect(node1.meta.status).toBe('todo');
    expect(atOne.body.as_of.pre_history_approximation).toBe(true);

    // And the head still answers exactly — that is what the late genesis buys.
    resetDerivedCache();
    const res = await request(app)
      .get(graphUrl(legacy))
      .query({ asOf: new Date(Date.now() + 60000).toISOString() });
    expect(res.body.as_of.base).toMatchObject({ kind: 'periodic', seq: 4 });
    expect(res.body.as_of.anomalies).toEqual([]);

    const live = await request(app).get(graphUrl(legacy));
    expect(res.body.nodes).toEqual(live.body.nodes);
    expect(res.body.links).toEqual(live.body.links);
    expect(res.body.nodes.map((n) => n.id)).not.toContain(doomed.id);
  });

  // The backfill runs on EVERY boot and a graph in this state never gains a
  // genesis row, so it is a backfill candidate forever. It must not rewrite a
  // whole state every time: the periodic base it already has answers the head
  // by replaying its tail.
  it('does not re-approximate on the next boot', async () => {
    const legacy = await legacyGraph();
    await makeTask({ title: 'post-log' }, legacy);
    expect(await backfillGenesis(pool, legacy)).toMatchObject({ written: true, seq: 1 });
    const before = await snapshots(legacy);

    await makeTask({ title: 'later still' }, legacy);
    const again = await backfillGenesis(pool, legacy);
    expect(again).toMatchObject({
      written: false,
      reason: 'head_ahead_of_genesis',
      head_seq: 2,
      pre_history_approximation: true,
    });
    const after = await snapshots(legacy);
    expect(after.map((r) => Number(r.seq))).toEqual(before.map((r) => Number(r.seq)));
    expect(after[0].built_at.getTime()).toBe(before[0].built_at.getTime());
  });

  it('an asOf before history returns the genesis state, truncated — not a 404', async () => {
    const legacy = await legacyGraph();
    await backfillGenesisAll(pool);
    await makeTask({ title: 'later' }, legacy);

    resetDerivedCache();
    const res = await request(app).get(graphUrl(legacy)).query({ asOf: '2020-01-01T00:00:00Z' });
    expect(res.status).toBe(200);
    expect(res.body.as_of.truncated).toBe(true);
    expect(res.body.as_of.seq).toBe(0);
    expect(res.body.as_of.base.kind).toBe('genesis');
    // The left edge of a timeline slider: the best available answer, flagged.
    expect(res.body.nodes).toHaveLength(2);
  });
});

// ── 3. the fallback ─────────────────────────────────────────────────────────

describe('E18.1 genesis — the late-genesis fallback', () => {
  it('flags pre_history_approximation when the substrate is missing', async () => {
    const legacy = await legacyGraph();
    const t = await makeTask({ title: 'post-log' }, legacy);

    // Backfill never ran. Everything the log saw is exact; the pre-log rows are
    // simply absent from the reconstruction, and the envelope says so.
    resetDerivedCache();
    const bare = await request(app)
      .get(graphUrl(legacy))
      .query({ asOf: new Date(Date.now() + 60000).toISOString() });
    expect(bare.body.as_of.base.kind).toBe('empty');
    expect(bare.body.as_of.pre_history_approximation).toBe(true);
    expect(bare.body.nodes.map((n) => n.id)).toEqual([t.id]);

    // The fallback: a periodic snapshot at the head, built from the live rows.
    // It cannot be a genesis row — `snapshots_genesis_at_zero` pins kind
    // 'genesis' to seq 0 and lying about the seq would break the replay tail.
    const late = await lateGenesis(pool, legacy);
    expect(late).toMatchObject({ written: true, pre_history_approximation: true });
    expect(late.seq).toBe(1);

    resetDerivedCache();
    const res = await request(app)
      .get(graphUrl(legacy))
      .query({ asOf: new Date(Date.now() + 60000).toISOString() });
    expect(res.body.as_of.base.kind).toBe('periodic');
    expect(res.body.as_of.pre_history_approximation).toBe(true);
    // The asOf floor has moved up to the late genesis, so anything earlier is
    // honestly flagged as beyond what this log can answer.
    expect(res.body.as_of.history_starts_at).toBeTruthy();
    // And the answer itself is now complete — the pre-log rows are back.
    const live = await request(app).get(graphUrl(legacy));
    expect(res.body.nodes).toEqual(live.body.nodes);
    expect(res.body.links).toEqual(live.body.links);
  });

  it('refuses to approximate a graph that has a real genesis available', async () => {
    const legacy = await legacyGraph();
    const res = await lateGenesis(pool, legacy);
    // No events yet: the empty-to-now replay is exact, so an "approximation"
    // would be a lie rather than a fallback.
    expect(res).toMatchObject({ written: false, reason: 'no_events' });
  });

  it('reports pre_history_approximation false for a normally seeded graph', async () => {
    await makeTask({ title: 'ordinary' });
    resetDerivedCache();
    const res = await request(app).get(graphUrl()).query({ asOfSeq: 1 });
    expect(res.body.as_of.pre_history_approximation).toBe(false);
  });
});

// ── 4. the bridge ───────────────────────────────────────────────────────────

describe('E18.1 — stateFromLiveRows == fold-at-head', () => {
  it('is byte-equal for a graph built entirely through the API', async () => {
    const a = await makeTask({ title: 'A', significance: 0.3 });
    const b = await makeTask({ title: 'B', description: 'bee' });
    const c = await makeTask({ title: 'C' });
    const e1 = await makeEdge(a.id, b.id);
    await makeEdge(b.id, c.id, 'supports');
    await patchTask(a.id, { title: 'A prime', status: 'review', significance: 0.4 });
    await patchTask(b.id, { title: 'B', description: 'bee', status: 'done', confidence: 0.9 });
    await request(app)
      .patch(`${edgesUrl()}/${e1.id}`)
      .send({ purpose: 'supports' })
      .expect(200);
    await request(app).delete(`${tasksUrl()}/${c.id}`).expect(200);

    const live = await stateFromLiveRows(pool, gid);
    const folded = await foldAtHead(pool, gid);
    expect(folded.base.kind).toBe('genesis');
    expect(folded.anomalies).toEqual([]);

    // BYTE equality, with no projection step in between. Anything weaker would
    // let the two drift in a field /graph does not happen to show.
    expect(canonicalJson(folded.state)).toBe(canonicalJson(live));
    expect(stateSha(folded.state)).toBe(stateSha(live));

    // Deleting C also cascaded its edge away; both sides agree it is gone.
    expect(folded.state.nodes.map((n) => n.id)).toEqual([a.id, b.id]);
    expect(folded.state.edges).toHaveLength(1);
  });
});

// ── 5. the fsck ─────────────────────────────────────────────────────────────

describe('E18.1 — diffFoldVsLive', () => {
  it('is ok after every capture scenario', async () => {
    const a = await makeTask({ title: 'A' });
    const b = await makeTask({ title: 'B' });
    const c = await makeTask({ title: 'C' });
    await makeEdge(a.id, b.id);
    const e2 = await makeEdge(b.id, c.id);

    // status change, field set, body-only patch, edge retype, edge rewire,
    // edge meta patch, node delete + cascade — one of each shape the
    // classifier can produce.
    await patchTask(a.id, { title: 'A', status: 'in_progress' });
    await patchTask(a.id, { title: 'A', status: 'in_progress', confidence: 0.4 });
    await patchTask(b.id, { title: 'B', status: 'todo' }, gid);
    await request(app)
      .patch(`${tasksUrl()}/${b.id}`)
      .send({ content: node({ title: 'B', status: 'todo' }, 'a new body') })
      .expect(200);
    await request(app).patch(`${edgesUrl()}/${e2.id}`).send({ purpose: 'contradicts' }).expect(200);
    await request(app).patch(`${edgesUrl()}/${e2.id}`).send({ target_id: a.id }).expect(200);
    await request(app).patch(`${edgesUrl()}/${e2.id}`).send({ meta: { color: '#3366ff' } }).expect(200);

    const fsck = await diffFoldVsLive(pool, gid);
    expect(fsck.anomalies).toEqual([]);
    expect(fsck.nodes).toMatchObject({ missing: [], extra: [], differing: [] });
    expect(fsck.edges).toMatchObject({ missing: [], extra: [], differing: [] });
    expect(fsck.ok).toBe(true);

    // Now the cascade, which is the case a handler-authored log gets wrong: the
    // HTTP response says `{deleted: 1}` and never learns the edges existed.
    await request(app).delete(`${tasksUrl()}/${b.id}`).expect(200);
    const after = await diffFoldVsLive(pool, gid);
    expect(after.ok).toBe(true);
    expect(after.nodes.missing).toEqual([]);
    expect(after.edges.extra).toEqual([]);
  });

  it('STILL returns ok:true after the present is poisoned by raw SQL', async () => {
    // THE STANDING PROOF. Under handler-authored logging this write is
    // invisible: no route ran, so no `w.append(...)` ran, so the fold would
    // still be showing the old title and this assertion would be ok:FALSE.
    // Under trigger capture the poison is itself captured — that is the whole
    // reason the trigger-first proposal was chosen — so the fold tracks it and
    // the two sources still agree.
    const a = await makeTask({ title: 'A', status: 'todo' });
    const b = await makeTask({ title: 'B' });
    await makeEdge(a.id, b.id);
    expect((await diffFoldVsLive(pool, gid)).ok).toBe(true);

    const before = await headOf(gid);
    await pool.query(
      `UPDATE tasks
          SET meta = meta || '{"title":"poisoned","status":"done","significance":0.9}'::jsonb,
              content = $2
        WHERE id = $1`,
      [a.id, node({ title: 'poisoned', status: 'done', significance: 0.9 }, 'rewritten behind the API')],
    );
    // The poison DID append an event, by construction. That is the thesis.
    expect(await headOf(gid)).toBeGreaterThan(before);

    const fsck = await diffFoldVsLive(pool, gid);
    expect(fsck.nodes.differing).toEqual([]);
    expect(fsck.ok).toBe(true);

    // And the reconstruction shows the poison, attributed to `system` because
    // nothing set an actor — fail-open attribution, not a dropped event.
    resetDerivedCache();
    const res = await request(app)
      .get(graphUrl())
      .query({ asOf: new Date(Date.now() + 60000).toISOString() });
    expect(res.body.nodes.find((n) => n.id === a.id).title).toBe('poisoned');
    const { rows } = await pool.query(
      'SELECT actor FROM events WHERE graph_id = $1 ORDER BY seq DESC LIMIT 1',
      [gid],
    );
    expect(rows[0].actor.type).toBe('system');
  });

  it('reports a genuine divergence rather than hiding it', async () => {
    // Capture OFF is the documented escape hatch, and it is the ONE way to
    // create a real gap. The fsck must find it, or it is not a check.
    const a = await makeTask({ title: 'A' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('gt.capture', 'off', true)");
      await client.query(
        `UPDATE tasks SET meta = meta || '{"title":"unlogged"}'::jsonb WHERE id = $1`,
        [a.id],
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const fsck = await diffFoldVsLive(pool, gid);
    expect(fsck.ok).toBe(false);
    expect(fsck.nodes.differing).toHaveLength(1);
    expect(fsck.nodes.differing[0].id).toBe(a.id);
    expect(fsck.nodes.differing[0].live.meta.title).toBe('unlogged');
    expect(fsck.nodes.differing[0].fold.meta.title).toBe('A');
  });
});

async function headOf(g) {
  const { rows } = await pool.query(
    'SELECT COALESCE(MAX(seq), 0) AS n FROM events WHERE graph_id = $1',
    [g],
  );
  return Number(rows[0].n);
}
