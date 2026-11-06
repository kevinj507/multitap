// E18.3 — POST /api/graphs/:gid/doubt. The DOUBT FRONT: everything in the graph
// that rests, transitively, on something we have since learned to doubt — and
// that nobody has re-checked since.
//
// It is the transitive answer to the question /decisions/at-risk (E17) answers
// one hop deep. It is a NEW ROUTE rather than a `transitive: true` flag on that
// one, and `/decisions/at-risk` is not touched by this rung — not one byte, not
// one `params` key — because:
//
//   1. THE RESULT TYPE DIFFERS, not just the row count. /decisions/at-risk
//      returns DECISIONS, each with a flat one-hop `reasons[]` of grounds. The
//      doubt front returns nodes AND decisions side by side, each with a weight
//      and a CAUSE CHAIN, and the node scope names the claims first. A flag
//      would have to either drop the claims (shipping it half-broken) or change
//      what the top-level array MEANS based on a body key.
//   2. A cause chain has no home in `reasons[]`, whose entries are
//      {id, title, kinds[]}. Adding one would make `reasons` mean "the grounds"
//      for one caller and "the chains" for another.
//   3. Cost: /decisions/at-risk is 4.4-4.8 ms measured; this is ~17 ms. A flag
//      gives a cheap shipped route two completely different execution paths
//      chosen by a body key — E18.2's two-path /frontier is the house's own
//      cautionary tale, and it only paid that price because back-compat forced
//      it. Here "the shipped route is unchanged" is free.
//
// `scope: 'decisions'` is the bridge: it is the strict transitive superset of
// what /decisions/at-risk answers, so a caller migrates by changing a URL. The
// two may still disagree on a decision's PRESENCE, deliberately —
// /decisions/at-risk also surfaces `changedSinceDecision` and
// `selfContradicted`, which are not weakening EVENTS and are out of scope here.
//
// ─────────────────────────────────────────────────────────────────────────────
// SURFACE-ONLY, AND IT IS STRUCTURAL RATHER THAN PROMISED.
//
// This handler issues four SELECTs and holds no transaction. There is no
// UPDATE, no INSERT, no gt.intent, no event of its own. IT CANNOT FLIP A STATUS
// BECAUSE IT NEVER WRITES ONE — a `done` decision surfaces here and stays
// `done`; re-verifying is a deliberate act with its own event, exactly as
// E18.4's /ready guard requires. tests/e18-doubt-route.test.js asserts
// graphs.version, every tasks.updated_at and MAX(events.seq) are unchanged
// across a call.
//
// ─────────────────────────────────────────────────────────────────────────────
// A SUPERSEDED NODE IS EXCLUDED AS AN ITEM AND RETAINED AS A CONDUCTOR.
//
// `includeSuperseded` controls only the first. The walk always traverses
// THROUGH a superseded node to its dependents, and this is the sharpest
// asymmetry in the rung: prune there and the acceptance scenario returns
// NOTHING, because the tweet supersedes the old-terms claim and every claim and
// decision resting on it hangs off the far side of exactly that node.
//
//   A SUPERSESSION ENDS THE FACT'S STORY. IT DOES NOT END THE STORY OF
//   EVERYTHING THAT WAS BUILT ON IT.
//
// E18.4 excludes superseded nodes from re-check queues because re-checking them
// is pointless. Their dependents are the opposite case: they are the most
// urgent thing in the graph. A supersession is a SEED, never a wall.

import { Router } from 'express';
import pool from '../db.js';
import { getDerived, setDerived } from '../derivedCache.js';
import { SUPERSEDES } from '../supersession.js';
import {
  ANCHOR_KINDS,
  AXES,
  CHAIN_LIMIT_CAP,
  DEFAULT_CHAIN_LIMIT,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  DEFAULT_MAX_RESULTS,
  DEFAULT_MAX_TRIGGERS,
  DEFAULT_WEIGHT_FLOOR,
  MAX_DEPTH_CAP,
  MAX_NODES_CAP,
  MAX_PROPAGATION,
  MAX_RESULTS_CAP,
  MAX_TRIGGERS_CAP,
  MIN_PROPAGATION,
  TRAVERSAL_PURPOSES,
  buildAdjacency,
  byNode,
  chainFor,
  layeredWalk,
  mergeWeights,
  onFront,
  seedsFromEvents,
  verifiedAfterInWorld,
} from '../doubt.js';

const router = Router({ mergeParams: true });

export const SCOPES = Object.freeze(['all', 'decisions', 'nodes']);
export const AXIS_ERROR = `axis must be one of ${AXES.map((a) => `'${a}'`).join(', ')}`;
export const SCOPE_ERROR = `scope must be one of ${SCOPES.map((s) => `'${s}'`).join(', ')}`;

// The house `{value}` / `{error}` validator, copied from frontier.js (which
// copied it to decisionsAtRisk.js): same shape, same messages, same caps.
function num(value, name, dflt, { min, max, integer }) {
  if (value === undefined || value === null) return { value: dflt };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `${name} must be a number` };
  if (integer && !Number.isInteger(value)) return { error: `${name} must be an integer` };
  if (min !== undefined && value < min) return { error: `${name} must be >= ${min}` };
  if (max !== undefined && value > max) return { error: `${name} must be <= ${max}` };
  return { value };
}

function enumOf(value, allowed, dflt, error) {
  if (value === undefined || value === null) return { value: dflt };
  if (typeof value !== 'string' || !allowed.includes(value)) return { error };
  return { value };
}

const HEAD_SQL = `SELECT COALESCE(MAX(seq), 0) AS head_seq FROM events WHERE graph_id = $1`;

// The seeds. `field.set` is in the kind filter because a confidence DROP is
// classified `field.set` — weakening() is what decides whether one actually
// weakened anything, and it reads `payload.changes['meta.confidence']`, so the
// classifier's own vocabulary is the index-servable prefilter and the pure
// function is the predicate. Served by events_kinds_gin BitmapAnd events_pkey.
//
// `payload #- '{changes,content}'` and not a bare `payload`: a verification
// event's `changes.content` is two full node bodies (measured at 128 KB each on
// real data) and nothing here reads a byte of it. E18.2 measured the same
// operator at 2x faster and 65x less data on VERIFY_EVENTS_SQL.
//
// AND IT IS READ NEWEST-FIRST, IN BOUNDED PAGES — see fetchSeeds() below. At
// `since: 0` this predicate matches every field.set the graph has ever recorded
// and the walk then keeps the newest `maxTriggers` (32) of them; reading all of
// them to throw all but 32 away is unbounded work that grows with the log.
// Measured on a 5000-weakening graph: 50.4 ms unbounded vs 9.0 ms for the
// bounded page, and the whole route 55.7 ms vs 9.4 ms. On the opposite shape —
// 5000 field.set events and NO weakening at all — the pages have to walk the
// whole range anyway and it is a wash (61.2 ms vs 47.0 ms, same rows, 2 round
// trips instead of 1).
const SEEDS_SQL = `SELECT seq, subject_id, happened_at, learned_at, cause_id,
                          payload #- '{changes,content}' AS payload
     FROM events
    WHERE graph_id = $1 AND seq > $2 AND seq < $3 AND subject_kind = 'node'
      AND payload->'kinds' ?| ARRAY['claim.refuted','node.superseded','field.set']
    ORDER BY seq DESC
    LIMIT $4`;

// The descending cursor's opening upper bound. DELIBERATELY NOT head_seq: an
// event committing between HEAD_SQL and this read is inside the old read's
// answer, and narrowing to the head would quietly drop it. This bound only ever
// says "no upper bound yet".
const SEQ_UNBOUNDED = Number.MAX_SAFE_INTEGER;

// The page ladder. A page must be at least `maxTriggers + 1` rows — one more
// than the cap — because that is what lets `truncated` stay EXACTLY the old
// `allSeeds.length > maxTriggers`: we page until a (maxTriggers + 1)-th seed
// proves truncation, or until the log is exhausted and there is none. Pages
// grow geometrically so a graph whose weakenings are sparse among its field.set
// events converges in a handful of round trips rather than one per trigger.
const SEED_PAGE_GROWTH = 4;
const SEED_PAGE_CAP = 4096;

// THE PREFILTER IS NOT THE PREDICATE, AND THAT IS WHY THIS PAGES INSTEAD OF
// TAKING ONE `LIMIT 32`. `payload->'kinds' ? 'field.set'` matches every title
// edit in the graph; weakening() then keeps only the ones whose
// `changes['meta.confidence']` actually went DOWN. A bare `ORDER BY seq DESC
// LIMIT 32` therefore returns THE NEWEST 32 CANDIDATES, not the newest 32
// weakenings — reproduced: 40 confidence drops under 100 later title edits
// yielded 0 seeds where the unbounded read yields 32. So: read newest-first in
// pages, run the ONE definition of a weakening (seedsFromEvents) over each, and
// stop only when the seeds we have settle the answer.
//
// Returns the same `{seeds, truncated}` the unbounded read produced, for every
// input — `seeds` newest-`maxTriggers`, ascending by seq.
async function fetchSeeds(gid, since, maxTriggers) {
  const want = maxTriggers + 1;
  const collected = [];
  let before = SEQ_UNBOUNDED;
  let page = want;
  for (;;) {
    const { rows } = await pool.query(SEEDS_SQL, [gid, since, before, page]);
    for (const seed of seedsFromEvents(rows)) collected.push(seed);
    // Fewer rows than asked for means the range is exhausted: there is nothing
    // older left to find, so what we hold is the complete set.
    if (rows.length < page) break;
    if (collected.length >= want) break;
    before = Number(rows[rows.length - 1].seq);
    page = Math.min(page * SEED_PAGE_GROWTH, SEED_PAGE_CAP);
  }
  // Pages arrive newest-first and seedsFromEvents sorts WITHIN a page, so the
  // concatenation is only piecewise ordered. One sort restores the ascending
  // order the walk's tie-break relies on.
  collected.sort((a, b) => a.seq - b.seq);
  const truncated = collected.length > maxTriggers;
  return {
    seeds: truncated ? collected.slice(collected.length - maxTriggers) : collected,
    truncated,
  };
}

// The edge slice: ONE indexed range scan over the two load-bearing purposes.
// This is the part the house's recursive-CTE idiom is genuinely good at, and it
// is kept; only the relaxation moved to JS (see src/doubt.js's header).
const EDGES_SQL = `SELECT id, source_id, target_id, purpose,
                          meta->'propagation' AS propagation
     FROM edges
    WHERE graph_id = $1 AND purpose = ANY($2::text[])
    ORDER BY id`;

// "Since it was last verified or decided", on the log. THE ALLOWLIST IS THE
// POSITIVE HALF ONLY — see ANCHOR_KINDS in src/doubt.js for the measured reason
// (`claim.refuted` would make a refutation its own anchor by equality and the
// refuted node would silence itself off the front it triggered).
const ANCHORS_SQL = `SELECT subject_id,
          max(seq)         FILTER (WHERE payload->'kinds' ? 'claim.verified') AS verify_seq,
          max(happened_at) FILTER (WHERE payload->'kinds' ? 'claim.verified') AS verify_happened,
          max(seq)         FILTER (WHERE payload->'kinds' ? 'decision.made')  AS decide_seq,
          max(happened_at) FILTER (WHERE payload->'kinds' ? 'decision.made')  AS decide_happened
     FROM events
    WHERE graph_id = $1 AND subject_kind = 'node'
      AND payload->'kinds' ?| ARRAY['claim.verified','decision.made']
    GROUP BY subject_id`;

// The node projection, for the REACHED ids only. `superseded` is ONE PROJECTED
// COLUMN rather than a second round trip — read from the EDGE SET, never a flag
// on the row, which is what keeps exclusion a function of time. Served by the
// partial index edges_supersedes_idx as an Index Only Scan, exactly as
// /frontier's V2_CANDIDATES_SQL does it.
const NODES_SQL = `SELECT t.id,
          t.meta->>'title'        AS title,
          t.meta->>'status'       AS status,
          t.meta->>'type'         AS type,
          (t.meta->>'confidence')::numeric   AS confidence,
          (t.meta->>'significance')::numeric AS significance,
          t.meta->>'verified_at'  AS verified_at,
          t.meta->>'decided_at'   AS decided_at,
          EXISTS (SELECT 1 FROM edges se
                   WHERE se.graph_id = $1 AND se.purpose = '${SUPERSEDES}'
                     AND se.target_id = t.id) AS superseded
     FROM tasks t
    WHERE t.graph_id = $1 AND t.id = ANY($2::int[])`;

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

// What a node IS, for the caller's scope filter and for display. `decision` is
// the only load-bearing distinction (it is what `scope: 'decisions'` selects);
// `claim` is the house population predicate /frontier has always used —
// confidence-bearing or `type: reference` — and everything else is a plain node.
function nodeKind(row) {
  if (row.type === 'decision') return 'decision';
  if (row.confidence !== null && row.confidence !== undefined) return 'claim';
  if (row.type === 'reference') return 'claim';
  return 'node';
}

// THE ANCHOR, in its three honest forms.
//
//   event  — a claim.verified / decision.made event exists → that event's seq.
//   scalar — no event, but meta.verified_at / meta.decided_at is present →
//            learned-axis seq 0, world-axis the scalar.
//   none   — neither → seq 0, no world time; every weakening is newer.
//
// Anchor seq 0 for a scalar-only node is the honest answer and not a shortcut:
// we genuinely do not know WHEN WE LEARNED a pre-log verification, so we cannot
// claim it postdates anything. Measured: essentially every real node today is
// in this state, because all 4103 corpus nodes predate the log. It sharpens from
// ship day forward exactly as history_starts_at does. This is E18.2's standing
// rule read on the other axis: THE LOG IS AUTHORITATIVE FOR BELIEF-TIME
// ORDERING, THE SCALAR IS THE WORLD-TIME FALLBACK ANCHOR.
function resolveAnchor(row, anchorRow) {
  const verifySeq = anchorRow ? numOrNull(anchorRow.verify_seq) : null;
  const decideSeq = anchorRow ? numOrNull(anchorRow.decide_seq) : null;
  if (verifySeq !== null || decideSeq !== null) {
    const useDecide = decideSeq !== null && (verifySeq === null || decideSeq > verifySeq);
    return {
      source: 'event',
      seq: useDecide ? decideSeq : verifySeq,
      happened_at: isoOrNull(useDecide ? anchorRow.decide_happened : anchorRow.verify_happened),
      kind: useDecide ? 'decision.made' : 'claim.verified',
    };
  }
  const verifiedAt = isoOrNull(row.verified_at);
  const decidedAt = isoOrNull(row.decided_at);
  if (verifiedAt !== null || decidedAt !== null) {
    const useDecide = decidedAt !== null
      && (verifiedAt === null || Date.parse(decidedAt) > Date.parse(verifiedAt));
    return {
      source: 'scalar',
      seq: 0,
      happened_at: useDecide ? decidedAt : verifiedAt,
      kind: useDecide ? 'decision.made' : 'claim.verified',
    };
  }
  return { source: 'none', seq: 0, happened_at: null, kind: null };
}

export function parseDoubtBody(body) {
  const b = body || {};
  const since = num(b.since, 'since', 0, { min: 0, integer: true });
  const maxDepth = num(b.maxDepth, 'maxDepth', DEFAULT_MAX_DEPTH, { min: 1, max: MAX_DEPTH_CAP, integer: true });
  const maxNodes = num(b.maxNodes, 'maxNodes', DEFAULT_MAX_NODES, { min: 1, max: MAX_NODES_CAP, integer: true });
  const maxResults = num(b.maxResults, 'maxResults', DEFAULT_MAX_RESULTS, { min: 1, max: MAX_RESULTS_CAP, integer: true });
  const chainLimit = num(b.chainLimit, 'chainLimit', DEFAULT_CHAIN_LIMIT, { min: 1, max: CHAIN_LIMIT_CAP, integer: true });
  const maxTriggers = num(b.maxTriggers, 'maxTriggers', DEFAULT_MAX_TRIGGERS, { min: 1, max: MAX_TRIGGERS_CAP, integer: true });
  // The floor lives in (0, 1] like every other weight in this rung: a floor of
  // 0 would ask the walk to carry a doubt of zero strength forever.
  const weightFloor = num(b.weightFloor, 'weightFloor', DEFAULT_WEIGHT_FLOOR, {
    min: Number.MIN_VALUE, max: MAX_PROPAGATION,
  });
  const axis = enumOf(b.axis, AXES, 'learned', AXIS_ERROR);
  const scope = enumOf(b.scope, SCOPES, 'all', SCOPE_ERROR);
  const weights = mergeWeights(b.weights);

  for (const r of [since, maxDepth, maxNodes, maxResults, chainLimit, maxTriggers,
    weightFloor, axis, scope, weights]) {
    if (r.error) return { error: r.error };
  }
  return {
    value: {
      since: since.value,
      axis: axis.value,
      scope: scope.value,
      weights: weights.value,
      maxDepth: maxDepth.value,
      weightFloor: weightFloor.value,
      maxNodes: maxNodes.value,
      maxResults: maxResults.value,
      chainLimit: chainLimit.value,
      maxTriggers: maxTriggers.value,
      includeSuperseded: b.includeSuperseded === true,
    },
  };
}

router.post('/', async (req, res, next) => {
  const parsed = parseDoubtBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const p = parsed.value;
  const { gid } = req.params;

  try {
    // HEAD FIRST — it is the cache key, and both cached values are pure
    // functions of (graph, head_seq), which is the precondition derivedCache.js
    // states. The namespaced keys cannot collide with the asOf reader's `g:1679`
    // or /frontier's `g:verify:1679`.
    const headRows = await pool.query(HEAD_SQL, [gid]);
    const headSeq = Number(headRows.rows[0].head_seq);

    // The seeds are NOT cached: `since` varies per caller.
    //
    // Newest first when the cap bites: a caller who asks for 32 triggers on a
    // graph with 200 weakenings wants the 32 most recently LEARNED, and the
    // truncation is reported rather than implied. fetchSeeds reads newest-first
    // so that preference is the READ's shape and not a slice of everything.
    const { seeds, truncated: triggerTruncated } = await fetchSeeds(gid, p.since, p.maxTriggers);

    const edgeKey = `doubt-edges:${headSeq}`;
    let edgeRows = getDerived(gid, edgeKey);
    let edgeSliceCached = edgeRows !== undefined;
    if (edgeRows === undefined) {
      const r = await pool.query(EDGES_SQL, [gid, [...TRAVERSAL_PURPOSES]]);
      edgeRows = setDerived(gid, edgeKey, r.rows);
    }
    const adjacency = buildAdjacency(edgeRows);

    const walk = layeredWalk(adjacency, seeds, {
      weights: p.weights,
      weightFloor: p.weightFloor,
      maxDepth: p.maxDepth,
      maxNodes: p.maxNodes,
    });
    const grouped = byNode(walk.best);
    const reached = [...grouped.keys()];

    const anchorKey = `doubt-anchors:${headSeq}`;
    let anchorRows = getDerived(gid, anchorKey);
    if (anchorRows === undefined) {
      const r = await pool.query(ANCHORS_SQL, [gid]);
      anchorRows = setDerived(gid, anchorKey, r.rows);
    }
    const anchors = new Map(anchorRows.map((r) => [Number(r.subject_id), r]));

    const nodeRows = reached.length
      ? (await pool.query(NODES_SQL, [gid, reached])).rows
      : [];
    const nodes = new Map(nodeRows.map((r) => [Number(r.id), r]));
    const supersededSet = new Set(nodeRows.filter((r) => r.superseded === true).map((r) => Number(r.id)));

    const bySeq = new Map(seeds.map((s) => [s.seq, s]));
    const reachedCount = new Map(seeds.map((s) => [s.seq, 0]));

    const items = [];
    for (const [id, perTrigger] of grouped) {
      const row = nodes.get(id);
      // A node the walk reached but `tasks` no longer holds: the log outlives
      // the graph's rows by design, so a removed node can still be a seed. It
      // is not an ITEM (there is nothing to re-check) and not a conductor
      // either, since it has no live edges.
      if (!row) continue;
      const anchor = resolveAnchor(row, anchors.get(id));

      // THE GATE, per (item, trigger). Keeping the walk keyed by the pair is
      // what lets this be exact: an item can be put on the front by one
      // weakening while another weakening's path to it predates its last check,
      // and the chain we report must be one that actually passed.
      let bestRecord = null;
      let bestTrigger = null;
      let passing = 0;
      for (const [triggerSeq, record] of perTrigger) {
        const trigger = bySeq.get(triggerSeq);
        if (!trigger) continue;
        if (!onFront(trigger, anchor, p.axis)) continue;
        passing += 1;
        reachedCount.set(triggerSeq, (reachedCount.get(triggerSeq) ?? 0) + 1);
        if (!bestRecord
            || record.w > bestRecord.w
            || (record.w === bestRecord.w && record.hops < bestRecord.hops)
            || (record.w === bestRecord.w && record.hops === bestRecord.hops
                && triggerSeq < bestRecord.triggerSeq)) {
          bestRecord = record;
          bestTrigger = trigger;
        }
      }
      if (!bestRecord) continue;

      const kind = nodeKind(row);
      if (p.scope === 'decisions' && kind !== 'decision') continue;
      if (p.scope === 'nodes' && kind === 'decision') continue;
      const superseded = supersededSet.has(id);
      if (superseded && !p.includeSuperseded) continue;

      items.push({
        id,
        kind,
        title: row.title ?? '',
        status: row.status ?? 'todo',
        type: row.type ?? null,
        weight: bestRecord.w,
        hops: bestRecord.hops,
        superseded,
        significance: numOrNull(row.significance),
        anchor,
        verified_after_in_world: verifiedAfterInWorld(bestTrigger, anchor),
        trigger_seq: bestRecord.triggerSeq,
        trigger_count: passing,
        _record: bestRecord,
      });
    }

    // The house ranking key. `significance` is lifted verbatim from /frontier
    // (E17) so a significant item cannot be buried under the truncation cap by
    // importance-equal peers. `verified_after_in_world` DEMOTES within equal
    // weight and never filters — a skewed clock or a sloppy backdate must not
    // be able to hide a live doubt.
    items.sort((a, b) =>
      (b.weight - a.weight)
      || ((a.verified_after_in_world ? 1 : 0) - (b.verified_after_in_world ? 1 : 0))
      || (a.hops - b.hops)
      || ((b.significance ?? -Infinity) - (a.significance ?? -Infinity))
      || (a.id - b.id));

    const truncated = items.length > p.maxResults || walk.truncated || triggerTruncated;
    const page = items.slice(0, p.maxResults);

    // Chains are allocated ONLY for the items actually returned — never for all
    // of the reached set, and never carried in SQL, which is exactly what makes
    // the path-carrying CTE exponential.
    const doubt = page.map((item) => {
      const { _record, significance, ...rest } = item;
      const cause = chainFor(walk.best, item.id, _record.triggerSeq, p.chainLimit, supersededSet);
      if (cause.truncated) walk.stoppedBy.push('chain');
      return { ...rest, significance, cause };
    });

    const stoppedBy = [...new Set([...walk.stoppedBy, ...(triggerTruncated ? ['trigger_cap'] : [])])].sort();

    res.set('Cache-Control', 'no-store');
    res.json({
      doubt,
      triggers: seeds.map((s) => ({
        seq: s.seq,
        kind: s.kind,
        magnitude: s.magnitude,
        weight: s.w,
        weight_source: s.weight_source,
        subject_id: s.subject_id,
        subject_title: nodes.get(s.subject_id)?.title ?? null,
        happened_at: isoOrNull(s.happened_at),
        learned_at: isoOrNull(s.learned_at),
        cause_id: s.cause_id,
        superseded_by: s.superseded_by,
        reached: reachedCount.get(s.seq) ?? 0,
      })),
      truncated,
      walk: {
        nodes_visited: walk.nodes,
        edges_relaxed: walk.relaxed,
        max_depth_reached: walk.deepest,
        stopped_by: stoppedBy,
      },
      params: {
        since: p.since,
        axis: p.axis,
        scope: p.scope,
        weights: p.weights,
        maxDepth: p.maxDepth,
        weightFloor: p.weightFloor,
        maxNodes: p.maxNodes,
        maxResults: p.maxResults,
        chainLimit: p.chainLimit,
        maxTriggers: p.maxTriggers,
        includeSuperseded: p.includeSuperseded,
      },
      model: {
        head_seq: headSeq,
        // THE TRIGGERS THIS ANSWER IS BUILT FROM — always `triggers.length`.
        // It USED to be "every weakening in the graph since `since`", which
        // only a full read of the log can know; the bounded read cannot, and
        // counting the SQL prefilter's rows instead would count title edits as
        // triggers, which is a worse kind of wrong than a smaller number. The
        // two values differ ONLY when the cap bit, and that case is already
        // announced by `truncated` and `stopped_by: ['trigger_cap']`.
        trigger_count: seeds.length,
        edge_slice_cached: edgeSliceCached,
        anchor_kinds: [...ANCHOR_KINDS],
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
