// E15.B3 — POST /api/graphs/:gid/inconsistencies. Scans the supports/contradicts
// subgraph for unbalanced directed cycles (odd number of `contradicts` edges) —
// the structural signature of a contradiction in the knowledge base. Read-only,
// read-guarded. This is NEVER a write guard (contradictions must always be
// storable) and NEVER auto-resolves; it surfaces tensions for a human to
// adjudicate, like a merge conflict. The cycle math is in src/signedCycles.js.

import { Router } from 'express';
import pool from '../db.js';
import { findSignedInconsistencies } from '../signedCycles.js';

const router = Router({ mergeParams: true });

const DEFAULTS = { maxCycleLen: 6, maxCycles: 50 };
const RANGES = { maxCycleLen: [2, 10], maxCycles: [1, 500] };

function intParam(value, name, [lo, hi], dflt) {
  if (value === undefined || value === null) return { value: dflt };
  if (typeof value !== 'number' || !Number.isInteger(value) || value < lo || value > hi) {
    return { error: `${name} must be an integer in [${lo}, ${hi}]` };
  }
  return { value };
}

router.post('/', async (req, res, next) => {
  const b = req.body || {};
  const { gid } = req.params;

  const mode = b.start !== undefined && b.start !== null ? 'claim' : 'graph';
  let start = null;
  if (mode === 'claim') {
    if (typeof b.start !== 'number' || !Number.isInteger(b.start) || b.start <= 0) {
      return res.status(400).json({ error: 'start must be a positive integer node id' });
    }
    start = b.start;
  }
  const maxCycleLen = intParam(b.maxCycleLen, 'maxCycleLen', RANGES.maxCycleLen, DEFAULTS.maxCycleLen);
  const maxCycles = intParam(b.maxCycles, 'maxCycles', RANGES.maxCycles, DEFAULTS.maxCycles);
  for (const r of [maxCycleLen, maxCycles]) if (r.error) return res.status(400).json({ error: r.error });

  try {
    if (mode === 'claim') {
      const { rows } = await pool.query('SELECT 1 FROM tasks WHERE id = $1 AND graph_id = $2', [start, gid]);
      if (rows.length === 0) return res.status(404).json({ error: 'start node not found in graph' });
    }

    // Only the signed edges matter; pull just those (purpose lives on the edge).
    const { rows: edges } = await pool.query(
      `SELECT source_id, target_id, purpose FROM edges
        WHERE graph_id = $1 AND purpose IN ('supports', 'contradicts')`,
      [gid],
    );

    const { inconsistencies, truncated, scanned } = findSignedInconsistencies(edges, {
      mode,
      start,
      maxCycleLen: maxCycleLen.value,
      maxCycles: maxCycles.value,
    });

    res.json({
      mode,
      start: start ?? undefined,
      inconsistencies,
      truncated,
      scanned,
      params: { maxCycleLen: maxCycleLen.value, maxCycles: maxCycles.value },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
