// E18.1 STEP 5 — graph(t): reconstruct `GET /graph` at any point on either
// clock, from the append-only log.
//
// This module owns the SQL side of the reconstruction (which base to start
// from, which events to replay, in which order). The fold itself is pure and
// lives in src/events/fold.js. Nothing here imports src/db.js: the pool is an
// argument, which keeps the module unit-testable and keeps the DATABASE_URL
// read-once rule (src/db.js) out of its import graph.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE TWO CLOCKS
//
// `learned_at` is BELIEF time — when we were told. It is stamped by the
// database with clock_timestamp() and accepted from nowhere.
// `happened_at` is WORLD time — when the thing was true. Callers may backdate
// it, and the row triggers flag `payload.backdated` when they do.
//
// LEARNED AXIS (the default) answers "what did the graph look like in our
// records at time T". Because `gt_next_seq()` allocates `seq` under the
// graphs-row lock held to commit, the visible prefix is gapless and
// commit-ordered, so `learned_at` is monotone with `seq` within a graph.
// Two consequences this file leans on hard:
//   * `ORDER BY seq` IS learned order. No `(learned_at, seq)` composite, no
//     settled-horizon hack, no lagging visibility window.
//   * `learned_at <= T` selects exactly the PREFIX `seq <= maxSeq(T)`. So an
//     asOf timestamp can be resolved to a single seq up front, and everything
//     downstream — including the cache key — is a seq.
//
// HAPPENED AXIS answers "what was the world like at time T, as far as we can
// tell". It re-sorts the log by `happened_at`, which is a DIFFERENT order, so
// last-writer-wins produces a DIFFERENT answer. That divergence is the signal.
// This module must not reconcile it.
//
// WHY A PERIODIC SNAPSHOT CANNOT BE A HAPPENED-AXIS BASE. A snapshot at seq S
// encodes "every event with seq <= S, applied in LEARNED order". A backdated
// event learned after S sorts BEFORE some of those on the happened axis, so
// S's last-writer outcomes are simply wrong for that ordering. Genesis is the
// one exemption: it is a substrate, not a fold of events, and each of its rows
// carries its own `created_at`, so it can be filtered honestly by birth time
// (`filterGenesisByHappened`).
//
// WHY `?axis=happened` REQUIRES `asOf`. A seq is a handle on BELIEF time. There
// is no such thing as "the happened-axis state at seq 42".

import { isIsoDatetime } from '../markdown.js';
import { getDerived, setDerived } from '../derivedCache.js';
import {
  AXES,
  FOLD_VERSION,
  emptyState,
  filterGenesisByHappened,
  foldEvents,
  orderEvents,
  toGraphPayload,
} from './fold.js';

// ── parameter validation (house `{value}` / `{error}` shape, cf. frontier.js) ─

export const ASOF_ERROR = 'asOf must be an ISO-8601 datetime';
export const ASOF_SEQ_ERROR = 'asOfSeq must be a non-negative integer';
export const KNOWN_ERROR = 'known must be an ISO-8601 datetime';
export const AXIS_ERROR = "axis must be 'learned' or 'happened'";
export const ASOF_COMBINED_ERROR = 'asOf and asOfSeq cannot be combined';
export const HAPPENED_NEEDS_ASOF_ERROR = 'axis=happened requires asOf';
export const KNOWN_NEEDS_HAPPENED_ERROR = 'known requires axis=happened';

// Returns `{value: null}` when the request carries NONE of the four knobs —
// that is the signal for `GET /graph` to take its untouched hot path. Pure: it
// never queries, so the hot path pays nothing for this call.
export function parseAsOfQuery(query) {
  const q = query ?? {};
  const raw = (k) => {
    const v = q[k];
    return v === undefined || v === null || v === '' ? null : v;
  };
  const asOfRaw = raw('asOf');
  const seqRaw = raw('asOfSeq');
  const axisRaw = raw('axis');
  const knownRaw = raw('known');

  if (asOfRaw === null && seqRaw === null && axisRaw === null && knownRaw === null) {
    return { value: null };
  }
  if (asOfRaw !== null && seqRaw !== null) return { error: ASOF_COMBINED_ERROR };

  const axis = axisRaw === null ? 'learned' : String(axisRaw);
  if (!AXES.includes(axis)) return { error: AXIS_ERROR };

  // A repeated query parameter arrives as an array, which is not a timestamp.
  let asOf = null;
  if (asOfRaw !== null) {
    if (typeof asOfRaw !== 'string' || !isIsoDatetime(asOfRaw)) return { error: ASOF_ERROR };
    asOf = asOfRaw;
  }
  let asOfSeq = null;
  if (seqRaw !== null) {
    if (typeof seqRaw !== 'string' || !/^\d+$/.test(seqRaw.trim())) {
      return { error: ASOF_SEQ_ERROR };
    }
    asOfSeq = Number(seqRaw.trim());
    if (!Number.isSafeInteger(asOfSeq)) return { error: ASOF_SEQ_ERROR };
  }
  let known = null;
  if (knownRaw !== null) {
    if (typeof knownRaw !== 'string' || !isIsoDatetime(knownRaw)) return { error: KNOWN_ERROR };
    known = knownRaw;
  }

  if (axis === 'happened' && asOf === null) return { error: HAPPENED_NEEDS_ASOF_ERROR };
  if (known !== null && axis !== 'happened') return { error: KNOWN_NEEDS_HAPPENED_ERROR };

  return { value: { axis, asOf, asOfSeq, known } };
}

// `?asOfSeq=` pins an immutable prefix (gapless + commit-ordered seq), so it is
// the one reconstruction that may sit in a cache. Everything else resolves
// against a wall clock whose answer changes as the log grows.
//
// ONLY A SEQ THAT THE LOG ACTUALLY REACHED IS PINNED. `learnedAsOf` clamps
// `asOfSeq` to the head (`Math.min`), so `?asOfSeq=999` on a graph whose head
// is 12 means "whatever the head is right now" — the same URL answers
// DIFFERENTLY the moment anyone writes. That is the one case where the
// immutability argument above does not hold, so it gets `no-store`. It is
// clamped rather than rejected: the envelope already reports the honest `seq`
// and `head_seq`, a 400 would turn a currently-200 read (a client holding a
// head it learned a moment ago) into a new failure mode, and the defect here is
// the header, not the status code. `asOfSeq` EQUAL to head_seq is a settled
// prefix like any other and keeps its max-age.
//
// `resolved` is the `as_of` envelope graphAsOf returned. Without it there is no
// way to tell a pinned prefix from the moving head, so the answer is no-store.
export function cacheControlFor(params, resolved = null) {
  const asOfSeq = params?.asOfSeq;
  if (asOfSeq === null || asOfSeq === undefined) return 'no-store';
  const headSeq = Number(resolved?.head_seq);
  if (!Number.isFinite(headSeq) || asOfSeq > headSeq) return 'no-store';
  return 'private, max-age=600';
}

// ── SQL ──────────────────────────────────────────────────────────────────────

// Every column the fold reads, and nothing else. `payload` carries the
// post-image / diff; `actor` and `request_id` are provenance the fold has no
// use for, so they stay out of a query that can return thousands of rows.
const EVENT_COLS = `seq, happened_at, learned_at, kind, subject_kind, subject_id, cause_id, payload`;

// ORDER BY seq IS learned order — see the header.
const LEARNED_TAIL_SQL = `SELECT ${EVENT_COLS}
     FROM events
    WHERE graph_id = $1 AND seq > $2 AND seq <= $3
    ORDER BY seq`;

// The bitemporal rectangle: happened_at <= asOf (world time) AND
// learned_at <= known (belief time). `known` NULL means "believing what we
// believe now", i.e. no belief-time ceiling at all.
const HAPPENED_TAIL_SQL = `SELECT ${EVENT_COLS}
     FROM events
    WHERE graph_id = $1 AND seq > $2
      AND happened_at <= $3::timestamptz
      AND ($4::timestamptz IS NULL OR learned_at <= $4::timestamptz)
    ORDER BY happened_at, seq`;

// The base is the newest snapshot that is a valid starting point. Two
// predicates, for two different reasons:
//   * `seq <= $2` — a snapshot from AFTER the requested point encodes events
//     the caller has not asked to see.
//   * `kind = 'genesis' OR at <= $4` — the plan's rule for periodic snapshots.
//     Genesis is exempt and ALWAYS qualifies: it is the substrate the log
//     starts from, so refusing it because it was built after the requested
//     instant would throw away the only pre-history fact there is.
// `fold_version = $3` keeps a snapshot written by an older fold from being
// trusted silently; the fallback is simply an older base and a longer replay.
const BASE_SQL = `SELECT seq, kind, at, state
     FROM graph_snapshots
    WHERE graph_id = $1 AND axis = 'learned' AND seq <= $2
      AND fold_version = $3
      AND (kind = 'genesis' OR $4::timestamptz IS NULL OR at <= $4::timestamptz)
    ORDER BY seq DESC LIMIT 1`;

const GENESIS_SQL = `SELECT seq, kind, at, state
     FROM graph_snapshots
    WHERE graph_id = $1 AND axis = 'learned' AND kind = 'genesis' AND fold_version = $2
    ORDER BY seq LIMIT 1`;

// `history_starts_at` is "when this graph's log begins", which is a fact about
// the graph and not about any particular fold version — so no fold_version
// filter here.
const GENESIS_AT_SQL = `SELECT at
     FROM graph_snapshots
    WHERE graph_id = $1 AND axis = 'learned' AND kind = 'genesis'
    ORDER BY seq LIMIT 1`;

// ── helpers ──────────────────────────────────────────────────────────────────

function isoOrNull(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// "The caller asked about a moment before this graph's log existed." The answer
// is still the best one available (the genesis substrate, filtered by birth
// time on the happened axis) — it is the left edge of a timeline slider, not a
// 404 — but it is an approximation and the envelope says so.
//
// NOTE the clock mix on the happened axis: `history_starts_at` is belief time
// and `asOf` is world time. Comparing them is deliberate — the question it
// answers is "could the log possibly know about this?" — and it is the only
// place the two clocks meet.
function beforeHistory(asOf, historyStartsAt) {
  if (asOf === null || historyStartsAt === null) return false;
  const a = new Date(asOf).getTime();
  const h = new Date(historyStartsAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(h)) return false;
  return a < h;
}

function maxSeq(events, fallback) {
  let best = fallback;
  for (const e of events) {
    const n = Number(e.seq);
    if (Number.isFinite(n) && n > best) best = n;
  }
  return best;
}

async function genesisAt(pool, graphId) {
  const { rows } = await pool.query(GENESIS_AT_SQL, [graphId]);
  return rows.length ? isoOrNull(rows[0].at) : null;
}

// ── the learned axis ─────────────────────────────────────────────────────────

// Everything that depends ONLY on (graph, seq) — which is everything except the
// caller's own knobs and the live head. Cached under `${graphId}:${seq}`,
// because that pair names an immutable value.
async function buildLearned(pool, graphId, seq, asOf) {
  const anomalies = [];
  const { rows: baseRows } = await pool.query(BASE_SQL, [graphId, seq, FOLD_VERSION, asOf]);
  const baseRow = baseRows[0] ?? null;
  const baseSeq = baseRow ? Number(baseRow.seq) : 0;

  const { rows: tail } = await pool.query(LEARNED_TAIL_SQL, [graphId, baseSeq, seq]);
  // foldEvents deliberately does NOT sort — ordering is orderEvents' job, and
  // going through it here keeps the one ordering rule in one place even though
  // the SQL already returned the rows in seq order.
  const state = foldEvents(baseRow?.state ?? emptyState(), orderEvents(tail, 'learned'), {
    anomalies,
  });

  // A graph with NO genesis row is one whose backfill has not run or could not
  // finish (src/events/snapshot.js, `lateGenesis`). Everything the log has seen
  // is still exact — the replay covers seq 1 upward — but there is no honest
  // substrate for the world before seq 1, so the floor moves up to whatever
  // base we do have and the envelope says the pre-history is an approximation
  // rather than presenting a guess as history.
  const genesisTime =
    baseRow?.kind === 'genesis' ? isoOrNull(baseRow.at) : await genesisAt(pool, graphId);

  return {
    state,
    base: { kind: baseRow?.kind ?? 'empty', seq: baseSeq, at: isoOrNull(baseRow?.at) },
    events_replayed: tail.length,
    anomalies,
    history_starts_at: genesisTime ?? isoOrNull(baseRow?.at),
    pre_history_approximation: genesisTime === null,
  };
}

async function learnedAsOf(pool, graphId, params) {
  const asOf = params.asOf ?? null;
  const asOfSeq = params.asOfSeq ?? null;

  // ONE round trip for both the live head and the seq that `asOf` resolves to.
  // The FILTER clause is the whole "learned_at <= T is a prefix of seq" claim,
  // expressed once: `asOf` is bound as the RAW string the caller sent, so a
  // microsecond-precision timestamp (which is what `learned_at` actually holds)
  // is not silently truncated to milliseconds by a JS Date round trip.
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(seq), 0) AS head_seq,
            COALESCE(MAX(seq) FILTER (WHERE learned_at <= $2::timestamptz), 0) AS at_seq
       FROM events WHERE graph_id = $1`,
    [graphId, asOf],
  );
  const headSeq = Number(rows[0].head_seq);
  let seq;
  if (asOfSeq !== null) seq = Math.min(asOfSeq, headSeq);
  else if (asOf !== null) seq = Number(rows[0].at_seq);
  else seq = headSeq;

  // The cache stores the REPORTED base / events_replayed / anomalies too, not
  // just the state, so a hit and a miss produce byte-identical envelopes: a
  // cache that changes the answer is not a cache.
  let built = getDerived(graphId, seq);
  if (built === undefined) {
    built = await buildLearned(pool, graphId, seq, asOf);
    setDerived(graphId, seq, built);
  }

  const { nodes, links } = toGraphPayload(built.state);
  return {
    nodes,
    links,
    as_of: {
      axis: 'learned',
      requested: asOf ?? asOfSeq,
      known: null,
      seq,
      head_seq: headSeq,
      base: built.base,
      events_replayed: built.events_replayed,
      history_starts_at: built.history_starts_at,
      pre_history_approximation: built.pre_history_approximation,
      truncated: beforeHistory(asOf, built.history_starts_at),
      anomalies: built.anomalies,
    },
  };
}

// ── the happened axis ────────────────────────────────────────────────────────

async function happenedAsOf(pool, graphId, params) {
  const asOf = params.asOf;
  const known = params.known ?? null;
  const anomalies = [];

  const { rows: headRows } = await pool.query(
    'SELECT COALESCE(MAX(seq), 0) AS head_seq FROM events WHERE graph_id = $1',
    [graphId],
  );
  const headSeq = Number(headRows[0].head_seq);

  // Genesis only. A periodic snapshot encodes learned-order outcomes and is
  // therefore not a legal base for this ordering — see the header.
  const { rows: gRows } = await pool.query(GENESIS_SQL, [graphId, FOLD_VERSION]);
  const genesis = gRows[0] ?? null;
  const baseSeq = genesis ? Number(genesis.seq) : 0;
  const baseState = filterGenesisByHappened(genesis?.state ?? emptyState(), asOf);

  const { rows: tail } = await pool.query(HAPPENED_TAIL_SQL, [graphId, baseSeq, asOf, known]);
  // Re-sorting is the point: this is a different order over the same events,
  // and re-sorting can put a patch before its create or after its delete.
  // applyEvent materialises from the post-image and records an anomaly rather
  // than dropping the event, so the caller sees exactly where the two axes
  // could not agree.
  const ordered = orderEvents(tail, 'happened');
  const state = foldEvents(baseState, ordered, { anomalies });

  const { nodes, links } = toGraphPayload(state);
  return {
    nodes,
    links,
    as_of: {
      axis: 'happened',
      requested: asOf,
      known,
      // The highest seq that made it into this answer. It is NOT a prefix
      // handle here — the happened axis is not a prefix of the log — it is
      // provenance: the newest belief this reconstruction rests on.
      seq: maxSeq(ordered, baseSeq),
      head_seq: headSeq,
      base: { kind: genesis ? 'genesis' : 'empty', seq: baseSeq, at: isoOrNull(genesis?.at) },
      events_replayed: ordered.length,
      history_starts_at: genesis ? isoOrNull(genesis.at) : await genesisAt(pool, graphId),
      // No genesis substrate means no honest account of the world before seq 1.
      // A periodic snapshot cannot stand in for one HERE even when a
      // late-genesis row exists, because it encodes learned-order outcomes —
      // see the header — so this axis simply replays the whole log over the
      // empty state and says that it is an approximation.
      pre_history_approximation: genesis === null,
      truncated: beforeHistory(asOf, isoOrNull(genesis?.at)),
      anomalies,
    },
  };
}

// ── the entry point ──────────────────────────────────────────────────────────

// `params` is the `{axis, asOf, asOfSeq, known}` value parseAsOfQuery returns.
// Returns the `GET /graph` payload plus the `as_of` envelope. Never mutates
// anything: this is a read path and E18's locked decision is that read paths
// only read — nothing here writes a snapshot, and nothing auto-flips a status.
export async function graphAsOf(pool, graphId, params = {}) {
  const axis = params.axis ?? 'learned';
  if (!AXES.includes(axis)) throw new Error(`unknown axis: ${axis}`);
  return axis === 'happened'
    ? happenedAsOf(pool, graphId, params)
    : learnedAsOf(pool, graphId, params);
}
