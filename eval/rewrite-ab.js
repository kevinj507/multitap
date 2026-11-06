#!/usr/bin/env node
// Query-rewrite A/B (#436/E11). Measures the RETRIEVAL LIFT from rewriting the
// query before the hybrid legs run: for each query it scores the production
// pipeline (bm25 + dense -> RRF -> graphExpand, rerank OFF) twice —
//   off : the raw user query
//   on  : the precomputed `rewrites[qid]` from the dataset
// — against the dataset's qrels, and prints per-metric means + the delta.
//
// The `on` arm feeds the rewrite straight to search(), which is exactly what a
// live LLM rewriter (src/search/queryRewrite.js, backend 'llm') would produce —
// so this isolates "does retrieving with a good rewrite help?" from "can the
// LLM produce a good rewrite?" (a separate question). Run on BOTH the
// reasoning-gap set (where the gain should show) and the direct sample (a
// regression check that rewrite doesn't hurt queries that already work):
//
//   set -a; source .env; set +a
//   EVAL_DATASET=eval/dataset-stocks-reasoning.json    node eval/rewrite-ab.js
//   EVAL_DATASET=eval/dataset-stocks-direct-sample.json node eval/rewrite-ab.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveConnectionString, createPool } from '../src/db.js';
import { SearchService } from '../src/search/service.js';
import { scoreQuery, meanScores } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = process.env.EVAL_DATASET
  ? path.resolve(process.cwd(), process.env.EVAL_DATASET)
  : path.join(__dirname, 'dataset-stocks-reasoning.json');
const KS = [1, 5, 10, 20];

const fmt = (n) => (Math.round(n * 1000) / 1000).toFixed(3);
const d = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : ' 0.000');

async function main() {
  const pool = createPool(resolveConnectionString());
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
  const GID = process.env.STOCK_GID || dataset.gid || dataset.gid_default || 'fwmhe8ysfrnx9fw7';
  const { queries, qrels, rewrites } = dataset;
  if (!rewrites) throw new Error('dataset has no `rewrites` map — rewrite-ab needs one');
  const qids = Object.keys(queries);

  // Production-shaped pipeline, rerank OFF (matches the deployed .env). The
  // rewriter is left OFF on the service — this harness supplies the rewrite by
  // passing the rewritten STRING directly, so both arms share one pipeline.
  const config = {
    retrievers: ['lexical', 'dense'],
    lexical: { ranker: 'bm25' },
    providers: {
      embedding: { backend: 'local-onnx', model: 'Xenova/bge-small-en-v1.5', dim: 384 },
      rerank: { backend: 'none' },
    },
    postprocessors: ['graphExpand'],
    fusion: { mode: 'rrf', k: 60 },
    topK: 20,
  };
  const svc = new SearchService({ config, pool });

  async function rankedIds(q) {
    const { candidates } = await svc.search(q, { gid: GID });
    return candidates.map((c) => String(c.taskId));
  }

  const offScores = [];
  const onScores = [];
  const perQuery = [];
  for (const qid of qids) {
    const qrel = qrels[qid] || {};
    const off = await rankedIds(queries[qid]);
    const rw = rewrites[qid] || queries[qid];
    const on = await rankedIds(rw);
    const sOff = scoreQuery(off, qrel, KS);
    const sOn = scoreQuery(on, qrel, KS);
    offScores.push(sOff);
    onScores.push(sOn);
    perQuery.push({ qid, p1Off: sOff['precision@1'], p1On: sOn['precision@1'] });
  }

  const mOff = meanScores(offScores);
  const mOn = meanScores(onScores);

  console.log(`\nQuery-rewrite A/B — ${path.basename(DATASET_PATH)} · graph ${GID} · ${qids.length} queries · pipeline: bm25+dense→RRF→graphExpand, rerank off\n`);
  const metrics = ['precision@1', 'mrr', 'ndcg@10', 'recall@10', 'recall@20', 'map'];
  console.log(`  ${'metric'.padEnd(14)} ${'raw query'.padStart(11)} ${'+rewrite'.padStart(11)} ${'Δ'.padStart(9)}`);
  for (const m of metrics) {
    console.log(`  ${m.padEnd(14)} ${fmt(mOff[m] || 0).padStart(11)} ${fmt(mOn[m] || 0).padStart(11)} ${d((mOn[m] || 0) - (mOff[m] || 0)).padStart(9)}`);
  }
  // Per-query p@1 movement — who the rewrite helped / hurt.
  const moved = perQuery.filter((p) => p.p1Off !== p.p1On);
  console.log(`\n  per-query p@1 changes (${moved.length}/${qids.length} moved):`);
  for (const p of moved) console.log(`    ${p.qid}: ${fmt(p.p1Off)} → ${fmt(p.p1On)}`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
