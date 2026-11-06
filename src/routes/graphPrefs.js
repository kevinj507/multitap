// /api/graphs/:gid/prefs — per-(user, graph) follow preference for the
// camera-follow toggle. Authed users only (anons use localStorage; see
// public/app.js). Mounted under requireGraph('read'), so any user with read
// access to the graph can read/write their own follow pref for it — even a
// viewer who can't edit the graph itself.
//
// Toggle semantics: PUT writes BOTH the per-graph row AND user_prefs.
// agent_follow_default in a single transaction. The "future graphs default
// to your last toggle" rule lives here; the client never has to make two
// calls. Existing per-graph rows on OTHER graphs are not touched — old
// graphs keep whatever you last set them to.
import { Router } from 'express';
import { withTx } from '../db.js';
import pool from '../db.js';

const router = Router({ mergeParams: true });

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'sign in required' });
  next();
}

router.get('/me', requireUser, async (req, res) => {
  const { gid } = req.params;
  const r = await pool.query(
    'SELECT agent_follow FROM user_graph_prefs WHERE user_id = $1 AND graph_id = $2',
    [req.user.id, gid],
  );
  // null = "unset, fall back to default" — caller (client) resolves.
  const agent_follow = r.rows[0]?.agent_follow ?? null;
  res.json({ agent_follow });
});

router.put('/me', requireUser, async (req, res) => {
  const { gid } = req.params;
  const { agent_follow } = req.body ?? {};
  if (typeof agent_follow !== 'boolean') {
    return res.status(400).json({ error: 'agent_follow must be boolean' });
  }
  // THE GRAPH CAN VANISH BETWEEN THE GUARD AND THE WRITE. requireGraph('read')
  // loaded the row and took no lock on it, so a concurrent DELETE /api/graphs/:id
  // — or rotate-id, which UPDATEs graphs.id — can commit inside this window and
  // the FK check raises 23503 on user_graph_prefs_graph_id_fkey. Unhandled that
  // is a bare 500; 404 is what requireGraph itself answers one retry later, so
  // the two agree. Same window, same handling, in routes/changes.js's PUT /seen.
  try {
    await withTx(async (client) => {
      await client.query(
        `INSERT INTO user_graph_prefs (user_id, graph_id, agent_follow, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, graph_id) DO UPDATE SET
           agent_follow = EXCLUDED.agent_follow,
           updated_at = NOW()`,
        [req.user.id, gid, agent_follow],
      );
      await client.query(
        `INSERT INTO user_prefs (user_id, agent_follow_default, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           agent_follow_default = EXCLUDED.agent_follow_default,
           updated_at = NOW()`,
        [req.user.id, agent_follow],
      );
    });
  } catch (err) {
    if (err?.code === '23503') return res.status(404).json({ error: 'not found' });
    throw err;
  }
  res.json({ agent_follow });
});

export default router;
