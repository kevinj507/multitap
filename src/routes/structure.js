// E19.1 — POST /api/graphs/:gid/structure. Derived plan structure: the shape of
// the plan, not a point query about one node.
//
// Every other structural query (`subtasks`, `ancestors`, `blockers`, `unblocks`,
// `ready`, `leaves`, `shortest-path`) is anchored on a node you already know.
// None answers "what are the independent bodies of work in here, and where is
// each one up to" — even though the `required for` edges already encode it. This
// route derives that, and stores nothing: like /frontier, the answer is a fold
// over live rows.
//
// Read-only and read-guarded. The region math is in src/planRegions.js.

import { Router } from 'express';
import pool from '../db.js';
import { derivePlanRegions, ALL_PURPOSES, DEFAULT_PURPOSES } from '../planRegions.js';

const router = Router({ mergeParams: true });

const MIN_REGION_SIZE_RANGE = [1, 100];

router.post('/', async (req, res, next) => {
  const b = req.body || {};
  const { gid } = req.params;

  let purposes = DEFAULT_PURPOSES;
  if (b.purposes !== undefined && b.purposes !== null) {
    if (!Array.isArray(b.purposes) || b.purposes.length === 0) {
      return res.status(400).json({ error: 'purposes must be a non-empty array' });
    }
    const bad = b.purposes.filter((p) => !ALL_PURPOSES.includes(p));
    if (bad.length) {
      return res.status(400).json({
        error: `purposes must be a subset of ${ALL_PURPOSES.join(', ')}`,
      });
    }
    purposes = [...new Set(b.purposes)];
  }

  let minRegionSize = 2;
  if (b.minRegionSize !== undefined && b.minRegionSize !== null) {
    const [lo, hi] = MIN_REGION_SIZE_RANGE;
    if (
      typeof b.minRegionSize !== 'number' ||
      !Number.isInteger(b.minRegionSize) ||
      b.minRegionSize < lo ||
      b.minRegionSize > hi
    ) {
      return res.status(400).json({ error: `minRegionSize must be an integer in [${lo}, ${hi}]` });
    }
    minRegionSize = b.minRegionSize;
  }

  try {
    const { rows: nodes } = await pool.query(
      `SELECT t.id,
              t.meta->>'title'  AS title,
              t.meta->>'status' AS status,
              (t.meta->>'confidence')::float AS confidence
         FROM tasks t WHERE t.graph_id = $1 ORDER BY t.id`,
      [gid],
    );
    // ALL edges: planRegions filters by `purposes` for region-building but needs
    // the full `required for` set to compute readiness honestly (a prerequisite
    // in another region still blocks).
    const { rows: edges } = await pool.query(
      'SELECT source_id, target_id, purpose FROM edges WHERE graph_id = $1',
      [gid],
    );

    const result = derivePlanRegions({ nodes, edges }, { purposes, minRegionSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
