#!/usr/bin/env node
// Eval harness runner for the KB search engine (graph tasks #171/#173).
//
// Runs the current retrieval tier over a frozen labeled query set and reports
// BOTH accuracy (Recall@K / nDCG@K / MRR / MAP, pytrec_eval semantics) AND
// latency (per-query p50/p95) — the dual gate from #173 §8. Phase 1 wires the
// Tier-0 lexical ranker (public/search-lexical.js); later phases point
// `runTier` at the hybrid + graph backend behind the same harness so each
// swap is A/B'd against the same numbers.
//
// Usage:
//   node eval/run-eval.js                 # offline fixture corpus (default)
//   node eval/run-eval.js --gid <id>      # score against a live graph's nodes
//   node eval/run-eval.js --k 5,10,20     # custom cutoffs
//   MULTITAP_BASE_URL=... MULTITAP_AGENT_TOKEN=... node eval/run-eval.js --gid <id>
//
// --gid only swaps the CORPUS (live node bodies); queries + qrels still come
// from eval/dataset.json, so author qrels against real node ids before using it.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assemblePipeline } from '../src/search/service.js';
import { defaultConfig, configFromEnv } from '../src/search/config.js';
import { scoreQuery, meanScores, percentile } from './metrics.js';
import { resolveAgentToken } from './resolve-token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = resolveAgentToken();

function parseArgs(argv) {
  const args = { ks: [5, 10], gid: null, dataset: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--gid') args.gid = argv[++i];
    else if (argv[i] === '--k') args.ks = argv[++i].split(',').map((n) => parseInt(n, 10)).filter(Boolean);
    else if (argv[i] === '--dataset') args.dataset = argv[++i];
    else if (argv[i] === '--ab-expand') args.abExpand = true;
  }
  return args;
}

// Edges for graph expansion (#197). Live graph: the /graph view returns
// { nodes, links } with links shaped {source,target,type}. Fixture: an optional
// `edges` array on the dataset. Either way the expander gets the same shape.
async function loadLiveEdges(gid) {
  const base = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000';
  const headers = TOKEN
    ? { Authorization: `Bearer ${TOKEN}` }
    : {};
  const res = await fetch(`${base}/api/graphs/${gid}/graph`, { headers });
  if (!res.ok) throw new Error(`failed to load edges for graph ${gid}: ${res.status}`);
  const { links = [] } = await res.json();
  return links.map((l) => ({ source: l.source, target: l.target, type: l.type }));
}

async function loadLiveCorpus(gid) {
  const base = process.env.MULTITAP_BASE_URL || process.env.GRAPHTASK_BASE_URL || 'http://127.0.0.1:3000';
  const headers = TOKEN
    ? { Authorization: `Bearer ${TOKEN}` }
    : {};
  const res = await fetch(`${base}/api/graphs/${gid}/tasks`, { headers });
  if (!res.ok) throw new Error(`failed to load live graph ${gid}: ${res.status}`);
  const rows = await res.json();
  // Minimal frontmatter split (mirrors public/app.js parseFrontmatter).
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

// The retrieval tier under test is the SAME configured SearchPipeline the route
// runs, not a bespoke call — so the eval measures exactly what ships (#173 §11
// "two callers, one pipeline"). Default is the boring Tier-0 lexical with a wide
// top-K (recall@K needs a deep list); setting EMBEDDING_BACKEND (e.g.
// `local-onnx`) flips on the dense leg via configFromEnv, and this harness A/Bs
// each backend on the same frozen set. Corpus rides in ctx — no DB.
// configFromEnv with an empty env reduces to the lexical-only default, so we
// always read the env — that's what lets LEXICAL_RANKER/EMBEDDING_* (etc.)
// A/Bs run through this harness without code edits (#228).
const EVAL_CONFIG = { ...configFromEnv(process.env), topK: 100 };

// Build a pipeline from EVAL_CONFIG, optionally appending graphExpand so the
// A/B compares the SAME retrieval tier with vs without the recall lever (#197).
function buildPipeline({ expand = false } = {}) {
  const cfg = { ...EVAL_CONFIG, postprocessors: [...EVAL_CONFIG.postprocessors] };
  if (expand && !cfg.postprocessors.includes('graphExpand')) cfg.postprocessors.push('graphExpand');
  return assemblePipeline(cfg, {});
}

async function runTier(pipeline, query, corpus, edges) {
  const ctx = { corpus, lexicalTopK: 100, denseTopK: 100 };
  if (edges) ctx.edges = edges; // only the expand pipeline traverses these
  const { candidates } = await pipeline.run(query, ctx);
  return candidates.map((c) => c.taskId);
}

function fmt(n) { return (Math.round(n * 1000) / 1000).toFixed(3); }
function delta(n) { const s = fmt(Math.abs(n)); return n > 0 ? `+${s}` : n < 0 ? `−${s}` : ' 0.000'; }

// A/B recall table: baseline vs +graphExpand on the same frozen set, so the
// gate (#197) is legible — does expansion lift recall@k without tanking nDCG?
async function runAbExpand(args, corpus, edges, queries, qrels, qids) {
  const base = buildPipeline({ expand: false });
  const exp = buildPipeline({ expand: true });
  const bQ = [];
  const eQ = [];
  for (const qid of qids) {
    const qrel = qrels[qid] || {};
    bQ.push(scoreQuery((await runTier(base, queries[qid], corpus)).map(String), qrel, args.ks));
    eQ.push(scoreQuery((await runTier(exp, queries[qid], corpus, edges)).map(String), qrel, args.ks));
  }
  const bm = meanScores(bQ);
  const em = meanScores(eQ);
  console.log(`\n  ── A/B: baseline vs +graphExpand (edges: ${edges.length}) ──`);
  console.log(`     ${'metric'.padEnd(12)} ${'baseline'.padStart(9)} ${'+expand'.padStart(9)} ${'Δ'.padStart(8)}`);
  for (const key of Object.keys(bm)) {
    console.log(`     ${key.padEnd(12)} ${fmt(bm[key]).padStart(9)} ${fmt(em[key]).padStart(9)} ${delta(em[key] - bm[key]).padStart(8)}`);
  }
  const recallKeys = Object.keys(bm).filter((k) => k.startsWith('recall@'));
  const lifted = recallKeys.some((k) => em[k] > bm[k] + 1e-9);
  const hurt = (em['ndcg@' + args.ks[0]] ?? 0) < (bm['ndcg@' + args.ks[0]] ?? 0) - 1e-9;
  console.log(`\n  Gate: ${lifted ? 'recall LIFTED' : 'no recall lift'}${hurt ? ' · WARNING nDCG dropped (precision cost)' : ''}\n`);
}

async function main() {
  const args = parseArgs(process.argv);
  // --dataset points at an alternate frozen query set (e.g. the live-graph
  // qrels in eval/dataset-stocks.json); defaults to the offline fixture. Queries
  // + qrels always come from this file; --gid only swaps the CORPUS for live nodes.
  const datasetPath = args.dataset
    ? path.resolve(process.cwd(), args.dataset)
    : path.join(__dirname, 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const corpus = args.gid ? await loadLiveCorpus(args.gid) : dataset.corpus;
  const { queries, qrels } = dataset;
  const qids = Object.keys(queries);

  console.log(`\nKB search eval — pipeline: ${EVAL_CONFIG.retrievers.join('+')} · fusion ${EVAL_CONFIG.fusion.mode}(k=${EVAL_CONFIG.fusion.k})`);
  console.log(`corpus: ${args.gid ? `live graph ${args.gid}` : 'fixture'} (${corpus.length} docs) · queries: ${qids.length} · cutoffs: ${args.ks.join(',')}\n`);

  // A/B mode (#197): compare baseline vs +graphExpand and stop. Edges come from
  // the live graph (--gid) or an `edges` array on the fixture dataset.
  if (args.abExpand) {
    const edges = args.gid ? await loadLiveEdges(args.gid) : (dataset.edges || []);
    if (edges.length === 0) {
      console.log('  --ab-expand: no edges available (need --gid or dataset.edges) — nothing to expand.\n');
      return;
    }
    await runAbExpand(args, corpus, edges, queries, qrels, qids);
    return;
  }

  const pipeline = buildPipeline();
  const perQuery = [];
  const latencies = [];
  for (const qid of qids) {
    const qrel = qrels[qid] || {};
    const t0 = performance.now();
    const ranked = await runTier(pipeline, queries[qid], corpus);
    latencies.push(performance.now() - t0);
    const scores = scoreQuery(ranked.map(String), qrel, args.ks);
    perQuery.push(scores);
    const top = ranked.slice(0, Math.max(...args.ks)).join(',');
    console.log(`  ${qid.padEnd(4)} "${queries[qid]}"`);
    console.log(`       ndcg@${args.ks[0]}=${fmt(scores[`ndcg@${args.ks[0]}`])} recall@${args.ks[0]}=${fmt(scores[`recall@${args.ks[0]}`])} mrr=${fmt(scores.mrr)} · top: [${top}]`);
  }

  const mean = meanScores(perQuery);
  console.log('\n  ── mean ──');
  for (const key of Object.keys(mean)) console.log(`     ${key.padEnd(12)} ${fmt(mean[key])}`);
  console.log('\n  ── latency (ms) ──');
  console.log(`     p50 ${fmt(percentile(latencies, 50))}  p95 ${fmt(percentile(latencies, 95))}  max ${fmt(Math.max(...latencies))}`);
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
