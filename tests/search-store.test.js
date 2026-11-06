// pgvector chunk store + indexer + store-backed dense retriever (#190 P2.2,
// the production half). Covers the spec's test list: skip-on-unchanged,
// re-chunk replaces old chunks (no orphans), collapse keeps best-per-node,
// graph_id scope filter, and the fallback paths. Runs against the real test
// Postgres — the schema's guarded migration created task_chunks there (the
// test DB ships pgvector), so these exercise the actual halfvec/HNSW SQL.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { contentSha } from '../src/search/chunking.js';
import {
  chunkStoreAvailable,
  ensureStoreVersion,
  syncTask,
  syncTasks,
  syncAll,
  annSearchChunks,
} from '../src/search/store.js';
import { createStoreDenseRetriever } from '../src/search/retrievers/dense.js';
import { createChunkIndexer } from '../src/search/indexer.js';
import { SearchService } from '../src/search/service.js';

let pool;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_URL;
  pool = getTestPool();
});

// Deterministic embedding: 4 keyword dimensions, count occurrences in the
// text, L2-normalize. Texts about the same keyword are cosine-close; no model.
const VOCAB = ['alpha', 'beta', 'gamma', 'delta'];
function keywordVector(text) {
  const t = (text || '').toLowerCase();
  const v = VOCAB.map((w) => (t.match(new RegExp(w, 'g')) || []).length);
  const norm = Math.hypot(...v);
  return norm === 0 ? v : v.map((x) => x / norm);
}
function fakeProvider({ modelId = 'fake-kw', dim = 4 } = {}) {
  return {
    modelId,
    dim,
    embed: vi.fn(async (texts) => texts.map(keywordVector)),
  };
}

async function makeGraph() {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('t') RETURNING id");
  return g.rows[0].id;
}
async function makeTask(gid, title, body) {
  const content = `---\ntitle: ${title}\nstatus: todo\n---\n${body}`;
  const meta = JSON.stringify({ title, status: 'todo' });
  const r = await pool.query(
    'INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id, content',
    [gid, content, meta],
  );
  return r.rows[0];
}
async function chunkRows(taskId) {
  const r = await pool.query(
    'SELECT chunk_index, chunk_text, content_sha, embedding_model FROM task_chunks WHERE task_id = $1 ORDER BY chunk_index',
    [taskId],
  );
  return r.rows;
}

// The test DB applies db/schema.sql against a pgvector-enabled Postgres, so
// the guarded migration must have created the store. The suite below assumes
// it; fail loudly here if the environment regressed.
describe('store availability', () => {
  it('task_chunks exists on the test database', async () => {
    expect(await chunkStoreAvailable(pool)).toBe(true);
  });
});

describe('ensureStoreVersion — model/dim index versioning', () => {
  it('re-types the embedding column to the provider dim and rebuilds the index', async () => {
    await ensureStoreVersion(pool, fakeProvider({ dim: 4 }));
    const { rows } = await pool.query(
      `SELECT atttypmod AS dim FROM pg_attribute
        WHERE attrelid = 'task_chunks'::regclass AND attname = 'embedding'`,
    );
    expect(rows[0].dim).toBe(4);
    const idx = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname = 'task_chunks_embedding_idx'",
    );
    expect(idx.rows[0].indexdef).toContain('hnsw');
  });

  it('purges rows from a different model (same dim) so spaces never mix', async () => {
    const gid = await makeGraph();
    const task = await makeTask(gid, 'Alpha', 'alpha alpha');
    const a = fakeProvider({ modelId: 'model-a' });
    await ensureStoreVersion(pool, a);
    await syncTask(pool, a, task.id);
    expect(await chunkRows(task.id)).not.toHaveLength(0);

    await ensureStoreVersion(pool, fakeProvider({ modelId: 'model-b' }));
    expect(await chunkRows(task.id)).toHaveLength(0);
  });
});

describe('syncTask — the write path', () => {
  let gid;
  let provider;
  beforeEach(async () => {
    gid = await makeGraph();
    provider = fakeProvider();
    await ensureStoreVersion(pool, provider);
  });

  it('indexes a task into title-prefixed chunks with sha + model stamped', async () => {
    const task = await makeTask(gid, 'Alpha note', 'alpha content here');
    const res = await syncTask(pool, provider, task.id);
    expect(res.status).toBe('indexed');

    const rows = await chunkRows(task.id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].chunk_index).toBe(0);
    expect(rows[0].content_sha).toBe(contentSha(task.content));
    expect(rows[0].embedding_model).toBe('fake-kw');
    // What hit the model is the title-prefixed embedText, not the raw passage.
    expect(provider.embed.mock.calls[0][0][0]).toContain('Alpha note');
  });

  it('skips when content is unchanged (no re-embed)', async () => {
    const task = await makeTask(gid, 'Alpha', 'alpha');
    await syncTask(pool, provider, task.id);
    const embedCalls = provider.embed.mock.calls.length;

    const res = await syncTask(pool, provider, task.id);
    expect(res.status).toBe('skipped');
    expect(provider.embed.mock.calls.length).toBe(embedCalls); // SHA-skip: zero embeds
  });

  it('re-chunks on content change, replacing old chunks with no orphans', async () => {
    const task = await makeTask(gid, 'Alpha', '## one\nalpha\n\n## two\nalpha\n\n## three\nalpha');
    await syncTask(pool, provider, task.id);
    expect((await chunkRows(task.id)).length).toBe(3);

    const newContent = `---\ntitle: Alpha\nstatus: todo\n---\nbeta only now`;
    await pool.query('UPDATE tasks SET content = $1 WHERE id = $2', [newContent, task.id]);
    const res = await syncTask(pool, provider, task.id);
    expect(res.status).toBe('indexed');

    const rows = await chunkRows(task.id);
    expect(rows).toHaveLength(1); // old 3 gone, exactly the new chunk remains
    expect(rows[0].chunk_text).toBe('beta only now');
    expect(rows[0].content_sha).toBe(contentSha(newContent));
  });

  it('reports gone for a deleted task; FK CASCADE removed its chunks', async () => {
    const task = await makeTask(gid, 'Alpha', 'alpha');
    await syncTask(pool, provider, task.id);
    await pool.query('DELETE FROM tasks WHERE id = $1', [task.id]);
    expect(await chunkRows(task.id)).toHaveLength(0); // CASCADE
    expect((await syncTask(pool, provider, task.id)).status).toBe('gone');
  });
});

describe('syncAll — backfill / catch-up', () => {
  it('indexes missing tasks, skips fresh ones', async () => {
    const gid = await makeGraph();
    const provider = fakeProvider();
    await ensureStoreVersion(pool, provider);

    const t1 = await makeTask(gid, 'Alpha', 'alpha');
    await syncTask(pool, provider, t1.id); // fresh
    await makeTask(gid, 'Beta', 'beta'); // missing
    const t3 = await makeTask(gid, 'Gamma', 'gamma'); // stale
    await syncTask(pool, provider, t3.id);
    await pool.query("UPDATE tasks SET content = content || ' delta' WHERE id = $1", [t3.id]);

    const res = await syncAll(pool, provider);
    expect(res).toMatchObject({ indexed: 2, skipped: 1, failed: 0 });
  });
});

describe('annSearchChunks — scope + ordering', () => {
  it('only returns chunks from the requested graph and model space', async () => {
    const provider = fakeProvider();
    await ensureStoreVersion(pool, provider);
    const gidA = await makeGraph();
    const gidB = await makeGraph();
    const inA = await makeTask(gidA, 'Alpha A', 'alpha');
    const inB = await makeTask(gidB, 'Alpha B', 'alpha'); // same content, other graph
    await syncTask(pool, provider, inA.id);
    await syncTask(pool, provider, inB.id);

    const rows = await annSearchChunks(pool, {
      vector: keywordVector('alpha'),
      gid: gidA,
      modelId: provider.modelId,
      limit: 10,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.task_id === inA.id)).toBe(true);

    const wrongModel = await annSearchChunks(pool, {
      vector: keywordVector('alpha'),
      gid: gidA,
      modelId: 'other-model',
      limit: 10,
    });
    expect(wrongModel).toHaveLength(0);
  });

  it('orders nearest-first', async () => {
    const provider = fakeProvider();
    await ensureStoreVersion(pool, provider);
    const gid = await makeGraph();
    const hit = await makeTask(gid, 'Alpha', 'alpha alpha alpha');
    const mixed = await makeTask(gid, 'Mixed', 'alpha beta beta');
    const miss = await makeTask(gid, 'Gamma', 'gamma');
    for (const t of [hit, mixed, miss]) await syncTask(pool, provider, t.id);

    const rows = await annSearchChunks(pool, {
      vector: keywordVector('alpha'),
      gid,
      modelId: provider.modelId,
      limit: 10,
    });
    const order = [...new Set(rows.map((r) => r.task_id))];
    expect(order[0]).toBe(hit.id);
    expect(order[1]).toBe(mixed.id);
  });
});

describe('createStoreDenseRetriever — query path', () => {
  let gid;
  let provider;
  beforeEach(async () => {
    gid = await makeGraph();
    provider = fakeProvider();
    await ensureStoreVersion(pool, provider);
  });

  it('collapses chunks to nodes by max-pool, winning passage as snippet', async () => {
    // One node, two sections: only section two matches the query.
    const task = await makeTask(gid, 'Doc', '## one\ngamma stuff\n\n## two\nalpha payload');
    await syncTask(pool, provider, task.id);

    const dense = createStoreDenseRetriever({ pool, provider });
    const out = await dense.retrieve('alpha', { gid, corpusFromStore: true });
    expect(out).toHaveLength(1); // two chunks → ONE candidate
    expect(out[0].taskId).toBe(task.id);
    expect(out[0].source).toBe('dense');
    expect(out[0].snippet.text).toContain('alpha payload'); // strongest passage carried
    expect(out[0].meta.similarity).toBeGreaterThan(0.5);
  });

  it('ranks store-backed results nearest-first across nodes', async () => {
    const hit = await makeTask(gid, 'Alpha', 'alpha alpha');
    const near = await makeTask(gid, 'Mixed', 'alpha beta');
    const far = await makeTask(gid, 'Delta', 'delta');
    for (const t of [hit, near, far]) await syncTask(pool, provider, t.id);

    const dense = createStoreDenseRetriever({ pool, provider });
    const out = await dense.retrieve('alpha', { gid, corpusFromStore: true });
    expect(out.map((c) => c.taskId).slice(0, 2)).toEqual([hit.id, near.id]);
  });

  it('falls back to in-memory for a caller-supplied corpus (eval path)', async () => {
    // Store has NOTHING for these docs; ranking must come from the corpus.
    const dense = createStoreDenseRetriever({ pool, provider });
    const out = await dense.retrieve('alpha', {
      corpus: [{ id: 7, title: '', description: '', body: 'alpha' }],
      // no gid, no corpusFromStore — the eval's shape
    });
    expect(out.map((c) => c.taskId)).toEqual([7]);
  });

  it('falls back to in-memory when the store has no rows for the graph yet', async () => {
    const task = await makeTask(gid, 'Alpha', 'alpha'); // never synced
    const dense = createStoreDenseRetriever({ pool, provider });
    const out = await dense.retrieve('alpha', {
      gid,
      corpusFromStore: true,
      corpus: [{ id: task.id, title: 'Alpha', description: '', body: 'alpha' }],
    });
    expect(out.map((c) => c.taskId)).toEqual([task.id]); // answered despite empty store
  });
});

describe('SearchService — store-backed end to end', () => {
  it('fuses store-backed dense with lexical through the real pipeline', async () => {
    const provider = fakeProvider();
    await ensureStoreVersion(pool, provider);
    const gid = await makeGraph();
    const task = await makeTask(gid, 'Alpha doc', 'alpha alpha');
    await makeTask(gid, 'Delta doc', 'delta');
    await syncAll(pool, provider);

    const service = new SearchService({
      config: { retrievers: ['lexical', 'dense'] },
      pool,
      deps: { embeddingProvider: provider },
    });
    const { candidates, timings } = await service.search('alpha', { gid });
    expect(candidates[0].taskId).toBe(task.id);
    expect(Object.keys(timings.retrievers)).toContain('dense');
    expect(timings.errors).toHaveLength(0);
  });
});

describe('syncTasks — batched (tasks-per-pass) embedding (E14.3)', () => {
  let gid;
  let provider;
  beforeEach(async () => {
    gid = await makeGraph();
    provider = fakeProvider();
    await ensureStoreVersion(pool, provider);
  });

  it('embeds many tasks in ONE provider.embed() call', async () => {
    const a = await makeTask(gid, 'Alpha', 'alpha');
    const b = await makeTask(gid, 'Beta', 'beta');
    const c = await makeTask(gid, 'Gamma', 'gamma');

    const res = await syncTasks(pool, provider, [a.id, b.id, c.id]);
    expect(res.map((r) => r.status)).toEqual(['indexed', 'indexed', 'indexed']);
    // The whole point: a single embed call carrying all three tasks' chunks.
    expect(provider.embed.mock.calls.length).toBe(1);
    expect(provider.embed.mock.calls[0][0]).toHaveLength(3);
    for (const t of [a, b, c]) expect((await chunkRows(t.id)).length).toBeGreaterThan(0);
  });

  it('SHA-skips already-current tasks and embeds only the rest, still in one call', async () => {
    const fresh = await makeTask(gid, 'Fresh', 'alpha');
    const stale1 = await makeTask(gid, 'S1', 'beta');
    const stale2 = await makeTask(gid, 'S2', 'gamma');
    await syncTask(pool, provider, fresh.id); // make `fresh` current
    const before = provider.embed.mock.calls.length;

    const res = await syncTasks(pool, provider, [fresh.id, stale1.id, stale2.id]);
    const byId = Object.fromEntries(res.map((r) => [r.id, r.status]));
    expect(byId[fresh.id]).toBe('skipped');
    expect(byId[stale1.id]).toBe('indexed');
    expect(byId[stale2.id]).toBe('indexed');
    // Exactly one new embed call, carrying only the two tasks that needed it.
    expect(provider.embed.mock.calls.length).toBe(before + 1);
    expect(provider.embed.mock.calls[before][0]).toHaveLength(2);
  });

  it('reports gone for a deleted task without failing its batch-mates', async () => {
    const live = await makeTask(gid, 'Live', 'alpha');
    const dead = await makeTask(gid, 'Dead', 'beta');
    await pool.query('DELETE FROM tasks WHERE id = $1', [dead.id]);

    const res = await syncTasks(pool, provider, [live.id, dead.id]);
    const byId = Object.fromEntries(res.map((r) => [r.id, r.status]));
    expect(byId[dead.id]).toBe('gone');
    expect(byId[live.id]).toBe('indexed');
    expect((await chunkRows(live.id)).length).toBeGreaterThan(0);
  });

  it('falls back to per-task embedding when the shared batch embed throws (one poison task cannot sink the batch)', async () => {
    // Provider that refuses a batched call (>1 text) but succeeds one-at-a-time.
    const flaky = {
      modelId: 'fake-kw',
      dim: 4,
      embed: vi.fn(async (texts) => {
        if (texts.length > 1) throw new Error('no batching on this backend');
        return texts.map(keywordVector);
      }),
    };
    await ensureStoreVersion(pool, flaky);
    const a = await makeTask(gid, 'A', 'alpha');
    const b = await makeTask(gid, 'B', 'beta');
    const c = await makeTask(gid, 'C', 'gamma');

    const res = await syncTasks(pool, flaky, [a.id, b.id, c.id]);
    expect(res.map((r) => r.status)).toEqual(['indexed', 'indexed', 'indexed']);
    // One failed batch attempt (3 texts) + three per-task retries (1 text each).
    expect(flaky.embed.mock.calls.length).toBe(4);
    for (const t of [a, b, c]) expect((await chunkRows(t.id)).length).toBeGreaterThan(0);
  });

  it('delegates a single id straight to syncTask (default tasks-per-pass=1 path)', async () => {
    const only = await makeTask(gid, 'Only', 'alpha');
    const res = await syncTasks(pool, provider, [only.id]);
    expect(res).toEqual([{ id: only.id, status: 'indexed', chunks: expect.any(Number) }]);
    expect(provider.embed.mock.calls.length).toBe(1);
  });
});

describe('createChunkIndexer — tasks-per-pass (E14.3)', () => {
  it('indexes every enqueued task when tasksPerPass > 1', async () => {
    const provider = fakeProvider();
    const gid = await makeGraph();
    const tasks = [];
    for (const w of ['alpha', 'beta', 'gamma', 'delta']) {
      tasks.push(await makeTask(gid, w, w));
    }
    const indexer = createChunkIndexer({ pool, provider, tasksPerPass: 5, log: () => {} });
    await indexer.start({ listen: false, backfill: false });
    for (const t of tasks) indexer.enqueue(t.id);
    await indexer.idle();
    for (const t of tasks) expect((await chunkRows(t.id)).length).toBeGreaterThan(0);
    await indexer.stop();
  });
});

describe('createChunkIndexer — queue + backfill', () => {
  it('backfills existing tasks on start (listen off) and processes enqueues', async () => {
    const provider = fakeProvider();
    const gid = await makeGraph();
    const t1 = await makeTask(gid, 'Alpha', 'alpha');
    const indexer = createChunkIndexer({ pool, provider, log: () => {} });

    const started = await indexer.start({ listen: false, backfill: true });
    expect(started).toBe(true);
    expect((await chunkRows(t1.id)).length).toBeGreaterThan(0); // backfilled

    const t2 = await makeTask(gid, 'Beta', 'beta');
    indexer.enqueue(t2.id);
    await indexer.idle();
    expect((await chunkRows(t2.id)).length).toBeGreaterThan(0);
    await indexer.stop();
  });

  it('reindexes via the real graph_change NOTIFY on task insert', async () => {
    const provider = fakeProvider();
    const indexer = createChunkIndexer({ pool, provider, connectionString: TEST_URL, log: () => {} });
    await indexer.start({ listen: true, backfill: false });

    const gid = await makeGraph();
    const task = await makeTask(gid, 'Alpha live', 'alpha'); // trigger fires NOTIFY

    // NOTIFY delivery is async; poll briefly rather than racing it.
    let rows = [];
    for (let i = 0; i < 50 && rows.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 100));
      await indexer.idle();
      rows = await chunkRows(task.id);
    }
    await indexer.stop();
    expect(rows.length).toBeGreaterThan(0);
  });
});
