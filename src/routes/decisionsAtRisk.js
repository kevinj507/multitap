// E17.2 — POST /api/graphs/:gid/decisions/at-risk. The decision re-check
// queue: every `type: decision` node whose GROUNDS have shifted since the
// decision was made. Complements /frontier (which re-checks claims): instead
// of "what established knowledge needs re-verifying", it answers "which
// committed decisions no longer rest on solid ground".
//
// A decision's grounds are the nodes wired INTO it via `supports` /
// `required for` (direction source(ground) → target(decision)). The decision
// is AT RISK when any ground is:
//   - stale          — verified_at absent or older than staleDays (evaluated
//                      only for confidence-bearing nodes and `reference`
//                      sources, same scope as /frontier);
//   - lowConfidence  — confidence < lowConfidenceBelow;
//   - contradicted   — the ground touches a `contradicts` edge, either
//                      direction;
//   - supersededGround — E18.4: a `supersedes` edge targets the ground, i.e.
//                      someone has declared that this ground WAS right for its
//                      time and something else replaced it. The decision still
//                      rests on the old version;
//   - changedSinceDecision — the ground's updated_at is newer than the
//                      decision's decided_at (falling back to the decision's
//                      created_at). This is the pivot detector: a requirement
//                      edited after the decision was committed means the
//                      decision was made against outdated grounds.
// A decision that itself touches a `contradicts` edge is also at risk
// (selfContradicted), even with no wired grounds. A decision that has itself
// been SUPERSEDED is the opposite case and drops out entirely (E18.4): it is no
// longer a live commitment, it is history.
//
// STATUS-INDEPENDENT by design: `done` decisions surface. "Done-status must
// never suppress the re-check" is a computed invariant here, not a prose vow
// in a node body — the same "orientation is computed, not written" principle
// as /ready and /frontier. Read-guarded; never mutates.
//
// Ranked by the decision's out-degree over `required for` + `supports` (its
// blast radius — how much of the graph rests on it), so load-bearing
// decisions surface first.

import { Router } from 'express';
import pool from '../db.js';
import { SUPERSEDES } from '../supersession.js';

const router = Router({ mergeParams: true });

const DEFAULTS = { staleDays: 90, lowConfidenceBelow: 0.5, maxResults: 50 };
const MAX_RESULTS_CAP = 500;

function num(value, name, dflt, { min, max, integer }) {
  if (value === undefined || value === null) return { value: dflt };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `${name} must be a number` };
  if (integer && !Number.isInteger(value)) return { error: `${name} must be an integer` };
  if (min !== undefined && value < min) return { error: `${name} must be >= ${min}` };
  if (max !== undefined && value > max) return { error: `${name} must be <= ${max}` };
  return { value };
}

router.post('/', async (req, res, next) => {
  const b = req.body || {};
  const { gid } = req.params;

  const staleDays = num(b.staleDays, 'staleDays', DEFAULTS.staleDays, { min: 0 });
  const lowConfidenceBelow = num(b.lowConfidenceBelow, 'lowConfidenceBelow', DEFAULTS.lowConfidenceBelow, { min: 0, max: 1 });
  const maxResults = num(b.maxResults, 'maxResults', DEFAULTS.maxResults, { min: 1, max: MAX_RESULTS_CAP, integer: true });
  for (const r of [staleDays, lowConfidenceBelow, maxResults]) {
    if (r.error) return res.status(400).json({ error: r.error });
  }
  // E18.4 — a SUPERSEDED decision is not at risk, it is HISTORY: re-checking it
  // is work nobody should be handed. Default-excluded, `includeSuperseded: true`
  // is the way back.
  const includeSuperseded = b.includeSuperseded === true;

  try {
    // One pass: decisions + their blast radius, their grounds with per-ground
    // risk booleans, and the contradicts-touch set. Fetch maxResults+1 so
    // truncation is flagged without a second COUNT (same as /frontier).
    const { rows } = await pool.query(
      `WITH sup AS (
         -- E18.4. The supersession set, read from the EDGE SET and never from a
         -- flag on the row — that is what keeps "is this superseded?" a
         -- function of time rather than a permanent mark. Served by the partial
         -- index edges_supersedes_idx.
         SELECT target_id AS id FROM edges WHERE graph_id = $1 AND purpose = '${SUPERSEDES}'
       ),
       decisions AS (
         SELECT t.id, t.meta, t.created_at,
                (t.meta->>'decided_at')::timestamptz AS decided_at
           FROM tasks t
          WHERE t.graph_id = $1 AND t.meta->>'type' = 'decision'
            ${includeSuperseded ? '' : 'AND t.id NOT IN (SELECT id FROM sup)'}
       ),
       contra AS (
         SELECT source_id AS id FROM edges WHERE graph_id = $1 AND purpose = 'contradicts'
         UNION
         SELECT target_id FROM edges WHERE graph_id = $1 AND purpose = 'contradicts'
       ),
       grounds AS (
         SELECT e.target_id AS decision_id,
                s.id AS source_id,
                s.meta->>'title' AS source_title,
                ((s.meta->>'confidence' IS NOT NULL OR s.meta->>'type' = 'reference')
                  AND (s.meta->>'verified_at' IS NULL
                       OR (s.meta->>'verified_at')::timestamptz < NOW() - ($2 || ' days')::interval)) AS stale,
                (s.meta->>'confidence' IS NOT NULL
                  AND (s.meta->>'confidence')::numeric < $3) AS low_confidence,
                (s.id IN (SELECT id FROM contra)) AS contradicted,
                -- The single most actionable at-risk signal there is: the
                -- ground this decision rests on has been REPLACED. Without it,
                -- retyping a mis-filed contradicts edge to supersedes would
                -- make the at-risk queue go QUIETER, which is backwards.
                (s.id IN (SELECT id FROM sup)) AS superseded_ground,
                (s.updated_at > COALESCE(d.decided_at, d.created_at)) AS changed_since_decision
           FROM edges e
           JOIN decisions d ON d.id = e.target_id
           JOIN tasks s ON s.id = e.source_id AND s.graph_id = $1
          WHERE e.graph_id = $1 AND e.purpose IN ('required for', 'supports')
       ),
       risky AS (
         SELECT decision_id,
                json_agg(json_build_object(
                  'id', source_id,
                  'title', COALESCE(source_title, ''),
                  'stale', stale,
                  'lowConfidence', low_confidence,
                  'contradicted', contradicted,
                  'supersededGround', superseded_ground,
                  'changedSinceDecision', changed_since_decision
                ) ORDER BY source_id) AS reasons
           FROM grounds
          WHERE stale OR low_confidence OR contradicted OR superseded_ground
                OR changed_since_decision
          GROUP BY decision_id
       )
       SELECT d.id,
              d.meta->>'title'  AS title,
              d.meta->>'status' AS status,
              d.meta->>'decided_at' AS decided_at,
              (SELECT count(*) FROM edges e
                WHERE e.source_id = d.id AND e.graph_id = $1
                  AND e.purpose IN ('required for', 'supports')) AS importance,
              (d.id IN (SELECT id FROM contra)) AS self_contradicted,
              COALESCE(r.reasons, '[]'::json) AS reasons
         FROM decisions d
         LEFT JOIN risky r ON r.decision_id = d.id
        WHERE r.decision_id IS NOT NULL OR d.id IN (SELECT id FROM contra)
        ORDER BY importance DESC, d.id ASC
        LIMIT $4`,
      [gid, String(staleDays.value), lowConfidenceBelow.value, maxResults.value + 1],
    );

    const truncated = rows.length > maxResults.value;
    const atRisk = rows.slice(0, maxResults.value).map((r) => ({
      id: r.id,
      title: r.title ?? '',
      status: r.status ?? 'todo',
      decided_at: r.decided_at ?? null,
      importance: Number(r.importance),
      selfContradicted: r.self_contradicted === true,
      reasons: r.reasons.map((g) => ({
        id: g.id,
        title: g.title,
        kinds: [
          ...(g.stale ? ['stale'] : []),
          ...(g.lowConfidence ? ['lowConfidence'] : []),
          ...(g.contradicted ? ['contradicted'] : []),
          ...(g.supersededGround ? ['supersededGround'] : []),
          ...(g.changedSinceDecision ? ['changedSinceDecision'] : []),
        ],
      })),
    }));

    res.json({
      atRisk,
      truncated,
      params: {
        staleDays: staleDays.value,
        lowConfidenceBelow: lowConfidenceBelow.value,
        maxResults: maxResults.value,
        includeSuperseded,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
