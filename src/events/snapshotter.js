// E18.1 STEP 7 — the background snapshotter.
//
// A THIRD consumer of the existing `graph_change` LISTEN bus, after src/sse.js
// (SSE fan-out) and src/search/indexer.js (chunk re-embedding). Same shape as
// the indexer, deliberately: a dedup'd `Set` queue drained serially, one
// dedicated pg.Client, a 2000 ms reconnect timer.
//
// WHY IT RIDES THE EXISTING BUS AND ADDS NO pg_notify OF ITS OWN.
// `bump_graph_updated_at()` already fires `pg_notify('graph_change', …)` on
// every task/edge row write, which is exactly the set of writes that append
// events. A `/batch` of 1500 rows therefore already emits 1500 notifications;
// adding a per-event notify would double a load that is already the dominant
// cost of a bulk import, for information this consumer does not need — it only
// needs to know THAT a graph moved, and the Set collapses 1500 of those into
// one unit of work.
//
// WHY IT IS STARTED FROM server.js AND NOT app.js. `src/app.js` is imported by
// every route test in the suite. Opening a LISTEN client there would leave a
// live connection (and a reconnect timer) behind in ~30 test files, which is
// both a resource leak and a source of "worker process failed to exit"
// flakiness. server.js is the process boundary; that is where background work
// belongs.
//
// COST INSIDE A USER TRANSACTION: ZERO. Nothing here runs on a request path.
// No write-on-GET, no snapshot built while a caller waits, and — the locked
// decision — no write of any kind back to `tasks` or `edges`. The snapshotter
// is read-only against the graph; its only writes are to `graph_snapshots`,
// which is pure cache.
//
// FAILURE POSTURE. A snapshot is an optimisation: without one, `?asOf` replays
// from genesis and returns the same answer, only slower. So every error here is
// logged and swallowed. Nothing the snapshotter can do should ever be able to
// break a read, let alone a write.

import pg from 'pg';
import { resolveConnectionString } from '../db.js';
import { maybeSnapshot } from './snapshot.js';

const RECONNECT_DELAY_MS = 2000;

/**
 * @param {{pool:Object, connectionString?:string, log?:Function, interval?:number,
 *          reconnectDelay?:number}} opts
 */
export function createSnapshotter({ pool, connectionString, log, interval, reconnectDelay } = {}) {
  if (!pool) throw new Error('createSnapshotter needs a pool');
  const say = log || ((msg) => console.log(`[snapshots] ${msg}`));
  const retryAfter =
    Number.isFinite(reconnectDelay) && reconnectDelay >= 0 ? Number(reconnectDelay) : RECONNECT_DELAY_MS;

  const queue = new Set(); // graph ids pending a checkpoint pass — Set dedupes bursts
  let draining = null; // in-flight drain promise (also the tests' settle hook)
  let listenClient = null;
  let restartTimer = null; // the in-flight-reconnect guard — see scheduleRestart
  let stopped = false;

  function drain() {
    if (draining) return draining;
    draining = (async () => {
      while (queue.size > 0 && !stopped) {
        const graphId = queue.values().next().value;
        queue.delete(graphId);
        try {
          const res = await maybeSnapshot(pool, graphId, { interval });
          if (res.repaired) say(`${graphId}: periodic snapshots failed verification — rebuilt`);
          if (res.written.length) {
            say(`${graphId}: snapshot at seq ${res.written.join(', ')}`);
          }
        } catch (err) {
          // Swallowed on purpose — see the failure posture note in the header.
          say(`${graphId}: snapshot pass failed — ${err.message}`);
        }
      }
      draining = null;
    })();
    return draining;
  }

  function enqueue(graphId) {
    if (typeof graphId !== 'string' || graphId === '') return;
    queue.add(graphId);
    drain();
  }

  // At most ONE pending reconnect, cancellable by stop(). A retry that fails is
  // logged and re-armed: the listener must survive a Postgres restart that
  // outlasts a single attempt (a deploy), not just a transient drop.
  function scheduleRestart() {
    if (stopped || restartTimer) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      startListener().catch((err) => {
        say(`listen reconnect failed: ${err.message}`);
        scheduleRestart();
      });
    }, retryAfter);
    // The HTTP server keeps the process alive; this timer should not.
    if (typeof restartTimer.unref === 'function') restartTimer.unref();
  }

  async function startListener() {
    if (listenClient || stopped) return;
    const client = new pg.Client({
      connectionString: connectionString || resolveConnectionString(),
    });

    client.on('notification', (msg) => {
      if (msg.channel !== 'graph_change' || !msg.payload) return;
      let payload;
      try {
        payload = JSON.parse(msg.payload);
      } catch {
        return;
      }
      // Every op counts, DELETE included: a node.removed is as much a state
      // change as a node.created, and `maybeSnapshot` is a no-op unless the
      // head has crossed a checkpoint anyway.
      enqueue(payload.graph_id);
    });

    // Same reconnect posture as src/sse.js and the search indexer. Anything
    // missed while the listener is down costs nothing permanent: the next
    // notification for that graph rebuilds every checkpoint the log has grown
    // past, because checkpoints are a deterministic function of (graph, seq)
    // rather than of when the notification arrived.
    //
    // ONE reconnect per drop, and the dead socket is closed rather than left to
    // the GC. node-postgres emits 'error' TWICE for a single dropped connection
    // ('terminating connection due to administrator command' from the backend,
    // then 'Connection terminated unexpectedly' from the socket), so an
    // unguarded handler schedules two reconnects and the client count doubles
    // on every drop — measured 1 → 2 → 4 against a real server, with three
    // connections still live after stop(). `dead` collapses the pair; the
    // shared `restartTimer` (src/sse.js's `restartPending`, in a form stop()
    // can also cancel) collapses anything that gets past it.
    let dead = false;
    client.on('error', (err) => {
      if (dead) return;
      dead = true;
      say(`listen client error: ${err.message}`);
      if (listenClient === client) listenClient = null;
      client.end().catch(() => {});
      scheduleRestart();
    });

    await client.connect();
    // stop() may have run while the connect was in flight; without this the new
    // client is never tracked and never closed.
    if (stopped) {
      await client.end().catch(() => {});
      return;
    }
    await client.query('LISTEN graph_change');
    listenClient = client;
  }

  return {
    enqueue,

    /** Resolves when the queue is fully drained — deterministic tests. */
    async idle() {
      while (draining) await draining;
    },

    /** @param {{listen?:boolean}} [opts] tests drive `enqueue` directly instead */
    async start({ listen = true } = {}) {
      if (listen) {
        try {
          await startListener();
        } catch (err) {
          // A Postgres that is not up yet (a deploy restarting it under us) must
          // not leave the snapshotter dead for the life of the process. The
          // caller still sees the first failure — src/server.js logs it.
          scheduleRestart();
          throw err;
        }
      }
      return true;
    },

    async stop() {
      stopped = true;
      queue.clear();
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      if (listenClient) {
        const c = listenClient;
        listenClient = null;
        try {
          await c.end();
        } catch {
          /* already gone */
        }
      }
      while (draining) await draining;
    },
  };
}

export default { createSnapshotter };
