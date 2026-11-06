// E18.4 — GET /api/graphs/:gid/tasks/:id/worldline?axis=&asOf=&known=
//
// A FACT'S WORLDLINE: the chain of generations a fact passed through, each with
// the half-open interval `[valid_from, valid_to)` over which it was the current
// version of that fact. Nothing here is stored. The interval boundaries are
// DERIVED — from the edge set the fold reconstructs for the requested rectangle,
// dated by the `node.superseded` events that opened each supersession.
//
// Mounted inside tasksRouter (app.js: requireGraphForMethod), so a GET is
// read-gated by the guard that is already there, with no new surface. The query
// knobs parse through the EXISTING `parseAsOfQuery`, so the error strings, the
// `axis=happened requires asOf` rule and the `known requires axis=happened`
// rule are shared rather than re-implemented.
//
// THE TWO CLOCKS DO NOT COLLAPSE, and this route is where that is most visible:
//   * `valid_to` is a HAPPENED-axis value — WHEN IN THE WORLD the fact's story
//     ended. It may be far earlier than the instant we were told.
//   * WHETHER a `valid_to` exists at all is a LEARNED-axis question — had we
//     been told by `known`?
// So `?axis=happened&asOf=X` can report `valid_to` = a backdated March date
// learned in September, and `?asOfSeq=<before that write>` reports the same
// node as OPEN. Neither answer is a correction of the other.
//
// RETRACTION is the other half. A supersession can be withdrawn (DELETE the
// edge, or retype it away). At an asOf before the withdrawal the node IS
// superseded; after it, it is not — and the `node.superseded` event is still in
// the log, unchanged and undeleted. The log is append-only; the STATE is the
// edge set; those are different things, and this is where the distinction earns
// its keep.
import pool from '../db.js';
import { cacheControlFor, graphAsOf, parseAsOfQuery } from '../events/store.js';
import {
  MAX_GENERATIONS,
  MAX_WORLDLINE_NODES,
  SUPERSEDES,
  buildWorldline,
  supersessionsFromLinks,
} from '../supersession.js';

// The opening event for a supersession. subject_kind='node' is SUPPLIED, so
// this is an index-only seek on the existing
// `events_subject_idx (graph_id, subject_kind, subject_id, seq)`.
//
// "LAST in the axis ordering", not "first": an edge can be retyped away from
// `supersedes` and back, and the CURRENT opening is the most recent one.
//
// THE RECTANGLE IS A SELECT-LIST FLAG, NOT A WHERE CLAUSE, and that is
// deliberate. Two things have to be told apart and a filtered query cannot tell
// them apart, because both come back as zero rows:
//
//   * no `node.superseded` event ANYWHERE in the log for this (node, edge) —
//     an edge that predates E18.4, or one written with `gt.capture=off`. THAT
//     is what the `edges.created_at` fallback was designed for.
//   * an opening that exists but sits OUTSIDE the requested rectangle — one seq
//     later on the learned axis (the annotation is a second event in the same
//     transaction as `edge.added`), or not yet learned by `known`. The
//     supersession has not been recorded as far as this rectangle can see, so
//     the fact is still OPEN in it. Falling back to `edges.created_at` here
//     invented a closing time out of a live-table column that the rectangle
//     cannot see at all — a wall-clock "closed just now" in a pinned past.
//
// The scan is over `node.superseded` events only — a kind that exists at the
// rate of 33 candidate relations across the entire 4103-node corpus.
const OPENED_SQL = (tail) => `SELECT seq, subject_id, happened_at,
                                     (payload ->> 'edge_id')::bigint AS edge_id,
                                     payload ->> 'via' AS via,
                                     (TRUE${tail}) AS in_rect
                                FROM events
                               WHERE graph_id = $1 AND subject_kind = 'node'
                                 AND kind = 'node.superseded'
                               ORDER BY happened_at, seq`;

// gen 0's left edge. One row per node in normal operation; MIN over
// (happened_at, seq) is the birth if a log ever holds more.
const CREATED_SQL = (tail) => `SELECT seq, subject_id, happened_at
                                 FROM events
                                WHERE graph_id = $1 AND subject_kind = 'node'
                                  AND kind = 'node.created'${tail}
                                ORDER BY happened_at, seq`;

function isoOrNull(value) {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

// The same tail filter the fold used, expressed for the annotation lookup:
//   learned axis  -> `seq <= S` (the resolved prefix; seq is gapless and
//                    commit-ordered, so learned_at <= T IS a prefix)
//   happened axis -> the bitemporal rectangle, verbatim from HAPPENED_TAIL_SQL
// A worldline that dated its intervals from events OUTSIDE the rectangle the
// edge set came from would be reporting two different reconstructions at once.
function tailFilter(params, resolvedSeq) {
  if (!params) return { tail: '', args: [] };
  if (params.axis === 'happened') {
    return {
      tail: ' AND happened_at <= $2::timestamptz AND ($3::timestamptz IS NULL OR learned_at <= $3::timestamptz)',
      args: [params.asOf, params.known ?? null],
    };
  }
  return { tail: ' AND seq <= $2', args: [resolvedSeq] };
}

export async function worldlineHandler(req, res, next) {
  const { gid } = req.params;
  const nodeId = Number(req.params.id);

  const parsed = parseAsOfQuery(req.query);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const params = parsed.value;

  try {
    let links;
    let titleOf = new Map();
    let asOfEnvelope;
    let resolvedSeq = null;

    if (params) {
      // ONE code path for every rectangle: the fold's own `links`, filtered to
      // `supersedes`. No second reconstruction, no drift.
      const out = await graphAsOf(pool, gid, params);
      links = out.links;
      titleOf = new Map(out.nodes.map((n) => [n.id, n.title ?? null]));
      asOfEnvelope = out.as_of;
      resolvedSeq = out.as_of.seq;
    } else {
      // No knobs: the LIVE tables, which ARE the fold at head — the standing
      // diffFoldVsLive fsck is the proof of that, and it is run after every
      // capture scenario. No replay happens, so there is no base or
      // events_replayed to report and the envelope says `live: true` instead of
      // inventing one.
      const [edgeRows, nodeRows, headRows] = await Promise.all([
        pool.query('SELECT id, source_id, target_id, purpose FROM edges WHERE graph_id = $1', [gid]),
        pool.query("SELECT id, meta->>'title' AS title FROM tasks WHERE graph_id = $1", [gid]),
        pool.query('SELECT COALESCE(MAX(seq), 0) AS head_seq FROM events WHERE graph_id = $1', [gid]),
      ]);
      links = edgeRows.rows.map((r) => ({
        id: Number(r.id),
        source: Number(r.source_id),
        target: Number(r.target_id),
        purpose: r.purpose,
      }));
      titleOf = new Map(nodeRows.rows.map((r) => [Number(r.id), r.title ?? null]));
      const headSeq = Number(headRows.rows[0].head_seq);
      asOfEnvelope = {
        axis: 'learned',
        requested: null,
        known: null,
        seq: headSeq,
        head_seq: headSeq,
        live: true,
      };
      resolvedSeq = headSeq;
    }

    if (!titleOf.has(nodeId)) return res.status(404).json({ error: 'not found' });

    const relations = supersessionsFromLinks(links);
    const { tail, args } = tailFilter(params, resolvedSeq);

    // Date every live supersession from the event that opened it.
    const openedRows = relations.length
      ? (await pool.query(OPENED_SQL(tail), [gid, ...args])).rows
      : [];
    const opened = new Map();   // openings INSIDE the rectangle
    const everOpened = new Set(); // openings anywhere in the log
    for (const row of openedRows) {
      const key = `${Number(row.subject_id)}:${Number(row.edge_id)}`;
      everOpened.add(key);
      // LAST wins: the rows arrive in axis order, so a plain overwrite is
      // "the most recent opening for this (node, edge) pair".
      if (row.in_rect) opened.set(key, row);
    }

    // Fallback for an edge that predates E18.4, or one written with
    // `gt.capture=off`: the edge row's own created_at, flagged approximate.
    const edgeIds = relations.map((r) => r.edge_id).filter((v) => Number.isFinite(v));
    const edgeCreated = new Map();
    if (edgeIds.length) {
      const { rows } = await pool.query(
        'SELECT id, created_at FROM edges WHERE graph_id = $1 AND id = ANY($2::bigint[])',
        [gid, edgeIds],
      );
      for (const r of rows) edgeCreated.set(Number(r.id), isoOrNull(r.created_at));
    }

    const records = [];
    for (const r of relations) {
      const key = `${r.superseded}:${r.edge_id}`;
      const hit = opened.get(key) ?? null;
      // Recorded, but not inside this rectangle: the edge is in the fold (the
      // `edge.added` is one seq earlier) while the assertion that dated it is
      // not. "Had we been told by then?" is a learned-axis question and the
      // answer here is NO, so this supersession is not part of the worldline
      // the rectangle can see and the fact reads as still open. Only a
      // supersession with no opening event AT ALL takes the approximate
      // `edges.created_at` fallback.
      if (!hit && everOpened.has(key)) continue;
      records.push({
        ...r,
        opened_at: hit ? isoOrNull(hit.happened_at) : edgeCreated.get(r.edge_id) ?? null,
        event_seq: hit ? Number(hit.seq) : null,
        via: hit ? hit.via ?? null : null,
        approximate: hit === null,
      });
    }

    // gen 0's left edge, and the row created_at beside it — REPORTED SEPARATELY
    // and never collapsed: `valid_from` is when the fact was true, `created_at`
    // is when we wrote it down.
    const nodeIds = [...new Set(records.flatMap((r) => [r.successor, r.superseded]).concat([nodeId]))];
    const [createdEvents, taskRows] = await Promise.all([
      pool.query(CREATED_SQL(`${tail} AND subject_id = ANY($${args.length + 2}::bigint[])`), [gid, ...args, nodeIds]),
      pool.query('SELECT id, created_at FROM tasks WHERE graph_id = $1 AND id = ANY($2::bigint[])', [gid, nodeIds]),
    ]);
    const createdEventAt = new Map();
    for (const row of createdEvents.rows) {
      const key = Number(row.subject_id);
      // FIRST wins here (the rows are in ascending axis order): a node's birth
      // is the earliest creation the rectangle can see.
      if (!createdEventAt.has(key)) createdEventAt.set(key, isoOrNull(row.happened_at));
    }
    const rowCreatedAt = new Map(taskRows.rows.map((r) => [Number(r.id), isoOrNull(r.created_at)]));

    const nodeInfo = new Map();
    for (const id of nodeIds) {
      nodeInfo.set(id, {
        title: titleOf.get(id) ?? null,
        created_at: rowCreatedAt.get(id) ?? null,
        // `undefined` (not null) is "no creation event in this rectangle", which
        // is what raises `approximate_from`. Measured: ALL 4103 corpus nodes
        // predate the log, so that is the common case for existing data — the
        // same honesty posture as `pre_history_approximation`.
        created_event_at: createdEventAt.has(id) ? createdEventAt.get(id) : undefined,
      });
    }

    const walk = buildWorldline(nodeId, records, nodeInfo, {
      maxGenerations: MAX_GENERATIONS,
      maxNodes: MAX_WORLDLINE_NODES,
    });

    res.set('Cache-Control', cacheControlFor(params ?? {}, asOfEnvelope));
    return res.json({
      node: nodeId,
      purpose: SUPERSEDES,
      as_of: asOfEnvelope,
      generations: walk.generations,
      // A worldline is not always a line. `roots` names every chain head the
      // walk was seeded from (a merge has more than one), `merges` the nodes
      // where separate lines join — the dual of `branches`.
      roots: walk.roots,
      branches: walk.branches,
      merges: walk.merges,
      truncated: walk.truncated,
    });
  } catch (err) {
    return next(err);
  }
}

export default worldlineHandler;
