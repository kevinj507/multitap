#!/usr/bin/env node
// E13.10.1 (#470) — DB-LEVEL graph copy. The API copy re-embeds every node, which
// bloats the 1.5GB ONNX server by ~1GB/copy and swap-thrashes the 3GB box (#436).
// Copying tasks + edges + task_chunks (WITH their embeddings) straight in Postgres
// is instant, does zero model inference, and adds no server memory — the dense
// store is reproduced verbatim so /search and /context work immediately on the copy.
// Title-keyed old->new remap (titles are unique in the source) carries the gold.
// Run: node eval/skill-ab/db-copy.js --src fwmhe8ysfrnx9fw7 --name "AB-x" --out remap.json
import fs from 'fs';
import pg from 'pg';
import { arg } from './lib.js';

const SRC = arg('src', 'fwmhe8ysfrnx9fw7');
const NAME = arg('name', `AB-dbcopy-${SRC}`);
const OUT = arg('out', null);
const url = process.env.DATABASE_URL ||
  (process.env.PG_BOOTSTRAP_URL || 'postgresql://postgres@localhost/postgres')
    .replace(/\/[^/]*$/, `/${process.env.DATABASE_NAME || 'postgres'}`);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  const ng = await client.query(`INSERT INTO graphs(name, description) VALUES ($1,$2) RETURNING id`, [NAME.slice(0, 80), `throwaway A/B db-copy of ${SRC}`]);
  const newGid = ng.rows[0].id;

  // tasks (copy content+meta verbatim)
  await client.query(
    `INSERT INTO tasks(graph_id, content, meta, created_at, updated_at)
     SELECT $1, content, meta, created_at, updated_at FROM tasks WHERE graph_id=$2`,
    [newGid, SRC]
  );
  // old->new id map by unique title
  const { rows: remapRows } = await client.query(
    `SELECT o.id AS old_id, n.id AS new_id, o.meta->>'title' AS title
     FROM tasks o JOIN tasks n ON n.graph_id=$1 AND n.meta->>'title' = o.meta->>'title'
     WHERE o.graph_id=$2`,
    [newGid, SRC]
  );
  // edges (remap endpoints via a join on the just-copied tasks, matched by title)
  await client.query(
    `INSERT INTO edges(graph_id, source_id, target_id, type, meta, created_at)
     SELECT $1, ns.id, nt.id, e.type, e.meta, e.created_at
     FROM edges e
     JOIN tasks os ON os.id=e.source_id
     JOIN tasks ot ON ot.id=e.target_id
     JOIN tasks ns ON ns.graph_id=$1 AND ns.meta->>'title' = os.meta->>'title'
     JOIN tasks nt ON nt.graph_id=$1 AND nt.meta->>'title' = ot.meta->>'title'
     WHERE e.graph_id=$2`,
    [newGid, SRC]
  );
  // task_chunks (copy embeddings verbatim, remap task_id + graph_id)
  await client.query(
    `INSERT INTO task_chunks(task_id, graph_id, chunk_index, chunk_text, content_sha, embedding_model, embedding, created_at)
     SELECT nt.id, $1, c.chunk_index, c.chunk_text, c.content_sha, c.embedding_model, c.embedding, c.created_at
     FROM task_chunks c
     JOIN tasks ot ON ot.id=c.task_id
     JOIN tasks nt ON nt.graph_id=$1 AND nt.meta->>'title' = ot.meta->>'title'
     WHERE c.graph_id=$2`,
    [newGid, SRC]
  );
  await client.query('COMMIT');

  // verify parity
  const cnt = async (tbl) => Number((await client.query(`SELECT count(*) FROM ${tbl} WHERE graph_id=$1`, [newGid])).rows[0].count);
  const parity = { nodes: await cnt('tasks'), edges: await cnt('edges'), chunks: await cnt('task_chunks') };
  const result = {
    newGid, src: SRC, nodeCount: parity.nodes, edgeCount: parity.edges, chunkCount: parity.chunks,
    parity, remap: remapRows.map((r) => ({ oldId: Number(r.old_id), newId: Number(r.new_id), title: r.title })),
  };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('db-copy failed:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
