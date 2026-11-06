// Ephemeral, process-local presence: who is on which graph right now.
// In-memory only — no DB writes. State is keyed by graphId, then by writerId,
// and carries {name, type, owner_user_id, lastSeen, active}. Listeners
// (e.g. the SSE layer) subscribe via `onChange` to broadcast state changes
// to browser viewers. `owner_user_id` is null for anonymous writers; for
// authed humans it's `users.id`; for agent-token writers it's the token's
// `user_id` (i.e. who the agent is acting on behalf of). Clients use it to
// answer "is this agent mine?" for the multi-agent follow filter.
//
// Time semantics: `announce` and `touch` refresh `lastSeen` and mark the
// writer active. A reaper drops anyone older than IDLE_TTL_MS. A separate
// sweep flips writers to inactive once `lastSeen` is older than
// ACTIVE_WINDOW_MS, broadcasting an `idle` event so other viewers can fade
// the avatar. The next announce/touch flips them back and emits `active`.

export const IDLE_TTL_MS = 30 * 60 * 1000;
export const REAPER_INTERVAL_MS = 60 * 1000;
export const ACTIVE_WINDOW_MS = 60 * 1000;
export const ACTIVE_SWEEP_INTERVAL_MS = 15 * 1000;
export const MAX_NAME_LENGTH = 64;
export const MAX_ID_LENGTH = 128;

const writers = new Map();
const listeners = new Set();
let reaperHandle = null;
let activeSweepHandle = null;

function clampName(name, fallback) {
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  return trimmed.length > MAX_NAME_LENGTH ? trimmed.slice(0, MAX_NAME_LENGTH) : trimmed;
}

function notify(graphId, op, writer) {
  for (const fn of listeners) {
    try { fn(graphId, op, writer); } catch {}
  }
}

function getOrCreateGraph(graphId) {
  let m = writers.get(graphId);
  if (!m) {
    m = new Map();
    writers.set(graphId, m);
  }
  return m;
}

export function announce(graphId, { id, name, type, owner_user_id } = {}) {
  if (!id || typeof id !== 'string' || id.length > MAX_ID_LENGTH) return null;
  const m = getOrCreateGraph(graphId);
  const prev = m.get(id);
  const cleanName = clampName(name, prev?.name ?? 'Anonymous');
  const cleanType = type === 'agent' ? 'agent' : 'human';
  const cleanOwner = owner_user_id ?? prev?.owner_user_id ?? null;
  const writer = {
    id,
    name: cleanName,
    type: cleanType,
    owner_user_id: cleanOwner,
    lastSeen: Date.now(),
    active: true,
  };
  m.set(id, writer);
  if (!prev) {
    notify(graphId, 'announce', writer);
  } else {
    if (prev.name !== cleanName) notify(graphId, 'rename', writer);
    if (prev.active === false) notify(graphId, 'active', writer);
    // else: silent lastSeen refresh — no UI-visible change
  }
  return writer;
}

// Implicit refresh from an actual write. If the writer is unknown to presence,
// synthesize an announce so a write counts as "I'm here." If known, bump
// lastSeen silently — unless they were idle, in which case re-broadcast as
// active so other viewers un-fade their avatar. Backfills owner_user_id if
// the existing record was anonymous and the writer has since been identified.
export function touch(graphId, writerId, name, type, owner_user_id) {
  if (!writerId) return null;
  const m = writers.get(graphId);
  const prev = m?.get(writerId);
  if (!prev) return announce(graphId, { id: writerId, name, type, owner_user_id });
  prev.lastSeen = Date.now();
  if (owner_user_id != null && prev.owner_user_id == null) {
    prev.owner_user_id = owner_user_id;
  }
  if (prev.active === false) {
    prev.active = true;
    notify(graphId, 'active', prev);
  }
  return prev;
}

export function depart(graphId, writerId) {
  const m = writers.get(graphId);
  if (!m) return false;
  const writer = m.get(writerId);
  if (!writer) return false;
  m.delete(writerId);
  if (m.size === 0) writers.delete(graphId);
  notify(graphId, 'depart', writer);
  return true;
}

export function getSnapshot(graphId) {
  const m = writers.get(graphId);
  if (!m) return [];
  return Array.from(m.values()).map((w) => ({ ...w }));
}

export function onChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reapStale(ttlMs = IDLE_TTL_MS) {
  const cutoff = Date.now() - ttlMs;
  for (const [graphId, m] of writers) {
    for (const [writerId, w] of m) {
      if (w.lastSeen < cutoff) {
        m.delete(writerId);
        notify(graphId, 'depart', w);
      }
    }
    if (m.size === 0) writers.delete(graphId);
  }
}

// Flip writers whose lastSeen is older than the active window to inactive,
// emitting one `idle` event per transition. Already-inactive writers are
// skipped. The reaper deals with full removal past IDLE_TTL_MS separately.
export function sweepActive(windowMs = ACTIVE_WINDOW_MS) {
  const cutoff = Date.now() - windowMs;
  for (const [graphId, m] of writers) {
    for (const w of m.values()) {
      if (w.active !== false && w.lastSeen < cutoff) {
        w.active = false;
        notify(graphId, 'idle', w);
      }
    }
  }
}

export function startReaper(intervalMs = REAPER_INTERVAL_MS, ttlMs = IDLE_TTL_MS) {
  if (reaperHandle) return;
  reaperHandle = setInterval(() => reapStale(ttlMs), intervalMs);
  reaperHandle.unref?.();
}

export function stopReaper() {
  if (reaperHandle) {
    clearInterval(reaperHandle);
    reaperHandle = null;
  }
}

export function startActiveSweep(
  intervalMs = ACTIVE_SWEEP_INTERVAL_MS,
  windowMs = ACTIVE_WINDOW_MS,
) {
  if (activeSweepHandle) return;
  activeSweepHandle = setInterval(() => sweepActive(windowMs), intervalMs);
  activeSweepHandle.unref?.();
}

export function stopActiveSweep() {
  if (activeSweepHandle) {
    clearInterval(activeSweepHandle);
    activeSweepHandle = null;
  }
}

// Test isolation: clears the per-graph writer state but leaves listeners
// intact. The SSE broadcast listener is registered once at app startup; tests
// that reset state between cases still expect the broadcast wiring to fire.
export function _resetForTest() {
  writers.clear();
  stopReaper();
  stopActiveSweep();
}
