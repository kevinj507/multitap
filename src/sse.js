// Server-sent events backed by a single Postgres LISTEN connection.
// Triggers in the schema fire `pg_notify('graph_change', { graph_id, kind,
// op })` on every task/edge insert/update/delete; we fan those out to any
// browser subscribed to that graph's /events endpoint.
import pg from 'pg';

const subscribers = new Map(); // graphId → Set<Response>
let listenClient = null;
let restartPending = false;

// Cap concurrent SSE connections to stay safely below the process fd ceiling
// (10240 on the wafer image). Each connection holds one fd; we leave ~2K for
// Postgres connections, static file handlers, and general HTTP overhead.
// Override with SSE_MAX_CONNECTIONS env var if you raise the OS-level limit.
const MAX_CONNECTIONS = Number(process.env.SSE_MAX_CONNECTIONS) || 8888;
let activeConnections = 0;

export function tryReserveSlot() {
  if (activeConnections >= MAX_CONNECTIONS) return false;
  activeConnections++;
  return true;
}

export function releaseSlot() {
  if (activeConnections > 0) activeConnections--;
}

export function getActiveConnectionCount() {
  return activeConnections;
}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const bootstrap = process.env.PG_BOOTSTRAP_URL;
  const dbName = process.env.DATABASE_NAME;
  if (bootstrap && dbName) {
    const u = new URL(bootstrap);
    u.pathname = `/${dbName}`;
    return u.toString();
  }
  return 'postgresql://postgres@localhost/multitap';
}

async function startListener() {
  if (listenClient) return;
  const client = new pg.Client({ connectionString: getConnectionString() });

  client.on('notification', (msg) => {
    if (msg.channel !== 'graph_change' || !msg.payload) return;
    let payload;
    try { payload = JSON.parse(msg.payload); } catch { return; }
    const set = subscribers.get(payload.graph_id);
    if (!set || set.size === 0) return;
    const frame = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) {
      try { res.write(frame); } catch {}
    }
  });

  // Reconnect on any drop. The browser EventSource will also reconnect, so
  // we just need the LISTEN side to come back.
  client.on('error', (err) => {
    console.error('[sse] listen client error:', err.message);
    listenClient = null;
    if (!restartPending) {
      restartPending = true;
      setTimeout(() => {
        restartPending = false;
        startListener().catch((e) => console.error('[sse] reconnect failed:', e.message));
      }, 2000);
    }
  });

  await client.connect();
  await client.query('LISTEN graph_change');
  listenClient = client;
  console.log('[sse] listening on graph_change');
}

export function startSse() {
  startListener().catch((err) => {
    console.error('[sse] failed to start listener:', err.message);
  });
}

export function subscribe(graphId, res) {
  let set = subscribers.get(graphId);
  if (!set) {
    set = new Set();
    subscribers.set(graphId, set);
  }
  set.add(res);
}

export function unsubscribe(graphId, res) {
  const set = subscribers.get(graphId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) subscribers.delete(graphId);
}

// Push a non-Postgres event to every browser subscribed to this graph.
// Used by the presence module (in-memory, not DB-backed) to broadcast
// announce/depart/rename, and by membership-change routes (graph_members
// has no DB trigger). Payload is sent as the JSON body of one SSE frame.
export function broadcastGraphEvent(graphId, payload) {
  const set = subscribers.get(graphId);
  if (!set || set.size === 0) return;
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(frame); } catch {}
  }
}
export { broadcastGraphEvent as broadcastPresence };
