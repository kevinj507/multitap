// Per-route guards that load the graph, run an ACL predicate, and attach
// `req.graph` + `req.graphMember` for the handler. They also stamp implicit
// presence on writes — folded in here so the touch can't fire before the
// access check passes.
//
// Post-Phase-B5c: there's no separate invite-token URL anymore. Anonymous
// access is gated entirely by `graph.anon_role`, which the predicates in
// access.js read directly off the row.
import * as presence from '../presence.js';
import { canEdit, canManage, canRead, loadGraph, loadMembership } from './access.js';
import { resolveAgentName } from '../writerName.js';

const CHECKS = { read: canRead, edit: canEdit, manage: canManage };

export function requireGraph(level) {
  const check = CHECKS[level];
  if (!check) throw new Error(`unknown require level: ${level}`);
  return async function requireGraphMiddleware(req, res, next) {
    const gid = req.params.gid ?? req.params.id;
    if (!gid) return res.status(400).json({ error: 'graph id missing' });
    let graph, member;
    try {
      graph = await loadGraph(gid);
      if (!graph) return res.status(404).json({ error: 'not found' });
      member = req.user ? await loadMembership(gid, req.user.id) : null;
    } catch (err) {
      return next(err);
    }
    if (!check(req.user, graph, member)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    req.graph = graph;
    req.graphMember = member;
    // Implicit presence touch: any mutating request from an identified writer
    // counts as "I'm here" and refreshes the avatar TTL. Matches the Phase A
    // behavior that lived in app.js, but now only fires after the ACL passes.
    if (req.method !== 'GET' && req.writer?.id) {
      // Agents are named authoritatively from the token owner (the operator),
      // not the client-sent X-Writer-Name — which is seeded from the repo's
      // git author and is wrong on shared repos. Humans pass through unchanged:
      // the browser owns its identity (Clerk name / rename modal / email), and
      // this touch fires for human writes too, so we must not override them.
      const name = req.writer.type === 'agent'
        ? resolveAgentName({ user: req.user, clientName: req.writer.name })
        : req.writer.name;
      presence.touch(
        graph.id,
        req.writer.id,
        name,
        req.writer.type,
        req.user?.id ?? null,
      );
    }
    next();
  };
}

// Pick read vs edit based on HTTP method. Cheap default for sub-resource
// routers (tasks, edges) where every GET is a read and every other verb is
// an edit. Routers that need finer granularity (graphs.js needs `manage` on
// PATCH/DELETE) attach `requireGraph(level)` per route instead.
export function requireGraphForMethod(req, res, next) {
  const level = req.method === 'GET' ? 'read' : 'edit';
  return requireGraph(level)(req, res, next);
}
