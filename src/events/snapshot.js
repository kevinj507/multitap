// E18.1 STEP 7 — genesis, periodic snapshots, and the standing proof that the
// log and the live tables say the same thing.
//
// Three jobs, one file, because all three are the same computation viewed from
// different ends:
//
//   GENESIS      — the seq-0 substrate. The one snapshot that is NOT derivable
//                  from the log, because it describes the world BEFORE the log
//                  existed. Written once per graph and never again.
//   PERIODIC     — a cache. `state(S) = fold(prev.state, events in (prev.seq, S])`.
//                  Always safe to delete and rebuild; derived from the LOG, never
//                  from tasks/edges, so there is no cross-source consistency
//                  question to answer.
//   FSCK         — `diffFoldVsLive`, the sharpest available check on the residual
//                  risk this design accepts (a plpgsql misclassification shipping
//                  as a silent wrong `changes` object rather than a crash).
//
// Nothing here imports src/db.js: the pool is an argument, exactly as in
// src/events/store.js, which keeps the DATABASE_URL read-once rule out of this
// module's import graph and lets a test import it statically.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THE GENESIS BACKFILL IS JS AND NOT `db/schema.sql`
//
// Three independent reasons, all of them load-bearing:
//   1. `applySchema()` runs the whole file as ONE transaction and
//      `src/server.js` does `process.exit(1)` when it throws. A backfill over
//      65 graphs / 4103 tasks / 7664 edges is exactly the kind of work that can
//      fail for reasons that must not stop the server booting.
//   2. The genesis `state` MUST be canonicalised by the SAME function the fold
//      uses, or the snapshot chain hashes differently from the replay. That
//      function is `canonicalJson` in src/events/fold.js. Postgres orders jsonb
//      keys by (length, bytes) and would never reproduce it.
//   3. DML in schema.sql is the actorless, untestable, un-attributed thing this
//      whole epic exists to stop adding to.
//
// RACE SAFETY, stated once so it is not re-derived at every call site. The
// genesis base is seq 0, and the backfill only writes one while the log is
// still empty (`head_seq = 0`, read under the same row lock — see the head
// check in `backfillGenesis`; a live cut written at seq 0 on top of existing
// events is a substrate that lies about every point below the head). EVERY
// write that races the backfill therefore allocates `seq >= 1` and is in the
// replay tail. The fold is forward-only and `to`-only, so re-applying a change the
// genesis state already reflects is a no-op (src/events/fold.js header). There
// is no window in which an edit is both absent from the base and skipped by the
// tail. The `SELECT id FROM graphs WHERE id = $1 FOR UPDATE` is therefore not
// needed for correctness of the replay — it is there to make the tasks and
// edges reads a consistent cut, which they would not otherwise be across two
// statements. Every concurrent writer of the graph is already blocked on
// exactly that lock (`gt_next_seq` takes it, and `bump_graph_updated_at` bumps
// the row on every task/edge write), so this is stronger AND simpler than
// REPEATABLE READ, and costs nothing that is not already being paid.

import {
  FOLD_VERSION,
  canonicalJson,
  emptyState,
  foldEvents,
  orderEvents,
  stateSha,
} from './fold.js';

// ── the snapshot interval ────────────────────────────────────────────────────

// How many events between periodic snapshots. 1000 is deliberately large: a
// snapshot is a cache, the replay tail is cheap (an indexed range scan plus a
// pure fold), and every snapshot costs a JSONB write proportional to the whole
// graph. Tests set it to 5 via setSnapshotInterval().
export const SNAPSHOT_EVERY_N_DEFAULT = 1000;

function intervalFromEnv() {
  const n = Number(process.env.SNAPSHOT_EVERY_N);
  return Number.isInteger(n) && n > 0 ? n : SNAPSHOT_EVERY_N_DEFAULT;
}

let snapshotInterval = intervalFromEnv();

export function getSnapshotInterval() {
  return snapshotInterval;
}

// Returns the PREVIOUS value, so a test can restore it in afterAll without
// having to know the default.
export function setSnapshotInterval(n) {
  const previous = snapshotInterval;
  const next = Number(n);
  if (!Number.isInteger(next) || next <= 0) {
    throw new Error('snapshot interval must be a positive integer');
  }
  snapshotInterval = next;
  return previous;
}

// House rule for any process-level singleton (src/auth/index.js:39).
export function _resetSnapshotIntervalForTests() {
  snapshotInterval = intervalFromEnv();
}

// ── SQL ──────────────────────────────────────────────────────────────────────

// `content_sha` and NOT `content`. The fold state carries no bodies (see
// src/events/fold.js): `GET /graph` never returns `content`, and the digest is
// the same scale `gt_content_change`'s `to_sha` uses —
// sha256(COALESCE(content,'')) — so a genesis node and the same node after its
// first post-ship edit are comparable without the log ever holding a pre-ship
// body. Measured: this turns a would-be 10 MB genesis into roughly 1 MB.
// convert_to(..., 'UTF8'), never `::bytea` — see the note on gt_content_change
// in db/schema.sql. The cast parses its input as bytea ESCAPE text, so a body
// holding a `\d` regex or a `C:\Users` path raises 22P02 and fails the whole
// backfill for that graph. Measured before the fix: 10 of 65 production graphs
// could not be given a genesis at all.
const LIVE_NODES_SQL = `SELECT id, meta, version, external_id, created_at,
          encode(sha256(convert_to(COALESCE(content, ''), 'UTF8')), 'hex') AS content_sha
     FROM tasks WHERE graph_id = $1 ORDER BY id`;

// `source` / `target`, not `source_id` / `target_id` — the fold state uses the
// /graph payload's names so the projection is a rename-free map.
const LIVE_EDGES_SQL = `SELECT id, source_id AS source, target_id AS target,
          purpose, type, meta, version, created_at
     FROM edges WHERE graph_id = $1 ORDER BY id`;

// `learned_at::text` / `happened_at::text` alongside the typed columns: the
// typed ones come back as JS Dates (millisecond precision) while the column
// holds microseconds, and a snapshot's `at` is written straight back into the
// database. Binding the raw text keeps the round trip exact. See the `at` note
// on PERIODIC_UPSERT for why that column is load-bearing.
const TAIL_SQL = `SELECT seq, happened_at, learned_at, kind, subject_kind, subject_id,
          cause_id, payload, learned_at::text AS learned_at_txt,
          happened_at::text AS happened_at_txt
     FROM events
    WHERE graph_id = $1 AND seq > $2 AND seq <= $3
    ORDER BY seq`;

const HEAD_SQL = `SELECT COALESCE(MAX(seq), 0) AS head_seq FROM events WHERE graph_id = $1`;

const GENESIS_INSERT = `INSERT INTO graph_snapshots
    (graph_id, axis, seq, kind, at, max_happened_at,
     state, state_sha, node_count, edge_count, fold_version)
  VALUES ($1, 'learned', 0, 'genesis', clock_timestamp(), clock_timestamp(),
          $2::jsonb, $3, $4, $5, $6)
  ON CONFLICT DO NOTHING
  RETURNING at`;

// DO UPDATE, not DO NOTHING: this is the repair path's only writer as well as
// the happy path's, and a corrupted row must be overwritable in place.
const PERIODIC_UPSERT = `INSERT INTO graph_snapshots
    (graph_id, axis, seq, kind, at, max_happened_at,
     state, state_sha, node_count, edge_count, fold_version, built_at)
  VALUES ($1, 'learned', $2, 'periodic', $3::timestamptz, $4::timestamptz,
          $5::jsonb, $6, $7, $8, $9, NOW())
  ON CONFLICT (graph_id, axis, seq) DO UPDATE SET
    kind = 'periodic',
    at = EXCLUDED.at,
    max_happened_at = EXCLUDED.max_happened_at,
    state = EXCLUDED.state,
    state_sha = EXCLUDED.state_sha,
    node_count = EXCLUDED.node_count,
    edge_count = EXCLUDED.edge_count,
    fold_version = EXCLUDED.fold_version,
    built_at = EXCLUDED.built_at`;

const SNAPSHOT_AT_SQL = `SELECT seq, kind, at, state, state_sha, fold_version
     FROM graph_snapshots
    WHERE graph_id = $1 AND axis = 'learned' AND seq = $2`;

// The newest snapshot that may serve as a fold base at or below `seq`. No
// `at <= asOf` predicate here (unlike store.js's BASE_SQL): the snapshotter is
// not answering a point-in-time question, it is extending a chain.
const BASE_AT_OR_BELOW_SQL = `SELECT seq, kind, at, state, state_sha
     FROM graph_snapshots
    WHERE graph_id = $1 AND axis = 'learned' AND seq <= $2 AND fold_version = $3
    ORDER BY seq DESC LIMIT 1`;

const BASE_BELOW_SQL = `SELECT seq, kind, at, state, state_sha
     FROM graph_snapshots
    WHERE graph_id = $1 AND axis = 'learned' AND seq < $2 AND fold_version = $3
    ORDER BY seq DESC LIMIT 1`;

// Just the seq of the newest snapshot — no `state` column, so the planner reads
// the (graph_id, axis, seq) index and nothing else. This is the cheap question
// "has the chain already reached the target?", asked before any state is
// dragged out of the table.
const TOP_SNAPSHOT_SEQ_SQL = `SELECT seq
     FROM graph_snapshots
    WHERE graph_id = $1 AND axis = 'learned' AND fold_version = $2
    ORDER BY seq DESC LIMIT 1`;

const GENESIS_SQL = `SELECT seq, kind, at, state, state_sha
     FROM graph_snapshots
    WHERE graph_id = $1 AND axis = 'learned' AND kind = 'genesis' AND fold_version = $2
    ORDER BY seq LIMIT 1`;

// ── helpers ──────────────────────────────────────────────────────────────────

function isoOrNull(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function numOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export async function headSeq(pool, graphId) {
  const { rows } = await pool.query(HEAD_SQL, [graphId]);
  return Number(rows[0].head_seq);
}

async function tailEvents(db, graphId, fromExclusive, toInclusive) {
  const { rows } = await db.query(TAIL_SQL, [graphId, fromExclusive, toInclusive]);
  return rows;
}

// ── the live cut ─────────────────────────────────────────────────────────────

// Build a fold state directly from `tasks` / `edges`. The ONLY place in the
// system that derives a state from anywhere but the log, and it exists for
// exactly two callers: the genesis backfill (there is no pre-history log to
// fold) and the fsck (whose entire purpose is to compare the two sources).
//
// `db` may be the pool or a client — the backfill passes its transaction's
// client so the reads are inside the FOR UPDATE.
//
// The record shape must match src/events/fold.js EXACTLY, key for key, or a
// genesis state and a replayed state hash differently and the whole snapshot
// chain is untrustworthy. Timestamps are normalised through `Date` to
// millisecond ISO, which is what `isoOrNull` in the fold does to the
// microsecond ISO text `to_jsonb(NEW)` produces — that normalisation is the
// thing that makes the two byte-identical.
export async function stateFromLiveRows(db, graphId) {
  const { rows: nodeRows } = await db.query(LIVE_NODES_SQL, [graphId]);
  const { rows: edgeRows } = await db.query(LIVE_EDGES_SQL, [graphId]);
  return {
    v: FOLD_VERSION,
    nodes: nodeRows.map((r) => ({
      id: Number(r.id),
      meta: { ...plainObject(r.meta) },
      version: numOrNull(r.version),
      external_id: r.external_id ?? null,
      content_sha: r.content_sha ?? null,
      created_at: isoOrNull(r.created_at),
    })),
    edges: edgeRows.map((r) => ({
      id: Number(r.id),
      source: numOrNull(r.source),
      target: numOrNull(r.target),
      purpose: r.purpose ?? null,
      type: r.type ?? null,
      meta: { ...plainObject(r.meta) },
      version: numOrNull(r.version),
      created_at: isoOrNull(r.created_at),
    })),
  };
}

// ── genesis ──────────────────────────────────────────────────────────────────

// One small transaction for ONE graph. Idempotent by construction: the write is
// `ON CONFLICT DO NOTHING` against a PK of (graph_id, axis, seq) plus the
// partial unique index on kind='genesis', so a second call writes nothing and
// reports `written: false`.
//
// `at` is `clock_timestamp()` — SHIP DAY, not the graph's creation date. That
// is the honest floor: this graph's history genuinely begins when the log
// started, pre-ship edits are unrecoverable, and `at` is what `store.js`
// reports as `history_starts_at` and compares against to set `truncated`. (The
// gt_seed_genesis trigger uses the graph's own created_at instead, which is the
// same claim for a graph whose life began after the log existed.)
export async function backfillGenesis(pool, graphId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Blocks every concurrent writer of this graph — they all take this same
    // row lock via gt_next_seq / bump_graph_updated_at — which is what makes
    // the two reads below a single consistent cut.
    const { rows: locked } = await client.query('SELECT id FROM graphs WHERE id = $1 FOR UPDATE', [
      graphId,
    ]);
    if (locked.length === 0) {
      await client.query('ROLLBACK');
      return { graph_id: graphId, written: false, reason: 'graph_missing' };
    }

    // Cheap pre-check so the already-backfilled 99% of a restart never pays for
    // the row reads. The ON CONFLICT below is still the authority.
    const { rows: existing } = await client.query(
      `SELECT seq FROM graph_snapshots
        WHERE graph_id = $1 AND axis = 'learned' AND kind = 'genesis'`,
      [graphId],
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return { graph_id: graphId, written: false, reason: 'already_present' };
    }

    // THE HEAD CHECK, AND IT IS LOAD-BEARING.
    //
    // `stateFromLiveRows` is the state NOW — at the head — and the seq-0 row
    // claims to be the state BEFORE event 1. Those are the same thing only
    // while the log is empty. Write the live cut at seq 0 for a graph that
    // already has events and the substrate silently encodes the effects of
    // events 1..N; the fold is forward-only and `to`-only, so it can never
    // un-apply them and every `?asOf` below the head answers with changes that
    // had not been learned yet — with `truncated: false` and
    // `pre_history_approximation: false`, i.e. no warning at all. Measured on a
    // clone of production: a two-event graph reported its post-`status.changed`
    // state at seq 0.
    //
    // This is reachable because the backfill runs on EVERY boot: any graph that
    // took writes before its first successful backfill lands here.
    //
    // Read INSIDE the FOR UPDATE, so the head cannot move between the check and
    // the write. When it is above zero the live state belongs at the head seq —
    // which is exactly what `lateGenesis` writes — and the transaction is ended
    // first because `lateGenesis` takes this same graphs row on its own
    // connection.
    const { rows: headRows } = await client.query(HEAD_SQL, [graphId]);
    const head = Number(headRows[0].head_seq);
    if (head > 0) {
      // A periodic base already covers this graph (a previous pass took this
      // same branch); replaying its tail answers the head exactly, so there is
      // nothing left to approximate and no reason to rewrite a whole state on
      // every boot.
      const { rows: based } = await client.query(BASE_AT_OR_BELOW_SQL, [
        graphId,
        head,
        FOLD_VERSION,
      ]);
      await client.query('ROLLBACK');
      if (based.length > 0) {
        return {
          graph_id: graphId,
          written: false,
          reason: 'head_ahead_of_genesis',
          head_seq: head,
          pre_history_approximation: true,
        };
      }
      const late = await lateGenesis(pool, graphId);
      return {
        ...late,
        reason: 'head_ahead_of_genesis',
        head_seq: head,
        pre_history_approximation: true,
      };
    }

    const state = await stateFromLiveRows(client, graphId);
    const { rows } = await client.query(GENESIS_INSERT, [
      graphId,
      canonicalJson(state),
      stateSha(state),
      state.nodes.length,
      state.edges.length,
      FOLD_VERSION,
    ]);
    await client.query('COMMIT');
    return {
      graph_id: graphId,
      written: rows.length > 0,
      reason: rows.length > 0 ? null : 'already_present',
      at: rows.length > 0 ? isoOrNull(rows[0].at) : null,
      node_count: state.nodes.length,
      edge_count: state.edges.length,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* the connection is already broken; the release below still applies */
    }
    throw err;
  } finally {
    client.release();
  }
}

// Every graph that exists today. Future graphs are covered STRUCTURALLY by the
// gt_seed_genesis AFTER INSERT trigger (db/schema.sql), so this runs once per
// deploy and finds nothing to do on every boot after the first.
//
// Failure of one graph must not abort the rest, and MUST NOT stop the server:
// src/server.js calls this inside a try/catch that logs and continues. A graph
// without a genesis row still answers `?asOf` — it just falls back to
// `base.kind: 'empty'` and replays from seq 1, which is correct for every graph
// created after the log shipped and an approximation only for pre-ship rows.
export async function backfillGenesisAll(pool, { log } = {}) {
  const say = log || (() => {});
  const { rows } = await pool.query(
    `SELECT g.id FROM graphs g
      WHERE NOT EXISTS (SELECT 1 FROM graph_snapshots s
                         WHERE s.graph_id = g.id AND s.axis = 'learned' AND s.kind = 'genesis')
      ORDER BY g.id`,
  );
  const out = { graphs: rows.length, written: 0, skipped: 0, failed: 0, errors: [] };
  for (const row of rows) {
    try {
      const res = await backfillGenesis(pool, row.id);
      if (res.written) out.written += 1;
      else out.skipped += 1;
    } catch (err) {
      out.failed += 1;
      out.errors.push({ graph_id: row.id, error: err.message });
      say(`genesis backfill failed for ${row.id} — ${err.message}`);
    }
  }
  return out;
}

// THE FALLBACK, for a graph whose genesis backfill could not be completed.
//
// A "late genesis" is a PERIODIC snapshot at the current head built from the
// live rows rather than from the log. It is not a genesis row and cannot be:
// `snapshots_genesis_at_zero` pins kind='genesis' to seq 0, and lying about the
// seq would make the replay tail wrong. What it buys is a usable base for every
// `asOf` at or after that head, at the cost of being unable to answer anything
// BEFORE it — which is precisely why store.js reports
// `pre_history_approximation: true` for a graph with a base but no genesis, and
// why `history_starts_at` then names this snapshot instead of seq 0.
//
// Honest and bounded: the approximation is visible in every response that rests
// on it, rather than silently presenting a guess as history.
export async function lateGenesis(pool, graphId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: locked } = await client.query('SELECT id FROM graphs WHERE id = $1 FOR UPDATE', [
      graphId,
    ]);
    if (locked.length === 0) {
      await client.query('ROLLBACK');
      return { graph_id: graphId, written: false, reason: 'graph_missing' };
    }
    const { rows: head } = await client.query(HEAD_SQL, [graphId]);
    const seq = Number(head[0].head_seq);
    if (seq === 0) {
      // No log yet: the empty substrate IS the truth, so a real genesis is
      // available and an approximation would be a lie.
      await client.query('ROLLBACK');
      return { graph_id: graphId, written: false, reason: 'no_events' };
    }
    const state = await stateFromLiveRows(client, graphId);
    const { rows: last } = await client.query(
      `SELECT learned_at::text AS at, happened_at::text AS happened
         FROM events WHERE graph_id = $1 AND seq = $2`,
      [graphId, seq],
    );
    await client.query(PERIODIC_UPSERT, [
      graphId,
      seq,
      last[0]?.at ?? null,
      last[0]?.happened ?? null,
      canonicalJson(state),
      stateSha(state),
      state.nodes.length,
      state.edges.length,
      FOLD_VERSION,
    ]);
    await client.query('COMMIT');
    return { graph_id: graphId, written: true, seq, pre_history_approximation: true };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken */
    }
    throw err;
  } finally {
    client.release();
  }
}

// ── folding ──────────────────────────────────────────────────────────────────

// Fold the whole log for a graph, from genesis (or the empty substrate when
// there is none) to `toSeq` (default: the head). Used by the fsck and by the
// bridge test; the asOf read path has its own, snapshot-accelerated version in
// src/events/store.js.
export async function foldAtHead(pool, graphId, toSeq = null) {
  const anomalies = [];
  const target = toSeq === null ? await headSeq(pool, graphId) : Number(toSeq);
  const { rows: gRows } = await pool.query(GENESIS_SQL, [graphId, FOLD_VERSION]);
  const genesis = gRows[0] ?? null;
  const baseSeq = genesis ? Number(genesis.seq) : 0;
  const tail = await tailEvents(pool, graphId, baseSeq, target);
  const state = foldEvents(genesis?.state ?? emptyState(), orderEvents(tail, 'learned'), {
    anomalies,
  });
  return {
    state,
    base: { kind: genesis ? 'genesis' : 'empty', seq: baseSeq },
    head_seq: target,
    events_replayed: tail.length,
    anomalies,
  };
}

// Build ONE checkpoint on top of `prev`, write it, and return the new base.
// `at` is the learned_at of the LAST event folded in, NOT the build time — see
// the note on the caller.
async function writeCheckpoint(pool, graphId, prev, seq) {
  const tail = await tailEvents(pool, graphId, prev.seq, seq);
  const anomalies = [];
  const state = foldEvents(prev.state, orderEvents(tail, 'learned'), { anomalies });
  const last = tail.length ? tail[tail.length - 1] : null;
  // max_happened_at is informational provenance ("the newest world-time this
  // state rests on"), and it is NOT max(learned_at): a backdated event can be
  // the last one folded in while naming the oldest instant in the range.
  let maxHappened = null;
  let maxHappenedMs = -Infinity;
  for (const e of tail) {
    if (!e.happened_at_txt) continue;
    const ms = new Date(e.happened_at).getTime();
    if (Number.isNaN(ms) || ms <= maxHappenedMs) continue;
    maxHappenedMs = ms;
    maxHappened = e.happened_at_txt;
  }
  const sha = stateSha(state);
  await pool.query(PERIODIC_UPSERT, [
    graphId,
    seq,
    last ? last.learned_at_txt : null,
    maxHappened,
    canonicalJson(state),
    sha,
    state.nodes.length,
    state.edges.length,
    FOLD_VERSION,
  ]);
  return { seq, kind: 'periodic', state, state_sha: sha, events_replayed: tail.length, anomalies };
}

// ── the snapshotter's unit of work ───────────────────────────────────────────

// Bring `graph_snapshots` up to the highest checkpoint the log currently
// supports. Checkpoints sit at exact multiples of the interval so they are a
// deterministic function of (graph, seq) — two processes racing this write the
// same rows, and `ON CONFLICT DO UPDATE` makes the race a no-op rather than an
// error.
//
// A NOTE ON `at`, BECAUSE IT IS LOAD-BEARING AND EASY TO GET WRONG. store.js's
// base predicate is `kind = 'genesis' OR at <= asOf`. Setting `at` to the BUILD
// time rather than to the learned_at of the last event folded in would push it
// into the future relative to the events it encodes, and every `asOf` between
// the last event and the build would skip the snapshot. Still correct — the
// fallback is an older base and a longer replay — but slower for no reason, and
// silently so. `built_at` is the column for build time.
//
// SELF-HEAL. Before extending the chain, the immediate predecessor is
// re-derived and its state_sha compared. On a mismatch every PERIODIC snapshot
// for the graph is dropped and the chain is rebuilt from genesis. That is
// always safe: periodic snapshots are pure cache. Genesis is the one snapshot
// that is not derivable, so it is never dropped and only `backfillGenesis`
// writes it.
export async function maybeSnapshot(pool, graphId, { interval } = {}) {
  const n = interval ?? getSnapshotInterval();
  const head = await headSeq(pool, graphId);
  const target = Math.floor(head / n) * n;
  const out = { graph_id: graphId, head_seq: head, target, written: [], repaired: false };
  if (target < n) return out;

  // NOTHING IS DUE — the overwhelmingly common case, and it must cost one index
  // lookup, not a fold.
  //
  // This runs once per `graph_change` notification, and `bump_graph_updated_at`
  // fires one of those on EVERY task/edge row write. Past the first checkpoint
  // the target only moves once every `n` events, so without this the other
  // n - 1 notifications each fetched three full snapshot states, re-folded the
  // whole last interval and computed two SHA-256s — to write nothing. Measured
  // on a clone of production (1638 events, 1175 nodes, 2289 edges, target
  // 1000): 172.6 ms, 5.5 queries and 2.4 MB of `state` read per notification,
  // output `written: []`.
  //
  // The predecessor verification below is not lost, it is rescheduled: it now
  // runs exactly when a checkpoint is about to be written on top of that
  // predecessor, which is the moment its correctness actually matters. A
  // corrupted snapshot is still caught by `verifySnapshot` / `repairSnapshots`
  // on demand, and a snapshot is cache in any case.
  const { rows: topRows } = await pool.query(TOP_SNAPSHOT_SEQ_SQL, [graphId, FOLD_VERSION]);
  if (topRows.length > 0 && Number(topRows[0].seq) >= target) return { ...out, up_to_date: true };

  let prev = (await pool.query(BASE_AT_OR_BELOW_SQL, [graphId, target, FOLD_VERSION])).rows[0] ?? null;
  if (!prev) {
    // No genesis and no periodic: the graph predates its own log and the
    // backfill has not run (or failed). Refuse rather than invent a substrate —
    // the empty state is a CLAIM about the world before seq 1, and this
    // function has no standing to make it. backfillGenesis / lateGenesis do.
    return { ...out, reason: 'no_base' };
  }

  if (prev.kind === 'periodic') {
    const check = await verifySnapshot(pool, graphId, Number(prev.seq));
    if (!check.ok) {
      await pool.query(
        `DELETE FROM graph_snapshots
          WHERE graph_id = $1 AND axis = 'learned' AND kind = 'periodic'`,
        [graphId],
      );
      out.repaired = true;
      prev = (await pool.query(GENESIS_SQL, [graphId, FOLD_VERSION])).rows[0] ?? null;
      if (!prev) return { ...out, reason: 'no_base' };
    }
  }

  let base = { seq: Number(prev.seq), state: prev.state };
  for (let seq = Math.floor(base.seq / n) * n + n; seq <= target; seq += n) {
    const built = await writeCheckpoint(pool, graphId, base, seq);
    out.written.push(seq);
    base = { seq, state: built.state };
  }
  return out;
}

// ── verification and repair ──────────────────────────────────────────────────

// TWO INDEPENDENT CHECKS, because there are two independent ways for a snapshot
// to be wrong and each is invisible to the other's test:
//
//   REPLAY    `expected` — the sha the LOG says this state should have, from
//             re-folding the predecessor's state over the events between them —
//             against `actual`, the stored `state_sha`. Catches a state that
//             was built from the wrong events, or by an older fold.
//   INTEGRITY `stored_state_sha` — the digest of the bytes ACTUALLY sitting in
//             the `state` column — against that same stored `state_sha`.
//             Catches a corrupted or rewritten `state`, which the replay check
//             alone cannot see: it never reads this row's own state, so a
//             mangled state under an intact digest would sail through. And it
//             is `state` that store.js hands to the fold, not `state_sha`, so
//             this is the half that protects actual answers.
//
// GENESIS IS THE EXCEPTION, and the limit is worth stating plainly: genesis is
// not derivable from the log — that is its entire reason for existing — so only
// the integrity half is available. It catches a corrupted or truncated state
// and a wrong digest; it cannot catch a genesis that faithfully records the
// wrong world. Nothing can, which is why only the backfill ever writes one.
export async function verifySnapshot(pool, graphId, seq) {
  const { rows } = await pool.query(SNAPSHOT_AT_SQL, [graphId, seq]);
  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      reason: 'missing',
      seq: Number(seq),
      expected: null,
      actual: null,
      stored_state_sha: null,
    };
  }

  const storedStateSha = stateSha(row.state);

  if (row.kind === 'genesis') {
    return {
      ok: storedStateSha === row.state_sha,
      reason: storedStateSha === row.state_sha ? null : 'state_sha_mismatch',
      seq: Number(row.seq),
      kind: 'genesis',
      derivable: false,
      expected: storedStateSha,
      actual: row.state_sha,
      stored_state_sha: storedStateSha,
    };
  }

  const prev =
    (await pool.query(BASE_BELOW_SQL, [graphId, Number(seq), FOLD_VERSION])).rows[0] ?? null;
  if (!prev) {
    return {
      ok: false,
      reason: 'no_base',
      seq: Number(row.seq),
      kind: row.kind,
      expected: null,
      actual: row.state_sha,
      stored_state_sha: storedStateSha,
    };
  }
  const tail = await tailEvents(pool, graphId, Number(prev.seq), Number(seq));
  const expected = stateSha(foldEvents(prev.state, orderEvents(tail, 'learned')));
  const replayOk = expected === row.state_sha;
  const integrityOk = storedStateSha === row.state_sha;
  return {
    ok: replayOk && integrityOk,
    reason: replayOk ? (integrityOk ? null : 'state_sha_mismatch') : 'replay_mismatch',
    seq: Number(row.seq),
    kind: row.kind,
    derivable: true,
    base: { kind: prev.kind, seq: Number(prev.seq) },
    events_replayed: tail.length,
    expected,
    actual: row.state_sha,
    stored_state_sha: storedStateSha,
  };
}

// E18.6 — excision reaches the genesis snapshot. Genesis is the one
// non-derivable row and it carries `meta` (a title is meta), so a node born
// before the log would keep its pre-log title there after every event of it
// had been blanked. gt_excise_node drops the periodic snapshots itself (a cache
// of the marked log); this rewrites the genesis entry to the same placeholder
// the fold emits, and re-digests, because state_sha is canonicalJson-based and
// SQL cannot reproduce it. Runs on the route's transaction client, so the
// event, the blanking and this rewrite commit or roll back together.
export async function exciseNodeFromGenesis(db, graphId, nodeId) {
  const { rows } = await db.query(
    `SELECT seq, state FROM graph_snapshots
      WHERE graph_id = $1 AND axis = 'learned' AND kind = 'genesis'
      FOR UPDATE`,
    [graphId],
  );
  const row = rows[0];
  if (!row) return { rewritten: false, reason: 'no_genesis' };
  const id = Number(nodeId);
  const nodes = Array.isArray(row.state?.nodes) ? row.state.nodes : [];
  const idx = nodes.findIndex((n) => Number(n?.id) === id);
  if (idx < 0) return { rewritten: false, reason: 'not_in_genesis' };
  const next = {
    ...row.state,
    nodes: nodes.map((n, i) =>
      i === idx
        ? {
            id,
            meta: { title: '[excised]', excised: true },
            version: numOrNull(n.version),
            external_id: null,
            content_sha: null,
            created_at: isoOrNull(n.created_at),
          }
        : n,
    ),
  };
  await db.query(
    `UPDATE graph_snapshots SET state = $3::jsonb, state_sha = $4
      WHERE graph_id = $1 AND axis = 'learned' AND kind = 'genesis' AND seq = $2`,
    [graphId, row.seq, canonicalJson(next), stateSha(next)],
  );
  return { rewritten: true, reason: null };
}

// Drop every periodic snapshot for a graph and rebuild the chain from genesis.
// Safe by definition — periodic snapshots are a cache of a pure function of the
// log — and the only repair this system needs, because the one non-derivable
// row (genesis) is never touched.
export async function repairSnapshots(pool, graphId, { interval } = {}) {
  const { rowCount } = await pool.query(
    `DELETE FROM graph_snapshots
      WHERE graph_id = $1 AND axis = 'learned' AND kind = 'periodic'`,
    [graphId],
  );
  const rebuilt = await maybeSnapshot(pool, graphId, { interval });
  return { deleted: rowCount ?? 0, rebuilt: rebuilt.written, head_seq: rebuilt.head_seq };
}

// ── the fsck ─────────────────────────────────────────────────────────────────

// Two deliberate normalisations, and both of them are documented non-events
// rather than slack in the check:
//
//  1. META KEYS WHOSE VALUE IS JSON NULL are dropped from both sides.
//     This is now a LEGACY allowance, not a live one. `gt_diff` used to build
//     `jsonb_build_object('to', new_j -> k)` and nothing else, and `->` returns
//     JSON null both for "key absent" and for "key present, value null" — so
//     the fold removed the key while the live row kept it. gt_diff now emits a
//     `to_present` flag on exactly those ambiguous entries and the fold honours
//     it (src/events/fold.js, applyMetaChanges), so an event written from here
//     on reconstructs the null key. Events ALREADY in the log carry no flag and
//     still fold to a removal — deliberately, so a stored snapshot stays
//     re-derivable — which is the divergence this normalisation still absorbs.
//     It is harmless in the derived reads either way: `meta->>'k'` is SQL NULL
//     whether the key is absent or null, so title/description/status and the
//     metaFilter DSL never saw it.
//
//  2. `version` IS COMPARED SEPARATELY and does not affect `ok`. It is in
//     gt_log_task's `drop_cols` on purpose: a version bump with no other change
//     is bookkeeping, and suppressing it is what keeps claim-lease renewals
//     (tasks.js:315) out of the log. One route bumps version with nothing else
//     changing — claim release on a non-`in_progress` node (tasks.js:398) — so
//     a live version CAN legitimately sit one ahead of the folded one. Failing
//     the fsck on a deliberate non-event would make it noise. It is reported as
//     `version_drift` so it is visible rather than hidden.
function comparableMeta(meta) {
  const out = {};
  for (const [k, v] of Object.entries(plainObject(meta))) {
    if (v === null) continue;
    // defineProperty, not `out[k] = v`: a meta key is user-controlled text and
    // may be `__proto__`, which plain assignment routes to Object.prototype's
    // setter instead of creating an own property — silently erasing the key
    // from one side of a comparison whose entire job is to notice a difference.
    // Same reasoning as setMetaKey in src/events/fold.js.
    Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  }
  return out;
}

function comparableNode(n) {
  return {
    id: n.id,
    meta: comparableMeta(n.meta),
    external_id: n.external_id ?? null,
    content_sha: n.content_sha ?? null,
    created_at: n.created_at ?? null,
  };
}

function comparableEdge(e) {
  return {
    id: e.id,
    source: e.source ?? null,
    target: e.target ?? null,
    purpose: e.purpose ?? null,
    type: e.type ?? null,
    meta: comparableMeta(e.meta),
    created_at: e.created_at ?? null,
  };
}

function compareSide(liveRows, foldRows, project) {
  const live = new Map(liveRows.map((r) => [r.id, r]));
  const folded = new Map(foldRows.map((r) => [r.id, r]));
  const missing = []; // present live, absent from the fold
  const extra = []; // present in the fold, absent live
  const differing = [];
  const versionDrift = [];
  for (const [id, row] of live) {
    const other = folded.get(id);
    if (!other) {
      missing.push(id);
      continue;
    }
    if (canonicalJson(project(row)) !== canonicalJson(project(other))) {
      differing.push({ id, live: project(row), fold: project(other) });
    }
    if ((row.version ?? null) !== (other.version ?? null)) {
      versionDrift.push({ id, live: row.version ?? null, fold: other.version ?? null });
    }
  }
  for (const id of folded.keys()) if (!live.has(id)) extra.push(id);
  return { missing, extra, differing, version_drift: versionDrift };
}

// THE STANDING PROOF of the thesis this design was chosen for.
//
// Under handler-authored logging, `ok` would go false the moment anything wrote
// to `tasks` or `edges` outside a route — a migration, a script, a test fixture,
// `eval/skill-ab/db-copy.js`, the two `UPDATE edges` statements inside
// db/schema.sql that run on EVERY boot. Under trigger capture the poison is
// itself captured, so the fold tracks it and this returns ok:true anyway. That
// is not the check being weak; it is the check confirming there is no gap to
// find. tests/e18-snapshot.test.js poisons the present with a raw
// `UPDATE tasks SET meta = ...` precisely to pin that.
export async function diffFoldVsLive(pool, graphId) {
  const live = await stateFromLiveRows(pool, graphId);
  const folded = await foldAtHead(pool, graphId);
  const nodes = compareSide(live.nodes, folded.state.nodes, comparableNode);
  const edges = compareSide(live.edges, folded.state.edges, comparableEdge);
  const ok =
    nodes.missing.length === 0 &&
    nodes.extra.length === 0 &&
    nodes.differing.length === 0 &&
    edges.missing.length === 0 &&
    edges.extra.length === 0 &&
    edges.differing.length === 0;
  return {
    ok,
    graph_id: graphId,
    head_seq: folded.head_seq,
    base: folded.base,
    events_replayed: folded.events_replayed,
    anomalies: folded.anomalies,
    nodes,
    edges,
  };
}

export default {
  backfillGenesis,
  backfillGenesisAll,
  diffFoldVsLive,
  foldAtHead,
  getSnapshotInterval,
  lateGenesis,
  maybeSnapshot,
  repairSnapshots,
  setSnapshotInterval,
  stateFromLiveRows,
  verifySnapshot,
};
