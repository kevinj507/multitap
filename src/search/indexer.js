// Chunk indexer — keeps `task_chunks` in step with `tasks` (graph task #190
// write path). Rides the SAME Postgres trigger the SSE fanout uses: every
// task INSERT/UPDATE/DELETE fires pg_notify('graph_change', {graph_id, kind,
// op, id}), so listening here catches EVERY write path (route PATCH, merge
// resolution, future bulk imports) with zero added request latency — the
// "updated_at trigger" variant #190 sanctioned, already wired.
//
// Shape: a dedup'd queue drained serially. Serial because embedding is the
// bottleneck and (local-onnx) runs on this process's CPU; a per-task SHA check
// at processing time (store.syncTask) makes redundant wakeups cheap. DELETEs
// are ignored — the task_chunks FK CASCADE already cleaned up.
//
// Boot does: probe-embed (resolves the model's dim + warms it) →
// ensureStoreVersion (model/dim index versioning) → LISTEN → backfill. If the
// store is absent (Postgres without pgvector) the indexer logs once and stays
// off; search still answers via the in-memory dense leg.

import pg from 'pg';
import { resolveConnectionString } from '../db.js';
import { chunkStoreAvailable, ensureStoreVersion, syncTasks, syncAll } from './store.js';

const RECONNECT_DELAY_MS = 2000;

/**
 * @param {{pool:Object, provider:import('./types.js').EmbeddingProvider,
 *          connectionString?:string, log?:Function}} opts
 */
export function createChunkIndexer({ pool, provider, connectionString, log, tasksPerPass } = {}) {
  if (!pool) throw new Error('createChunkIndexer needs a pool');
  if (!provider) throw new Error('createChunkIndexer needs an EmbeddingProvider');
  const say = log || ((msg) => console.log(`[search-index] ${msg}`));
  // How many queued tasks to embed in ONE provider.embed() call (E14.3).
  // Default 1 = one task per call (the original behavior). Operators on
  // parallel/remote embedding backends raise EMBED_TASKS_PER_PASS for
  // throughput; on an in-process CPU backend it makes no difference.
  const perPass = Math.max(1, Number(tasksPerPass) || 1);

  const queue = new Set(); // task ids pending (re)index — Set dedupes bursts
  let draining = null; // in-flight drain promise (also the tests' settle hook)
  let listenClient = null;
  let stopped = false;

  function drain() {
    if (draining) return draining;
    draining = (async () => {
      while (queue.size > 0 && !stopped) {
        // Pull up to perPass ids for one (possibly batched) embed pass.
        const batch = [];
        for (const id of queue) {
          batch.push(id);
          if (batch.length >= perPass) break;
        }
        for (const id of batch) queue.delete(id);
        try {
          // syncTasks is failure-isolated: it never throws for a single poison
          // task (falls back to per-task), so one bad task can't wedge the
          // queue. We log any per-task failures it reports.
          const results = await syncTasks(pool, provider, batch);
          for (const r of results) {
            if (r.status === 'failed') say(`reindex of task ${r.id} failed — ${r.error}`);
          }
        } catch (err) {
          // Defensive: should not happen, but a surprise must not wedge the queue.
          say(`reindex batch [${batch.join(',')}] failed — ${err.message}`);
        }
      }
      draining = null;
    })();
    return draining;
  }

  function enqueue(taskId) {
    const id = Number(taskId);
    if (!Number.isInteger(id)) return;
    queue.add(id);
    drain();
  }

  async function startListener() {
    if (listenClient || stopped) return;
    const client = new pg.Client({
      connectionString: connectionString || resolveConnectionString(),
    });

    client.on('notification', (msg) => {
      if (msg.channel !== 'graph_change' || !msg.payload) return;
      let payload;
      try { payload = JSON.parse(msg.payload); } catch { return; }
      // Only task content changes need re-embedding; edge writes don't touch
      // chunk text, and DELETE is handled by the FK CASCADE.
      if (payload.kind !== 'tasks' || payload.op === 'DELETE') return;
      enqueue(payload.id);
    });

    // Same reconnect posture as src/sse.js: the LISTEN side just needs to come
    // back; anything missed while down is caught by the next boot's backfill
    // (and usually sooner, by the SHA-stale scan being cheap to re-run).
    client.on('error', (err) => {
      say(`listen client error: ${err.message}`);
      listenClient = null;
      if (!stopped) setTimeout(() => startListener().catch(() => {}), RECONNECT_DELAY_MS);
    });

    await client.connect();
    await client.query('LISTEN graph_change');
    listenClient = client;
  }

  return {
    enqueue,

    /** Resolves when the queue is fully drained — deterministic tests. */
    async idle() {
      while (draining) await draining;
    },

    /**
     * Bring the store online. Returns false (and logs why) when the store
     * can't run here; throws only on unexpected errors.
     * @param {{listen?:boolean, backfill?:boolean}} [opts] tests disable either half
     */
    async start({ listen = true, backfill = true } = {}) {
      if (!(await chunkStoreAvailable(pool))) {
        say('task_chunks not present (pgvector missing) — dense search will run in-memory');
        return false;
      }
      // Resolve the model's dim (lazily learned by both provider backends) and
      // warm the model before any task waits on it.
      await provider.embed(['multitap index warmup']);
      const { resized } = await ensureStoreVersion(pool, provider);
      if (resized) say(`store re-typed to halfvec(${provider.dim}) for ${provider.modelId}`);

      if (listen) await startListener();

      if (backfill) {
        const res = await syncAll(pool, provider, { log: (m) => say(`backfill: ${m}`) });
        say(
          `backfill done — ${res.indexed} indexed, ${res.skipped} unchanged` +
            (res.failed ? `, ${res.failed} FAILED` : ''),
        );
      }
      return true;
    },

    async stop() {
      stopped = true;
      queue.clear();
      if (listenClient) {
        const c = listenClient;
        listenClient = null;
        try { await c.end(); } catch {}
      }
      while (draining) await draining;
    },
  };
}

export default { createChunkIndexer };
