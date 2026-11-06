#!/usr/bin/env node
// Query-rewrite MODEL SWEEP (#447/E11b). Unlike rewrite-ab.js — which scores
// PRECOMPUTED rewrites from the dataset to ask "does a good rewrite help
// retrieval?" — this harness calls a REAL LLM per model to ask the other half:
// "can THIS model produce a good rewrite, fast enough?" For every candidate
// model it generates a live rewrite for each query, feeds it through the
// production pipeline (bm25 + dense -> RRF -> graphExpand, rerank OFF), scores
// retrieval against the dataset qrels, and times the rewrite call — then prints
// an accuracy+latency leaderboard plus the raw rewrites for eyeballing.
//
// Run (after putting a key in .env):
//   set -a; source .env; set +a
//   GROQ_API_KEY=gsk_... node eval/rewrite-model-sweep.js
//
// Knobs (all optional):
//   SWEEP_MODELS    comma list of model ids (default: the 4 below)
//   SWEEP_DATASETS  comma list of dataset paths (default: reasoning + direct)
//   QUERY_REWRITE_PROVIDER  anthropic|groq (default: groq)
//   QUERY_REWRITE_BASE_URL  override endpoint for other OpenAI-compatible hosts
//   STOCK_GID       graph to retrieve against (default: dataset gid)
//
// Note: the rewriter swallows errors and returns the RAW query on failure, so a
// rewrite that comes back identical to the input is counted as "kept" — on the
// reasoning set (where every query SHOULD be rewritten) a high kept-count is
// itself the signal that a model is failing or no-op'ing.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveConnectionString, createPool } from '../src/db.js';
import { SearchService } from '../src/search/service.js';
import { createQueryRewriter } from '../src/search/queryRewrite.js';
import { scoreQuery, meanScores, percentile } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KS = [1, 5, 10, 20];
// SWEEP_REPEATS>1 runs the whole query set N times per model and reports the
// mean plus the min…max spread across runs — LLM rewrites are non-deterministic,
// so this is how you tell a real lift from a lucky draw on a small query set.
const REPEATS = Math.max(1, Number(process.env.SWEEP_REPEATS || 1));
// SWEEP_DELAY_MS throttles between live rewrite calls to stay under the
// provider's tokens-per-minute bucket. Without it, a big query set bursts past
// the free-tier TPM limit and the 429s fast-fail into "kept" — silently
// poisoning the numbers. Groq free tier: 8b ~6k TPM, 70b ~12k TPM.
const DELAY_MS = Math.max(0, Number(process.env.SWEEP_DELAY_MS || 0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROVIDER = process.env.QUERY_REWRITE_PROVIDER || 'groq';
const DEFAULT_MODELS = [
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
];
const MODELS = (process.env.SWEEP_MODELS
  ? process.env.SWEEP_MODELS.split(',')
  : DEFAULT_MODELS).map((m) => m.trim()).filter(Boolean);
const DATASETS = (process.env.SWEEP_DATASETS
  ? process.env.SWEEP_DATASETS.split(',')
  : ['eval/dataset-stocks-reasoning.json', 'eval/dataset-stocks-direct-sample.json'])
  .map((p) => p.trim()).filter(Boolean)
  .map((p) => path.resolve(process.cwd(), p));

const fmt = (n) => (Math.round(n * 1000) / 1000).toFixed(3);
const d = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : ' 0.000');

// SWEEP_RERANK turns the Tier-2 cross-encoder on for the experiment ("does
// rerank convert the rewrite's recall gain into precision?"). Both arms (raw +
// rewrite) get reranked, so the Δ stays a clean isolation of the rewrite even
// though the local TinyBERT model is known to drag absolute scores down on this
// corpus. Default off = same pipeline as the deployed app.
const RERANK_BACKEND = process.env.SWEEP_RERANK || 'none';
const PIPELINE = {
  retrievers: ['lexical', 'dense'],
  lexical: { ranker: 'bm25' },
  providers: {
    embedding: { backend: 'local-onnx', model: 'Xenova/bge-small-en-v1.5', dim: 384 },
    rerank: { backend: RERANK_BACKEND },
  },
  // Canonical order: rerank the fused top-M, then graph-expand.
  postprocessors: RERANK_BACKEND !== 'none' ? ['rerank', 'graphExpand'] : ['graphExpand'],
  fusion: { mode: 'rrf', k: 60 },
  topK: 20,
};

const METRICS = ['precision@1', 'mrr', 'ndcg@10', 'recall@10', 'recall@20', 'map'];

async function main() {
  if (!process.env[PROVIDER === 'groq' ? 'GROQ_API_KEY' : 'ANTHROPIC_API_KEY']) {
    throw new Error(`no key for provider "${PROVIDER}" — set ${PROVIDER === 'groq' ? 'GROQ_API_KEY' : 'ANTHROPIC_API_KEY'}`);
  }
  const pool = createPool(resolveConnectionString());
  const svc = new SearchService({ config: PIPELINE, pool });

  for (const datasetPath of DATASETS) {
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    const GID = process.env.STOCK_GID || dataset.gid || dataset.gid_default || 'fwmhe8ysfrnx9fw7';
    const { queries, qrels } = dataset;
    const qids = Object.keys(queries);

    const rankedIds = async (q) => {
      const { candidates } = await svc.search(q, { gid: GID });
      return candidates.map((c) => String(c.taskId));
    };

    // Baseline: raw query, no rewrite — the bar every model has to beat.
    const baseScores = [];
    for (const qid of qids) baseScores.push(scoreQuery(await rankedIds(queries[qid]), qrels[qid] || {}, KS));
    const mBase = meanScores(baseScores);

    const rows = [];      // one per model: { model, mean, spread, latencies, kept, rewrites }
    for (const model of MODELS) {
      const rewriter = createQueryRewriter(
        { backend: 'llm', provider: PROVIDER, model, timeoutMs: 15000, retries: 1 },
        {},
      );
      const runMeans = [];  // per-repeat metric means
      const latencies = [];
      let kept = 0;
      let rewrites = [];
      for (let r = 0; r < REPEATS; r++) {
        const scores = [];
        const runRewrites = [];
        for (const qid of qids) {
          const raw = queries[qid];
          if (DELAY_MS) await sleep(DELAY_MS);
          const t0 = Date.now();
          const rw = await rewriter.rewrite(raw);
          latencies.push(Date.now() - t0);
          if (String(rw).trim() === String(raw).trim()) kept++;
          runRewrites.push({ qid, raw, rw });
          scores.push(scoreQuery(await rankedIds(rw), qrels[qid] || {}, KS));
        }
        runMeans.push(meanScores(scores));
        rewrites = runRewrites; // keep the last run's rewrites for display
      }
      // Mean + min…max spread of each metric across the repeats.
      const mean = {};
      const spread = {};
      for (const m of METRICS) {
        const vals = runMeans.map((rm) => rm[m] || 0);
        mean[m] = vals.reduce((a, b) => a + b, 0) / vals.length;
        spread[m] = [Math.min(...vals), Math.max(...vals)];
      }
      rows.push({ model, mean, spread, latencies, kept, rewrites });
    }

    // ---- accuracy table ------------------------------------------------------
    console.log(`\n══ ${path.basename(datasetPath)} · graph ${GID} · ${qids.length} queries · provider ${PROVIDER}${REPEATS > 1 ? ` · ${REPEATS}× repeats (means)` : ''}`);
    console.log(`   pipeline: bm25+dense→RRF→${RERANK_BACKEND !== 'none' ? `rerank(${RERANK_BACKEND})→` : ''}graphExpand · rewrites generated LIVE per model\n`);
    const head = `  ${'model'.padEnd(34)}` + METRICS.map((m) => m.padStart(11)).join('');
    console.log(head);
    console.log(`  ${'raw query (baseline)'.padEnd(34)}` + METRICS.map((m) => fmt(mBase[m] || 0).padStart(11)).join(''));
    for (const r of rows) {
      console.log(`  ${r.model.padEnd(34)}` + METRICS.map((m) => fmt(r.mean[m] || 0).padStart(11)).join(''));
    }
    console.log(`  ${''.padEnd(34)}` + METRICS.map((m) => '———'.padStart(11)).join(''));
    for (const r of rows) {
      console.log(`  Δ ${r.model.padEnd(32)}` + METRICS.map((m) => d((r.mean[m] || 0) - (mBase[m] || 0)).padStart(11)).join(''));
    }

    // ---- variance across repeats --------------------------------------------
    if (REPEATS > 1) {
      console.log(`\n  spread across ${REPEATS} runs (min … max) — narrow = trustworthy`);
      for (const r of rows) {
        const sp = (m) => `${fmt(r.spread[m][0])}…${fmt(r.spread[m][1])}`;
        console.log(`    ${r.model.padEnd(30)} p@1 ${sp('precision@1').padEnd(15)} ndcg@10 ${sp('ndcg@10').padEnd(15)} recall@20 ${sp('recall@20').padEnd(15)} map ${sp('map')}`);
      }
    }

    // ---- latency table -------------------------------------------------------
    console.log(`\n  rewrite latency (ms) · kept = returned unchanged/failed`);
    console.log(`  ${'model'.padEnd(34)}${'p50'.padStart(8)}${'p95'.padStart(8)}${'max'.padStart(8)}${'mean'.padStart(8)}${'kept'.padStart(8)}`);
    for (const r of rows) {
      const mean = r.latencies.reduce((a, b) => a + b, 0) / (r.latencies.length || 1);
      console.log(
        `  ${r.model.padEnd(34)}`
        + `${String(percentile(r.latencies, 50)).padStart(8)}`
        + `${String(percentile(r.latencies, 95)).padStart(8)}`
        + `${String(Math.max(0, ...r.latencies)).padStart(8)}`
        + `${String(Math.round(mean)).padStart(8)}`
        + `${`${r.kept}/${qids.length * REPEATS}`.padStart(8)}`,
      );
    }

    // ---- raw rewrites for eyeballing ----------------------------------------
    if (process.env.SWEEP_SHOW_REWRITES !== '0') {
      for (const r of rows) {
        console.log(`\n  ── ${r.model} rewrites`);
        for (const { qid, raw, rw } of r.rewrites) {
          console.log(`    ${qid}: "${raw}"`);
          console.log(`        → "${rw}"`);
        }
      }
    }
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
