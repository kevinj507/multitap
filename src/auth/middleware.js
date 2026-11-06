// verifyAuth: resolves `req.user` (or null) for every request. Routes never
// call adapters directly — they read `req.user` and `req.viaAgentToken` and
// the row's ACL.
//
// Order of operations:
//   1. Bearer agent-token path (prefix `gt_`): looks up the token in
//      `agent_tokens`. Strict 401 on a missing/revoked token so the
//      operator sees the real cause.
//   2. Otherwise: adapter.verify() — the Clerk path resolves the session
//      cookie/JWT and returns `{providerUserId, email, displayName}`.
//   3. If we end up with a real user (either path), upsert their `users`
//      row and run claimPendingByEmail to convert any owner-issued email
//      invites into proper memberships.
import pool from '../db.js';
import { getAdapter } from './index.js';
import { claimPendingByEmail } from './pending_members.js';
import { findActiveByToken as findAgentToken, touchLastUsed } from './agent_tokens.js';

async function ensureUserRow(provider, info) {
  const result = await pool.query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, provider_user_id) DO UPDATE
       SET email = EXCLUDED.email,
           display_name = EXCLUDED.display_name
     RETURNING *`,
    [provider, info.providerUserId, info.email ?? null, info.displayName ?? null],
  );
  return result.rows[0];
}

// Bearer path. Looks for `Authorization: Bearer <token>`, hashes the token,
// and resolves it via the agent_tokens table. Three possible return shapes:
//   { user }             — valid token, request will be attributed
//   { error: 'invalid' } — bearer header present but doesn't resolve (revoked
//                          token, garbage value, unknown hash) — caller 401s
//   null                 — no bearer header at all, fall through to adapter
// Strict 401 on invalid means a revoked/forgotten token fails LOUDLY instead
// of silently degrading to anonymous.
async function checkAgentToken(req) {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const plaintext = header.slice(7).trim();
  if (!plaintext) return { error: 'invalid' };
  // Only our app-issued tokens carry the `gt_` prefix. Anything else (Clerk
  // session JWT, OAuth tokens from a future provider, etc.) is passed back
  // to the adapter path — strict 401 must not hijack legitimate Clerk traffic.
  if (!plaintext.startsWith('gt_')) return null;
  const tokenRow = await findAgentToken(plaintext);
  if (!tokenRow) return { error: 'invalid' };
  const u = await pool.query('SELECT * FROM users WHERE id = $1', [tokenRow.user_id]);
  if (u.rows.length === 0) return { error: 'invalid' };
  touchLastUsed(tokenRow.id).catch((err) =>
    console.error('agent_tokens touch failed —', err.message),
  );
  return { user: u.rows[0] };
}

export async function verifyAuth(req, res, next) {
  req.user = null;
  req.viaAgentToken = false;
  try {
    const bearer = await checkAgentToken(req);
    if (bearer?.error === 'invalid') {
      return res.status(401).json({ error: 'invalid or revoked agent token' });
    }
    if (bearer?.user) {
      req.user = bearer.user;
      req.viaAgentToken = true;
    } else {
      const adapter = await getAdapter();
      const info = await adapter.verify(req);
      if (info?.providerUserId) {
        req.user = await ensureUserRow(adapter.provider, info);
      }
    }
    // Once we know who the user is, sweep up any per-email invites the
    // owner sent them while they were signed out. Safe to run on every
    // request — idempotent + bounded by the user's pending row count.
    if (req.user?.email) {
      try {
        await claimPendingByEmail(req.user.id, req.user.email);
      } catch (err) {
        console.error('claimPendingByEmail failed —', err.message);
      }
    }
  } catch (err) {
    // Soft-fail: a transient adapter or DB error should not 500 every request.
    console.error('verifyAuth: degrading to anonymous —', err.message);
  }
  next();
}
