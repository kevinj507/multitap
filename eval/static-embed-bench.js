#!/usr/bin/env node
// Static-embedding operational benchmark (graph eubxft9h7v9edta2,
// tk-static-embeddings): measures the CLAIMED benefits of the static backend
// against local-onnx, concretely — (1) cold start to first embedding, (2)
// steady-state throughput on realistic chunk texts, (3) RSS memory. Retrieval
// QUALITY is measured separately by run-eval.js (same harness, env-swapped).
//
// Each timed arm runs in a FRESH child process (cold start must include
// module import + model load, exactly what a worker wake pays). Runs are
// serial — this box has 1 core; parallel arms would corrupt the numbers.
//
// Usage:
//   node eval/static-embed-bench.js                  # all arms, 3 cold reps
//   node eval/static-embed-bench.js --reps 5
//   node eval/static-embed-bench.js --texts 200      # throughput corpus size

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { reps: 3, texts: 200, arms: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--reps') args.reps = Number(argv[++i]);
    else if (argv[i] === '--texts') args.texts = Number(argv[++i]);
    else if (argv[i] === '--arms') args.arms = argv[++i].split(',').map((s) => s.trim());
  }
  return args;
}

// Realistic inputs: chunk texts from the frozen TIL eval dataset's corpus
// snapshot if present, else synthesized markdown-ish paragraphs.
function loadTexts(n) {
  const til = path.join(__dirname, 'dataset.json');
  const texts = [];
  try {
    const d = JSON.parse(fs.readFileSync(til, 'utf8'));
    for (const doc of d.corpus || []) {
      const body = `${doc.title || ''}\n${doc.description || ''}\n${doc.body || ''}`.trim();
      if (body.length > 80) texts.push(body.slice(0, 1200));
    }
  } catch { /* fall through to synthetic */ }
  let i = 0;
  while (texts.length < n) {
    texts.push(
      `## Section ${i}\nIncremental view maintenance keeps derived indexes in sync as rows change. ` +
      `Chunk ${i} covers RRF fusion (k=60), pgvector HNSW parameters (m=16, ef_construction=64), ` +
      `and the retraction path: DELETE FROM task_chunks WHERE task_id = $1; re-embed on content sha change. ` +
      `The dense leg max-pools chunk scores back to nodes before fusing with BM25.`,
    );
    i++;
  }
  return texts.slice(0, n);
}

// The child measures one arm and prints JSON. Kept as a template string so the
// whole benchmark is one reviewable file.
const CHILD_SRC = `
const t0 = performance.now();
const backend = process.env.BENCH_BACKEND;
const model = process.env.BENCH_MODEL || undefined;
const texts = JSON.parse(require('fs').readFileSync(process.env.BENCH_TEXTS_FILE, 'utf8'));
(async () => {
  const { createEmbeddingProvider } = await import(process.env.BENCH_ROOT + '/src/search/providers/embedding.js');
  const tImport = performance.now();
  const provider = createEmbeddingProvider({ backend, ...(model ? { model } : {}) });
  const [firstVec] = await provider.embed([texts[0]]);
  const tFirst = performance.now();
  const rssAfterLoad = process.memoryUsage().rss;

  // steady-state throughput (batch shape mirrors the indexer: batches of 64)
  const tBatch0 = performance.now();
  const out = await provider.embed(texts);
  const tBatch1 = performance.now();

  // query-shaped latency: 30 short queries, one at a time (the search path)
  const queries = texts.slice(0, 30).map((t, i) => 'how does ' + t.slice(0, 40) + ' work ' + i);
  const qLat = [];
  for (const q of queries) {
    const q0 = performance.now();
    await provider.embed([q]);
    qLat.push(performance.now() - q0);
  }
  qLat.sort((a, b) => a - b);

  console.log(JSON.stringify({
    backend, model: provider.modelId, dim: provider.dim,
    importMs: +(tImport - t0).toFixed(1),
    coldToFirstEmbedMs: +(tFirst - t0).toFixed(1),
    throughputTexts: texts.length,
    throughputMs: +(tBatch1 - tBatch0).toFixed(1),
    textsPerSec: +(texts.length / ((tBatch1 - tBatch0) / 1000)).toFixed(1),
    queryP50Ms: +qLat[Math.floor(qLat.length * 0.5)].toFixed(2),
    queryP95Ms: +qLat[Math.floor(qLat.length * 0.95)].toFixed(2),
    rssAfterLoadMB: +(rssAfterLoad / 1048576).toFixed(1),
    // Kernel high-water mark (ru_maxrss, KB on Linux) — a true peak. A
    // point-in-time rss sample here would miss transient peaks entirely.
    rssPeakMB: +(process.resourceUsage().maxRSS / 1024).toFixed(1),
    vecLen: out[0].length, firstVecOk: Array.isArray(firstVec) && firstVec.length > 0,
  }));
})().catch((e) => { console.error(e); process.exit(1); });
`;

function runArm({ label, backend, model }, textsFile, reps) {
  const runs = [];
  for (let r = 0; r < reps; r++) {
    const out = execFileSync(process.execPath, ['--input-type=commonjs', '-e', CHILD_SRC], {
      env: {
        ...process.env,
        BENCH_BACKEND: backend,
        BENCH_MODEL: model || '',
        BENCH_TEXTS_FILE: textsFile,
        BENCH_ROOT: ROOT,
      },
      timeout: 600_000,
    }).toString();
    runs.push(JSON.parse(out.trim().split('\n').pop()));
  }
  const med = (k) => runs.map((x) => x[k]).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
  return {
    label,
    modelId: runs[0].model,
    dim: runs[0].dim,
    coldToFirstEmbedMs: med('coldToFirstEmbedMs'),
    importMs: med('importMs'),
    textsPerSec: med('textsPerSec'),
    queryP50Ms: med('queryP50Ms'),
    queryP95Ms: med('queryP95Ms'),
    rssAfterLoadMB: med('rssAfterLoadMB'),
    rssPeakMB: med('rssPeakMB'),
    reps,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const texts = loadTexts(args.texts);
  const textsFile = path.join(ROOT, 'eval', '.static-bench-texts.json');
  fs.writeFileSync(textsFile, JSON.stringify(texts));

  let arms = [
    { label: 'static-int8-d256', backend: 'static', model: 'static-retrieval-mrl-en-v1-int8-d256' },
    { label: 'static-int8-d1024', backend: 'static', model: 'static-retrieval-mrl-en-v1-int8-d1024' },
    { label: 'static-f32-d1024', backend: 'static', model: 'static-retrieval-mrl-en-v1-f32-d1024' },
    { label: 'local-onnx (prod baseline)', backend: 'local-onnx', model: '' },
  ];
  if (args.arms) arms = arms.filter((a) => args.arms.some((s) => a.label.startsWith(s)));

  console.log(`static-embed bench — ${args.texts} texts, ${args.reps} cold reps per arm, serial (1-core box)`);
  console.log(`avg text length: ${Math.round(texts.reduce((s, t) => s + t.length, 0) / texts.length)} chars\n`);

  const results = [];
  for (const arm of arms) {
    process.stdout.write(`running ${arm.label} ...\n`);
    try {
      results.push(runArm(arm, textsFile, args.reps));
    } catch (e) {
      results.push({ label: arm.label, error: String(e.message || e).slice(0, 200) });
    }
  }
  fs.rmSync(textsFile, { force: true });

  const cols = ['label', 'dim', 'coldToFirstEmbedMs', 'textsPerSec', 'queryP50Ms', 'queryP95Ms', 'rssAfterLoadMB', 'rssPeakMB'];
  console.log('\n' + cols.join('\t'));
  for (const r of results) {
    console.log(cols.map((c) => r[c] ?? (r.error ? `ERR:${r.error}` : '-')).join('\t'));
  }
  console.log('\nJSON:');
  console.log(JSON.stringify(results, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
