// Access control helpers. Three predicates over (user, graph, member):
//
//   canRead   — view the graph and its tasks/edges
//   canEdit   — create/update/delete tasks and edges on the graph
//   canManage — change the graph's settings, share/unshare, delete the graph
//
// Legacy un-owned graphs (`owner_user_id IS NULL`) preserve the Phase A
// URL-bearer semantic: anyone with the id can do anything.
//
// For owned graphs (post-Phase-B5c), access flows from:
//   - graph.anon_role: 'none' | 'viewer' | 'editor' — tier for any visitor
//                       who isn't the owner or a member.
//   - member.role:     'viewer' | 'editor' — explicit per-user permission.
//   - owner_user_id:   the graph's owner has full canManage.
//
// `member` is the user's `graph_members` row (or null). Pass it in rather
// than recomputing — the request-scoped middleware already loaded it once.
import pool from '../db.js';

export async function loadGraph(graphId) {
  const r = await pool.query('SELECT * FROM graphs WHERE id = $1', [graphId]);
  return r.rows[0] || null;
}

export async function loadMembership(graphId, userId) {
  if (!userId) return null;
  const r = await pool.query(
    'SELECT * FROM graph_members WHERE graph_id = $1 AND user_id = $2',
    [graphId, userId],
  );
  return r.rows[0] || null;
}

export function canRead(user, graph, member) {
  if (!graph.owner_user_id) return true;       // legacy bearer-token graph
  if (user && graph.owner_user_id === user.id) return true;
  if (member) return true;                      // viewer or editor — both can read
  // Anonymous (or non-member signed-in) reads gated by graph.anon_role.
  const anon = graph.anon_role || 'none';
  return anon === 'viewer' || anon === 'editor';
}

export function canEdit(user, graph, member) {
  if (!graph.owner_user_id) return true;       // legacy stays URL-bearer edit
  if (user && graph.owner_user_id === user.id) return true;
  if (member && member.role === 'editor') return true;
  // Anonymous/non-member edit only when general access is 'editor'.
  return (graph.anon_role || 'none') === 'editor';
}

// canManage is intentionally owner-only — even an editor-member can't share
// further, kick people, change anon_role, rotate the id, or delete the graph.
export function canManage(user, graph) {
  if (!graph.owner_user_id) return true;       // legacy: URL = manage
  if (!user) return false;
  return graph.owner_user_id === user.id;
}
