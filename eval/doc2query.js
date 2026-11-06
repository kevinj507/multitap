#!/usr/bin/env node
// DOC2QUERY experiment (#447/E11b follow-up). Second cut at write-time document
// expansion, after topic-keyword expansion came back flat/negative on dense
// (eval/doc-expansion.js). doc2query-PROPER: for each node the LLM predicts the
// QUESTIONS a user would ask that this node best answers, and we append those
// questions to the node's indexed text. Two differences from the first cut:
//   1. questions (real query-shaped text), not topic keywords — closer to how
//      the literature's docTTTTTquery actually works;
//   2. the FULL HYBRID pipeline (bm25 lexical + dense → RRF), because doc2query's
//      classic gain is on the LEXICAL side (it injects matchable query terms),
//      which the dense-only first cut never measured.
//
// MEMORY-SAFE: dense uses our own incremental embed (batch EMBED_BATCH) + cosine
// (the in-memory pipeline OOMs a 2nd ONNX copy on this box, #436); lexical uses
// the pure-JS BM25 retriever; we RRF-fuse the two id lists ourselves. graphExpand
// is omitted (append-mode, inert per #231). Baseline = same pipeline over the
// ORIGINAL text; Δ isolates what the questions buy.
//
//   set -a; source .env; set +a
//   GROQ_API_KEY=gsk_... node eval/doc2query.js
//
// Questions cached to eval/.doc2query-<gid>.json. Knobs: EXPAND_MODEL,
// SWEEP_DELAY_MS (gen throttle, default 3000), EMBED_BATCH (default 4),
// N_QUESTIONS (default 5), RRF_K (default 60), SWEEP_DATASETS, STOCK_GID.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveConnectionString, createPool } from '../src/db.js';
import { loadCorpus } from '../src/search/service.js';
import { createEmbeddingProvider } from '../src/search/providers/embedding.js';
import { createLexicalRetriever } from '../src/search/retrievers/lexical.js';
import { scoreQuery, meanScores } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KS = [1, 5, 10, 20];
const GEN_MODEL = process.env.EXPAND_MODEL || 'llama-3.3-70b-versatile';
const DELAY_MS = Math.max(0, Number(process.env.SWEEP_DELAY_MS || 3000));
const EMBED_BATCH = Math.max(1, Number(process.env.EMBED_BATCH || 4));
const N_Q = Math.max(1, Number(process.env.N_QUESTIONS || 5));
const RRF_K = Math.max(1, Number(process.env.RRF_K || 60));
const POOL = 50;
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

const SYSTEM = [
  `You are given a knowledge-base document. Output ${N_Q} distinct natural-language search queries that a user might type for which THIS document is the ideal answer.`,
  'Favor indirect, intent-based phrasings a searcher would actually use — not keyword restatements of the title. If the document is about a concrete thing, include the real-world problems/intents it speaks to.',
  'Output one query per line. No numbering, no preamble, no commentary.',
].join('\n');

async function genQuestions(doc) {
  const src = `Title: ${doc.title}\n${doc.description ? `Summary: ${doc.description}\n` : ''}Body: ${(doc.body || '').replace(/\s+/g, ' ').slice(0, 900)}`;
  const body = { model: GEN_MODEL, max_completion_tokens: 160, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: src }] };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return '';
    const data = await res.json();
    const txt = (data?.choices?.[0]?.message?.content || '').trim();
    return txt.split('\n').map((l) => l.replace(/^[\s\-\d.)]+/, '').trim()).filter(Boolean).join(' ');
  } catch { return ''; }
}

const denseRank = (qv, vecs, ids) => ids.map((id, i) => ({ id, s: dot(qv, vecs[i]) })).sort((a, b) => b.s - a.s).map((x) => String(x.id));

// RRF-fuse ranked id lists into one ordering.
function rrf(lists) {
  const score = new Map();
  for (const list of lists) list.forEach((id, i) => score.set(id, (score.get(id) || 0) + 1 / (RRF_K + i + 1)));
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
}

async function main() {
  if (!process.env.GROQ_API_KEY) throw new Error('set GROQ_API_KEY');
  const pool = createPool(resolveConnectionString());
  const GID = process.env.STOCK_GID || 'fwmhe8ysfrnx9fw7';
  const docs = await loadCorpus(pool, GID);
  docs.sort((a, b) => a.id - b.id);
  console.log(`corpus: ${docs.length} nodes · graph ${GID} · ${GEN_MODEL} · ${N_Q} questions/node · hybrid bm25+dense→RRF`);

  const cachePath = path.join(__dirname, `.doc2query-${GID}.json`);
  let cache = {};
  if (!process.env.EXPAND_REFRESH && fs.existsSync(cachePath)) { cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8')); console.log(`loaded ${Object.keys(cache).length} cached`); }
  let gen = 0;
  for (const doc of docs) {
    if (typeof cache[doc.id] === 'string') continue;
    if (DELAY_MS && gen > 0) await sleep(DELAY_MS);
    cache[doc.id] = await genQuestions(doc);
    if (++gen % 10 === 0) process.stdout.write(`  generated ${gen}…\n`);
  }
  if (gen) fs.writeFileSync(cachePath, JSON.stringify(cache, null, 0));
  console.log(`questions ready (${gen} new, ${docs.filter((x) => !cache[x.id]).length} empty)\n`);

  const ids = docs.map((x) => String(x.id));
  const origDocs = docs;
  const expDocs = docs.map((x) => ({ ...x, body: cache[x.id] ? `${x.body}\n${cache[x.id]}` : x.body }));
  const origTexts = origDocs.map((x) => `${x.title}\n${x.description}\n${x.body}`.trim());
  const expTexts = expDocs.map((x) => `${x.title}\n${x.description}\n${x.body}`.trim());

  const provider = createEmbeddingProvider({ backend: 'local-onnx', model: 'Xenova/bge-small-en-v1.5', dim: 384, batchSize: EMBED_BATCH }, {});
  console.log('embedding original…'); const origVecs = await provider.embed(origTexts);
  console.log('embedding +questions…'); const expVecs = await provider.embed(expTexts);
  const qvecCache = new Map();
  const qvec = async (q) => { if (!qvecCache.has(q)) qvecCache.set(q, (await provider.embed([QUERY_PREFIX + q]))[0]); return qvecCache.get(q); };

  const lex = createLexicalRetriever({ ranker: 'bm25', topK: POOL });
  const lexRank = (q, corpus) => lex.retrieve(q, { corpus, lexicalTopK: POOL }).map((c) => String(c.taskId));

  for (const datasetPath of DATASETS) {
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    const { queries, qrels } = dataset;
    const qids = Object.keys(queries);
    const base = []; const exp = []; const perQ = [];
    for (const qid of qids) {
      const q = queries[qid]; const qv = await qvec(q); const rel = qrels[qid] || {};
      const sB = scoreQuery(rrf([denseRank(qv, origVecs, ids), lexRank(q, origDocs)]), rel, KS);
      const sE = scoreQuery(rrf([denseRank(qv, expVecs, ids), lexRank(q, expDocs)]), rel, KS);
      base.push(sB); exp.push(sE);
      perQ.push({ qid, p1: [sB['precision@1'], sE['precision@1']] });
    }
    const mB = meanScores(base); const mE = meanScores(exp);
    console.log(`══ ${path.basename(datasetPath)} · ${qids.length} queries · hybrid bm25+dense→RRF (raw query)`);
    console.log(`  ${'indexed text'.padEnd(24)}` + METRICS.map((m) => m.padStart(11)).join(''));
    console.log(`  ${'original (baseline)'.padEnd(24)}` + METRICS.map((m) => fmt(mB[m] || 0).padStart(11)).join(''));
    console.log(`  ${'+ doc2query questions'.padEnd(24)}` + METRICS.map((m) => fmt(mE[m] || 0).padStart(11)).join(''));
    console.log(`  ${'Δ'.padEnd(24)}` + METRICS.map((m) => d((mE[m] || 0) - (mB[m] || 0)).padStart(11)).join(''));
    const moved = perQ.filter((p) => p.p1[0] !== p.p1[1]);
    console.log(`  p@1 moved on ${moved.length}/${qids.length}: ${moved.map((p) => `${p.qid} ${fmt(p.p1[0])}→${fmt(p.p1[1])}`).join('  ')}\n`);
  }
  console.log('sample questions:');
  for (const doc of docs.slice(0, 3)) console.log(`  [${doc.id}] ${doc.title}\n      → ${(cache[doc.id] || '(none)').slice(0, 180)}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
