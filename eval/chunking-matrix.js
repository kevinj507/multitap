#!/usr/bin/env node
// Chunking matrix (#229 E7): A/B chunker variants in the eval's IN-MEMORY
// dense path (re-chunk + re-embed per arm; the store stays untouched — prod
// reindexes only for a winner). One arm per process — the box OOMs on big
// in-memory embeds, so run with EMBEDDING_BATCH=8 and a single --arm.
//
//   set -a; source .env; set +a
//   EMBEDDING_BATCH=8 node eval/chunking-matrix.js --arm baseline
//   arms: baseline (300/50) · overlap0 (300/0) · target450 (450/50)
//         prime (300/50 + edge-neighbor titles folded into the embed prefix)
//
// Reports, per arm: chunk count / embed-corpus size, REAL bge tokenizer stats
// (max/p95/%>512 — the 4-chars/tok estimate is only a proxy), dense-leg
// metrics, and hybrid (bm25 lexical + RRF k=60, no rerank/expand so the
// chunking signal isn't laundered through later stages) on the frozen set.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveConnectionString, createPool } from '../src/db.js';
import { loadCorpus } from '../src/search/service.js';
import { createEmbeddingProvider } from '../src/search/providers/embedding.js';
import { createDenseRetriever } from '../src/search/retrievers/dense.js';
import { createLexicalRetriever } from '../src/search/retrievers/lexical.js';
import { SearchPipeline } from '../src/search/pipeline.js';
import { getJoiner } from '../src/search/fusion.js';
import { chunkParts } from '../src/search/chunking.js';
import { scoreQuery, meanScores } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KS = [1, 5, 10, 20, 30];
const fmt = (n) => (Math.round(n * 1000) / 1000).toFixed(3);

const ARMS = {
  baseline: { chunkOpts: { targetTokens: 300, overlapTokens: 50 } },
  overlap0: { chunkOpts: { targetTokens: 300, overlapTokens: 0 } },
  target450: { chunkOpts: { targetTokens: 450, overlapTokens: 50 } },
  prime: { chunkOpts: { targetTokens: 300, overlapTokens: 50 }, prime: true },
};

function parseArgs(argv) {
  const args = { arm: 'baseline', dataset: process.env.EVAL_DATASET || 'eval/dataset-stocks.json' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--arm') args.arm = argv[++i];
    else if (argv[i] === '--dataset') args.dataset = argv[++i];
  }
  if (!ARMS[args.arm]) { console.error(`unknown arm "${args.arm}" (${Object.keys(ARMS).join(', ')})`); process.exit(1); }
  return args;
}

// Edge-neighbor titles per node (#229 arm c): the graph's authored edges are
// free contextual-retrieval signal. Cap 5, deterministic by node id.
async function neighborTitles(pool, gid) {
  const { rows } = await pool.query(
    `SELECT e.source_id, e.target_id, ts.meta->>'title' AS source_title, tt.meta->>'title' AS target_title
       FROM edges e
       JOIN tasks ts ON ts.id = e.source_id
       JOIN tasks tt ON tt.id = e.target_id
      WHERE e.graph_id = $1
      ORDER BY e.source_id, e.target_id`,
    [gid],
  );
  const map = new Map(); // taskId -> [titles]
  const add = (id, title) => {
    if (!title) return;
    const list = map.get(id) || [];
    if (list.length < 5 && !list.includes(title)) list.push(title);
    map.set(id, list);
  };
  for (const r of rows) {
    add(r.source_id, r.target_title);
    add(r.target_id, r.source_title);
  }
  return map;
}

async function main() {
  const args = parseArgs(process.argv);
  const arm = ARMS[args.arm];
  const dataset = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args.dataset), 'utf-8'));
  const gid = dataset.gid || 'fwmhe8ysfrnx9fw7';
  const pool = createPool(resolveConnectionString());
  const corpus = await loadCorpus(pool, gid);
  const { queries, qrels } = dataset;
  const qids = Object.keys(queries);

  // Arm c: decorate titles with neighbor titles for the DENSE leg only — the
  // title prefix is what chunkParts folds into every chunk's embedText.
  let denseCorpus = corpus;
  if (arm.prime) {
    const nbrs = await neighborTitles(pool, gid);
    denseCorpus = corpus.map((d) => {
      const titles = nbrs.get(Number(d.id)) || nbrs.get(String(d.id)) || [];
      return titles.length ? { ...d, title: `${d.title} (related: ${titles.join(', ')})` } : d;
    });
  }

  // Chunk-shape + REAL-tokenizer report (the 512-window check the node demands).
  let chunkCount = 0;
  let embedChars = 0;
  const embedTexts = [];
  for (const d of denseCorpus) {
    for (const c of chunkParts({ title: d.title, description: d.description, body: d.body }, arm.chunkOpts)) {
      chunkCount++;
      embedChars += c.embedText.length;
      embedTexts.push(c.embedText);
    }
  }
  const { AutoTokenizer } = await import('@huggingface/transformers');
  const tok = await AutoTokenizer.from_pretrained('Xenova/bge-small-en-v1.5');
  const realTok = embedTexts.map((t) => tok.encode(t).length).sort((a, b) => a - b);
  const over512 = realTok.filter((n) => n > 512).length;
  const p95tok = realTok[Math.floor(realTok.length * 0.95)];

  console.log(`\nChunking matrix — arm=${args.arm} (target=${arm.chunkOpts.targetTokens}, overlap=${arm.chunkOpts.overlapTokens}${arm.prime ? ', +edge-priming' : ''})`);
  console.log(`graph ${gid} · ${corpus.length} docs · ${qids.length} queries`);
  console.log(`chunks: ${chunkCount} · embed corpus: ${(embedChars / 1024).toFixed(0)}KB · REAL bge tokens: max ${realTok[realTok.length - 1]}, p95 ${p95tok}, >512: ${over512} (${(100 * over512 / realTok.length).toFixed(1)}%)`);

  const provider = createEmbeddingProvider({
    backend: 'local-onnx', model: 'Xenova/bge-small-en-v1.5', dim: 384,
    batchSize: Number(process.env.EMBEDDING_BATCH || 8),
  }, {});

  const denseInner = createDenseRetriever({ provider, chunkOpts: arm.chunkOpts });
  // Freeze the dense leg to the (possibly decorated) arm corpus regardless of
  // ctx — the lexical leg must keep ranking the ORIGINAL titles.
  const dense = { name: 'dense', retrieve: (q, ctx) => denseInner.retrieve(q, { ...ctx, corpus: denseCorpus }) };
  const lexical = createLexicalRetriever({ ranker: 'bm25' });

  const t0 = performance.now();
  await dense.retrieve(queries[qids[0]], {}); // build + embed the index once, timed
  const embedMs = Math.round(performance.now() - t0);
  console.log(`corpus embed: ${embedMs}ms (batch ${process.env.EMBEDDING_BATCH || 8})`);

  // Dense leg alone.
  const densePer = [];
  for (const qid of qids) {
    const out = await dense.retrieve(queries[qid], { denseTopK: 100 });
    densePer.push(scoreQuery(out.map((c) => String(c.taskId)), qrels[qid] || {}, KS));
  }
  // Hybrid: bm25 lexical + dense → RRF (no rerank/expand — isolate chunking).
  const pipeline = new SearchPipeline({
    retrievers: [lexical, dense],
    joiner: getJoiner('rrf'),
    fusionOpts: { k: 60 },
    postprocessors: [],
    topK: 100,
  });
  const hybridPer = [];
  for (const qid of qids) {
    const { candidates } = await pipeline.run(queries[qid], { corpus, lexicalTopK: 50, denseTopK: 50 });
    hybridPer.push(scoreQuery(candidates.map((c) => String(c.taskId)), qrels[qid] || {}, KS));
  }

  for (const [label, per] of [['dense-leg', densePer], ['hybrid (bm25+RRF)', hybridPer]]) {
    const mean = meanScores(per);
    console.log(`\n  ── ${label} ──`);
    for (const key of ['map', 'mrr', 'precision@1', 'ndcg@10', 'recall@5', 'recall@10', 'recall@20', 'recall@30']) {
      if (mean[key] !== undefined) console.log(`     ${key.padEnd(12)} ${fmt(mean[key])}`);
    }
  }
  console.log('');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
