// /api/me/* — per-user surface area. Currently just agent_tokens CRUD; will
// host other "this user's data" endpoints (preferences, profile) later.
//
// Permission model:
// - GET tokens — any authed request (including via agent token itself). Lets
//   the agent confirm what it's running as.
// - POST / DELETE tokens — only browser sessions. An agent token CANNOT mint
//   new tokens or revoke peers, so a leaked token's blast radius is limited
//   to graph access, not credential escalation.
import { Router } from 'express';
import { createToken, listTokens, revokeToken } from '../auth/agent_tokens.js';
import pool from '../db.js';

const router = Router();

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'sign in required' });
  next();
}

function requireBrowserUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'sign in required' });
  if (req.viaAgentToken) {
    return res.status(403).json({ error: 'agent tokens cannot manage tokens' });
  }
  next();
}

const LABEL_MAX = 64;

router.post('/agent_tokens', requireBrowserUser, async (req, res) => {
  let label = req.body?.label;
  if (label !== undefined && label !== null) {
    if (typeof label !== 'string') {
      return res.status(400).json({ error: 'label must be a string' });
    }
    label = label.trim().slice(0, LABEL_MAX);
    if (label.length === 0) label = null;
  } else {
    label = null;
  }
  const { token, row } = await createToken(req.user.id, label);
  res.status(201).json({
    token,
    record: {
      id: row.id,
      label: row.label,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
      revoked_at: row.revoked_at,
    },
  });
});

router.get('/agent_tokens', requireUser, async (req, res) => {
  res.json(await listTokens(req.user.id));
});

router.delete('/agent_tokens/:id', requireBrowserUser, async (req, res) => {
  const revoked = await revokeToken(req.params.id, req.user.id);
  if (!revoked) return res.status(404).json({ error: 'not found or already revoked' });
  res.json(revoked);
});

// Per-user follow preferences. Anons can't store prefs server-side (no
// stable user id) — they use localStorage on the client. So both endpoints
// are sign-in-required for authed users only; the client falls back to
// localStorage when window.gtUser is absent (see public/app.js).
router.get('/prefs', requireUser, async (req, res) => {
  const r = await pool.query(
    'SELECT agent_follow_default FROM user_prefs WHERE user_id = $1',
    [req.user.id],
  );
  const agent_follow_default = r.rows[0]?.agent_follow_default ?? true;
  res.json({ agent_follow_default });
});

router.put('/prefs', requireUser, async (req, res) => {
  const { agent_follow_default } = req.body ?? {};
  if (typeof agent_follow_default !== 'boolean') {
    return res.status(400).json({ error: 'agent_follow_default must be boolean' });
  }
  await pool.query(
    `INSERT INTO user_prefs (user_id, agent_follow_default, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       agent_follow_default = EXCLUDED.agent_follow_default,
       updated_at = NOW()`,
    [req.user.id, agent_follow_default],
  );
  res.json({ agent_follow_default });
});

export default router;
