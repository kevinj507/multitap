// E18.1 STEP 5 — process-local memo for graph states reconstructed from the
// event log.
//
// WHY A CACHE IS SOUND AT ALL. `seq` is allocated by `gt_next_seq()` under the
// graphs-row lock, held to commit, so the visible prefix is GAPLESS and
// commit-ordered. That makes "the state of graph G after event seq N" a value
// that can never change: no event can ever be inserted into the middle of an
// already-observed prefix. A pinned (graph, seq) is therefore genuinely
// immutable, which is also why `?asOfSeq=` is the one read on this surface that
// gets a real `Cache-Control: max-age` instead of `no-store`.
//
// WHY THE KEY IS `${graphId}:${seq}` AND NEVER `seq` ALONE. `tests/setup.js`
// runs `TRUNCATE ... RESTART IDENTITY CASCADE` before EVERY test while this
// module's state survives for the whole file. A seq-only key would hand test 2
// the answer it computed for test 1 — the two graphs both start their log at
// seq 1. The graph id is part of the identity of the value, not decoration.
//
// Ships `_resetDerivedCacheForTests()`: the house rule for any process-level
// singleton (src/auth/index.js:39, `_resetAdapterCacheForTests`).
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THE BUDGET IS BYTES AND NOT ENTRIES
//
// This cache used to hold a fixed 256 ENTRIES, on the theory that a folded
// state is "kilobytes per graph, not megabytes". That is false on real data.
// Measured against the production clone (65 graphs, 4103 tasks, 7664 edges):
// the largest graph's state is 1175 nodes + 2289 edges = 748 KB of JSON and
// retains 1.28 MB of heap. 256 of those is ~330 MB — and it is reachable from
// a plain read endpoint, by walking `?asOfSeq=` down one big graph's log.
// Measured: RSS 57.8 MB -> 399.6 MB over 256 such reads, heap 6.1 -> 295.8 MB,
// on a box with under 3 GB. So the cap has to be on SIZE.
//
// THE PROXY. `JSON.stringify(entry).length` is what is counted. Measured across
// the clone's eight busiest graphs, retained heap is 1.6x-2.1x that number —
// a tight, faithful ratio — whereas a node+edge COUNT proxy ignores exactly the
// thing that varies (long `meta.description` strings) and is what made the
// original estimate wrong in the first place. It costs 4.7 ms on the largest
// production entry against an 87 ms cache MISS (canonicalJson would cost 32 ms
// for the same number; byte-equal, since canonicalisation only reorders keys),
// so it is paid only on the miss that just did far more work.
//
// THE NUMBERS. 16 MiB of counted JSON is ~27-34 MB of retained heap at the
// measured ratio. Per graph: a quarter of that, and at most 16 entries, so one
// big graph scrubbing a timeline slider cannot evict every other graph or own
// the whole budget. MAX_ENTRIES stays as a belt-and-braces ceiling for the
// opposite shape — a flood of tiny states, which cost Map overhead the byte
// count does not see.
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_BYTES_PER_GRAPH = MAX_BYTES / 4;
const MAX_ENTRIES = 256;
const MAX_ENTRIES_PER_GRAPH = 16;

// key -> {graphId, value, bytes}. Insertion-ordered, and read re-inserts, so
// the iterator yields least-recently-used first.
const cache = new Map();
// graphId -> {entries, bytes}. Kept in lockstep with `cache` by `remove()`;
// without it the per-graph caps would need a full scan on every write.
const perGraph = new Map();
let totalBytes = 0;
let hits = 0;
let misses = 0;
// Set calls declined because one entry exceeded a whole graph's allowance, and
// the graph ids already warned about. See setDerived().
let oversized = 0;
const warnedOversized = new Set();

export function derivedCacheKey(graphId, seq) {
  return `${graphId}:${seq}`;
}

// A cache that throws is worse than a cache that mis-sizes one entry, and this
// runs on a read path. Anything JSON.stringify cannot handle (it cannot here —
// the fold emits plain data) falls back to a deliberately pessimistic guess so
// the entry still counts against the budget rather than becoming invisible.
function sizeOf(value) {
  try {
    const json = JSON.stringify(value);
    return typeof json === 'string' ? json.length : MAX_BYTES_PER_GRAPH;
  } catch {
    return MAX_BYTES_PER_GRAPH;
  }
}

function remove(key) {
  const entry = cache.get(key);
  if (entry === undefined) return;
  cache.delete(key);
  totalBytes -= entry.bytes;
  const g = perGraph.get(entry.graphId);
  if (g) {
    g.entries -= 1;
    g.bytes -= entry.bytes;
    if (g.entries <= 0) perGraph.delete(entry.graphId);
  }
}

// The least-recently-used key, optionally restricted to one graph, never the
// entry we just wrote (which would make a write a no-op at the budget edge).
function oldestKey(graphId, exclude) {
  for (const [key, entry] of cache) {
    if (key === exclude) continue;
    if (graphId !== null && entry.graphId !== graphId) continue;
    return key;
  }
  return null;
}

// Returns the stored value or `undefined`. The value is shared, not copied:
// callers MUST treat it as read-only. Everything that consumes it
// (`foldEvents`, `toGraphPayload`) is pure and returns new objects, so this is
// a contract rather than a hazard.
export function getDerived(graphId, seq) {
  const key = derivedCacheKey(graphId, seq);
  const entry = cache.get(key);
  if (entry === undefined) {
    misses += 1;
    return undefined;
  }
  // Re-insert to move it to the young end of the Map's insertion order.
  cache.delete(key);
  cache.set(key, entry);
  hits += 1;
  return entry.value;
}

export function setDerived(graphId, seq, value) {
  const key = derivedCacheKey(graphId, seq);
  remove(key);

  const bytes = sizeOf(value);
  // One entry bigger than a whole graph's allowance is not cacheable at any
  // budget: storing it would evict everything else and still be over. Return
  // the value uncached — the caller already has it, this is a memo, not a store.
  //
  // DECLINING IS CORRECT; BEING SILENT WAS NOT. The failure mode this shape has
  // is that the memo stops memoising and nothing says so: /frontier's
  // verification-checks entry is ~72 bytes per check, so it crosses the 4 MiB
  // per-graph allowance at roughly 58 000 checks (measured: 32 576 cached,
  // 57 000 declined) and from then on EVERY call re-derives from the log at full
  // cost, indistinguishable from a cold process. Raising the budget only moves
  // the cliff; what was missing is the signal. So: count it, and say it once per
  // graph — the graph id is what an operator needs to find the entry that grew.
  //
  // Note this does NOT interact with the narrowed VERIFY_EVENTS_SQL projection:
  // what is cached is the folded-down `checks` array, never the event payloads,
  // so shrinking the rows read from the database does not move this ceiling.
  if (bytes > MAX_BYTES_PER_GRAPH) {
    oversized += 1;
    if (!warnedOversized.has(graphId)) {
      warnedOversized.add(graphId);
      console.error(`[derived-cache] entry for graph ${graphId} is ${bytes} bytes,`
        + ` over the ${MAX_BYTES_PER_GRAPH}-byte per-graph budget — NOT cached;`
        + ' this value will be re-derived on every request until it shrinks');
    }
    return value;
  }

  cache.set(key, { graphId, value, bytes });
  totalBytes += bytes;
  const g = perGraph.get(graphId) ?? { entries: 0, bytes: 0 };
  g.entries += 1;
  g.bytes += bytes;
  perGraph.set(graphId, g);

  while (g.entries > MAX_ENTRIES_PER_GRAPH || g.bytes > MAX_BYTES_PER_GRAPH) {
    const victim = oldestKey(graphId, key);
    if (victim === null) break;
    remove(victim);
  }
  while (cache.size > MAX_ENTRIES || totalBytes > MAX_BYTES) {
    const victim = oldestKey(null, key);
    if (victim === null) break;
    remove(victim);
  }
  return value;
}

// Drop everything for one graph. Nothing in E18.1 needs it — a (graph, seq)
// entry is immutable — but rotate-id moves a graph's log to a NEW id, and a
// future consumer that caches under the old id will want this.
export function dropDerivedForGraph(graphId) {
  for (const [key, entry] of [...cache]) {
    if (entry.graphId === graphId) remove(key);
  }
}

export function _resetDerivedCacheForTests() {
  cache.clear();
  perGraph.clear();
  warnedOversized.clear();
  totalBytes = 0;
  hits = 0;
  misses = 0;
  oversized = 0;
}

export function _derivedCacheStats() {
  return { size: cache.size, bytes: totalBytes, hits, misses, oversized };
}

export const _derivedCacheLimits = Object.freeze({
  MAX_BYTES,
  MAX_BYTES_PER_GRAPH,
  MAX_ENTRIES,
  MAX_ENTRIES_PER_GRAPH,
});
