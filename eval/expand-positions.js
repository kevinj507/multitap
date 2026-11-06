// #231 experiment 5: where do expansion-added candidates land?
import fs from 'fs';
import { resolveConnectionString, createPool } from '../src/db.js';
import { assemblePipeline, loadCorpus } from '../src/search/service.js';
import { createEmbeddingProvider } from '../src/search/providers/embedding.js';
import { createRerankProvider } from '../src/search/providers/rerank.js';

const DATASET = process.env.EVAL_DATASET || 'eval/dataset-stocks.json';
const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf-8'));
const GID = dataset.gid || 'fwmhe8ysfrnx9fw7';
const pool = createPool(resolveConnectionString());
const corpus = await loadCorpus(pool, GID);
const deps = {
  pool,
  embeddingProvider: createEmbeddingProvider({ backend: 'local-onnx', model: 'Xenova/bge-small-en-v1.5', dim: 384 }, {}),
  rerankProvider: createRerankProvider({ backend: 'local-onnx', model: 'Xenova/ms-marco-TinyBERT-L-2-v2', dtype: 'q8', topM: 50, maxChars: 512 }, {}),
};
const base = {
  retrievers: ['lexical', 'dense'],
  fusion: { mode: 'rrf', k: 60 },
  topK: 100,
  lexical: { ranker: process.env.LEXICAL_RANKER || 'bm25' },
  dense: { chunkTopK: 50 },
  graphExpand: { hops: Number(process.env.GRAPH_EXPAND_HOPS || 1), maxAddedPerSeed: 5, maxAdded: 50 },
  providers: { embedding: { backend: 'local-onnx' }, rerank: { backend: 'local-onnx', topM: 50 } },
};
const noRerank = assemblePipeline({ ...base, postprocessors: ['graphExpand'] }, deps);
const withRerank = assemblePipeline({ ...base, postprocessors: ['graphExpand', 'rerank'] }, deps);

const stats = { fusedLens: [], added: 0, addedPos: [], addedTop50: 0, addedTop20PostRerank: 0, queriesWithAdds: 0 };
for (const qid of Object.keys(dataset.queries)) {
  const q = dataset.queries[qid];
  const { candidates } = await noRerank.run(q, { gid: GID, corpus, corpusFromStore: true, lexicalTopK: 50 });
  const addedIdx = candidates.map((c, i) => (c.meta?.expandHop ? i + 1 : null)).filter(Boolean);
  const fusedLen = candidates.length - addedIdx.length;
  stats.fusedLens.push(fusedLen);
  if (addedIdx.length) stats.queriesWithAdds++;
  stats.added += addedIdx.length;
  stats.addedPos.push(...addedIdx);
  stats.addedTop50 += addedIdx.filter((p) => p <= 50).length;
  const post = await withRerank.run(q, { gid: GID, corpus, corpusFromStore: true, lexicalTopK: 50 });
  const addedIds = new Set(candidates.filter((c) => c.meta?.expandHop).map((c) => String(c.taskId)));
  stats.addedTop20PostRerank += post.candidates.slice(0, 20).filter((c) => addedIds.has(String(c.taskId))).length;
}
const sorted = stats.fusedLens.sort((a, b) => a - b);
console.log(JSON.stringify({
  queries: Object.keys(dataset.queries).length,
  fusedLen_min: sorted[0], fusedLen_p50: sorted[Math.floor(sorted.length / 2)], fusedLen_max: sorted[sorted.length - 1],
  totalAdded: stats.added,
  queriesWithAdds: stats.queriesWithAdds,
  addedWithinTop50: stats.addedTop50,
  addedReachingTop20AfterRerank: stats.addedTop20PostRerank,
  minAddedPos: Math.min(...stats.addedPos),
}));
await pool.end();
