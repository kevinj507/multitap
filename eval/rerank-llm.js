#!/usr/bin/env node
// LLM RERANK experiment (#447/E11b follow-up). The reasoning-gap miss is a
// RANKING problem, not a recall problem: the right docs ARE retrieved, just
// buried (raw recall@20 0.476 but recall@100 0.99 on the 73-node stock graph).
// So instead of rewriting the query (which taxes already-good queries), retrieve
// a DEEP pool and let a fast LLM reorder it into a good top-10.
//
// Pipeline per query: raw query → bm25+dense→RRF→graphExpand → top POOL_N →
// LLM listwise rerank (sees each candidate's title + body excerpt) → score.
// Baseline = the same pool WITHOUT the LLM rerank (i.e. the fused order). The Δ
// isolates what the reranker buys. Runs on the reasoning set (where it should
// help) and the direct set (regression check — a good reranker must not hurt
// queries that already rank well).
//
//   set -a; source .env; set +a
//   GROQ_API_KEY=gsk_... node eval/rerank-llm.js
//
// Knobs: RERANK_MODELS (comma), POOL_N (default 50), RERANK_TOPK (ids to ask
// for, default 15), SWEEP_DATASETS, SWEEP_DELAY_MS, STOCK_GID.

import fs from 'fs';
import path from 'path';
import { resolveConnectionString, createPool } from '../src/db.js';
import { SearchService } from '../src/search/service.js';
import { scoreQuery, meanScores } from './metrics.js';

const KS = [1, 5, 10, 20];
const POOL_N = Math.max(5, Number(process.env.POOL_N || 50));
const ASK_TOPK = Math.max(5, Number(process.env.RERANK_TOPK || 15));
const DELAY_MS = Math.max(0, Number(process.env.SWEEP_DELAY_MS || 0));
const MODELS = (process.env.RERANK_MODELS ? process.env.RERANK_MODELS.split(',') : ['llama-3.3-70b-versatile'])
  .map((m) => m.trim()).filter(Boolean);
const DATASETS = (process.env.SWEEP_DATASETS
  ? process.env.SWEEP_DATASETS.split(',')
  : ['eval/dataset-stocks-reasoning.json', 'eval/dataset-stocks-direct-sample.json'])
  .map((p) => p.trim()).filter(Boolean).map((p) => path.resolve(process.cwd(), p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => (Math.round(n * 1000) / 1000).toFixed(3);
const d = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : ' 0.000');
const METRICS = ['precision@1', 'mrr', 'ndcg@10', 'recall@10', 'recall@20', 'map'];

// Pull title + a body excerpt for every node so the reranker judges real text,
// not just the lexical snippet fragment.
function docText(content) {
  const s = String(content || '');
  const m = s.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = m ? m[1] : '';
  const body = (m ? m[2] : s).replace(/\s+/g, ' ').trim();
  const title = (fm.match(/^title:\s*(.+)$/m)?.[1] || '').trim();
  return { title, excerpt: body.slice(0, 220) };
}

// Listwise rerank via Groq (OpenAI-compatible, JSON mode). Returns an ordered
// array of candidate ids (most relevant first); falls back to [] on any failure
// so the caller keeps the fused order.
async function llmRerank(model, query, pool) {
  const list = pool.map((c, i) => `${i + 1}. [id:${c.id}] ${c.title || '(untitled)'} — ${c.excerpt}`).join('\n');
  const system = [
    'You re-rank search results for a knowledge base by how well each document answers the user\'s query INTENT.',
    'The literal words may differ from the intent (e.g. "keep the servers powered up" means energy/utility/grid suppliers).',
    `Return JSON {"ranking":[ids]} — the ${ASK_TOPK} most relevant document ids, most relevant FIRST. Use only ids from the list. No prose.`,
  ].join('\n');
  const user = `Query: ${query}\n\nDocuments:\n${list}`;
  const body = {
    model,
    max_completion_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(txt);
    const ids = Array.isArray(parsed?.ranking) ? parsed.ranking : [];
    return ids.map((x) => String(x).replace(/[^0-9]/g, '')).filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!process.env.GROQ_API_KEY) throw new Error('set GROQ_API_KEY');
  const pool = createPool(resolveConnectionString());

  const cfg = {
    retrievers: ['lexical', 'dense'],
    lexical: { ranker: 'bm25' },
    providers: {
      embedding: { backend: 'local-onnx', model: 'Xenova/bge-small-en-v1.5', dim: 384 },
      rerank: { backend: 'none' },
    },
    postprocessors: ['graphExpand'],
    fusion: { mode: 'rrf', k: 60 },
    topK: POOL_N,
  };
  const svc = new SearchService({ config: cfg, pool });

  for (const datasetPath of DATASETS) {
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    const GID = process.env.STOCK_GID || dataset.gid || dataset.gid_default || 'fwmhe8ysfrnx9fw7';
    const { queries, qrels } = dataset;
    const qids = Object.keys(queries);

    // Node text map for the whole graph (corpus is small).
    const { rows } = await pool.query('SELECT id, content FROM tasks WHERE graph_id=$1', [GID]);
    const textById = new Map(rows.map((r) => [String(r.id), docText(r.content)]));

    // Fused pool + baseline score (no rerank) per query.
    const baseScores = [];
    const pools = {};
    for (const qid of qids) {
      const { candidates } = await svc.search(queries[qid], { gid: GID });
      const ids = candidates.map((c) => String(c.taskId));
      pools[qid] = ids.map((id) => ({ id, ...(textById.get(id) || { title: '', excerpt: '' }) }));
      baseScores.push(scoreQuery(ids, qrels[qid] || {}, KS));
    }
    const mBase = meanScores(baseScores);

    const rows2 = [];
    for (const model of MODELS) {
      const scores = [];
      const latencies = [];
      const perQ = [];
      let failed = 0;
      for (const qid of qids) {
        const fused = pools[qid];
        if (DELAY_MS) await sleep(DELAY_MS);
        const t0 = Date.now();
        const order = await llmRerank(model, queries[qid], fused);
        latencies.push(Date.now() - t0);
        // Rebuild full ranking: LLM's valid ids first (deduped), then the rest
        // of the pool in fused order. Empty order ⇒ fused order unchanged.
        const valid = [];
        const seen = new Set();
        const inPool = new Set(fused.map((c) => c.id));
        for (const id of order) if (inPool.has(id) && !seen.has(id)) { seen.add(id); valid.push(id); }
        if (!valid.length) failed++;
        const reranked = [...valid, ...fused.map((c) => c.id).filter((id) => !seen.has(id))];
        const sBase = scoreQuery(fused.map((c) => c.id), qrels[qid] || {}, KS);
        const sNew = scoreQuery(reranked, qrels[qid] || {}, KS);
        scores.push(sNew);
        perQ.push({ qid, p1: [sBase['precision@1'], sNew['precision@1']] });
      }
      rows2.push({ model, mean: meanScores(scores), latencies, failed, perQ });
    }

    console.log(`\n══ ${path.basename(datasetPath)} · graph ${GID} · ${qids.length} queries · pool top-${POOL_N} → LLM rerank top-${ASK_TOPK}`);
    console.log(`   baseline = fused order (bm25+dense→RRF→graphExpand), no rerank\n`);
    console.log(`  ${'model'.padEnd(30)}` + METRICS.map((m) => m.padStart(11)).join(''));
    console.log(`  ${'fused (baseline)'.padEnd(30)}` + METRICS.map((m) => fmt(mBase[m] || 0).padStart(11)).join(''));
    for (const r of rows2) console.log(`  ${r.model.padEnd(30)}` + METRICS.map((m) => fmt(r.mean[m] || 0).padStart(11)).join(''));
    console.log(`  ${''.padEnd(30)}` + METRICS.map(() => '———'.padStart(11)).join(''));
    for (const r of rows2) console.log(`  Δ ${r.model.padEnd(28)}` + METRICS.map((m) => d((r.mean[m] || 0) - (mBase[m] || 0)).padStart(11)).join(''));
    for (const r of rows2) {
      const mean = r.latencies.reduce((a, b) => a + b, 0) / (r.latencies.length || 1);
      const moved = r.perQ.filter((p) => p.p1[0] !== p.p1[1]);
      console.log(`\n  ${r.model}: rerank latency mean ${Math.round(mean)}ms · failed/empty ${r.failed}/${qids.length} · p@1 moved on ${moved.length}:`);
      for (const p of moved) console.log(`    ${p.qid}: ${fmt(p.p1[0])} → ${fmt(p.p1[1])}`);
    }
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
