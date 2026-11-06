// E10: per-query paired A/B (rerank on/off) + sign test + qrel-subset splits.
import fs from 'fs';
import { resolveConnectionString, createPool } from '../src/db.js';
import { assemblePipeline, loadCorpus } from '../src/search/service.js';
import { createEmbeddingProvider } from '../src/search/providers/embedding.js';
import { createRerankProvider } from '../src/search/providers/rerank.js';
import { scoreQuery } from './metrics.js';

const dataset = JSON.parse(fs.readFileSync('./dataset-stocks.json', 'utf-8'));
const GID = 'fwmhe8ysfrnx9fw7';
const pool = createPool(resolveConnectionString());
const corpus = await loadCorpus(pool, GID);
const deps = {
  pool,
  embeddingProvider: createEmbeddingProvider({ backend: 'local-onnx', model: 'Xenova/bge-small-en-v1.5', dim: 384 }, {}),
  rerankProvider: createRerankProvider({ backend: 'local-onnx', model: 'Xenova/ms-marco-TinyBERT-L-2-v2', dtype: 'q8', topM: 50, maxChars: 512 }, {}),
};
const base = {
  retrievers: ['lexical', 'dense'], fusion: { mode: 'rrf', k: 60 }, topK: 100,
  lexical: { ranker: 'bm25' }, dense: { chunkTopK: 50 },
  graphExpand: { hops: 1, maxAddedPerSeed: 5, maxAdded: 50 },
  providers: { embedding: { backend: 'local-onnx' }, rerank: { backend: 'local-onnx', topM: 50 } },
};
const off = assemblePipeline({ ...base, postprocessors: ['graphExpand'] }, deps);
const on = assemblePipeline({ ...base, postprocessors: ['graphExpand', 'rerank'] }, deps);

const TYPES = (qid) => { const n = Number(qid.slice(1));
  if (n <= 40) return 'orig40'; if (n <= 55) return 'keyword'; if (n <= 70) return 'paraphrase'; if (n <= 85) return 'conceptual'; return 'specific'; };

function signTest(wins, losses) { // two-sided binomial sign test, normal approx for n>30 else exact
  const n = wins + losses;
  if (n === 0) return 1;
  let p;
  if (n <= 30) {
    const fact = (k) => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; };
    const choose = (n, k) => fact(n) / (fact(k) * fact(n - k));
    const k = Math.min(wins, losses);
    let cum = 0; for (let i = 0; i <= k; i++) cum += choose(n, i) * Math.pow(0.5, n);
    p = Math.min(1, 2 * cum);
  } else {
    const z = (Math.abs(wins - losses) - 1) / Math.sqrt(n);
    p = 2 * (1 - 0.5 * (1 + erf(z / Math.SQRT2)));
  }
  return p;
}
function erf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y; }

const rows = [];
for (const qid of Object.keys(dataset.queries)) {
  const q = dataset.queries[qid];
  const qrel = dataset.qrels[qid] || {};
  const a = await off.run(q, { gid: GID, corpus, corpusFromStore: true, lexicalTopK: 50 });
  const b = await on.run(q, { gid: GID, corpus, corpusFromStore: true, lexicalTopK: 50 });
  const sa = scoreQuery(a.candidates.map((c) => String(c.taskId)), qrel, [1, 10, 20]);
  const sb = scoreQuery(b.candidates.map((c) => String(c.taskId)), qrel, [1, 10, 20]);
  rows.push({ qid, type: TYPES(qid), dNdcg: sb['ndcg@10'] - sa['ndcg@10'], dP1: sb['precision@1'] - sa['precision@1'], dR20: sb['recall@20'] - sa['recall@20'] });
}

function summarize(label, subset) {
  for (const m of ['dNdcg', 'dP1', 'dR20']) {
    const wins = subset.filter((r) => r[m] > 1e-9).length;
    const losses = subset.filter((r) => r[m] < -1e-9).length;
    const ties = subset.length - wins - losses;
    const mean = subset.reduce((s, r) => s + r[m], 0) / subset.length;
    console.log(`${label.padEnd(12)} ${m.padEnd(6)} mean ${mean >= 0 ? '+' : ''}${mean.toFixed(3)}  rerank wins ${wins} / losses ${losses} / ties ${ties}  sign-test p=${signTest(wins, losses).toFixed(4)}`);
  }
}
summarize('ALL-100', rows);
for (const t of ['orig40', 'keyword', 'paraphrase', 'conceptual', 'specific']) summarize(t, rows.filter((r) => r.type === t));
const worst = [...rows].sort((x, y) => x.dNdcg - y.dNdcg).slice(0, 5);
console.log('\nworst rerank damage (ΔnDCG@10):', worst.map((r) => `${r.qid} ${r.dNdcg.toFixed(2)}`).join(' · '));
const best = [...rows].sort((x, y) => y.dNdcg - x.dNdcg).slice(0, 5);
console.log('best rerank help  (ΔnDCG@10):', best.map((r) => `${r.qid} +${r.dNdcg.toFixed(2)}`).join(' · '));
await pool.end();
