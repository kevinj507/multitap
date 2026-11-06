// Chunk store — the pgvector production half of the dense retriever (graph
// task #190, P2.2). The WRITE path: one node → many title-prefixed passages
// (src/search/chunking.js) → embedded rows in `task_chunks`. The QUERY path:
// ANN over those rows, scoped to a graph. Both live here so the indexer
// (indexer.js) and the retriever (retrievers/dense.js) share one set of SQL.
//
// Re-embed discipline (#190): `content_sha` (sha256 of the whole node content)
// is the re-chunk trigger — an unchanged node skips embedding entirely.
// `embedding_model` + the column's declared dim are the INDEX VERSION: vectors
// from one model are never compared against another's, and a model/dim change
// invalidates the store (rows are purged and re-embedded by the backfill)
// rather than silently mixing spaces.
//
// Everything degrades gracefully: where pgvector is absent (older self-host
// Postgres) `chunkStoreAvailable` is false and callers fall back to the
// in-memory dense leg — search still answers (#173 §11).

import { splitMarkdown, contentSha } from './chunking.js';

// pgvector renders/accepts vectors as '[v1,v2,...]' text literals.
export function vectorLiteral(vec) {
  return '[' + vec.join(',') + ']';
}

/** Is the pgvector-backed store present? (The schema.sql migration is guarded
 *  on the extension, so on a Postgres without pgvector the table won't exist.) */
export async function chunkStoreAvailable(pool) {
  const { rows } = await pool.query("SELECT to_regclass('task_chunks') AS t");
  return rows[0].t != null;
}

/**
 * Align the store with the active provider — the "index version" enforcement.
 * The schema declares halfvec(1024) (BGE-M3, the #190 safe default), but the
 * configured backend may emit a different width (bge-small-en-v1.5 = 384), and
 * a vector column's dim is fixed — so on mismatch the column is re-typed.
 * Stored vectors are only valid for ONE (model, dim) pair; on any change the
 * rows are deleted (cheap — the backfill re-embeds) instead of being kept in a
 * foreign vector space.
 *
 * @param {Object} pool
 * @param {{modelId:string, dim:number}} provider an EmbeddingProvider whose
 *   dim is already resolved (callers probe-embed first; see indexer.start)
 */
export async function ensureStoreVersion(pool, provider) {
  const dim = provider.dim;
  if (!Number.isInteger(dim) || dim < 1) {
    throw new Error(`ensureStoreVersion needs a resolved provider dim (got ${dim})`);
  }

  // For pgvector types atttypmod IS the dimension (no header offset).
  const { rows } = await pool.query(
    `SELECT atttypmod AS dim FROM pg_attribute
      WHERE attrelid = 'task_chunks'::regclass AND attname = 'embedding'`,
  );
  const columnDim = rows[0]?.dim;

  if (columnDim !== dim) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Old-dim vectors can't be cast; they're stale by definition. Purge,
      // re-type, rebuild the HNSW index (same params as db/schema.sql).
      await client.query('DELETE FROM task_chunks');
      await client.query('DROP INDEX IF EXISTS task_chunks_embedding_idx');
      await client.query(`ALTER TABLE task_chunks ALTER COLUMN embedding TYPE halfvec(${dim})`);
      await client.query(
        `CREATE INDEX task_chunks_embedding_idx ON task_chunks
          USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64)`,
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return { resized: true, purged: true };
  }

  // Same dim, different model (e.g. two 384-wide models): the widths agree but
  // the spaces don't — purge the other model's rows so ANN never mixes them.
  const purged = await pool.query('DELETE FROM task_chunks WHERE embedding_model <> $1', [
    provider.modelId,
  ]);
  return { resized: false, purged: purged.rowCount > 0 };
}

/**
 * Read a task and decide what (re)indexing it needs: 'gone' (deleted),
 * 'skipped' (content_sha + model already current), or 'needs-embed' with the
 * graph id, sha, and freshly split chunks ready to embed. The SHA-skip read
 * that makes redundant wakeups cheap lives here so both the single and batched
 * write paths share it.
 *
 * @returns {Promise<{status:'gone'|'skipped'} | {status:'needs-embed', graphId:string, sha:string, chunks:Array}>}
 */
async function prepareTask(pool, provider, taskId) {
  const taskRes = await pool.query('SELECT id, graph_id, content FROM tasks WHERE id = $1', [taskId]);
  // Deleted between event and processing — the FK CASCADE already cleaned its
  // chunks; nothing to do.
  if (taskRes.rows.length === 0) return { status: 'gone' };
  const { graph_id: graphId, content } = taskRes.rows[0];

  const sha = contentSha(content || '');
  const cur = await pool.query(
    'SELECT content_sha, embedding_model FROM task_chunks WHERE task_id = $1 LIMIT 1',
    [taskId],
  );
  if (
    cur.rows.length > 0 &&
    cur.rows[0].content_sha === sha &&
    cur.rows[0].embedding_model === provider.modelId
  ) {
    return { status: 'skipped' };
  }

  const { chunks } = splitMarkdown(content || '');
  return { status: 'needs-embed', graphId, sha, chunks };
}

/**
 * Atomically replace one task's chunk rows with freshly embedded ones (#190
 * write path: "delete+reinsert beats per-chunk diffing at our scale"). The
 * embedding is computed by the caller (outside this txn — it's the slow step);
 * the swap is atomic. Isolated per task so a batched pass can't let one task's
 * write failure roll back its siblings.
 */
async function writeChunks(pool, taskId, graphId, sha, modelId, chunks, vectors) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM task_chunks WHERE task_id = $1', [taskId]);
    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        `INSERT INTO task_chunks
           (task_id, graph_id, chunk_index, chunk_text, content_sha, embedding_model, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7::halfvec)`,
        [taskId, graphId, chunks[i].index, chunks[i].text, sha, modelId, vectorLiteral(vectors[i])],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * (Re-)index one task: SHA-skip → chunk → embed → delete+reinsert. Embedding
 * runs OUTSIDE the transaction (it's the slow, IO/CPU step); the swap is atomic.
 *
 * @returns {Promise<{status:'skipped'|'indexed'|'gone', chunks?:number}>}
 */
export async function syncTask(pool, provider, taskId) {
  const prep = await prepareTask(pool, provider, taskId);
  if (prep.status !== 'needs-embed') return { status: prep.status };

  const vectors = await provider.embed(prep.chunks.map((c) => c.embedText));
  if (vectors.length !== prep.chunks.length) {
    throw new Error(`embed returned ${vectors.length} vectors for ${prep.chunks.length} chunks`);
  }
  await writeChunks(pool, taskId, prep.graphId, prep.sha, provider.modelId, prep.chunks, vectors);
  return { status: 'indexed', chunks: prep.chunks.length };
}

/**
 * Batched (re)index: embed the chunks of MANY tasks in ONE provider.embed()
 * call, then write each task's chunks in its own transaction. This is the
 * throughput lever for parallel / remote embedding backends (E14.3) — the
 * indexer uses it when EMBED_TASKS_PER_PASS > 1. On in-process CPU backends it
 * makes no difference (embed() already slices internally at EMBEDDING_BATCH);
 * the memory ceiling is unchanged either way.
 *
 * Failure-isolated to preserve the single-task guarantees: if the shared embed
 * throws (one poison text), it falls back to per-task syncTask so one bad task
 * can't sink the batch; a write that fails affects only its own task.
 *
 * @returns {Promise<Array<{id:number, status:'indexed'|'skipped'|'gone'|'failed', chunks?:number, error?:string}>>}
 */
export async function syncTasks(pool, provider, taskIds) {
  const ids = [...new Set((taskIds || []).map(Number).filter(Number.isInteger))];
  if (ids.length === 0) return [];
  // One task is just syncTask — no benefit to batching, and it keeps the
  // default (EMBED_TASKS_PER_PASS=1) path byte-identical to before.
  if (ids.length === 1) {
    try {
      return [{ id: ids[0], ...(await syncTask(pool, provider, ids[0])) }];
    } catch (err) {
      return [{ id: ids[0], status: 'failed', error: err.message }];
    }
  }

  // Prepare every task (fetch + SHA-skip + split); collect those needing embed.
  const results = [];
  const pending = []; // { taskId, graphId, sha, chunks }
  for (const id of ids) {
    let prep;
    try {
      prep = await prepareTask(pool, provider, id);
    } catch (err) {
      results.push({ id, status: 'failed', error: err.message });
      continue;
    }
    if (prep.status !== 'needs-embed') {
      results.push({ id, status: prep.status });
      continue;
    }
    pending.push({ taskId: id, graphId: prep.graphId, sha: prep.sha, chunks: prep.chunks });
  }
  if (pending.length === 0) return results;

  // ONE embed across every pending task's chunks; provenance is the flat order.
  const flatTexts = pending.flatMap((p) => p.chunks.map((c) => c.embedText));
  let flatVectors;
  try {
    flatVectors = await provider.embed(flatTexts);
    if (flatVectors.length !== flatTexts.length) {
      throw new Error(`embed returned ${flatVectors.length} vectors for ${flatTexts.length} chunks`);
    }
  } catch (err) {
    // Shared embed failed — fall back to per-task so one poison text doesn't
    // sink the whole batch (restores single-task isolation).
    for (const p of pending) {
      try {
        results.push({ id: p.taskId, ...(await syncTask(pool, provider, p.taskId)) });
      } catch (e) {
        results.push({ id: p.taskId, status: 'failed', error: e.message });
      }
    }
    return results;
  }

  // Scatter vectors back to each task and write (per-task txn = isolated).
  let cursor = 0;
  for (const p of pending) {
    const vectors = flatVectors.slice(cursor, cursor + p.chunks.length);
    cursor += p.chunks.length;
    try {
      await writeChunks(pool, p.taskId, p.graphId, p.sha, provider.modelId, p.chunks, vectors);
      results.push({ id: p.taskId, status: 'indexed', chunks: p.chunks.length });
    } catch (err) {
      results.push({ id: p.taskId, status: 'failed', error: err.message });
    }
  }
  return results;
}

/**
 * Find every task whose chunks are missing or stale (sha/model mismatch) and
 * reindex it — the boot backfill and the catch-up after downtime. Serial on
 * purpose: embedding is the bottleneck and (for local-onnx) CPU-bound in this
 * very process; fanning out would just contend with request handling.
 *
 * @returns {Promise<{indexed:number, skipped:number, failed:number}>}
 */
export async function syncAll(pool, provider, { log = () => {} } = {}) {
  const tasks = await pool.query('SELECT id, content FROM tasks ORDER BY id');
  const chunkMeta = await pool.query(
    'SELECT DISTINCT ON (task_id) task_id, content_sha, embedding_model FROM task_chunks',
  );
  const current = new Map(chunkMeta.rows.map((r) => [r.task_id, r]));

  const out = { indexed: 0, skipped: 0, failed: 0 };
  for (const t of tasks.rows) {
    const cur = current.get(t.id);
    if (cur && cur.content_sha === contentSha(t.content || '') && cur.embedding_model === provider.modelId) {
      out.skipped++;
      continue;
    }
    try {
      const res = await syncTask(pool, provider, t.id);
      if (res.status === 'indexed') out.indexed++;
      else out.skipped++;
    } catch (err) {
      out.failed++;
      log(`task ${t.id} failed: ${err.message}`);
    }
  }
  return out;
}

// hnsw.iterative_scan (pgvector ≥0.8) keeps a filtered ANN scan producing
// results until the LIMIT is satisfied instead of starving when the WHERE
// (graph_id scope, later cross-graph ownership) discards most neighbors —
// #173 §4's access-control caveat. Older pgvector lacks the GUC; remembered
// per process after the first failed SET so every later query skips the retry.
let iterativeScanSupported = null;

/**
 * ANN query: nearest chunks to `vector` within one model space, scoped to one
 * graph — or to a SET of graphs (`gid` as array) for the cross-graph "my
 * graphs" search (#172/#173). The ANY filter + iterative_scan together are
 * what keep the ownership WHERE from starving ANN results.
 * Returns rows ordered nearest-first: { task_id, chunk_text, distance }.
 *
 * @param {Object} pool
 * @param {{vector:number[], gid:string|string[], modelId:string, limit?:number}} opts
 */
export async function annSearchChunks(pool, { vector, gid, modelId, limit = 50 }) {
  const gids = Array.isArray(gid) ? gid : [gid];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (iterativeScanSupported !== false) {
      try {
        await client.query("SET LOCAL hnsw.iterative_scan = 'strict_order'");
        iterativeScanSupported = true;
      } catch {
        iterativeScanSupported = false;
        await client.query('ROLLBACK');
        await client.query('BEGIN');
      }
    }
    const { rows } = await client.query(
      `SELECT task_id, chunk_text, embedding <=> $1::halfvec AS distance
         FROM task_chunks
        WHERE graph_id = ANY($2) AND embedding_model = $3 AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::halfvec
        LIMIT $4`,
      [vectorLiteral(vector), gids, modelId, limit],
    );
    await client.query('COMMIT');
    return rows;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

export default {
  chunkStoreAvailable,
  ensureStoreVersion,
  syncTask,
  syncTasks,
  syncAll,
  annSearchChunks,
  vectorLiteral,
};
