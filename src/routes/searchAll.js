// POST /api/search — cross-graph "All graphs" KB search (#172 scope toggle,
// #171 "search my graphs", #173 §4 access-control caveat). One pipeline run
// over every graph the signed-in user can see as THEIRS: graphs they own plus
// graphs they're a member of — exactly the GET /api/graphs listing set. The
// ownership WHERE rides into every leg (corpus load, ANN chunk scan, edge
// expansion), so nodes can never leak across owners; anonymous users own
// nothing and get a 401, matching the listing's empty answer.
//
// Response shape is the per-graph endpoint's plus attribution: each result
// carries `graphId`, and a `graphs` map (id → name) lets the client label and
// navigate without N follow-up fetches.

import { Router } from 'express';
import pool from '../db.js';
// The per-graph route's process-wide service — sharing it means the boot
// warmup covers cross-graph too, and the ONNX models exist exactly once.
import { getDefaultService } from './search.js';

const router = Router();

router.post('/', async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'cross-graph search requires a signed-in user' });
  }
  const { query } = req.body || {};
  if (typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }

  try {
    // The "my graphs" set — owned + member, same predicate as GET /api/graphs.
    const { rows: graphs } = await pool.query(
      `SELECT id, name FROM graphs
        WHERE owner_user_id = $1
           OR id IN (SELECT graph_id FROM graph_members WHERE user_id = $1)`,
      [req.user.id],
    );
    if (graphs.length === 0) {
      return res.json({ query, results: [], timings: { total: 0 }, graphs: {} });
    }

    const gids = graphs.map((g) => g.id);
    const service = getDefaultService();
    const { candidates, timings } = await service.search(query, { gids, user: req.user });

    // Attribute each hit to its graph and carry the node title: the client's
    // per-graph doc cache can't label hits from OTHER graphs, and a row
    // without a title is unpaintable. One cheap query, no corpus threading.
    const { rows: taskRows } = await pool.query(
      `SELECT id, graph_id, meta->>'title' AS title FROM tasks WHERE id = ANY($1)`,
      [candidates.map((c) => c.taskId)],
    );
    const byTask = new Map(taskRows.map((t) => [String(t.id), t]));
    const results = candidates.map((c) => {
      const t = byTask.get(String(c.taskId));
      return { ...c, graphId: t ? t.graph_id : null, title: t ? t.title : null };
    });

    res.json({
      query,
      results,
      timings,
      graphs: Object.fromEntries(graphs.map((g) => [g.id, g.name])),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
