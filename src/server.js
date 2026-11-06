import app from './app.js';
import pool, { applySchema } from './db.js';
import { backfillGenesisAll } from './events/snapshot.js';
import { createSnapshotter } from './events/snapshotter.js';
import { configFromEnv } from './search/config.js';
import { createEmbeddingProvider } from './search/providers/embedding.js';
import { createChunkIndexer } from './search/indexer.js';
import { warmupDefaultService } from './routes/search.js';

const PORT = Number(process.env.PORT) || 3000;

// Apply (idempotent) schema before accepting connections. Catches schema
// drift on every restart — no more "users table missing" 500s after a
// Phase B deploy that forgot the `psql -f db/schema.sql` step.
try {
  await applySchema(pool);
  console.log('multitap schema applied');
} catch (err) {
  console.error('multitap schema apply failed —', err.message);
  process.exit(1);
}

// E18.1 — seq-0 genesis for the graphs that predate the event log. Graphs
// created from here on are covered STRUCTURALLY by the gt_seed_genesis trigger
// (a new graph has no rows, so its substrate is the empty state), so this finds
// nothing to do on every boot after the first.
//
// DELIBERATELY NOT IN db/schema.sql, and deliberately NOT fatal. schema.sql is
// applied as ONE transaction and a throw there process.exit(1)s the server
// above; the genesis state must be canonicalised by the same JS function the
// fold uses (Postgres orders jsonb keys by (length, bytes) and would hash
// differently); and DML in schema.sql is the actorless, untestable thing this
// epic exists to stop adding to.
//
// A graph that fails here still answers `?asOf` — it falls back to
// `base.kind: 'empty'` and replays from seq 1, which is exact for everything
// the log has seen and an approximation only for pre-log rows. Awaited (unlike
// the indexer below) because it is bounded and cheap — measured against the
// live database: 65 graphs, 4103 tasks, 7664 edges, no bodies stored — and
// because a `?asOf` served before it finishes would report a base it is about
// to gain.
try {
  const t0 = performance.now();
  const res = await backfillGenesisAll(pool, { log: (m) => console.error(`[events] ${m}`) });
  if (res.written || res.failed) {
    console.log(
      `[events] genesis backfill — ${res.written} written, ${res.skipped} skipped` +
        (res.failed ? `, ${res.failed} FAILED` : '') +
        ` in ${Math.round(performance.now() - t0)}ms`,
    );
  }
} catch (err) {
  // LOG AND CONTINUE. Never process.exit: the log is already complete from the
  // moment the triggers exist, and a missing genesis costs accuracy about
  // pre-log history, not correctness about anything since.
  console.error('[events] genesis backfill failed —', err.message);
}

// E18.1 — periodic snapshots. A third consumer of the graph_change LISTEN bus
// (after src/sse.js and the search indexer), started HERE and not in app.js so
// that the ~30 test files importing app.js never open a LISTEN client. Not
// awaited: a snapshot is a cache, and `?asOf` answers identically without one.
try {
  const snapshotter = createSnapshotter({ pool });
  snapshotter.start().catch((err) => {
    console.error('[snapshots] failed to start —', err.message);
  });
} catch (err) {
  console.error('[snapshots] not started —', err.message);
}

// Semantic-search indexer (#190 write path): with an embedding backend
// configured, keep task_chunks in step with tasks — LISTEN on the graph_change
// trigger + a boot backfill. Deliberately NOT awaited: model warm-up and the
// first backfill can take seconds and the server must serve immediately
// (lexical search answers regardless; dense fills in as the store catches up).
try {
  const provider = createEmbeddingProvider(configFromEnv().providers.embedding);
  if (provider) {
    // EMBED_TASKS_PER_PASS (default 1): how many queued tasks to embed in one
    // provider.embed() call. Raise it on parallel/remote embedding backends
    // (GPU, Modal/TEI) for throughput; default 1 is the original behavior and a
    // no-op on the in-process CPU backend. (E14.3)
    const tasksPerPass = Number(process.env.EMBED_TASKS_PER_PASS) || 1;
    const indexer = createChunkIndexer({ pool, provider, tasksPerPass });
    indexer.start().catch((err) => {
      console.error('[search-index] failed to start —', err.message);
    });
  }
} catch (err) {
  console.error('[search-index] not started —', err.message);
}

// Warm the search models off the request path (not awaited — same rationale as
// the indexer above: the server must serve immediately; lexical answers while
// the dense/rerank weights load).
const warmT0 = performance.now();
warmupDefaultService()
  .then(() => console.log(`[search-warmup] models warm in ${Math.round(performance.now() - warmT0)}ms`))
  .catch((err) => console.error('[search-warmup] failed —', err.message));

// Bind address. Loopback by default (the hosted wafer fronts the app with its
// own gateway); set HOST=0.0.0.0 where the app is the whole container.
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`multitap running on ${HOST}:${PORT}`);
});
