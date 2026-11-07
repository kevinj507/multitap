// The owner rule for coordination nodes — decision D4 of the one-data-model
// design (Multitap er289bkv2zkcs5w6 #11334; Kevin, 2026-11-06), in his words
// "steer through recorded actions, not silent edits".
//
// A coordination node is a node that carries the engine's document under
// `meta.coord` (a proposition, a line, the engine's finding, assumption or decision).
// The engine works on an in-memory copy of those documents and writes them
// back whole, so a change made to the statement or to `meta.coord` through
// these routes would be overwritten at the engine's next save without anyone
// — least of all the agent holding the proposition — ever seeing it. That is the one
// write this module refuses. Everything else stays as it is:
//
//   * layout and UI-managed keys (`x`, `y`, `color`, `background-image`) may
//     change on a coordination node like on any node — a drag is a drag;
//   * ordinary nodes are untouched by this rule (constraint C0: a knowledge
//     graph, a research graph, a project plan never has a coordination node);
//   * steering happens through the engine's own routes, which record the act
//     and tell the agent: file a finding against the proposition (it turns stale and
//     the agent re-plans with the reason in front of it), raise or answer a
//     decision, change an assumption, amend the proposition (a new version
//     supersedes the old), release or reassign the lease.
//
// The refusal is 409 with `error: 'coordination_node'`, so a client can tell it
// from a version conflict and point the person at the right action.

export const COORD_META_KEY = 'coord';

// Keys anyone may change on a coordination node through the record's routes.
export const COORD_LAYOUT_KEYS = Object.freeze(['x', 'y', 'color', 'background-image']);

export const COORD_NODE_ERROR = 'coordination_node';
export const COORD_NODE_DETAIL =
  'this node is kept by the coordination engine; change its statement or its coordination fields through the ' +
  'coordination routes (amend the proposition, file a finding, answer a decision, release the lease) — only layout ' +
  'fields (x, y, color, background-image) can change here';
export const COORD_EDGE_DETAIL =
  'this edge is kept by the coordination engine; it changes only through the coordination routes';

export function isCoordMeta(meta) {
  return !!(meta && typeof meta === 'object' && Object.prototype.hasOwnProperty.call(meta, COORD_META_KEY));
}

function canonical(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

// Null when the write is allowed; otherwise a short reason naming what it
// tried to change. `curMeta`/`curBody` are the stored node, `nextMeta`/
// `nextBody` what the route is about to store (after its merge).
export function coordNodeChangeRefusal(curMeta, curBody, nextMeta, nextBody) {
  if (!isCoordMeta(curMeta)) return null;
  const changed = [];
  if ((curBody ?? '').trim() !== (nextBody ?? '').trim()) changed.push('body');
  const keys = new Set([...Object.keys(curMeta ?? {}), ...Object.keys(nextMeta ?? {})]);
  for (const k of keys) {
    if (COORD_LAYOUT_KEYS.includes(k)) continue;
    if (canonical(curMeta?.[k]) !== canonical(nextMeta?.[k])) changed.push(k === COORD_META_KEY ? 'coord' : `meta.${k}`);
  }
  return changed.length ? `changes ${changed.join(', ')}` : null;
}
