// E15.B2 — POST /api/graphs/:gid/frontier. The re-verification frontier: the
// confidence-bearing nodes that are LOAD-BEARING (high importance) AND either
// STALE (verified_at older than staleDays, or never verified) OR LOW-CONFIDENCE.
// Complements /tasks/ready: instead of "what's next to do", it answers "what
// established knowledge most needs re-checking". Read-guarded; never mutates.
//
// Importance = OUT-degree counting `required for` + `supports` edges. Our edge
// direction is source(prereq) → target(dependent), so a node that many things
// REST ON has high out-degree — exactly the foundation we want to re-verify
// first. (The umbrella's older "in-degree" wording is backwards under this
// direction and would surface terminal leaves instead of foundations.)
// Importance is derived on demand from edges, never stored.
//
// E17 additions:
// - INHERITED IMPORTANCE (one hop, through decisions only): a claim whose
//   `supports`/`required for` edge lands on a `type: decision` node also
//   inherits that decision's own out-degree. A finding grounding a decision
//   that gates ten build tasks is load-bearing even though its direct
//   out-degree is 1 — without this, a foundation-of-a-foundation ranks 0.
// - SIGNIFICANCE TIE-BREAK: within equal importance, higher `significance`
//   ranks first, so a significant orphan claim isn't buried below the
//   truncation cap by dozens of importance-0 peers.
//
// ─────────────────────────────────────────────────────────────────────────────
// E18.2 — RATIONAL DECAY, AND WHY THIS ROUTE IS TWO-PATH
//
// v1 asks one question of every node: "is `verified_at` older than
// `staleDays`?" — one global window for every fact in the graph. v2 replaces
// the global window with a PER-NODE one, S, derived from that node's own
// verification series in the event log (src/events/stability.js), and reports
// retrievability R(t) = (1 + t/(9S))^-1 beside it.
//
// The two agree by construction rather than by argument:
//
//   R(t) = (1 + t/(9S))^-1 ;  R = 0.9  <=>  t = S
//
// so with S_INIT := staleDays and rThreshold := 0.9 — the defaults — "R below
// threshold" IS "older than staleDays". `staleDays` is not deprecated by this
// rung; it is PROMOTED to S_INIT and every existing caller's parameter keeps
// its exact meaning. A node with no verification events gets S = staleDays and
// therefore exactly its v1 treatment, per node, even inside a graph that has
// decay data for other nodes.
//
// And the strongest guarantee is structural, not algebraic: PATH A below runs
// TODAY'S SQL — the same query object, untouched — so no argument about float
// boundaries or sort collations can reach it. The switch is on VERIFICATION
// events, not on events at all: a graph with 20 000 `node.patched` events and
// no verifications still takes PATH A, which is most graphs.
//
// Measured against the production clone before this shipped: 65 graphs x 5
// parameter sets, 3179 rows compared, 0 ordering differences and 0 stale-flag
// differences between v1 and an R-formulated v2.

import { Router } from 'express';
import pool from '../db.js';
import { getDerived, setDerived } from '../derivedCache.js';
import { isDecayEligible } from '../events/kinds.js';
import { SUPERSEDES } from '../supersession.js';
import {
  DEFAULT_R_THRESHOLD,
  checkFromEvent,
  checksFor,
  dueAt,
  emptyStability,
  foldChecks,
  isDue,
  retrievability,
  stabilityFor,
} from '../events/stability.js';

const router = Router({ mergeParams: true });

const DEFAULTS = { minImportance: 2, staleDays: 90, lowConfidenceBelow: 0.5, maxResults: 50 };
const MAX_RESULTS_CAP = 500;
const RANKS = ['tiered', 'urgency'];
// The candidate set PATH B pulls is unfiltered by staleness, so it is bounded
// by the graph, not by maxResults. The largest real graph yields 834 rows at
// minImportance 0; this is a guard against a pathological graph, not a path.
const MAX_CANDIDATES = 10000;
const MS_PER_DAY = 86400000;

function num(value, name, dflt, { min, max, integer }) {
  if (value === undefined || value === null) return { value: dflt };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `${name} must be a number` };
  if (integer && !Number.isInteger(value)) return { error: `${name} must be an integer` };
  if (min !== undefined && value < min) return { error: `${name} must be >= ${min}` };
  if (max !== undefined && value > max) return { error: `${name} must be <= ${max}` };
  return { value };
}

// The E17 importance CTE. ONE definition, shared verbatim by both paths, so
// "importance" cannot drift between them.
const IMPORTANCE_CTE = `WITH deg AS (
         SELECT t.id,
                (SELECT count(*) FROM edges e
                  WHERE e.source_id = t.id AND e.graph_id = $1
                    AND e.purpose IN ('required for', 'supports')) AS out_deg
           FROM tasks t WHERE t.graph_id = $1
       ),
       imp AS (
         SELECT d.id,
                d.out_deg + COALESCE(
                  (SELECT sum(dd.out_deg) FROM edges e
                     JOIN tasks td ON td.id = e.target_id
                     JOIN deg dd ON dd.id = e.target_id
                    WHERE e.source_id = d.id AND e.graph_id = $1
                      AND e.purpose IN ('required for', 'supports')
                      AND td.meta->>'type' = 'decision'), 0) AS importance
           FROM deg d
       )`;

// ── PATH A — v1, VERBATIM ───────────────────────────────────────────────────
//
// DO NOT EDIT THIS STRING. It is the reviewable form of the back-compat claim:
// a graph with no decay data runs byte-for-byte the query it ran before E18.2,
// so its ordering and its `stale` flags cannot move. Importance via a
// correlated out-degree count over the load-bearing purposes. Staleness uses
// NOW() so "older than staleDays" is server-clock relative; an absent
// verified_at is treated as never-verified = stale. Fetch maxResults+1 so we
// can flag truncation without a second COUNT.
const V1_SQL = `${IMPORTANCE_CTE}
       SELECT t.id,
              t.meta->>'title'        AS title,
              t.meta->>'status'       AS status,
              t.meta->>'type'         AS type,
              (t.meta->>'confidence')::numeric AS confidence,
              t.meta->>'verified_at'  AS verified_at,
              i.importance,
              (t.meta->>'verified_at' IS NULL
                OR (t.meta->>'verified_at')::timestamptz < NOW() - ($3 || ' days')::interval) AS stale,
              (t.meta->>'confidence' IS NOT NULL
                AND (t.meta->>'confidence')::numeric < $4) AS low_confidence
         FROM tasks t
         JOIN imp i ON i.id = t.id
        WHERE t.graph_id = $1
          AND (t.meta->>'confidence' IS NOT NULL OR t.meta->>'type' = 'reference')
          AND i.importance >= $2
          AND (
                t.meta->>'verified_at' IS NULL
                OR (t.meta->>'verified_at')::timestamptz < NOW() - ($3 || ' days')::interval
                OR (t.meta->>'confidence' IS NOT NULL AND (t.meta->>'confidence')::numeric < $4)
          )
        ORDER BY i.importance DESC,
                 (t.meta->>'significance')::numeric DESC NULLS LAST,
                 (t.meta->>'verified_at') ASC NULLS FIRST, t.id ASC
        LIMIT $5`;

// ── PATH B — the same population, unfiltered and unsorted ───────────────────
//
// The importance CTE is unchanged; the staleness clause, the ORDER BY and the
// LIMIT are gone, because the decay model decides all three and lives in one
// pure module. Measured on the largest real graph: 102-132 ms here against
// 87-122 ms for v1 — the E17 importance CTE is the dominant cost in both, and
// always was.
const V2_CANDIDATES_SQL = `${IMPORTANCE_CTE}
       SELECT t.id,
              t.meta->>'title'        AS title,
              t.meta->>'status'       AS status,
              t.meta->>'type'         AS type,
              (t.meta->>'confidence')::numeric    AS confidence,
              (t.meta->>'significance')::numeric  AS significance,
              t.meta->>'verified_at'  AS verified_at,
              t.meta->>'refuted_at'   AS refuted_at,
              t.meta->'decay'         AS decay,
              i.importance,
              -- E18.4. ONE PROJECTED COLUMN rather than a second round trip.
              -- Served by the partial index edges_supersedes_idx as an Index
              -- Only Scan (2 buffers); it is an EXISTS over the edge set, never
              -- a flag on the row, which is what keeps exclusion a function of
              -- time. The supersedes purpose is deliberately absent from
              -- IMPORTANCE_CTE: superseding a node is not evidence supporting
              -- it, so it contributes ZERO importance.
              EXISTS (SELECT 1 FROM edges se
                       WHERE se.graph_id = $1 AND se.purpose = '${SUPERSEDES}'
                         AND se.target_id = t.id) AS superseded
         FROM tasks t
         JOIN imp i ON i.id = t.id
        WHERE t.graph_id = $1
          AND (t.meta->>'confidence' IS NOT NULL OR t.meta->>'type' = 'reference')
          AND i.importance >= $2
        ORDER BY t.id
        LIMIT ${MAX_CANDIDATES + 1}`;

// The path probe. `max(seq)` is an index-only backward scan on events_pkey
// (0.08 ms server on the largest real graph). The EXISTS is the honesty term:
// `refuted_at` and `decay` are E18.2 fields with no v1 projection, so a graph
// carrying either must take the path that can read them — otherwise a shipped
// field would be a silent no-op. Zero corpus nodes carry either key, so on
// real data this term is always false and every existing graph keeps PATH A.
// E18.4 adds the third term on exactly the same honesty rule: a graph carrying
// supersessions must take the path that can READ them, or a shipped exclusion
// would be a silent no-op on PATH A. All 65 real graphs have zero supersedes
// edges, so all 65 keep PATH A byte-for-byte; a graph that acquires one flips
// to PATH B permanently, at a measured ~1.15x latency and (measured across 65
// graphs x 5 parameter sets, 3179 rows) 0 ordering differences.
const PROBE_SQL = `SELECT (SELECT max(seq) FROM events WHERE graph_id = $1) AS head_seq,
                          EXISTS (SELECT 1 FROM tasks t
                                   WHERE t.graph_id = $1
                                     AND (t.meta ? 'decay' OR t.meta ? 'refuted_at')) AS has_e18_2_meta,
                          EXISTS (SELECT 1 FROM edges se
                                   WHERE se.graph_id = $1
                                     AND se.purpose = '${SUPERSEDES}') AS has_supersessions`;

// Verification events only — the `payload->'kinds'` GIN index answers this
// directly. Ordered by seq, which is gapless and commit-ordered per graph, so
// the fold is a left fold over a stable prefix.
//
// `#- '{changes,content}'` IS THE WHOLE OPTIMISATION, AND IT IS A DENYLIST ON
// PURPOSE. Every verification event carries `changes.content` — the verify
// handler rewrites `content` because meta lives in the frontmatter — whose
// `from` and `to` are each a whole markdown body, capped at 128 KB apiece by
// gt_content_change. checkFromEvent() reads `kinds`, `intent`, `id` and
// `changes['meta.verified_at']` and nothing else, so all of that crossed the
// wire and was parsed into the JS heap purely to be discarded.
//
// MEASURED in multitap_test on a synthetic history (1000 verification events,
// ~17.5 KB of JSON payload each), median of 9 runs:
//
//   SELECT payload                                209 ms   17.55 MB into JS
//   SELECT payload #- '{changes,content}'         106 ms    0.27 MB   <- this
//   jsonb_build_object(kinds,intent,id,changes)   241 ms    0.24 MB
//   the same, from a MATERIALIZED CTE             250 ms    0.24 MB
//
// and at 3000 events, 569 ms / 322 ms / 725 ms / 728 ms.
//
// The ALLOWLIST — build a minimal payload out of `payload->'kinds'`,
// `payload->'intent'`, ... — is 15-27% SLOWER THAN DOING NOTHING, because each
// operator detoasts and re-traverses the jsonb independently: four references
// to a TOASTed column cost four detoasts, which is more than the transfer they
// save. `#-` names the column ONCE, so there is one detoast and one traversal,
// and it is ~2x faster than today while shipping 65x less data. It is also the
// safer edit: it can only ever REMOVE a field checkFromEvent provably does not
// read, where an allowlist silently drops anything a later rung adds.
const VERIFY_EVENTS_SQL = `SELECT seq, subject_id, subject_kind, happened_at,
                                  payload #- '{changes,content}' AS payload
                             FROM events
                            WHERE graph_id = $1
                              AND subject_kind = 'node'
                              AND payload -> 'kinds' ?| ARRAY['claim.verified','claim.refuted']
                            ORDER BY seq`;

// The CHECKS are cached, not the folded state: `checkFromEvent` takes no
// parameters, so one entry serves every `staleDays` a caller may ask for,
// whereas a folded S depends on S_INIT and would be wrong the moment a caller
// varied it. The fold itself measures 5 ms on the worst real graph.
//
// derivedCacheKey interpolates its second argument into `${graphId}:${seq}`,
// so the `verify:` namespace yields `g:verify:1679` and cannot collide with the
// asOf reader's `g:1679`. Keying on the graph HEAD seq (not a
// verification-specific one) over-invalidates on unrelated writes; that is
// deliberate — the head probe is 25x cheaper than a kinds-filtered max(seq),
// and the worst-case penalty is one ~20 ms re-derive.
async function checksForGraph(gid, headSeq) {
  const key = `verify:${headSeq}`;
  const hit = getDerived(gid, key);
  if (hit !== undefined) return hit;
  const { rows } = await pool.query(VERIFY_EVENTS_SQL, [gid]);
  const checks = [];
  for (const row of rows) {
    const check = checkFromEvent(row);
    if (check) checks.push(check);
  }
  setDerived(gid, key, checks);
  return checks;
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// significance DESC NULLS LAST, the JS twin of v1's SQL sort key.
function bySignificanceDesc(a, b) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

// v1's `(t.meta->>'verified_at') ASC NULLS FIRST`, on parsed instants.
//
// WHY IT IS BACK. R GENERALISES the recency key but does not always SEPARATE
// on it, and the degenerate point is reachable: `staleDays` is a caller
// parameter with `min: 0`, `staleDays: 0` sets S = 0 for every node, and
// R(t) = (1 + t/(9S))^-1 is then the step function "1 at t = 0, else 0" —
// deliberately, because `staleDays: 0` means "everything already checked is
// stale" and that is exactly v1's answer too. There is NO NaN and no division
// by zero: retrievability() guards `s <= 0` explicitly.
//
// What DID break is the ORDER. With every R equal, the tiered comparator fell
// straight through to `id ASC`. MEASURED on five equally load-bearing nodes
// verified 1/5/30/200/900 days ago and inserted newest-first: v1 returns
// oldest-first, PATH B at `staleDays: 0` returned the exact REVERSE. So the
// key v1 sorted on is restored as the tie-break under R, which is a no-op
// wherever R already separates the rows.
function byLastHeldAsc(a, b) {
  if (a === b) return 0;
  if (a === null) return -1;   // never held: NULLS FIRST
  if (b === null) return 1;
  return a - b;
}

router.post('/', async (req, res, next) => {
  const b = req.body || {};
  const { gid } = req.params;

  const minImportance = num(b.minImportance, 'minImportance', DEFAULTS.minImportance, { min: 0, integer: true });
  const staleDays = num(b.staleDays, 'staleDays', DEFAULTS.staleDays, { min: 0 });
  const lowConfidenceBelow = num(b.lowConfidenceBelow, 'lowConfidenceBelow', DEFAULTS.lowConfidenceBelow, { min: 0, max: 1 });
  const maxResults = num(b.maxResults, 'maxResults', DEFAULTS.maxResults, { min: 1, max: MAX_RESULTS_CAP, integer: true });
  const rThreshold = num(b.rThreshold, 'rThreshold', DEFAULT_R_THRESHOLD, { min: 0, max: 1 });
  for (const r of [minImportance, staleDays, lowConfidenceBelow, maxResults, rThreshold]) {
    if (r.error) return res.status(400).json({ error: r.error });
  }
  // E18.4 — a superseded node is not a re-verification candidate: nobody needs
  // to re-check a fact whose story has ended. Default-excluded; the flag is the
  // way back, and it is reported in `params` so the answer says which question
  // it answered.
  const includeSuperseded = b.includeSuperseded === true;
  const rank = b.rank === undefined || b.rank === null ? 'tiered' : b.rank;
  if (!RANKS.includes(rank)) {
    return res.status(400).json({ error: "rank must be 'tiered' or 'urgency'" });
  }

  const params = {
    minImportance: minImportance.value,
    staleDays: staleDays.value,
    lowConfidenceBelow: lowConfidenceBelow.value,
    maxResults: maxResults.value,
    rThreshold: rThreshold.value,
    rank,
    includeSuperseded,
  };
  // S_INIT is `staleDays`. That single line is the whole of the parameter
  // back-compat story.
  const stabilityParams = { sInitDays: staleDays.value };

  try {
    const { rows: probe } = await pool.query(PROBE_SQL, [gid]);
    const headSeq = probe[0]?.head_seq === null || probe[0]?.head_seq === undefined
      ? null
      : Number(probe[0].head_seq);
    const hasE18_2Meta = probe[0]?.has_e18_2_meta === true;
    const hasSupersessions = probe[0]?.has_supersessions === true;

    // PATH A is for a v1-SHAPED REQUEST against a graph with no decay data.
    // A caller who asks for a non-default `rThreshold` or `rank: 'urgency'` is
    // asking a question v1's SQL cannot answer, so those take PATH B too —
    // better a slower honest answer than a silently ignored parameter.
    const v1Request = rank === 'tiered' && rThreshold.value === DEFAULT_R_THRESHOLD;
    const checks = headSeq === null ? [] : await checksForGraph(gid, headSeq);

    if (v1Request && !hasE18_2Meta && !hasSupersessions && checks.length === 0) {
      const { rows } = await pool.query(V1_SQL, [
        gid, params.minImportance, String(params.staleDays), params.lowConfidenceBelow, params.maxResults + 1,
      ]);
      const nowMs = Date.now();
      const truncated = rows.length > params.maxResults;
      const frontier = rows.slice(0, params.maxResults).map((r) => {
        const confidence = numOrNull(r.confidence);
        const lastHeldMs = r.verified_at ? Date.parse(r.verified_at) : NaN;
        const held = Number.isFinite(lastHeldMs) ? lastHeldMs : null;
        const ageDays = held === null ? null : Math.max(0, (nowMs - held) / MS_PER_DAY);
        return {
          id: r.id,
          title: r.title ?? '',
          status: r.status ?? 'todo',
          type: r.type ?? null,
          importance: Number(r.importance),
          confidence,
          verified_at: r.verified_at ?? null,
          stale: r.stale === true,
          lowConfidence: r.low_confidence === true,
          // Reported, never load-bearing on this path: `stale` above is the
          // SQL's answer, not this R's.
          refuted_at: null,
          // Exact, not approximate: PATH A is only reachable when the graph
          // carries NO supersedes edge at all (the probe term above).
          superseded: false,
          r: held === null ? 0 : retrievability(ageDays, params.staleDays),
          stability: params.staleDays,
          due_at: held === null ? null : dueAt(held, params.staleDays, stabilityParams, params.rThreshold),
          decays: isDecayEligible(null, { confidence, type: r.type ?? null }) === true,
          checks: checksFor(null, r.id),
        };
      });
      return res.json({
        frontier,
        truncated,
        params,
        model: { mode: 'scalar', head_seq: headSeq, verified_nodes: 0 },
      });
    }

    // ── PATH B ──────────────────────────────────────────────────────────────
    const state = foldChecks(emptyStability(), checks, stabilityParams);

    const { rows } = await pool.query(V2_CANDIDATES_SQL, [gid, params.minImportance]);
    const candidateTruncated = rows.length > MAX_CANDIDATES;
    const candidates = candidateTruncated ? rows.slice(0, MAX_CANDIDATES) : rows;

    const nowMs = Date.now();
    const scored = [];
    for (const row of candidates) {
      const confidence = numOrNull(row.confidence);
      const type = row.type ?? null;
      // `decay: false` is the one caller-reachable behaviour change in E18.2:
      // R is pinned at 1, stale is false, due_at is null. The node can still
      // surface via lowConfidence.
      const decays = isDecayEligible(null, {
        confidence,
        type,
        decay: row.decay === false ? false : undefined,
      }) === true;

      // THE SCALAR IS AUTHORITATIVE FOR THE ANCHOR; THE LOG ONLY SETS THE
      // WINDOW. So a deliberate `verified_at: null` PATCH collapses R to 0 even
      // though the log still holds old holds, and a failed check — which clears
      // verified_at — puts the claim at R = 0 in v1's query too. Scalar and
      // derived state cannot drift apart.
      const parsedHeld = row.verified_at ? Date.parse(row.verified_at) : NaN;
      const lastHeldMs = Number.isFinite(parsedHeld) ? parsedHeld : null;
      const s = stabilityFor(state, row.id, stabilityParams);
      const ageDays = lastHeldMs === null ? null : Math.max(0, (nowMs - lastHeldMs) / MS_PER_DAY);

      let r;
      let stale;
      let due;
      if (!decays) {
        r = 1;
        stale = false;
        due = null;
      } else if (lastHeldMs === null) {
        r = 0;
        stale = true;
        due = null;
      } else {
        r = retrievability(ageDays, s);
        stale = isDue(ageDays, s, stabilityParams, params.rThreshold);
        due = dueAt(lastHeldMs, s, stabilityParams, params.rThreshold);
      }
      const lowConfidence = confidence !== null && confidence < params.lowConfidenceBelow;
      if (!stale && !lowConfidence) continue;
      // Excluded AFTER scoring, not before, so `includeSuperseded: true` puts
      // the node back in EXACTLY the position it would have held — the flag
      // changes what is shown, never how anything ranks.
      if (row.superseded === true && !params.includeSuperseded) continue;

      scored.push({
        id: row.id,
        title: row.title ?? '',
        status: row.status ?? 'todo',
        type,
        importance: Number(row.importance),
        confidence,
        verified_at: row.verified_at ?? null,
        stale,
        lowConfidence,
        refuted_at: row.refuted_at ?? null,
        superseded: row.superseded === true,
        r,
        stability: s,
        due_at: due,
        decays,
        checks: checksFor(state, row.id),
        _significance: numOrNull(row.significance),
        _lastHeld: lastHeldMs,
      });
    }

    if (params.rank === 'urgency') {
      // The brief's literal "R(t) x importance": a continuous trade between a
      // low-R low-importance claim and a high-R high-importance one, instead of
      // v1's tiers. Opt-in, because a continuous score cannot reproduce a
      // tiered order and the default must.
      scored.sort((a, x) => {
        const sa = a.importance * (1 - a.r);
        const sx = x.importance * (1 - x.r);
        if (sa !== sx) return sx - sa;
        const sig = bySignificanceDesc(a._significance, x._significance);
        if (sig !== 0) return sig;
        const held = byLastHeldAsc(a._lastHeld, x._lastHeld);
        if (held !== 0) return held;
        return a.id - x.id;
      });
    } else {
      // v1's shape, with R generalising the recency key. With constant S,
      // `r ASC` IS `verified_at ASC NULLS FIRST` (R is strictly decreasing in
      // age, and R = 0 for never-verified sorts first) — a generalisation of
      // the v1 order, not a replacement of it.
      scored.sort((a, x) => {
        if (a.importance !== x.importance) return x.importance - a.importance;
        const sig = bySignificanceDesc(a._significance, x._significance);
        if (sig !== 0) return sig;
        if (a.r !== x.r) return a.r - x.r;
        const held = byLastHeldAsc(a._lastHeld, x._lastHeld);
        if (held !== 0) return held;
        return a.id - x.id;
      });
    }

    const truncated = candidateTruncated || scored.length > params.maxResults;
    const frontier = scored.slice(0, params.maxResults).map((row) => {
      const { _significance, _lastHeld, ...out } = row;
      return out;
    });

    return res.json({
      frontier,
      truncated,
      params,
      model: {
        mode: 'decay',
        head_seq: headSeq,
        verified_nodes: Object.keys(state.byNode).length,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
