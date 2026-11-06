// E18.1 STEP 7 — periodic snapshots, and the replay-equivalence gate.
//
// A periodic snapshot is a CACHE and nothing more: `state(S) = fold(prev.state,
// events in (prev.seq, S])`. It is built by folding the LOG, never by
// re-reading `tasks`/`edges`, which is what removes any cross-source
// consistency question — a snapshot cannot disagree with the log about
// something it was computed from.
//
// THE SECOND DONE-WHEN GATE lives in this file, and it is deliberately strict:
//
//   canonicalJson(fold(snapshot, tail)) === canonicalJson(fold(genesis, all))
//
// BYTE equality of the canonical state, with NO projection step in between,
// plus matching `stateSha`. Comparing the projected `/graph` payloads instead
// would hide every divergence in a field the projection drops (content_sha,
// created_at, the whole shape of `meta` under a key /graph does not surface) —
// which is exactly where a fold bug would live. The assertion is made at three
// points that are NOT snapshot boundaries (7, 12, 17), because a checkpoint
// that is only correct AT the checkpoint is useless: every real `?asOf` lands
// between two of them and pays for the tail.
//
// Also pinned:
//   * `at` is the learned_at of the LAST EVENT FOLDED IN, not the build time.
//     store.js's base predicate is `kind='genesis' OR at <= asOf`, so a build
//     time would push the row into the future relative to the events it
//     encodes and silently disqualify it for every asOf in between.
//   * verify + repair. A corrupted snapshot is DETECTED (not trusted), and the
//     repair rebuilds to a sha that matches the independent computation.
//   * the self-heal fires on its own, from the ordinary snapshot pass, without
//     anybody calling the repair.
//   * genesis is never deleted by a repair. It is the one snapshot that is not
//     derivable; only the backfill writes it.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
// Safe at module scope: src/events/snapshot.js imports only ./fold.js.
// src/events/snapshotter.js reaches src/db.js and must wait for beforeAll.
import {
  _resetSnapshotIntervalForTests,
  foldAtHead,
  getSnapshotInterval,
  maybeSnapshot,
  repairSnapshots,
  setSnapshotInterval,
  verifySnapshot,
} from '../src/events/snapshot.js';
import { canonicalJson, foldEvents, orderEvents, stateSha } from '../src/events/fold.js';

const EVERY = 5;

let app;
let pool;
let gid;
let resetDerivedCache;
let createSnapshotter;

beforeAll(async () => {
  // MUST precede the import of app.js: src/db.js reads DATABASE_URL once, at
  // first import, so a static import would bind the wrong database.
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  resetDerivedCache = (await import('../src/derivedCache.js'))._resetDerivedCacheForTests;
  createSnapshotter = (await import('../src/events/snapshotter.js')).createSnapshotter;
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-snap') RETURNING id");
  gid = g.rows[0].id;
  // The interval is process-global module state. Every caller below passes it
  // explicitly as well, so this only covers the default-argument path — but it
  // is restored in afterEach regardless, because tests/e18-asof.test.js asserts
  // exact `events_replayed` counts that a small interval would change.
  setSnapshotInterval(EVERY);
  resetDerivedCache();
});

afterEach(() => {
  _resetSnapshotIntervalForTests();
});

// ── fixtures ────────────────────────────────────────────────────────────────

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const graphUrl = () => `/api/graphs/${gid}/graph`;
const tasksUrl = () => `/api/graphs/${gid}/tasks`;
const edgesUrl = () => `/api/graphs/${gid}/edges`;

async function makeTask(meta) {
  const res = await request(app)
    .post(tasksUrl())
    .send({ content: node({ status: 'todo', ...meta }) });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

async function patchTask(id, meta) {
  const res = await request(app).patch(`${tasksUrl()}/${id}`).send({ content: node(meta) });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

async function makeEdge(source_id, target_id, purpose = 'required for') {
  const res = await request(app).post(edgesUrl()).send({ source_id, target_id, purpose });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

// Exactly SEVENTEEN events, through the real routes so every middleware and
// every trigger fires. One event per changed row is the restated DONE-WHEN, so
// the count is a property of the writes and is asserted, never assumed.
async function drive17() {
  const t = [];
  for (let i = 1; i <= 6; i += 1) t.push(await makeTask({ title: `T${i}` })); //  1..6
  const e1 = await makeEdge(t[0].id, t[1].id); //                                    7
  await makeEdge(t[1].id, t[2].id); //                                               8
  await makeEdge(t[2].id, t[3].id); //                                               9
  for (let i = 0; i < 4; i += 1) {
    await patchTask(t[i].id, { title: `T${i + 1}`, status: 'in_progress' }); //  10..13
  }
  await request(app).patch(`${edgesUrl()}/${e1.id}`).send({ purpose: 'supports' }).expect(200); // 14
  await request(app).delete(`${tasksUrl()}/${t[5].id}`).expect(200); //              15
  await patchTask(t[0].id, { title: 'T1', status: 'review', confidence: 0.8 }); //   16
  await patchTask(t[1].id, { title: 'T2', status: 'done' }); //                      17
  expect(await head()).toBe(17);
  return t;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const head = async () =>
  Number(
    (await pool.query('SELECT COALESCE(MAX(seq),0) AS n FROM events WHERE graph_id = $1', [gid]))
      .rows[0].n,
  );

const snapRows = async () =>
  (
    await pool.query(
      `SELECT seq, kind, at, built_at, state, state_sha, node_count, edge_count, fold_version
         FROM graph_snapshots WHERE graph_id = $1 AND axis = 'learned' ORDER BY seq`,
      [gid],
    )
  ).rows;

const periodicSeqs = async () =>
  (await snapRows()).filter((r) => r.kind === 'periodic').map((r) => Number(r.seq));

// The state at `seq` computed FROM THE NEWEST SNAPSHOT AT OR BELOW IT — the
// path a real `?asOf` takes.
async function stateFromSnapshot(seq) {
  const { rows: baseRows } = await pool.query(
    `SELECT seq, kind, state FROM graph_snapshots
      WHERE graph_id = $1 AND axis = 'learned' AND seq <= $2 AND fold_version = 1
      ORDER BY seq DESC LIMIT 1`,
    [gid, seq],
  );
  expect(baseRows).toHaveLength(1);
  const base = baseRows[0];
  const { rows: tail } = await pool.query(
    `SELECT seq, happened_at, learned_at, kind, subject_kind, subject_id, payload
       FROM events WHERE graph_id = $1 AND seq > $2 AND seq <= $3 ORDER BY seq`,
    [gid, Number(base.seq), seq],
  );
  return {
    base: { kind: base.kind, seq: Number(base.seq) },
    tail: tail.length,
    state: foldEvents(base.state, orderEvents(tail, 'learned')),
  };
}

// ── 1. the checkpoints ──────────────────────────────────────────────────────

describe('E18.1 snapshots — checkpoints', () => {
  it('writes a row at every multiple of the interval, and nowhere else', async () => {
    await drive17();
    const res = await maybeSnapshot(pool, gid, { interval: EVERY });
    expect(res.head_seq).toBe(17);
    expect(res.target).toBe(15);
    expect(res.written).toEqual([5, 10, 15]);
    expect(res.repaired).toBe(false);

    const rows = await snapRows();
    expect(rows.map((r) => Number(r.seq))).toEqual([0, 5, 10, 15]);
    expect(rows.map((r) => r.kind)).toEqual(['genesis', 'periodic', 'periodic', 'periodic']);
    for (const r of rows) expect(r.fold_version).toBe(1);

    // A second pass has nothing to add — checkpoints are a deterministic
    // function of (graph, seq), not of how many times the snapshotter ran.
    const again = await maybeSnapshot(pool, gid, { interval: EVERY });
    expect(again.written).toEqual([]);
    expect(await periodicSeqs()).toEqual([5, 10, 15]);
  });

  it("stamps `at` with the last folded event's learned_at, not the build time", async () => {
    await drive17();
    await maybeSnapshot(pool, gid, { interval: EVERY });

    for (const seq of [5, 10, 15]) {
      const { rows } = await pool.query(
        `SELECT s.at = e.learned_at AS matches, s.built_at > e.learned_at AS built_later
           FROM graph_snapshots s
           JOIN events e ON e.graph_id = s.graph_id AND e.seq = s.seq
          WHERE s.graph_id = $1 AND s.axis = 'learned' AND s.seq = $2`,
        [gid, seq],
      );
      expect(rows).toHaveLength(1);
      // EXACT equality, to the microsecond: the value is round-tripped as text
      // precisely so a JS Date's millisecond truncation cannot shift it.
      expect(rows[0].matches).toBe(true);
      // And `built_at` — the column that IS for build time — is later.
      expect(rows[0].built_later).toBe(true);
    }
  });

  it('does nothing before the first checkpoint is reachable', async () => {
    await makeTask({ title: 'only one' });
    const res = await maybeSnapshot(pool, gid, { interval: EVERY });
    expect(res.written).toEqual([]);
    expect(res.target).toBe(0);
    expect(await periodicSeqs()).toEqual([]);
  });

  // Every `graph_change` notification calls this, and bump_graph_updated_at
  // fires one on EVERY task/edge row write. Past the first checkpoint the
  // target only moves once every `n` events, so the other n-1 calls must be
  // nearly free. Measured on a clone of production before this short-circuit
  // (1638 events, 1175 nodes, 2289 edges, target 1000): 172.6 ms, 5 queries and
  // 2.4 MB of `state` dragged out of the table per notification — to fetch
  // three snapshot states, re-fold 1000 events, compute two SHA-256s and write
  // nothing. After: 1.3 ms, 2 queries, no `state` read at all.
  it('does no work at all when the target has not moved', async () => {
    await drive17();
    expect((await maybeSnapshot(pool, gid, { interval: EVERY })).written).toEqual([5, 10, 15]);

    // A counting stand-in for the pool. maybeSnapshot only ever calls .query().
    let queries = 0;
    let stateBytes = 0;
    const counted = {
      query: async (...args) => {
        queries += 1;
        const r = await pool.query(...args);
        for (const row of r.rows ?? []) {
          if (row && row.state) stateBytes += JSON.stringify(row.state).length;
        }
        return r;
      },
    };

    const res = await maybeSnapshot(counted, gid, { interval: EVERY });
    expect(res).toMatchObject({ head_seq: 17, target: 15, written: [], up_to_date: true });
    // The head lookup and the top-snapshot-seq lookup. Nothing else.
    expect(queries).toBe(2); // before: 5
    // And not one byte of any snapshot state was read, let alone re-folded.
    expect(stateBytes).toBe(0); // before: three full states
    expect(await periodicSeqs()).toEqual([5, 10, 15]);

    // …and the moment the target DOES move, the pass resumes its full job,
    // predecessor verification included (pinned by the self-heal test below).
    for (let i = 0; i < 3; i += 1) await makeTask({ title: `after ${i}` });
    expect(await head()).toBe(20);
    expect((await maybeSnapshot(pool, gid, { interval: EVERY })).written).toEqual([20]);
  });

  it('refuses to invent a substrate for a graph with no base', async () => {
    await drive17();
    // A graph whose genesis is missing (backfill never ran). The empty state is
    // a CLAIM about the world before seq 1 and the snapshotter has no standing
    // to make it — backfillGenesis / lateGenesis do.
    await pool.query('DELETE FROM graph_snapshots WHERE graph_id = $1', [gid]);
    const res = await maybeSnapshot(pool, gid, { interval: EVERY });
    expect(res.reason).toBe('no_base');
    expect(res.written).toEqual([]);
    expect(await periodicSeqs()).toEqual([]);
  });
});

// ── 2. THE DONE-WHEN GATE ───────────────────────────────────────────────────

describe('E18.1 snapshots — replay equivalence', () => {
  it('fold(snapshot, tail) is BYTE-equal to fold(genesis, all) at 7, 12 and 17', async () => {
    await drive17();
    expect(await maybeSnapshot(pool, gid, { interval: EVERY })).toMatchObject({
      written: [5, 10, 15],
    });

    for (const [seq, expectedBase, expectedTail] of [
      [7, 5, 2],
      [12, 10, 2],
      [17, 15, 2],
    ]) {
      const viaSnapshot = await stateFromSnapshot(seq);
      const viaGenesis = await foldAtHead(pool, gid, seq);

      // The snapshot really is the base being used — otherwise this test could
      // pass by accidentally replaying from genesis on both sides.
      expect(viaSnapshot.base).toEqual({ kind: 'periodic', seq: expectedBase });
      expect(viaSnapshot.tail).toBe(expectedTail);
      expect(viaGenesis.base).toEqual({ kind: 'genesis', seq: 0 });
      expect(viaGenesis.events_replayed).toBe(seq);
      expect(viaGenesis.anomalies).toEqual([]);

      // THE GATE. Byte equality of the canonical state, no projection between.
      expect(canonicalJson(viaSnapshot.state)).toBe(canonicalJson(viaGenesis.state));
      expect(stateSha(viaSnapshot.state)).toBe(stateSha(viaGenesis.state));
    }
  });

  it('a stored snapshot state hashes to its stored state_sha', async () => {
    await drive17();
    await maybeSnapshot(pool, gid, { interval: EVERY });
    for (const row of await snapRows()) {
      // The sha is computed ONLY in JS, over canonicalJson. A SQL-side digest of
      // the jsonb could never match: Postgres orders jsonb keys by
      // (length, bytes), which is a different string for the same state.
      expect(stateSha(row.state)).toBe(row.state_sha);
    }
  });

  it('the route answers identically with and without the snapshots', async () => {
    await drive17();
    resetDerivedCache();
    const bare = await request(app).get(graphUrl()).query({ asOfSeq: 12 });
    expect(bare.status).toBe(200);
    expect(bare.body.as_of.base).toMatchObject({ kind: 'genesis', seq: 0 });
    expect(bare.body.as_of.events_replayed).toBe(12);

    await maybeSnapshot(pool, gid, { interval: EVERY });
    // A state cached at the same (graph, seq) reports the base it used THEN, so
    // the cache MUST be cleared before asserting on `base.kind`.
    resetDerivedCache();
    const cached = await request(app).get(graphUrl()).query({ asOfSeq: 12 });
    expect(cached.body.as_of.base).toMatchObject({ kind: 'periodic', seq: 10 });
    expect(cached.body.as_of.events_replayed).toBe(2);

    // Same answer, less work. A cache that changes the answer is not a cache.
    expect(cached.body.nodes).toEqual(bare.body.nodes);
    expect(cached.body.links).toEqual(bare.body.links);
  });
});

// ── 3. verify + repair ──────────────────────────────────────────────────────

describe('E18.1 snapshots — verify and repair', () => {
  it('verifies a good snapshot, detects a corrupted one, and repairs to a matching sha', async () => {
    await drive17();
    await maybeSnapshot(pool, gid, { interval: EVERY });

    for (const seq of [5, 10, 15]) {
      const v = await verifySnapshot(pool, gid, seq);
      expect(v.ok).toBe(true);
      expect(v.derivable).toBe(true);
      expect(v.expected).toBe(v.actual);
    }
    // Genesis is not derivable from the log — that is its whole reason for
    // existing — so the strongest check available is internal consistency.
    const g = await verifySnapshot(pool, gid, 0);
    expect(g).toMatchObject({ ok: true, kind: 'genesis', derivable: false });

    const truth = (await snapRows()).find((r) => Number(r.seq) === 10).state_sha;

    // Deliberate corruption. graph_snapshots carries no append-only guard —
    // unlike `events`, where gt_events_append_only raises 0A000 — precisely
    // because a snapshot is cache that must be rewritable.
    await pool.query(
      `UPDATE graph_snapshots SET state_sha = 'deadbeef'
        WHERE graph_id = $1 AND axis = 'learned' AND seq = 10`,
      [gid],
    );
    const bad = await verifySnapshot(pool, gid, 10);
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe('replay_mismatch');
    expect(bad.actual).toBe('deadbeef');
    expect(bad.expected).toBe(truth);
    expect(bad.stored_state_sha).toBe(truth);
    expect(bad.base).toEqual({ kind: 'periodic', seq: 5 });

    const repair = await repairSnapshots(pool, gid, { interval: EVERY });
    expect(repair.deleted).toBe(3);
    expect(repair.rebuilt).toEqual([5, 10, 15]);

    for (const seq of [5, 10, 15]) expect((await verifySnapshot(pool, gid, seq)).ok).toBe(true);
    expect((await snapRows()).find((r) => Number(r.seq) === 10).state_sha).toBe(truth);
    // Genesis survived. Only backfillGenesis ever writes it, and nothing here
    // may delete it: it is the one row that cannot be rebuilt.
    expect((await snapRows()).map((r) => r.kind)).toEqual([
      'genesis',
      'periodic',
      'periodic',
      'periodic',
    ]);
  });

  it('a corrupted state (not just its digest) is caught too', async () => {
    await drive17();
    await maybeSnapshot(pool, gid, { interval: EVERY });
    await pool.query(
      `UPDATE graph_snapshots SET state = '{"v":1,"nodes":[],"edges":[]}'::jsonb
        WHERE graph_id = $1 AND axis = 'learned' AND seq = 10`,
      [gid],
    );
    const bad = await verifySnapshot(pool, gid, 10);
    expect(bad.ok).toBe(false);
    // The REPLAY half still agrees — the log and the digest both describe the
    // state this row was built from. Only the INTEGRITY half sees that the
    // bytes in the `state` column are no longer that state, and `state` is what
    // store.js actually folds over.
    expect(bad.reason).toBe('state_sha_mismatch');
    expect(bad.expected).toBe(bad.actual);
    expect(bad.stored_state_sha).not.toBe(bad.actual);
  });

  it('self-heals during an ordinary pass, with nobody calling repair', async () => {
    await drive17();
    await maybeSnapshot(pool, gid, { interval: EVERY });
    const truth = (await snapRows()).find((r) => Number(r.seq) === 15).state_sha;

    // Poison the immediate predecessor of the NEXT checkpoint, then push the
    // head past 20 so a pass actually has work to do.
    await pool.query(
      `UPDATE graph_snapshots SET state = state || '{"nodes":[]}'::jsonb
        WHERE graph_id = $1 AND axis = 'learned' AND seq = 15`,
      [gid],
    );
    await makeTask({ title: 'T7' });
    await makeTask({ title: 'T8' });
    await makeTask({ title: 'T9' });
    expect(await head()).toBe(20);

    const res = await maybeSnapshot(pool, gid, { interval: EVERY });
    expect(res.repaired).toBe(true);
    // Rebuilt from genesis, every checkpoint up to the new target.
    expect(res.written).toEqual([5, 10, 15, 20]);
    expect((await snapRows()).find((r) => Number(r.seq) === 15).state_sha).toBe(truth);
    for (const seq of [5, 10, 15, 20]) expect((await verifySnapshot(pool, gid, seq)).ok).toBe(true);

    // And the repaired chain still satisfies the gate.
    const viaSnapshot = await stateFromSnapshot(18);
    const viaGenesis = await foldAtHead(pool, gid, 18);
    expect(viaSnapshot.base).toEqual({ kind: 'periodic', seq: 15 });
    expect(canonicalJson(viaSnapshot.state)).toBe(canonicalJson(viaGenesis.state));
  });

  it('reports a missing snapshot rather than throwing', async () => {
    expect(await verifySnapshot(pool, gid, 999)).toMatchObject({ ok: false, reason: 'missing' });
  });
});

// ── 4. the snapshotter ──────────────────────────────────────────────────────

describe('E18.1 snapshotter', () => {
  it('drains a dedup’d queue and writes the checkpoints', async () => {
    await drive17();
    const snapshotter = createSnapshotter({ pool, interval: EVERY, log: () => {} });
    // No LISTEN client: this test drives `enqueue` directly. Opening one here
    // is exactly what starting the snapshotter from app.js instead of
    // server.js would do to every route test in the suite.
    await snapshotter.start({ listen: false });
    snapshotter.enqueue(gid);
    snapshotter.enqueue(gid); // a burst collapses to one unit of work
    snapshotter.enqueue(gid);
    await snapshotter.idle();
    await snapshotter.stop();

    expect(await periodicSeqs()).toEqual([5, 10, 15]);
  });

  it('swallows a failing pass rather than wedging the queue', async () => {
    // A snapshot is an optimisation: without one, ?asOf replays from genesis
    // and returns the same answer. So nothing the snapshotter can do should be
    // able to break anything, including itself.
    const said = [];
    const snapshotter = createSnapshotter({ pool, interval: EVERY, log: (m) => said.push(m) });
    await snapshotter.start({ listen: false });
    snapshotter.enqueue('nosuchgraphid');
    await snapshotter.idle();

    await drive17();
    snapshotter.enqueue(gid);
    await snapshotter.idle();
    await snapshotter.stop();

    expect(await periodicSeqs()).toEqual([5, 10, 15]);
  });

  // ── the LISTEN connection ────────────────────────────────────────────────
  //
  // node-postgres emits 'error' TWICE for ONE dropped connection (the backend's
  // 'terminating connection due to administrator command', then the socket's
  // 'Connection terminated unexpectedly'). An unguarded handler therefore
  // schedules TWO reconnects per drop and the client count doubles every time:
  // measured 1 → 2 → 4 against a real server, with three still live after
  // stop(). On a long-lived server that walks into the connection limit.
  it('opens exactly one LISTEN client per drop, and leaves none behind on stop()', async () => {
    const appName = `e18-snap-listen-${process.pid}-${Date.now()}`;
    const live = async () =>
      Number(
        (
          await pool.query(
            'SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = $1',
            [appName],
          )
        ).rows[0].n,
      );
    const kill = () =>
      pool.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = $1',
        [appName],
      );

    const snapshotter = createSnapshotter({
      pool,
      interval: EVERY,
      log: () => {},
      reconnectDelay: 100,
      connectionString: `${TEST_URL}?application_name=${appName}`,
    });
    try {
      await snapshotter.start();
      expect(await live()).toBe(1);

      await kill();
      await sleep(900);
      expect(await live()).toBe(1); // unguarded: 2

      await kill();
      await sleep(900);
      expect(await live()).toBe(1); // unguarded: 4
    } finally {
      await snapshotter.stop();
    }
    await sleep(300);
    // stop() tracks only ONE client, so every extra one it spawned is orphaned
    // for the life of the process. Unguarded: 3.
    expect(await live()).toBe(0);
  }, 30000);

  it('keeps retrying when the FIRST connect fails (a Postgres restart mid-deploy)', async () => {
    const said = [];
    const snapshotter = createSnapshotter({
      pool,
      interval: EVERY,
      log: (m) => said.push(m),
      reconnectDelay: 100,
      connectionString: 'postgresql://postgres@127.0.0.1:1/multitap_test', // nothing listens
    });
    // The caller still sees the first failure — src/server.js logs it — but the
    // snapshotter must not be dead for the life of the process afterwards.
    await expect(snapshotter.start()).rejects.toThrow(/ECONNREFUSED/);
    await sleep(500);
    expect(said.filter((m) => m.startsWith('listen reconnect failed')).length).toBeGreaterThan(0);

    await snapshotter.stop();
    const afterStop = said.length;
    await sleep(400);
    expect(said.length).toBe(afterStop); // stop() cancels the pending retry
  }, 30000);

  it('ignores a notification with no graph id', async () => {
    const snapshotter = createSnapshotter({ pool, interval: EVERY, log: () => {} });
    snapshotter.enqueue(undefined);
    snapshotter.enqueue('');
    await snapshotter.idle();
    await snapshotter.stop();
    expect(await periodicSeqs()).toEqual([]);
  });
});

// ── 5. the interval knob ────────────────────────────────────────────────────

describe('E18.1 snapshots — SNAPSHOT_EVERY_N', () => {
  it('defaults to 1000 and is settable', () => {
    _resetSnapshotIntervalForTests();
    expect(getSnapshotInterval()).toBe(1000);
    const prev = setSnapshotInterval(5);
    expect(prev).toBe(1000);
    expect(getSnapshotInterval()).toBe(5);
    expect(() => setSnapshotInterval(0)).toThrow(/positive integer/);
    expect(() => setSnapshotInterval(2.5)).toThrow(/positive integer/);
  });

  it('uses the module default when no interval is passed', async () => {
    await drive17();
    setSnapshotInterval(EVERY);
    expect((await maybeSnapshot(pool, gid)).written).toEqual([5, 10, 15]);
  });
});
