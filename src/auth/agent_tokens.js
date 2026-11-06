// App-issued bearer tokens for agents. Mint via Settings → Agent tokens in
// the UI; paste into MULTITAP_AGENT_TOKEN; the skill sends it as
// `Authorization: Bearer <token>` on every write.
//
// Token format: `gt_` prefix + base32(32 random bytes) → ~55 chars. The
// prefix is purely human-recognizable; verification ignores it after
// hashing. Prefix is conventional (`gh_`, `sk_`, `gt_`) so users can spot
// Multitap tokens in their env files at a glance.
import { randomBytes, createHash } from 'node:crypto';
import pool from '../db.js';

const TOKEN_BYTES = 32;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function mintToken() {
  return `gt_${toBase32(randomBytes(TOKEN_BYTES))}`;
}

export function hashToken(plaintext) {
  return createHash('sha256').update(plaintext).digest('hex');
}

export async function createToken(userId, label) {
  const token = mintToken();
  const hash = hashToken(token);
  const r = await pool.query(
    `INSERT INTO agent_tokens (user_id, token_hash, label)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, hash, label ?? null],
  );
  return { token, row: r.rows[0] };
}

export async function listTokens(userId) {
  const r = await pool.query(
    `SELECT id, user_id, label, last_used_at, revoked_at, created_at
       FROM agent_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return r.rows;
}

export async function revokeToken(tokenId, userId) {
  const r = await pool.query(
    `UPDATE agent_tokens
        SET revoked_at = NOW()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
    RETURNING *`,
    [tokenId, userId],
  );
  return r.rows[0] || null;
}

export async function findActiveByToken(plaintext) {
  if (!plaintext) return null;
  const r = await pool.query(
    `SELECT * FROM agent_tokens
      WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(plaintext)],
  );
  return r.rows[0] || null;
}

export function touchLastUsed(tokenId) {
  // Fire-and-forget: we don't want the bearer-auth path to wait on this
  // (it's purely audit metadata). Caller may ignore the returned promise.
  return pool.query('UPDATE agent_tokens SET last_used_at = NOW() WHERE id = $1', [tokenId]);
}
