#!/usr/bin/env node
// Reranker bake-off — one cell (model × dtype) per process (#198). Measures a
// cross-encoder's LATENCY and eval ACCURACY on our box so we pick by data, not
// theory. Run one process per cell (memory releases between models on the
// 2.9GB box); a driver loop aggregates the JSON lines into a table.
//
// Method (OOM-safe, apples-to-apples):
//   • Corpus = the live stock graph's nodes; queries+qrels = dataset-stocks.json.
//   • Retrieval = LEXICAL only (deterministic, same candidate set for every
//     model; the hybrid+rerank-at-50 cut is a follow-up — dense onnx OOMs here).
//   • Each model reranks the top-M lexical candidates; we score the result.
//   • Latency: a CONTROLLED probe (rerank a fixed 20- and 10-doc batch, warm,
//     median of 3) isolates model speed from per-query candidate-count variance.
//
// Usage:
//   node eval/rerank-bench.js --model none                      # lexical baseline
//   node eval/rerank-bench.js --model Xenova/ms-marco-MiniLM-L-6-v2 --dtype q8
//   MULTITAP_BASE_URL=... --gid <id>   (defaults: local app + stock graph)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assemblePipeline } from '../src/search/service.js';
import { createRerankProvider } from '../src/search/providers/rerank.js';
import { scoreQuery, meanScores, percentile } from './metrics.js';
import { resolveAgentToken } from './resolve-token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = resolveAgentToken();
const KS = [1, 10];           // precision@1 is rerank's home metric; recall@10 for the list
const TOP_M = 20;             // rerank this many lexical hits
const GID = process.env.STOCK_GID || 'fwmhe8ysfrnx9fw7';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

async function loadLiveCorpus(gid) {
  const base = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000';
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
  const res = await fetch(`${base}/api/graphs/${gid}/tasks`, { headers });
  if (!res.ok) throw new Error(`load corpus ${gid}: ${res.status}`);
  const rows = await res.json();
  const FENCE = '---';
  return rows.map((row) => {
    const text = row.content || '';
    let meta = {}, body = text;
    if (text.startsWith(FENCE + '\n')) {
      const end = text.indexOf('\n' + FENCE, FENCE.length);
      if (end !== -1) {
        for (const line of text.slice(FENCE.length + 1, end).split('\n')) {
          const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
          if (m) meta[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
        }
        body = text.slice(end + FENCE.length + 2);
      }
    }
    return { id: row.id, title: meta.title || '', description: meta.description || '', body, createdAt: row.created_at };
  });
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function main() {
  const model = arg('--model', 'none');
  const dtype = arg('--dtype', undefined);
  const gid = arg('--gid', GID);
  const corpus = await loadLiveCorpus(gid);
  const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-stocks.json'), 'utf-8'));
  const { queries, qrels } = dataset;
  const qids = Object.keys(queries);

  const cell = { model, dtype: dtype || (model === 'none' ? '-' : 'default'), ok: true };

  // Provider + controlled latency probe (skipped for the baseline).
  let provider = null;
  if (model !== 'none') {
    try {
      provider = createRerankProvider({ backend: 'local-onnx', model, ...(dtype ? { dtype } : {}) }, {});
      const q = queries[qids[0]];
      // Truncate probe docs the way the rerank stage does (RERANK_MAXCHARS,
      // default 512) — untruncated 10KB notes through a long-window model
      // OOM the box and measure an input shape production never sends.
      const maxChars = Number(process.env.RERANK_MAXCHARS || 512);
      const docs20 = corpus.slice(0, 20).map((d) => [d.title, d.description, d.body].filter(Boolean).join('\n').slice(0, maxChars));
      await provider.rerank(q, docs20); // warm (loads weights)
      const t20 = []; for (let i = 0; i < 3; i++) { const t = performance.now(); await provider.rerank(q, docs20); t20.push(performance.now() - t); }
      const t10 = []; const docs10 = docs20.slice(0, 10); for (let i = 0; i < 3; i++) { const t = performance.now(); await provider.rerank(q, docs10); t10.push(performance.now() - t); }
      cell.ms20 = Math.round(median(t20));
      cell.ms10 = Math.round(median(t10));
    } catch (e) {
      console.log(JSON.stringify({ model, dtype: cell.dtype, ok: false, error: String(e.message).slice(0, 100) }));
      return;
    }
  }

  // Accuracy: lexical (+ rerank) over all queries.
  const cfg = {
    retrievers: ['lexical'],
    fusion: { mode: 'rrf', k: 60 },
    postprocessors: model === 'none' ? [] : ['rerank'],
    topK: 100,
    // BM25 candidates (#228): the tiered AND ranker returns near-empty lists
    // for the E1 paraphrase/conceptual queries, which starves the reranker and
    // hides model differences. Round-2 cells all rerank a real top-M list.
    lexical: { ranker: process.env.LEXICAL_RANKER || 'bm25' },
    providers: {
      embedding: { backend: 'none' },
      rerank: {
        backend: model === 'none' ? 'none' : 'local-onnx',
        topM: TOP_M,
        ...(process.env.RERANK_INPUT ? { input: process.env.RERANK_INPUT } : {}),
      },
    },
  };
  const pipeline = assemblePipeline(cfg, provider ? { rerankProvider: provider } : {});

  const per = [];
  const stageMs = [];
  for (const qid of qids) {
    const { candidates, timings } = await pipeline.run(queries[qid], { corpus, lexicalTopK: 100 });
    per.push(scoreQuery(candidates.map((c) => String(c.taskId)), qrels[qid] || {}, KS));
    if (timings.postprocessors.rerank != null) stageMs.push(timings.postprocessors.rerank);
  }
  const mean = meanScores(per);
  cell.metrics = {
    'precision@1': +mean['precision@1'].toFixed(3),
    'ndcg@10': +mean['ndcg@10'].toFixed(3),
    mrr: +mean.mrr.toFixed(3),
    'recall@10': +mean['recall@10'].toFixed(3),
  };
  if (stageMs.length) cell.stage_p50 = Math.round(percentile(stageMs, 50));
  console.log(JSON.stringify(cell));
}

main().catch((e) => { console.log(JSON.stringify({ ok: false, error: String(e.message) })); process.exit(0); });
