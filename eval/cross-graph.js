#!/usr/bin/env node
// Cross-graph eval (#223 E1, part 3) — the FIRST eval coverage for the
// "All graphs" path (POST /api/search, src/routes/searchAll.js). Runs the
// production SearchService over ctx.gids exactly like the route does (multi-
// graph corpus load + store-ANN scoped to the gid set + expansion + rerank),
// against eval/dataset-crossgraph.json's frozen queries/qrels.
//
// Two jobs per run:
//   1. Accuracy + latency over the mixed two-graph corpus (stock + TIL).
//   2. OWNERSHIP-LEAK ASSERTION on every query: no result may come from a
//      graph outside the gids scope. dataset.leakProbeNodes are honeypots in
//      a non-owned graph authored to lexically dominate several queries —
//      if one ever surfaces, scoping is broken and the run FAILS (exit 1).
//
// Run with the app's env:  set -a; source .env; set +a; node eval/cross-graph.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveConnectionString, createPool } from '../src/db.js';
import { SearchService } from '../src/search/service.js';
import { configFromEnv } from '../src/search/config.js';
import { scoreQuery, meanScores, percentile } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KS = [1, 5, 10, 20];
const fmt = (n) => (Math.round(n * 1000) / 1000).toFixed(3);

async function main() {
  const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-crossgraph.json'), 'utf-8'));
  const { gids, queries, qrels } = dataset;
  const leakProbes = new Set((dataset.leakProbeNodes || []).map(String));
  const pool = createPool(resolveConnectionString());

  // The route's own assembly: configFromEnv + pool. What ships is what runs.
  const service = new SearchService({ config: configFromEnv(process.env), pool });

  const qids = Object.keys(queries);
  console.log(`\nCross-graph eval — gids: ${gids.join(' + ')} · ${qids.length} queries · cutoffs ${KS.join(',')}`);

  const per = [];
  const lat = [];
  const leaks = [];
  for (const qid of qids) {
    const t0 = performance.now();
    const { candidates } = await service.search(queries[qid], { gids });
    lat.push(performance.now() - t0);

    // Leak assertions: every hit must belong to a graph in scope, and no
    // honeypot may ever appear regardless of how well it matches the query.
    const ids = candidates.map((c) => String(c.taskId));
    const probeHits = ids.filter((id) => leakProbes.has(id));
    if (probeHits.length) leaks.push({ qid, kind: 'honeypot', ids: probeHits });
    const { rows } = await pool.query(
      'SELECT id, graph_id FROM tasks WHERE id = ANY($1)',
      [candidates.map((c) => c.taskId)],
    );
    const outside = rows.filter((r) => !gids.includes(r.graph_id));
    if (outside.length) leaks.push({ qid, kind: 'out-of-scope', ids: outside.map((r) => String(r.id)) });

    const scores = scoreQuery(ids, qrels[qid] || {}, KS);
    per.push(scores);
    console.log(`  ${qid.padEnd(4)} "${queries[qid]}"`);
    console.log(`       ndcg@10=${fmt(scores['ndcg@10'])} recall@10=${fmt(scores['recall@10'])} mrr=${fmt(scores.mrr)} · top5: [${ids.slice(0, 5).join(',')}]`);
  }

  const mean = meanScores(per);
  console.log('\n  ── mean ──');
  for (const key of Object.keys(mean)) console.log(`     ${key.padEnd(12)} ${fmt(mean[key])}`);
  console.log('\n  ── latency (ms) ──');
  console.log(`     p50 ${fmt(percentile(lat, 50))}  p95 ${fmt(percentile(lat, 95))}  first ${fmt(lat[0])}`);

  if (leaks.length) {
    console.error(`\n  ✗ OWNERSHIP LEAK: ${JSON.stringify(leaks)}`);
    await pool.end();
    process.exit(1);
  }
  console.log(`\n  ✓ leak assertions passed: 0 out-of-scope results, 0 honeypot hits (probes: ${[...leakProbes].join(',')})\n`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
