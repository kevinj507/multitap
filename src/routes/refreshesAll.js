// Cross-graph refresh queue — /api/refreshes and /api/refreshes/due.
//
// The poll surface for refresh executors (node 3834): a cron session asks
// "which of MY graphs are due for a refresh?" and works the list. Scope
// mirrors reportsAll.js exactly — graphs the signed-in viewer owns or is a
// member of, the same set the sidebar lists; anonymous callers own nothing
// and get [] with 200. The scope WHERE *is* the ACL: a schedule (or its
// purpose prompt) never surfaces for a graph the viewer can't already list.
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

const DUE_EXPR = `(r.enabled AND (r.last_run_at IS NULL
  OR r.last_run_at < NOW() - make_interval(days => r.interval_days)))`;

async function listForViewer(req, res, onlyDue) {
  res.set('Cache-Control', 'no-store');
  if (!req.user) return res.json([]);
  const { rows } = await pool.query(
    `SELECT r.graph_id, r.interval_days, r.purpose, r.enabled,
            r.last_run_at, r.last_run_summary, r.last_run_id, r.last_run_kind,
            ${DUE_EXPR} AS due,
            g.name AS graph_name, g.updated_at AS graph_updated_at
       FROM graph_refreshes r
       JOIN graphs g ON g.id = r.graph_id
      WHERE (g.owner_user_id = $1
         OR g.id IN (SELECT graph_id FROM graph_members WHERE user_id = $1))
        ${onlyDue ? `AND ${DUE_EXPR}` : ''}
      ORDER BY r.last_run_at ASC NULLS FIRST, r.graph_id`,
    [req.user.id],
  );
  res.json(rows);
}

router.get('/', (req, res, next) => listForViewer(req, res, false).catch(next));
router.get('/due', (req, res, next) => listForViewer(req, res, true).catch(next));

export default router;
