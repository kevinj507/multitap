// GET /api/reports — the cross-graph report rail (E16.5, FIXED #2). One row per
// graph the signed-in viewer can see as THEIRS — graphs they own plus graphs
// they're a member of — exactly the GET /api/graphs listing set (graphs.js
// GET /). The scope WHERE IS the ACL: a report can never surface for a graph
// the viewer can't already list, so no report title/id leaks across owners.
//
// This deliberately reuses the owned+member set (not a broader read-based set
// that would include public anon_role graphs) so the reader's left rail mirrors
// the sidebar graph list exactly — same graphs, same order key. Per-graph
// report READS are broader (a viewer/anon who can requireGraph('read') a public
// graph may read its report via /api/graphs/:gid/report); the rail simply does
// not advertise those graphs, the same way the sidebar doesn't list them.
//
// Unlike searchAll.js (which 401s anonymous callers), this mirrors the graph
// LIST: anonymous owns nothing, so it returns [] with 200 — the same empty
// answer the sidebar shows an anon viewer. `body` is omitted; the reader fetches
// each report's body per-graph on row click. `graph_updated_at` lets the rail
// render a staleness dot (E16.6) without a second round trip.
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  // Never let the browser serve a cached rail: a report generated out-of-band
  // (agent/workflow) must appear on the next reader-mode entry, not after a hard
  // refresh. Heuristic HTTP caching of this GET was surfacing a stale empty list.
  res.set('Cache-Control', 'no-store');
  if (!req.user) return res.json([]);
  try {
    const { rows } = await pool.query(
      `SELECT r.graph_id, r.title, r.description, r.generated_at, r.updated_at,
              r.source_graph_version,
              g.name AS graph_name, g.updated_at AS graph_updated_at
         FROM reports r
         JOIN graphs g ON g.id = r.graph_id
        WHERE g.owner_user_id = $1
           OR g.id IN (SELECT graph_id FROM graph_members WHERE user_id = $1)
        ORDER BY r.updated_at DESC, r.graph_id DESC`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
