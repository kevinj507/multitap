// Ephemeral, process-local per-writer selection state. Mirrors presence.js:
// in-memory only, keyed by graphId then writerId. The SSE layer subscribes
// via `onChange` and fans events out to browser viewers so they can render
// peer outlines and labeled cursors in real time.
//
// Shape per writer:
//   { node_ids: number[], edge_ids: number[],
//     editing: { kind: 'node'|'edge', id: number } | null,
//     cursor_anchor: { kind, id } | null,
//     updated_at: number }
//
// Cleanup: presence.depart fires on Stop hook / sendBeacon / 30-min reaper;
// the wiring in src/app.js calls clearSelection on every depart so a
// disappearing peer's outlines and cursor wipe within one SSE round-trip.

const RATE_LIMIT_MS = 50;
const MAX_IDS = 500;

const state = new Map();
const listeners = new Set();

function getOrCreateGraph(graphId) {
  let m = state.get(graphId);
  if (!m) {
    m = new Map();
    state.set(graphId, m);
  }
  return m;
}

function notify(graphId, op, payload) {
  for (const fn of listeners) {
    try { fn(graphId, op, payload); } catch {}
  }
}

function sanitizeIdArray(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) out.push(n);
    if (out.length >= MAX_IDS) break;
  }
  return out;
}

function sanitizeAnchor(value) {
  if (!value || typeof value !== 'object') return null;
  const kind = value.kind === 'edge' ? 'edge' : value.kind === 'node' ? 'node' : null;
  if (!kind) return null;
  const id = typeof value.id === 'number' ? value.id : Number(value.id);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) return null;
  return { kind, id };
}

export function setSelection(graphId, writerId, payload) {
  if (!graphId || !writerId) return null;
  const m = getOrCreateGraph(graphId);
  const prev = m.get(writerId);
  const now = Date.now();
  // Cheap guard against rapid-fire updates from the same writer (e.g. shift-
  // selecting a long range fires per-element events). Drop anything closer
  // than RATE_LIMIT_MS to the previous accepted update.
  if (prev && now - prev.updated_at < RATE_LIMIT_MS) return prev;
  const next = {
    node_ids: sanitizeIdArray(payload?.node_ids),
    edge_ids: sanitizeIdArray(payload?.edge_ids),
    editing: sanitizeAnchor(payload?.editing),
    cursor_anchor: sanitizeAnchor(payload?.cursor_anchor),
    updated_at: now,
  };
  m.set(writerId, next);
  notify(graphId, 'changed', { writer_id: writerId, ...next });
  return next;
}

export function clearSelection(graphId, writerId) {
  const m = state.get(graphId);
  if (!m) return false;
  if (!m.has(writerId)) return false;
  m.delete(writerId);
  if (m.size === 0) state.delete(graphId);
  notify(graphId, 'cleared', { writer_id: writerId });
  return true;
}

export function getSnapshot(graphId) {
  const m = state.get(graphId);
  if (!m) return [];
  return Array.from(m.entries()).map(([writerId, sel]) => ({
    writer_id: writerId,
    ...sel,
  }));
}

export function onChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function _resetForTest() {
  state.clear();
}
