#!/usr/bin/env node
// E10 item 6: score the LIVE deployed endpoint (shipped config) on the frozen
// stock-100 set — proves the served pipeline matches the harness numbers.
// Verified 2026-06-12: live = harness to 3 decimals (p@1 0.770, nDCG@10 0.700,
// MRR 0.843, r@10 0.635, r@20 0.751), server p50 324ms.
//
// WARNING: do NOT extend this to per-request `config` overrides with
// local-onnx backends — the route builds an ad-hoc service whose duplicate
// ONNX models OOM-killed the 2.9GB box during E10 (incident on node #436).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scoreQuery, meanScores, percentile } from './metrics.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-stocks.json'), 'utf-8'));
const URL = `${process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000'}/api/graphs/${dataset.gid || 'fwmhe8ysfrnx9fw7'}/search`;
const per = [], lat = [];
for (const qid of Object.keys(dataset.queries)) {
  const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: dataset.queries[qid] }) });
  if (!res.ok) { console.error(qid, 'HTTP', res.status); process.exit(1); }
  const { results, timings } = await res.json();
  lat.push(timings.total);
  per.push(scoreQuery(results.map((r) => String(r.taskId)), dataset.qrels[qid] || {}, [1, 10, 20]));
}
const m = meanScores(per);
console.log(`LIVE shipped: p@1=${m['precision@1'].toFixed(3)} ndcg@10=${m['ndcg@10'].toFixed(3)} mrr=${m.mrr.toFixed(3)} r@10=${m['recall@10'].toFixed(3)} r@20=${m['recall@20'].toFixed(3)} · server p50=${Math.round(percentile(lat, 50))}ms p95=${Math.round(percentile(lat, 95))}ms`);
