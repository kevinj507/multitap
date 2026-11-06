// Member routes for the Share modal.
//
//   GET   /api/graphs/:gid/members        — list real + pending members
//   POST  /api/graphs/:gid/members        — owner invites by email + role
//   DELETE /api/graphs/:gid/members/:userId         — kick a real member
//   DELETE /api/graphs/:gid/members/pending/:email  — cancel a pending invite
//
// Real members live in `graph_members` (joined with `users` so the UI gets
// display_name + email in one trip). Pending invites live in
// `pending_members` and resolve automatically when the email signs in via
// Clerk — see src/auth/middleware.js:claimPendingByEmail.
import { Router } from 'express';
import pool from '../db.js';
import { requireGraph } from '../auth/require.js';
import { addPending, removePending } from '../auth/pending_members.js';
import { broadcastGraphEvent } from '../sse.js';

const router = Router({ mergeParams: true });

const ALLOWED_MEMBER_ROLES = ['viewer', 'editor'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET: returns { members: [...], pending: [...] } so the UI can render both
// in the same panel. Read-gated — anyone who can see the graph can see who
// else is on it (same as the presence avatar bar already reveals).
router.get('/', requireGraph('read'), async (req, res) => {
  const [members, pending] = await Promise.all([
    pool.query(
      `SELECT gm.graph_id, gm.user_id, gm.role, gm.created_at,
              u.display_name, u.email
         FROM graph_members gm
         JOIN users u ON u.id = gm.user_id
        WHERE gm.graph_id = $1
        ORDER BY gm.created_at ASC`,
      [req.graph.id],
    ),
    pool.query(
      `SELECT graph_id, email, role, created_at
         FROM pending_members
        WHERE graph_id = $1
        ORDER BY created_at ASC`,
      [req.graph.id],
    ),
  ]);
  res.json({ members: members.rows, pending: pending.rows });
});

// POST: owner adds someone by email. If the email matches an existing user
// account we promote directly to a member row; otherwise we stash a pending
// row that auto-claims on their next sign-in.
router.post('/', requireGraph('manage'), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = req.body?.role;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'valid email is required' });
  }
  if (!ALLOWED_MEMBER_ROLES.includes(role)) {
    return res.status(400).json({
      error: `role must be one of ${ALLOWED_MEMBER_ROLES.join(', ')}`,
    });
  }
  if (email === (req.user?.email || '').toLowerCase()) {
    return res.status(400).json({ error: "you're already the owner — no need to invite yourself" });
  }

  // Existing user? Promote directly.
  const existing = await pool.query(
    'SELECT id FROM users WHERE lower(email) = $1 LIMIT 1',
    [email],
  );
  if (existing.rows.length > 0) {
    const userId = existing.rows[0].id;
    const r = await pool.query(
      `INSERT INTO graph_members (graph_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (graph_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [req.graph.id, userId, role],
    );
    // Belt-and-suspenders: if a stale pending row existed for this email,
    // delete it so the listing doesn't show both.
    await removePending(req.graph.id, email);
    return res.status(201).json({ kind: 'member', member: r.rows[0] });
  }

  // No account yet — stash as pending; claims on first sign-in.
  const pending = await addPending(req.graph.id, email, role);
  res.status(201).json({ kind: 'pending', pending });
});

// DELETE /:userId — kick a real member. Refuses to drop the owner.
router.delete('/:userId', requireGraph('manage'), async (req, res) => {
  if (req.params.userId === req.graph.owner_user_id) {
    return res.status(400).json({ error: 'cannot remove the graph owner' });
  }
  const r = await pool.query(
    'DELETE FROM graph_members WHERE graph_id = $1 AND user_id = $2 RETURNING *',
    [req.graph.id, req.params.userId],
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'not a member' });
  // Push an SSE frame so the kicked member's live browser refetches and
  // hits the new 403 path immediately rather than waiting for their next
  // interaction. graph_members has no DB trigger, so notify directly here.
  broadcastGraphEvent(req.graph.id, {
    graph_id: req.graph.id,
    kind: 'members',
    op: 'DELETE',
    user_id: req.params.userId,
  });
  res.json({ removed: r.rows[0] });
});

// DELETE /pending/:email — cancel an invite that hasn't been claimed yet.
router.delete('/pending/:email', requireGraph('manage'), async (req, res) => {
  const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
  const removed = await removePending(req.graph.id, email);
  if (!removed) return res.status(404).json({ error: 'no pending invite for that email' });
  res.json({ removed });
});

export default router;
