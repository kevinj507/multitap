#!/usr/bin/env node
// DOCUMENT-EXPANSION experiment (#447/E11b follow-up). The reasoning-gap miss is
// a RANKING problem (right docs retrieved but buried). LLM rerank fixes it but
// costs ~3.8k tokens PER SEARCH (free-tier: ~26/day). This tests the cheap
// alternative: at WRITE time, have the LLM enrich what gets EMBEDDED for each
// node (doc2query-style) — pay once per node, then every search is free vector
// math. If a utility node is enriched with its implied intents ("powers data
// centers, keeps AI server farms running"), its embedding moves toward the
// reasoning-gap query and it ranks higher — no per-search LLM.
//
// MEMORY-SAFE design: this box (~3GB, plus the app on :3000 holds an ONNX model)
// OOMs if we bulk-embed the whole corpus through the pipeline (#436). So we
// isolate the DENSE leg — exactly what expansion affects — and embed in tiny
// batches: embed each node's text ONCE (original and expanded), then rank by
// cosine to the query. bge-*-v1.5 returns L2-normalized vectors, so dot==cosine.
// This drops lexical/RRF/graphExpand to stay in memory; it's the clean isolation
// of "does enriching the embedded text pull buried docs up?". Δ = expanded−orig.
//
//   set -a; source .env; set +a
//   GROQ_API_KEY=gsk_... node eval/doc-expansion.js
//
// Expansions cached to eval/.doc-expansions-<gid>.json (re-runs cost 0 tokens;
// EXPAND_REFRESH=1 to regenerate). Knobs: EXPAND_MODEL, SWEEP_DELAY_MS (gen
// throttle, default 3000), EMBED_BATCH (default 4), SWEEP_DATASETS, STOCK_GID.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveConnectionString, createPool } from '../src/db.js';
import { loadCorpus } from '../src/search/service.js';
import { createEmbeddingProvider } from '../src/search/providers/embedding.js';
import { scoreQuery, meanScores } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KS = [1, 5, 10, 20];
const GEN_MODEL = process.env.EXPAND_MODEL || 'llama-3.3-70b-versatile';
const DELAY_MS = Math.max(0, Number(process.env.SWEEP_DELAY_MS || 3000));
const EMBED_BATCH = Math.max(1, Number(process.env.EMBED_BATCH || 4));
// bge-*-v1.5 was trained with a query-side instruction; passages stay plain.
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';
const DATASETS = (process.env.SWEEP_DATASETS
  ? process.env.SWEEP_DATASETS.split(',')
  : ['eval/dataset-stocks-reasoning.json', 'eval/dataset-stocks-direct-sample.json'])
  .map((p) => p.trim()).filter(Boolean).map((p) => path.resolve(process.cwd(), p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => (Math.round(n * 1000) / 1000).toFixed(3);
const d = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : ' 0.000');
const METRICS = ['precision@1', 'mrr', 'ndcg@10', 'recall@10', 'recall@20', 'map'];
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const EXPAND_SYSTEM = [
  'You enrich a knowledge-base document so semantic search can find it from indirect, intent-based queries.',
  'Given a document, output a SHORT list of the real-world topics, entities, and question-intents it actually answers — especially ones a searcher would phrase differently from the document\'s own words (e.g. a doc about electric utilities also answers "what keeps AI data centers / server farms powered").',
  'Output comma-separated terms and short phrases only — no preamble, no sentences, no repetition of the title verbatim.',
].join('\n');

async function genExpansion(doc) {
  const src = `Title: ${doc.title}\n${doc.description ? `Summary: ${doc.description}\n` : ''}Body: ${(doc.body || '').replace(/\s+/g, ' ').slice(0, 900)}`;
  const body = { model: GEN_MODEL, max_completion_tokens: 130, messages: [{ role: 'system', content: EXPAND_SYSTEM }, { role: 'user', content: src }] };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || '').replace(/\s+/g, ' ').trim();
  } catch { return ''; }
}

// Rank doc ids by cosine to the query vector (vectors are L2-normalized).
function denseRank(qvec, vecs, ids) {
  return ids
    .map((id, i) => ({ id, s: dot(qvec, vecs[i]) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => String(x.id));
}

async function main() {
  if (!process.env.GROQ_API_KEY) throw new Error('set GROQ_API_KEY');
  const pool = createPool(resolveConnectionString());
  const GID = process.env.STOCK_GID || 'fwmhe8ysfrnx9fw7';

  const docs = await loadCorpus(pool, GID);
  docs.sort((a, b) => a.id - b.id);
  console.log(`corpus: ${docs.length} nodes · graph ${GID} · expansion model ${GEN_MODEL} · embed batch ${EMBED_BATCH}`);

  // --- expansions (cached) --------------------------------------------------
  const cachePath = path.join(__dirname, `.doc-expansions-${GID}.json`);
  let cache = {};
  if (!process.env.EXPAND_REFRESH && fs.existsSync(cachePath)) {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    console.log(`loaded ${Object.keys(cache).length} cached expansions`);
  }
  let generated = 0;
  for (const doc of docs) {
    if (typeof cache[doc.id] === 'string') continue;
    if (DELAY_MS && generated > 0) await sleep(DELAY_MS);
    cache[doc.id] = await genExpansion(doc);
    if (++generated % 10 === 0) process.stdout.write(`  generated ${generated}…\n`);
  }
  if (generated) fs.writeFileSync(cachePath, JSON.stringify(cache, null, 0));
  console.log(`expansions ready (${generated} new, ${docs.filter((x) => !cache[x.id]).length} empty)\n`);

  // --- embed both corpora in tiny batches (memory-safe) ---------------------
  const ids = docs.map((x) => String(x.id));
  const origTexts = docs.map((x) => `${x.title}\n${x.description}\n${x.body}`.trim());
  const expTexts = docs.map((x, i) => (cache[x.id] ? `${origTexts[i]}\nRelated topics: ${cache[x.id]}` : origTexts[i]));
  const provider = createEmbeddingProvider({ backend: 'local-onnx', model: 'Xenova/bge-small-en-v1.5', dim: 384, batchSize: EMBED_BATCH }, {});
  console.log('embedding original corpus…');
  const origVecs = await provider.embed(origTexts);
  console.log('embedding expanded corpus…');
  const expVecs = await provider.embed(expTexts);

  // query-vector cache so each query is embedded once (reused across arms)
  const qvecCache = new Map();
  const qvec = async (q) => { if (!qvecCache.has(q)) qvecCache.set(q, (await provider.embed([QUERY_PREFIX + q]))[0]); return qvecCache.get(q); };

  // --- score per dataset ----------------------------------------------------
  for (const datasetPath of DATASETS) {
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    const { queries, qrels } = dataset;
    const qids = Object.keys(queries);
    const base = []; const exp = []; const perQ = [];
    for (const qid of qids) {
      const qv = await qvec(queries[qid]);
      const sB = scoreQuery(denseRank(qv, origVecs, ids), qrels[qid] || {}, KS);
      const sE = scoreQuery(denseRank(qv, expVecs, ids), qrels[qid] || {}, KS);
      base.push(sB); exp.push(sE);
      perQ.push({ qid, p1: [sB['precision@1'], sE['precision@1']] });
    }
    const mB = meanScores(base); const mE = meanScores(exp);
    console.log(`══ ${path.basename(datasetPath)} · ${qids.length} queries · DENSE-ONLY (bge-small, raw query)`);
    console.log(`  ${'embedded text'.padEnd(22)}` + METRICS.map((m) => m.padStart(11)).join(''));
    console.log(`  ${'original (baseline)'.padEnd(22)}` + METRICS.map((m) => fmt(mB[m] || 0).padStart(11)).join(''));
    console.log(`  ${'+ doc expansion'.padEnd(22)}` + METRICS.map((m) => fmt(mE[m] || 0).padStart(11)).join(''));
    console.log(`  ${'Δ'.padEnd(22)}` + METRICS.map((m) => d((mE[m] || 0) - (mB[m] || 0)).padStart(11)).join(''));
    const moved = perQ.filter((p) => p.p1[0] !== p.p1[1]);
    console.log(`  p@1 moved on ${moved.length}/${qids.length}: ${moved.map((p) => `${p.qid} ${fmt(p.p1[0])}→${fmt(p.p1[1])}`).join('  ')}\n`);
  }

  console.log('sample expansions:');
  for (const doc of docs.slice(0, 4)) console.log(`  [${doc.id}] ${doc.title}\n      → ${(cache[doc.id] || '(none)').slice(0, 150)}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
