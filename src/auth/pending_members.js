// Per-email graph invites that resolve into real `graph_members` rows on
// first sign-in. Created when an owner adds someone by email in the Share
// modal who doesn't have an account yet (or whose account exists but we
// don't know that). verifyAuth runs `claimPendingByEmail` after Clerk
// resolves the user, converting any matches.
//
// Email is stored case-folded; matching is always lower-cased.
import pool from '../db.js';

export async function addPending(graphId, emailRaw, role) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!email) return null;
  const r = await pool.query(
    `INSERT INTO pending_members (graph_id, email, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (graph_id, email) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [graphId, email, role],
  );
  return r.rows[0];
}

export async function listPending(graphId) {
  const r = await pool.query(
    `SELECT graph_id, email, role, created_at
       FROM pending_members
      WHERE graph_id = $1
      ORDER BY created_at ASC`,
    [graphId],
  );
  return r.rows;
}

export async function removePending(graphId, emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!email) return null;
  const r = await pool.query(
    `DELETE FROM pending_members
      WHERE graph_id = $1 AND email = $2 RETURNING *`,
    [graphId, email],
  );
  return r.rows[0] || null;
}

// Convert every pending row matching this user's email into a real member
// row, in a single transaction. Idempotent on subsequent sign-ins (the
// pending rows are deleted as we convert). Returns the list of converted
// graph_id strings so the caller can log / notify if desired.
export async function claimPendingByEmail(userId, emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!userId || !email) return [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pending = await client.query(
      `SELECT graph_id, role FROM pending_members WHERE email = $1 FOR UPDATE`,
      [email],
    );
    const claimed = [];
    for (const row of pending.rows) {
      await client.query(
        `INSERT INTO graph_members (graph_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (graph_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [row.graph_id, userId, row.role],
      );
      await client.query(
        'DELETE FROM pending_members WHERE graph_id = $1 AND email = $2',
        [row.graph_id, email],
      );
      claimed.push(row.graph_id);
    }
    await client.query('COMMIT');
    return claimed;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
