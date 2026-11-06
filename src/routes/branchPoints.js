// E18.5 — DECISION BRANCH POINTS.
//
//   GET  /api/graphs/:gid/decisions/:id/branches?axis=&asOf=&asOfSeq=&known=
//   POST /api/graphs/:gid/decisions/:id/confrontation
//
// Two handlers, one router, mounted AFTER the existing `/decisions/at-risk`
// mount (Express matches in registration order and that path is an exact
// prefix). Both are read-gated and both are SELECT-ONLY: they issue queries,
// hold no transaction, emit no event, write no snapshot and flip no status —
// they could not if they tried. tests/e18-branches-route.test.js asserts
// graphs.version, every tasks.updated_at and MAX(events.seq) unchanged across a
// call, copied from tests/e18-doubt-route.test.js.
//
// WHY TWO ROUTES AND NOT ONE, and not three. The RESULT TYPES DIFFER, which is
// E18.3's own stated test for a new route over a flag: `/branches` returns
// options and node id sets for a RECTANGLE, `/confrontation` returns pairs of
// grounds and outcomes for a MOMENT. A flag would make the top-level arrays mean
// different things depending on a body key. And the contingency closure is a
// FIELD of `/branches`, not a third route: it is the same walk over the same
// edge set the overlay already needed, rooted at the decision instead of at an
// option.
//
// WHY `/branches` IS A GET AND `/confrontation` A POST. `/branches` is a
// rectangle read — its knobs are exactly `parseAsOfQuery`'s, so the errors and
// the `axis=happened requires asOf` / `known requires axis=happened` rules are
// SHARED rather than re-implemented, and `?asOfSeq=` pins an immutable prefix so
// `cacheControlFor` can hand out a real max-age. That is `/tasks/:id/worldline`'s
// shape, for the same reasons. `/confrontation` carries caller-owned tuning in a
// body like `/frontier`, `/doubt`, `/decisions/at-risk` and `/structure` — all
// POST, all read-gated — and is always `no-store`, because outcomes accrue with
// the log.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE CONFRONTATION VIEW REFUSES TO DO, and says so in `limits`
//
//   * NO FABRICATED COUNTERFACTUALS. Every node named has real events. An
//     unexplored branch reports `empty: true, node_count: 0, fabricated: false`
//     and a reason — never a projected plan.
//   * IT DOES NOT RUN THE BENCHMARK. `ran: false` is a CONSTANT, not a computed
//     flag: there is no execution path in this file. Re-running is a deliberate
//     act with its own event.
//   * IT RENDERS NO VERDICT. It pairs what was on record then against what the
//     log has recorded since. Whether the decision was right is the reader's.
//   * SILENCE IS NOT VINDICATION. `unconfronted` means nobody checked, which is
//     not evidence that the decision held.
//   * "WE CANNOT SEE THAT FAR BACK" IS NEVER RENDERED AS "IT DID NOT EXIST":
//     when the reconstruction is incomplete, `present_at_decision` is `null` on
//     every ground and never `false`. `basis: 'none'` IS such a case — head
//     state is not a reconstruction of a moment the view cannot locate — so it
//     reports `complete: false` and nulls every decision-time field.
//   * A BOUND IS NEVER SILENT. Every cap that could have shortened this answer
//     is named in `truncation.reasons`, including the ONE GLOBAL cause walk
//     shared across all grounds: a ground starved by that cap says
//     `outcomes_truncated_by: ['cause_walk_cap']` rather than reporting the
//     silence the cap created as `unconfronted`.
//   * A SUMMARY DESCRIBES THE DECISION, NOT THE PAGE. `confronted` counts over
//     every ground the decision has, never over the `maxResults` slice that was
//     returned; the page size is stated as `confronted.returned`. A paged read
//     that summarised its own page reported a decision whose grounds had been
//     contradicted as one where nothing had been confronted at all.
//   * DIRECTION IS NOT DISCARDED. `supersedes` is directed (source = SUCCESSOR,
//     target = SUPERSEDED), so a ground that REPLACED something is not reported
//     as having been replaced. `contradicts` stays symmetric.

import { Router } from 'express';
import pool from '../db.js';
import { requireIntegerParam } from './_validate.js';
import { cacheControlFor, graphAsOf, parseAsOfQuery } from '../events/store.js';
import { SUPERSEDES, outcomeEndpoints, supersededIds } from '../supersession.js';
import {
  DEFAULT_CHAIN_LIMIT,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  DEFAULT_MAX_RESULTS,
  CHAIN_LIMIT_CAP,
  MAX_DEPTH_CAP,
  MAX_NODES_CAP,
  MAX_RESULTS_CAP,
} from '../doubt.js';
import { isDecayEligible, weakening } from '../events/kinds.js';
import {
  checkFromEvent,
  dueAt,
  emptyStability,
  foldChecks,
  isDue,
  retrievability,
  stabilityFor,
} from '../events/stability.js';
import {
  CLOSURE_PURPOSE,
  closureAdjacency,
  closureFrom,
  committedDecisionIds,
  contingencyAdjacency,
  contingencyFrom,
  contingencyLinks,
  dormantIds,
  optionsFromLinks,
  overlaySummary,
} from '../branches.js';

const router = Router({ mergeParams: true });
const validateId = requireIntegerParam('id');

// The two purposes that wire a GROUND into a decision. Identical to
// /decisions/at-risk's `e.purpose IN ('required for','supports')`, deliberately:
// "what this decision rests on" must be ONE definition across the two views.
export const GROUND_PURPOSES = Object.freeze([CLOSURE_PURPOSE, 'supports']);

// The structural assertions a human can make that bear on a decision.
export const STRUCTURAL_PURPOSES = Object.freeze(['contradicts', SUPERSEDES]);

// The index-servable PREFILTER for "what happened to this ground since". THE
// PREFILTER IS NOT THE PREDICATE (E18.3's measured lesson): `field.set` matches
// every confidence or significance edit, and `weakening()` is what decides
// whether one actually moved confidence DOWN. Served by events_kinds_gin.
export const FATE_KINDS = Object.freeze([
  'claim.verified', 'claim.refuted', 'node.superseded', 'field.set',
]);

export const DEFAULT_MAX_OUTCOMES = 50;
export const MAX_OUTCOMES_CAP = 500;

export const PREDICTION_TYPES_ERROR = 'predictionTypes must be an array of strings';

// ── house validators ─────────────────────────────────────────────────────────

function num(value, name, dflt, { min, max, integer }) {
  if (value === undefined || value === null) return { value: dflt };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `${name} must be a number` };
  if (integer && !Number.isInteger(value)) return { error: `${name} must be an integer` };
  if (min !== undefined && value < min) return { error: `${name} must be >= ${min}` };
  if (max !== undefined && value > max) return { error: `${name} must be <= ${max}` };
  return { value };
}

// Query-string twin of num(): a repeated parameter arrives as an array, which is
// not a number, and a non-integer is a 400 rather than a silent Math.floor.
function intQuery(value, name, dflt, { min, max }) {
  if (value === undefined || value === null || value === '') return { value: dflt };
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return { error: `${name} must be a non-negative integer` };
  }
  const n = Number(value.trim());
  if (!Number.isSafeInteger(n)) return { error: `${name} must be a non-negative integer` };
  if (min !== undefined && n < min) return { error: `${name} must be >= ${min}` };
  if (max !== undefined && n > max) return { error: `${name} must be <= ${max}` };
  return { value: n };
}

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

const MS_PER_DAY = 86400000;

// ── SQL ──────────────────────────────────────────────────────────────────────

// The decision's own commitment events. subject_kind='node' is SUPPLIED, so this
// is an index seek on events_subject_idx.
const DECISION_EVENTS_SQL = `SELECT seq, kind, happened_at, learned_at, actor, cause_id,
                                    payload #- '{changes,content}' AS payload
                               FROM events
                              WHERE graph_id = $1 AND subject_kind = 'node' AND subject_id = $2
                                AND payload -> 'kinds' ?| ARRAY['decision.made','decision.reopened']
                              ORDER BY seq`;

// A node CREATED already carrying `decided_at` emits `node.created` and NO
// `decision.made` at all — the INSERT logger writes one literal kind, and
// gt_classify_node() only ever runs on an UPDATE's `changes`. So when such a
// node is later REOPENED the commitment leaves no `decision.made` behind, and
// the creation event is the commitment's own seq, exactly. `/branches` already
// reasons from this shape (see its `state` comment); this is the query that
// lets the confrontation do the same instead of falling through to head state.
const CREATED_DECIDED_SQL = `SELECT seq FROM events
                              WHERE graph_id = $1 AND subject_kind = 'node' AND subject_id = $2
                                AND kind = 'node.created' AND seq <= $3
                                AND payload -> 'after' -> 'meta' ->> 'decided_at' IS NOT NULL
                              ORDER BY seq
                              LIMIT 1`;

// The last event at or before the decision that CHANGED the body. `node.created`
// qualifies because a node born with its rationale never emits a `content`
// change at all.
const RATIONALE_SQL = `SELECT seq, kind,
                              payload -> 'changes' -> 'content' AS content_change,
                              payload -> 'after' ->> 'content'  AS created_content,
                              COALESCE((payload ->> 'excised')::boolean, false) AS excised
                         FROM events
                        WHERE graph_id = $1 AND subject_kind = 'node' AND subject_id = $2
                          AND seq <= $3
                          AND ((payload -> 'changes') ? 'content' OR kind = 'node.created')
                        ORDER BY seq DESC
                        LIMIT 1`;

// sha256 in SQL, so `content_sha_now` is computed by EXACTLY the expression the
// row trigger uses for `to_sha`. convert_to(x,'UTF8'), NEVER `text::bytea` — the
// cast parses its input as bytea escape text and dies 22P02 on any body holding
// a stray backslash (measured: 118 production nodes).
const CURRENT_NODE_SQL = `SELECT id, meta, updated_at,
                                 encode(sha256(convert_to(COALESCE(content,''), 'UTF8')), 'hex') AS content_sha
                            FROM tasks WHERE graph_id = $1 AND id = $2`;

const HEAD_GROUNDS_SQL = `SELECT e.id AS edge_id, e.source_id, e.purpose, s.meta
                            FROM edges e
                            JOIN tasks s ON s.id = e.source_id AND s.graph_id = $1
                           WHERE e.graph_id = $1 AND e.target_id = $2
                             AND e.purpose = ANY($3::text[])
                           ORDER BY e.source_id`;

// `via: fate` — what happened to the thing we relied on. The strongest and
// cheapest of the three mechanisms: it requires no wiring discipline of the
// writer at all.
const fateSql = (boundary) => `SELECT seq, kind, subject_id, happened_at, learned_at, cause_id,
                                      payload #- '{changes,content}' AS payload
                                 FROM events
                                WHERE graph_id = $1 AND subject_kind = 'node'
                                  AND subject_id = ANY($2::bigint[])
                                  AND ${boundary}
                                  AND payload -> 'kinds' ?| $4::text[]
                                ORDER BY seq`;

// `via: cause` — belief-time provenance: "this was recorded BECAUSE OF that
// decision". The writer opted in by setting `gt.cause_id`.
//
// `CHECK (cause_id < seq)` makes the cause graph a STRICT DAG, so this walk
// TERMINATES WITH NO VISITED SET — the comfort src/supersession.js is explicitly
// denied for succession, and it is real here. Served by events_cause_idx.
const CAUSED_SQL = `WITH RECURSIVE caused AS (
                      SELECT e.seq, e.kind, e.subject_kind, e.subject_id,
                             e.happened_at, e.learned_at, e.cause_id
                        FROM events e
                       WHERE e.graph_id = $1 AND e.cause_id = $2
                      UNION
                      SELECT e.seq, e.kind, e.subject_kind, e.subject_id,
                             e.happened_at, e.learned_at, e.cause_id
                        FROM events e JOIN caused c ON e.cause_id = c.seq
                       WHERE e.graph_id = $1
                    )
                    SELECT * FROM caused ORDER BY seq LIMIT $3`;

// `via: edge` — a human's structural assertion that this bears on the decision.
const edgeOutcomeSql = (boundary) => `SELECT e.id AS edge_id, e.source_id, e.target_id, e.purpose,
                                             ev.seq, ev.happened_at, ev.learned_at
                                        FROM edges e
                                        JOIN events ev
                                          ON ev.graph_id = $1 AND ev.subject_kind = 'edge'
                                         AND ev.subject_id = e.id AND ev.kind = 'edge.added'
                                       WHERE e.graph_id = $1
                                         AND e.purpose = ANY($4::text[])
                                         AND (e.source_id = ANY($2::int[]) OR e.target_id = ANY($2::int[]))
                                         AND ev.${boundary}
                                       ORDER BY ev.seq`;

// The empirical leg's checks. Same allowlist E18.2's stability fold uses — for
// THAT question a failed check IS a check.
const CHECK_EVENTS_SQL = `SELECT seq, subject_id, subject_kind, happened_at, learned_at,
                                 payload #- '{changes,content}' AS payload
                            FROM events
                           WHERE graph_id = $1 AND subject_kind = 'node'
                             AND subject_id = ANY($2::bigint[])
                             AND payload -> 'kinds' ?| ARRAY['claim.verified','claim.refuted']
                           ORDER BY seq`;

// ── GET /:id/branches ────────────────────────────────────────────────────────

router.get('/:id/branches', validateId, async (req, res, next) => {
  const { gid } = req.params;
  const decisionId = Number(req.params.id);

  const parsed = parseAsOfQuery(req.query);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const rect = parsed.value ?? { axis: 'learned', asOf: null, asOfSeq: null, known: null };

  const maxDepth = intQuery(req.query.maxDepth, 'maxDepth', DEFAULT_MAX_DEPTH, { min: 1, max: MAX_DEPTH_CAP });
  const maxNodes = intQuery(req.query.maxNodes, 'maxNodes', DEFAULT_MAX_NODES, { min: 1, max: MAX_NODES_CAP });
  const maxResults = intQuery(req.query.maxResults, 'maxResults', DEFAULT_MAX_RESULTS, { min: 1, max: MAX_RESULTS_CAP });
  const chainLimit = intQuery(req.query.chainLimit, 'chainLimit', DEFAULT_CHAIN_LIMIT, { min: 1, max: CHAIN_LIMIT_CAP });
  for (const r of [maxDepth, maxNodes, maxResults, chainLimit]) {
    if (r.error) return res.status(400).json({ error: r.error });
  }

  try {
    // ONE reconstruction. Options, closures, dormancy, the overlays AND the
    // contingency walk all read the SAME `links` array, so nothing in this
    // answer can be describing a different rectangle from anything else in it —
    // which is precisely the mistake worldline.js's header warns about.
    const view = await graphAsOf(pool, gid, rect);
    const node = view.nodes.find((n) => n.id === decisionId);
    if (!node) return res.status(404).json({ error: 'not found' });

    const meta = node.meta ?? {};
    const decidedAt = meta.decided_at ?? null;
    const committed = committedDecisionIds(view.nodes);
    const { dormant, contested } = dormantIds(view.links, committed);
    const superseded = supersededIds(view.links);
    const adjacency = closureAdjacency(view.links);
    const byId = new Map(view.nodes.map((n) => [n.id, n]));

    // The commitment's seq, from the LOG — never from the backdatable scalar.
    // Restricted to the rectangle so a decision made after the requested point
    // is not read back into it.
    const boundary = rect.axis === 'happened'
      ? { clause: 'happened_at <= $3::timestamptz AND ($4::timestamptz IS NULL OR learned_at <= $4::timestamptz)', args: [rect.asOf, rect.known ?? null] }
      : { clause: 'seq <= $3', args: [view.as_of.seq] };
    const { rows: decisionEvents } = await pool.query(
      `SELECT seq, kind FROM events
        WHERE graph_id = $1 AND subject_kind = 'node' AND subject_id = $2
          AND payload -> 'kinds' ?| ARRAY['decision.made','decision.reopened']
          AND ${boundary.clause}
        ORDER BY seq`,
      [gid, decisionId, ...boundary.args],
    );
    let decisionSeq = null;
    let reopenedSeq = null;
    for (const row of decisionEvents) {
      const kinds = String(row.kind);
      if (kinds === 'decision.made') { decisionSeq = Number(row.seq); reopenedSeq = null; }
      else if (kinds === 'decision.reopened') reopenedSeq = Number(row.seq);
    }

    // ROLES ARE NOT AUTO-FLIPPED, so both tags are reported and the view resolves
    // neither: `role` is what the edge asserts NOW (in this rectangle), and
    // `role_at_decision` is what it asserted when the commitment was made. That
    // pair is what makes "we changed our minds and re-tagged" legible.
    //
    // The second reconstruction is on the LEARNED axis at the commitment's seq
    // even when the caller asked for a happened-axis rectangle, and that is not
    // a mix-up: "what did the tag say WHEN WE COMMITTED" is a belief-time
    // question and the seq is its only unforgeable handle. It is also free —
    // the asOf reader caches `${graphId}:${seq}`.
    let rolesAtDecision = null;
    if (decisionSeq !== null) {
      const atDecision = await graphAsOf(pool, gid, {
        axis: 'learned', asOf: null, asOfSeq: decisionSeq, known: null,
      });
      rolesAtDecision = new Map(
        optionsFromLinks(atDecision.links, decisionId).map((o) => [o.node_id, o.role]),
      );
    }

    // `reopened` is claimed on the strength of EITHER commitment event: a node
    // CREATED already carrying `decided_at` emits `node.created` and no
    // `decision.made` at all (measured — the INSERT logger writes one literal
    // kind), so `decision.reopened` can be the only trace a commitment ever
    // existed. Reading only the first would report that node as never decided.
    const state = decidedAt === null || decidedAt === undefined
      ? (decisionSeq === null && reopenedSeq === null ? 'never_decided' : 'reopened')
      : 'committed';

    const options = optionsFromLinks(view.links, decisionId).map((option) => {
      const optionNode = byId.get(option.node_id) ?? null;
      const closure = closureFrom(adjacency, option.node_id);
      const roleAtDecision = rolesAtDecision ? rolesAtDecision.get(option.node_id) ?? null : null;
      return {
        node_id: option.node_id,
        edge_id: option.edge_id,
        title: optionNode?.title ?? null,
        role: option.role,
        role_at_decision: roleAtDecision,
        // The decision is open and a `chosen` role is STILL asserted. Reported,
        // never resolved: nothing in this rung auto-flips anything.
        stale_role: state !== 'committed' && option.role === 'chosen',
        status: optionNode?.meta?.status ?? null,
        superseded: superseded.has(option.node_id),
        dormant: dormant.has(option.node_id),
        branch_size: closure.size,
        overlay: overlaySummary(view, closure, {
          option_id: option.node_id,
          role: option.role,
        }),
      };
    });

    const contingency = contingencyFrom(
      contingencyAdjacency(contingencyLinks(view.links, decisionId)),
      decisionId,
      {
        maxDepth: maxDepth.value,
        maxNodes: maxNodes.value,
        maxResults: maxResults.value,
        chainLimit: chainLimit.value,
      },
    );
    const contingencyNodes = contingency.nodes.map((item) => {
      const n = byId.get(item.id) ?? null;
      return {
        id: item.id,
        title: n?.title ?? null,
        status: n?.meta?.status ?? null,
        hops: item.hops,
        dormant: dormant.has(item.id),
        chain: item.chain.hops,
        chain_truncated: item.chain.truncated,
      };
    });

    res.set('Cache-Control', cacheControlFor(rect, view.as_of));
    res.json({
      decision: {
        id: decisionId,
        title: node.title ?? null,
        type: node.meta?.type ?? null,
        state,
        decided_at: decidedAt ?? null,
        decision_seq: decisionSeq,
        reopened_seq: reopenedSeq,
      },
      as_of: view.as_of,
      options,
      dormant: {
        count: dormant.size,
        node_ids: [...dormant].sort((a, b) => a - b),
        // NAMED, not silently applied. A node reachable from an alternative AND
        // from a chosen option stays LIVE — the work is needed either way — and
        // a view that applied that rule without saying which nodes it applied to
        // would be unexplainable to the human reading it.
        contested: [...contested].sort((a, b) => a - b),
      },
      contingency: {
        root: decisionId,
        count: contingency.count,
        nodes: contingencyNodes,
        truncated: contingency.truncated,
        stopped_by: contingency.stopped_by,
        walk: contingency.walk,
      },
      params: {
        axis: rect.axis,
        asOf: rect.asOf,
        asOfSeq: rect.asOfSeq,
        known: rect.known,
        maxDepth: maxDepth.value,
        maxNodes: maxNodes.value,
        maxResults: maxResults.value,
        chainLimit: chainLimit.value,
      },
      truncated: contingency.truncated,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/confrontation ──────────────────────────────────────────────────

export function parseConfrontationBody(body) {
  const b = body || {};
  const maxResults = num(b.maxResults, 'maxResults', DEFAULT_MAX_RESULTS, { min: 1, max: MAX_RESULTS_CAP, integer: true });
  const maxOutcomes = num(b.maxOutcomes, 'maxOutcomes', DEFAULT_MAX_OUTCOMES, { min: 1, max: MAX_OUTCOMES_CAP, integer: true });
  if (maxResults.error) return { error: maxResults.error };
  if (maxOutcomes.error) return { error: maxOutcomes.error };

  // CALLER-OWNED NARROWING, default EMPTY. Nothing in the corpus marks a
  // prediction, and requiring a `meta.type: 'prediction'` would key the whole
  // feature on a field no node has — exactly the mistake E18.2 refused when it
  // declined to name a `claim` type (2983 of 4103 nodes are untyped).
  let predictionTypes = [];
  if (b.predictionTypes !== undefined && b.predictionTypes !== null) {
    if (!Array.isArray(b.predictionTypes)) return { error: PREDICTION_TYPES_ERROR };
    for (const t of b.predictionTypes) {
      if (typeof t !== 'string' || t === '') return { error: PREDICTION_TYPES_ERROR };
    }
    predictionTypes = [...b.predictionTypes];
  }
  return {
    value: {
      maxResults: maxResults.value,
      maxOutcomes: maxOutcomes.value,
      predictionTypes,
    },
  };
}

// The effect an outcome has on the ground it is paired with. Three mechanisms,
// reported SEPARATELY under `via` and never merged, because they mean different
// things — but they agree on what a contradiction is.
function effectOf(kind, purpose = null) {
  if (purpose !== null) return 'contradicted';          // contradicts / supersedes
  if (kind === 'claim.refuted' || kind === 'node.superseded') return 'contradicted';
  if (kind === 'claim.verified') return 'confirmed';
  return 'changed';
}

function statusFor(outcomes) {
  if (outcomes.length === 0) return 'unconfronted';
  if (outcomes.some((o) => o.effect === 'contradicted')) return 'contradicted_since';
  if (outcomes.some((o) => o.effect === 'confirmed')) return 'confirmed_since';
  return 'changed_since';
}

// Which of the prefiltered kinds this event actually asserts. `field.set` is the
// one that needs a PREDICATE and not just the index's prefilter: it matches
// every significance edit, and only a confidence drop is an outcome.
function fateKindOf(row) {
  const kinds = Array.isArray(row?.payload?.kinds) ? row.payload.kinds : [];
  for (const k of ['claim.refuted', 'node.superseded', 'claim.verified']) {
    if (kinds.includes(k)) return k;
  }
  if (kinds.includes('field.set')) {
    const wk = weakening(row);
    return wk && wk.kind === 'confidence_drop' ? 'field.set' : null;
  }
  return null;
}

router.post('/:id/confrontation', validateId, async (req, res, next) => {
  const { gid } = req.params;
  const decisionId = Number(req.params.id);
  const parsed = parseConfrontationBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const p = parsed.value;

  try {
    const { rows: currentRows } = await pool.query(CURRENT_NODE_SQL, [gid, decisionId]);
    if (currentRows.length === 0) return res.status(404).json({ error: 'not found' });
    const current = currentRows[0];
    const currentMeta = current.meta ?? {};
    const decidedAt = currentMeta.decided_at ?? null;

    // ── leg (a): the decision's context ──────────────────────────────────────
    //
    // PRIMARY: the LEARNED axis pinned at the SEQ of the `decision.made` event.
    // `decided_at` is a world-time scalar any writer may backdate; the seq is
    // allocated by gt_next_seq() under the graphs-row lock held to commit —
    // gapless, commit-ordered and unforgeable. "What did we believe when we
    // committed" is a BELIEF-TIME question, so the honest handle is the seq.
    const { rows: decisionEvents } = await pool.query(DECISION_EVENTS_SQL, [gid, decisionId]);
    let decisionEvent = null;
    const reopenedEvents = [];
    for (const row of decisionEvents) {
      const kinds = Array.isArray(row.payload?.kinds) ? row.payload.kinds : [];
      if (kinds.includes('decision.made')) { decisionEvent = row; reopenedEvents.length = 0; }
      else if (kinds.includes('decision.reopened')) reopenedEvents.push(row);
    }

    // FOUR HONEST BASES, mirroring resolveAnchor() in src/routes/doubt.js.
    //   event_seq  — a decision.made event exists: exact.
    //   scalar     — no event, but meta.decided_at is set. EVERY node in the
    //                corpus predates the log, so this is the common case today
    //                and it sharpens from ship day forward.
    //   reopen_seq — decided_at is GONE and no decision.made was ever written,
    //                but `decision.reopened` events exist — and a reopen CANNOT
    //                EXIST unless a commitment once did. Reading that as "no
    //                decision point" made the view report HEAD STATE as the
    //                decision's context and skip every outcome leg, so a
    //                refutation sitting in the log came back `unconfronted`.
    //                The anchor is the creation event when the node was born
    //                carrying decided_at (exact), else the EARLIEST reopen,
    //                which bounds the commitment from ABOVE and says so.
    //   none       — no trace of a commitment at all. Head state, no decision
    //                point, no outcomes — and, because that is not a
    //                reconstruction of any moment, `complete: false` and
    //                decision-time fields NULL (below).
    const decisionSeq = decisionEvent !== null ? Number(decisionEvent.seq) : null;
    let anchor = decisionSeq === null
      ? null
      : { seq: decisionSeq, bound: 'exact', event_kind: 'decision.made' };
    if (anchor === null && !decidedAt && reopenedEvents.length > 0) {
      const firstReopen = Number(reopenedEvents[0].seq);
      const { rows } = await pool.query(CREATED_DECIDED_SQL, [gid, decisionId, firstReopen]);
      anchor = rows.length
        ? { seq: Number(rows[0].seq), bound: 'exact', event_kind: 'node.created' }
        : { seq: firstReopen, bound: 'upper', event_kind: 'decision.reopened' };
    }

    const basis = decisionEvent !== null
      ? 'event_seq'
      : (decidedAt ? 'scalar' : (anchor !== null ? 'reopen_seq' : 'none'));

    const contextParams = basis === 'scalar'
      ? { axis: 'happened', asOf: decidedAt, asOfSeq: null, known: null }
      : { axis: 'learned', asOf: null, asOfSeq: anchor === null ? null : anchor.seq, known: null };
    const context = await graphAsOf(pool, gid, contextParams);

    // SECONDARY, reported BESIDE the primary and never instead of it: what the
    // world looked like at the moment CLAIMED. The two are allowed to disagree
    // and this view must not reconcile them — that divergence is E18's standing
    // signal.
    let worldAtDecision = null;
    if (decidedAt && basis !== 'scalar') {
      const world = await graphAsOf(pool, gid, {
        axis: 'happened', asOf: decidedAt, asOfSeq: null, known: null,
      });
      worldAtDecision = {
        ...world.as_of,
        node_count: world.nodes.length,
        edge_count: world.links.length,
      };
    } else if (basis === 'scalar') {
      worldAtDecision = {
        ...context.as_of,
        node_count: context.nodes.length,
        edge_count: context.links.length,
      };
    }

    // `basis: 'none'` means the view could not locate the moment AT ALL, so what
    // it just reconstructed is HEAD STATE and not a reconstruction of anything.
    // Calling that `complete` was the view's worst lie: it made every head
    // ground `present_at_decision: true` at its CURRENT confidence.
    const contextComplete = basis !== 'none'
      && !(context.as_of.truncated || context.as_of.pre_history_approximation);

    // ── the grounds ──────────────────────────────────────────────────────────
    const contextGrounds = new Map();
    for (const link of context.links) {
      if (link.target !== decisionId) continue;
      if (!GROUND_PURPOSES.includes(link.purpose)) continue;
      contextGrounds.set(link.source, link.purpose);
    }
    const contextNodes = new Map(context.nodes.map((n) => [n.id, n]));

    const { rows: headGroundRows } = await pool.query(
      HEAD_GROUNDS_SQL, [gid, decisionId, [...GROUND_PURPOSES]],
    );
    const headGrounds = new Map(headGroundRows.map((r) => [Number(r.source_id), r]));

    const groundIds = [...new Set([...contextGrounds.keys(), ...headGrounds.keys()])]
      .sort((a, b) => a - b);

    // ── legs (b): outcomes, by three separate mechanisms ─────────────────────
    const boundaryIsSeq = anchor !== null;
    const boundaryValue = boundaryIsSeq ? anchor.seq : decidedAt;
    const boundaryLabel = boundaryIsSeq ? 'seq' : 'happened_at';

    const outcomesByNode = new Map();
    const unpaired = [];
    const groundSet = new Set(groundIds);
    const push = (nodeId, outcome) => {
      if (groundSet.has(nodeId)) {
        const held = outcomesByNode.get(nodeId);
        if (held) held.push(outcome);
        else outcomesByNode.set(nodeId, [outcome]);
      } else if (nodeId !== null) {
        // THE MOST INTERESTING LIST IN THE VIEW: the decision had consequences
        // nobody predicted. Listed, never discarded.
        unpaired.push(outcome);
      }
    };

    if (basis !== 'none' && groundIds.length > 0) {
      const boundaryClause = boundaryIsSeq ? 'seq > $3' : 'happened_at > $3::timestamptz';
      const { rows } = await pool.query(fateSql(boundaryClause), [
        gid, groundIds, boundaryValue, [...FATE_KINDS],
      ]);
      for (const row of rows) {
        const kind = fateKindOf(row);
        if (kind === null) continue;
        // events.subject_id is BIGINT and `pg` hands it back as a STRING. Left
        // raw it never matches a numeric edge endpoint and the pairing silently
        // returns nothing — the same trap src/doubt.js records.
        const nodeId = Number(row.subject_id);
        push(nodeId, {
          via: 'fate',
          seq: Number(row.seq),
          kind,
          node_id: nodeId,
          happened_at: isoOrNull(row.happened_at),
          learned_at: isoOrNull(row.learned_at),
          boundary: boundaryLabel,
          effect: effectOf(kind),
        });
      }
    }

    // THE CAUSE CAP IS GLOBAL, AND THAT IS WHY IT MUST BE ANNOUNCED. One
    // recursive walk rooted at the commitment's seq serves EVERY ground, so its
    // `LIMIT` cannot be split per ground without either running the walk once
    // per ground or fetching it unbounded — and an unbounded walk over the cause
    // DAG is exactly the shape that spills temp files. So the cap stays global
    // and the response STATES that it is global: `truncation.cause_walk_scope`.
    //
    // What is not allowed is what this did before — fetching maxOutcomes + 1,
    // throwing the overflow row away and recording nothing, so a ground whose
    // outcomes fell off the end came back `unconfronted`, which in this view
    // means NOBODY CHECKED. That is silence manufactured by a cap.
    let causeTruncated = false;
    if (anchor !== null && anchor.bound === 'exact') {
      const { rows } = await pool.query(CAUSED_SQL, [gid, anchor.seq, p.maxOutcomes + 1]);
      causeTruncated = rows.length > p.maxOutcomes;
      for (const row of rows.slice(0, p.maxOutcomes)) {
        const nodeId = row.subject_kind === 'node' ? Number(row.subject_id) : null;
        const outcome = {
          via: 'cause',
          seq: Number(row.seq),
          kind: row.kind,
          node_id: nodeId,
          subject_kind: row.subject_kind,
          happened_at: isoOrNull(row.happened_at),
          learned_at: isoOrNull(row.learned_at),
          boundary: 'seq',
          effect: effectOf(row.kind),
        };
        if (nodeId !== null && groundSet.has(nodeId)) push(nodeId, outcome);
        else unpaired.push(outcome);
      }
    }

    if (basis !== 'none') {
      const boundaryClause = boundaryIsSeq ? 'seq > $3' : 'happened_at > $3::timestamptz';
      const touch = [...groundIds, decisionId];
      const { rows } = await pool.query(edgeOutcomeSql(boundaryClause), [
        gid, touch, boundaryValue, [...STRUCTURAL_PURPOSES],
      ]);
      for (const row of rows) {
        const source = Number(row.source_id);
        const target = Number(row.target_id);
        const base = {
          via: 'edge',
          seq: Number(row.seq),
          kind: 'edge.added',
          purpose: row.purpose,
          edge_id: Number(row.edge_id),
          happened_at: isoOrNull(row.happened_at),
          learned_at: isoOrNull(row.learned_at),
          boundary: boundaryLabel,
          effect: effectOf('edge.added', row.purpose),
        };
        // WHOSE OUTCOME IS THIS? Not "whichever end is a ground": `supersedes`
        // is DIRECTED — source = SUCCESSOR, target = SUPERSEDED — so a ground
        // that is the SOURCE did the replacing and nothing happened to it.
        // Attaching to both ends made "our ground replaced something" and "our
        // ground was replaced" produce the SAME status, which is the one field
        // a human reads. outcomeEndpoints() is the at-risk rule, once.
        const bearing = outcomeEndpoints({ purpose: row.purpose, source, target });
        let attached = false;
        for (const endpoint of bearing) {
          if (!groundSet.has(endpoint)) continue;
          push(endpoint, { ...base, node_id: endpoint });
          attached = true;
        }
        if (!attached) {
          // Still listed, never discarded — under the node it actually happened
          // to, which for a supersedes edge is the superseded end.
          const affected = bearing.find((n) => n !== decisionId)
            ?? (source === decisionId ? target : source);
          unpaired.push({ ...base, node_id: affected });
        }
      }
    }

    // ── assembling the grounds ───────────────────────────────────────────────
    const grounds = [];
    for (const id of groundIds) {
      const inContext = contextGrounds.has(id);
      const contextNode = contextNodes.get(id) ?? null;
      const headRow = headGrounds.get(id) ?? null;
      const headMeta = headRow?.meta ?? null;
      const metaAtDecision = contextNode?.meta ?? null;
      const confidenceAt = numOrNull(metaAtDecision?.confidence);
      const confidenceNow = numOrNull(headMeta?.confidence);
      const type = metaAtDecision?.type ?? headMeta?.type ?? null;

      // THE DEFAULT PREDICTION PREDICATE: a decision-time ground that is
      // CONFIDENCE-BEARING. A claim carrying a confidence is the closest thing
      // the corpus has to a recorded expectation, and
      // `confidence IS NOT NULL OR type = 'reference'` is the house population
      // predicate /frontier has always used. Everything else is returned with
      // `prediction: false`: THE VIEW LABELS, IT NEVER INVENTS.
      let prediction = false;
      let predictionBasis = null;
      if (inContext && confidenceAt !== null) { prediction = true; predictionBasis = 'confidence'; }
      if (!prediction && p.predictionTypes.length > 0 && type !== null
          && p.predictionTypes.includes(type)) {
        prediction = true;
        predictionBasis = 'type';
      }

      const all = outcomesByNode.get(id) ?? [];
      all.sort((a, b) => a.seq - b.seq);
      const outcomes = all.slice(0, p.maxOutcomes);

      // TWO WAYS AN OUTCOME LIST CAN BE SHORT, NAMED SEPARATELY. The per-ground
      // slice cut THIS ground's tail; the global cause walk may have starved ANY
      // ground before its rows were ever fetched, and there is no way to know
      // which — so when it capped, every ground says so. A caller can tell a
      // capped answer from a complete one, and `unconfronted` under
      // `cause_walk_cap` reads as "we stopped looking", not "nobody checked".
      const truncatedBy = [];
      if (all.length > outcomes.length) truncatedBy.push('per_ground_cap');
      if (causeTruncated) truncatedBy.push('cause_walk_cap');

      grounds.push({
        id,
        title: contextNode?.title ?? headMeta?.title ?? null,
        purpose: contextGrounds.get(id) ?? headRow?.purpose ?? null,
        // NULL, NEVER FALSE, when the reconstruction could not see that far
        // back. "We cannot see that far back" rendered as "that ground did not
        // exist yet" would be the view fabricating the strongest possible claim
        // out of its own blindness.
        present_at_decision: contextComplete ? inContext : null,
        prediction,
        prediction_basis: predictionBasis,
        // With no anchor there is no decision-time, so there is no decision-time
        // confidence either. Reporting the CURRENT number in this field dressed
        // head state up as what was on record then.
        confidence_at_decision: basis === 'none' ? null : confidenceAt,
        confidence_now: confidenceNow,
        outcomes,
        outcomes_truncated: truncatedBy.length > 0,
        outcomes_truncated_by: truncatedBy,
        status: statusFor(outcomes),
      });
    }

    // ── leg (c): the re-runnable benchmark — POINTED AT, NEVER RUN ───────────
    //
    // Identified with no new vocabulary: a decision-time ground that is
    // DECAY-ELIGIBLE and carries at least one `claim.verified` event. Something
    // that has been checked at least once is something that CAN be checked
    // again; that is the whole claim, and it is derived from the log rather than
    // asserted by a type.
    const benchmarkCandidates = grounds
      .filter((g) => g.present_at_decision !== false)
      .filter((g) => {
        const node = contextNodes.get(g.id) ?? null;
        const meta = node?.meta ?? headGrounds.get(g.id)?.meta ?? null;
        return isDecayEligible(null, meta) === true;
      })
      .map((g) => g.id);

    const benchmark = [];
    if (benchmarkCandidates.length > 0) {
      const { rows } = await pool.query(CHECK_EVENTS_SQL, [gid, benchmarkCandidates]);
      const byNodeChecks = new Map();
      for (const row of rows) {
        const id = Number(row.subject_id);
        const held = byNodeChecks.get(id);
        if (held) held.push(row);
        else byNodeChecks.set(id, [row]);
      }
      const now = Date.now();
      for (const id of benchmarkCandidates) {
        const events = byNodeChecks.get(id) ?? [];
        const verified = events.filter(
          (e) => Array.isArray(e.payload?.kinds) && e.payload.kinds.includes('claim.verified'),
        );
        if (verified.length === 0) continue;   // never checked: not re-runnable
        const checks = [];
        for (const e of events) {
          const check = checkFromEvent(e);
          if (check) checks.push(check);
        }
        const state = foldChecks(emptyStability(), checks);
        const s = stabilityFor(state, id);
        const entry = state.byNode?.[String(id)] ?? null;
        const lastHeld = entry?.lastOutcome === 'held' ? entry.lastCheckAt : null;
        const ageDays = lastHeld === null ? null : Math.max(0, (now - lastHeld) / MS_PER_DAY);
        const ground = grounds.find((g) => g.id === id) ?? null;
        benchmark.push({
          id,
          title: ground?.title ?? null,
          rerunnable: true,
          checks: events.map((e) => ({
            seq: Number(e.seq),
            kind: Array.isArray(e.payload?.kinds) && e.payload.kinds.includes('claim.refuted')
              ? 'claim.refuted' : 'claim.verified',
            happened_at: isoOrNull(e.happened_at),
            learned_at: isoOrNull(e.learned_at),
          })),
          check_count: events.length,
          last_check: events.length
            ? { seq: Number(events[events.length - 1].seq),
                happened_at: isoOrNull(events[events.length - 1].happened_at) }
            : null,
          decay: true,
          stability_days: s,
          retrievability: ageDays === null ? null : retrievability(ageDays, s),
          due: ageDays === null ? true : isDue(ageDays, s),
          due_at: dueAt(lastHeld, s),
          // A CONSTANT. This route issues SELECTs; it does not run the
          // benchmark, shell out, enqueue a job, or write a claim.verified.
          ran: false,
        });
      }
    }

    // ── the rationale, and the one limit append-only does NOT cover ──────────
    //
    // The `decision.made` event is immutable: `events` raises 0A000 on UPDATE and
    // DELETE, `seq` is gapless and commit-ordered, `learned_at` is
    // clock_timestamp() and accepted from nowhere. A `decision.reopened` event is
    // an ADDITION and cannot alter its predecessor.
    //
    // What that does NOT guarantee is PROSE immutability: the fold stores no
    // bodies (only `content_sha`), the capture caps a body at 128 KB, and a
    // rationale written in an earlier write than the one that set `decided_at`
    // lives in that earlier event. So append-only guarantees DETECTABILITY, not
    // recoverability — and `unchanged_since_decision` is the claim that is
    // actually provable: byte equality of two sha256 digests.
    let rationale = {
      event_seq: decisionSeq,
      content_sha_at_decision: null,
      content_sha_now: current.content_sha ?? null,
      unchanged_since_decision: null,
      text_recoverable: false,
      text_source_event_seq: null,
      reason: 'no_content_change_in_log',
    };
    if (decisionSeq !== null) {
      const { rows } = await pool.query(RATIONALE_SQL, [gid, decisionId, decisionSeq]);
      const row = rows[0] ?? null;
      if (row) {
        const change = row.content_change ?? null;
        const shaAt = row.kind === 'node.created' && change === null
          ? null
          : change?.to_sha ?? null;
        const createdBody = row.kind === 'node.created' ? row.created_content : null;
        const recoverable = change
          ? change.to !== null && change.to !== undefined && change.truncated !== true
          : createdBody !== null && createdBody !== undefined;
        // E18.6 — an excised rationale is a THIRD case, and it must not be
        // read as the second: the bytes were removed on purpose, not capped,
        // and the digest of the empty string the marker would hash to is not
        // "the content at decision time". Say excised; hash nothing.
        const excised = row.excised === true;
        rationale = {
          event_seq: decisionSeq,
          content_sha_at_decision: excised ? null : shaAt,
          content_sha_now: current.content_sha ?? null,
          unchanged_since_decision: excised || shaAt === null
            ? null
            : shaAt === (current.content_sha ?? null),
          text_recoverable: !excised && recoverable === true,
          text_source_event_seq: Number(row.seq),
          reason: excised ? 'content_excised' : recoverable === true ? null : 'content_truncated',
        };
      }
    }
    // A node born with its rationale emits `node.created`, whose `after.content`
    // the fold hashes but whose payload carries no `to_sha`. Hash it here rather
    // than reporting "unknown" for the commonest shape there is.
    if (
      rationale.content_sha_at_decision === null
      && rationale.text_source_event_seq !== null
      && rationale.reason !== 'content_excised'
    ) {
      const { rows } = await pool.query(
        `SELECT encode(sha256(convert_to(COALESCE(payload -> 'after' ->> 'content', ''), 'UTF8')), 'hex') AS sha
           FROM events WHERE graph_id = $1 AND seq = $2`,
        [gid, rationale.text_source_event_seq],
      );
      const sha = rows[0]?.sha ?? null;
      rationale.content_sha_at_decision = sha;
      rationale.unchanged_since_decision = sha === null
        ? null
        : sha === (current.content_sha ?? null);
    }

    const state = decidedAt
      ? 'committed'
      : (decisionEvent || reopenedEvents.length ? 'reopened' : 'never_decided');
    const page = grounds.slice(0, p.maxResults);

    // ANYTHING BOUNDED REPORTS THAT IT WAS BOUNDED, and names WHICH bound bit.
    // A bare `truncated: true` cannot tell a caller whether it is missing
    // grounds, a ground's later outcomes, or outcomes that the shared cause walk
    // never fetched at all — and those three call for different next moves.
    const truncation = {
      grounds: grounds.length > page.length,
      // Over ALL grounds, not the page: a cap that bit an off-page ground still
      // shortened that ground's outcome list, and `confronted` counts that
      // ground's `status` — which was folded from the SHORTENED list. Read off
      // the page this flag went silent about a bound that moved the summary.
      ground_outcomes: grounds.some((g) => g.outcomes_truncated_by.includes('per_ground_cap')),
      cause_walk: causeTruncated,
      cause_walk_scope: 'global',   // ONE walk serves every ground: see above.
      unpaired_outcomes: unpaired.length > p.maxOutcomes,
      reasons: [],
    };
    if (truncation.grounds) truncation.reasons.push('grounds_page');
    if (truncation.ground_outcomes) truncation.reasons.push('ground_outcomes_capped');
    if (truncation.cause_walk) truncation.reasons.push('cause_walk_capped');
    if (truncation.unpaired_outcomes) truncation.reasons.push('unpaired_outcomes_capped');

    res.set('Cache-Control', 'no-store');
    res.json({
      decision: {
        id: decisionId,
        title: currentMeta.title ?? null,
        type: currentMeta.type ?? null,
        state,
        decided_at: decidedAt ?? null,
        decision_event: decisionEvent === null ? null : {
          seq: Number(decisionEvent.seq),
          kind: decisionEvent.kind,
          happened_at: isoOrNull(decisionEvent.happened_at),
          learned_at: isoOrNull(decisionEvent.learned_at),
          actor: decisionEvent.actor ?? null,
          reason: decisionEvent.payload?.reason ?? null,
          intent: decisionEvent.payload?.intent ?? null,
        },
        reopened_events: reopenedEvents.map((e) => ({
          seq: Number(e.seq),
          happened_at: isoOrNull(e.happened_at),
          learned_at: isoOrNull(e.learned_at),
        })),
      },
      context: {
        basis,
        axis: contextParams.axis,
        complete: contextComplete,
        no_decision_point: basis === 'none',
        // WHICH EVENT THE RECONSTRUCTION IS PINNED TO, and whether that pin is
        // the commitment itself (`exact`) or merely a seq the commitment must
        // precede (`upper`). A reopen proves a commitment existed without
        // saying when, and the difference has to be readable.
        anchor: anchor === null ? null : { ...anchor },
        node_count: context.nodes.length,
        edge_count: context.links.length,
        as_of: context.as_of,
        world_at_decision: worldAtDecision,
      },
      rationale,
      grounds: page,
      unpaired_outcomes: unpaired
        .sort((a, b) => a.seq - b.seq)
        .slice(0, p.maxOutcomes),
      benchmark,
      // THE SUMMARY DESCRIBES THE DECISION, NOT THE PAGE. Computed off `page`
      // these four numbers answered "how much of the first maxResults grounds
      // was confronted" while wearing the name of "how much of this decision
      // was confronted": a decision with 5 grounds, 2 of them contradicted
      // since, reported `{grounds: 2, with_outcomes: 0, unconfronted: 2}` under
      // `maxResults: 2` — a summary in which nothing had been confronted at
      // all. `truncated: true` does not repair it, because it says the GROUNDS
      // LIST was cut and not that the SUMMARY was. So every count is over the
      // whole `grounds` array — which is what `benchmark` above already does —
      // and the page size is STATED as `returned` rather than implied by
      // `grounds`.
      confronted: {
        grounds: grounds.length,
        returned: page.length,
        predictions: grounds.filter((g) => g.prediction).length,
        with_outcomes: grounds.filter((g) => g.outcomes.length > 0).length,
        unconfronted: grounds.filter((g) => g.status === 'unconfronted').length,
      },
      // MACHINE-READABLE REFUSALS, not prose, so a caller cannot mistake what it
      // is holding. Every one of these is a constant.
      limits: {
        counterfactual: false,
        benchmark_run: false,
        verdict: false,
        silence_is_not_vindication: true,
        context_complete: contextComplete,
      },
      params: {
        maxResults: p.maxResults,
        maxOutcomes: p.maxOutcomes,
        predictionTypes: p.predictionTypes,
      },
      truncation,
      truncated: truncation.reasons.length > 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
