// Retrieval metrics — pytrec_eval / BEIR semantics, pure JS (no Python dep,
// so it runs on the Wafer as-is). This is the quality+latency GATE from graph
// tasks #173 (§5, §8): every later tier (vector → BM25 → rerank → graph
// expansion) must beat the prior tier on these numbers, on a frozen query
// set, before it lands. Accuracy lives here; latency is timed in run-eval.js.
//
// Inputs throughout:
//   rankedIds : ordered array of retrieved doc ids (strongest first)
//   qrel      : { [docId]: gradedRelevance }  — graded 0..3; absent ⇒ 0
// Ids are compared as strings so number/string ids interoperate.

function rel(qrel, id) {
  const v = qrel[String(id)];
  return typeof v === 'number' && v > 0 ? v : 0;
}

function numRelevant(qrel) {
  let n = 0;
  for (const k of Object.keys(qrel)) if (qrel[k] > 0) n++;
  return n;
}

/** Fraction of all relevant docs that appear in the top k. */
export function recallAtK(rankedIds, qrel, k) {
  const total = numRelevant(qrel);
  if (total === 0) return 0;
  let hit = 0;
  for (let i = 0; i < Math.min(k, rankedIds.length); i++) {
    if (rel(qrel, rankedIds[i]) > 0) hit++;
  }
  return hit / total;
}

/** Fraction of the top k that are relevant. */
export function precisionAtK(rankedIds, qrel, k) {
  if (k <= 0) return 0;
  let hit = 0;
  for (let i = 0; i < Math.min(k, rankedIds.length); i++) {
    if (rel(qrel, rankedIds[i]) > 0) hit++;
  }
  return hit / k;
}

/** Reciprocal rank of the first relevant hit (0 if none in the list). */
export function reciprocalRank(rankedIds) {
  return (qrel) => {
    for (let i = 0; i < rankedIds.length; i++) {
      if (rel(qrel, rankedIds[i]) > 0) return 1 / (i + 1);
    }
    return 0;
  };
}

/** MRR for a single query: 1/rank of the first relevant result. */
export function mrr(rankedIds, qrel) {
  for (let i = 0; i < rankedIds.length; i++) {
    if (rel(qrel, rankedIds[i]) > 0) return 1 / (i + 1);
  }
  return 0;
}

/** Graded nDCG@k. DCG uses the standard (2^rel − 1)/log2(rank+1) gain; IDCG
 *  is the DCG of the ideal graded ordering. Returns 0 when no relevant docs. */
export function ndcgAtK(rankedIds, qrel, k) {
  let dcg = 0;
  for (let i = 0; i < Math.min(k, rankedIds.length); i++) {
    const g = rel(qrel, rankedIds[i]);
    if (g > 0) dcg += (Math.pow(2, g) - 1) / Math.log2(i + 2);
  }
  const ideal = Object.values(qrel).filter((v) => v > 0).sort((a, b) => b - a);
  let idcg = 0;
  for (let i = 0; i < Math.min(k, ideal.length); i++) {
    idcg += (Math.pow(2, ideal[i]) - 1) / Math.log2(i + 2);
  }
  return idcg === 0 ? 0 : dcg / idcg;
}

/** Average Precision for a single query (binary relevance), as in MAP. */
export function averagePrecision(rankedIds, qrel) {
  const total = numRelevant(qrel);
  if (total === 0) return 0;
  let hit = 0;
  let sum = 0;
  for (let i = 0; i < rankedIds.length; i++) {
    if (rel(qrel, rankedIds[i]) > 0) {
      hit++;
      sum += hit / (i + 1); // precision@(i+1) at this relevant position
    }
  }
  return sum / total;
}

/** Score one query across all metrics at the given cutoffs. */
export function scoreQuery(rankedIds, qrel, ks = [5, 10]) {
  const out = { mrr: mrr(rankedIds, qrel), map: averagePrecision(rankedIds, qrel) };
  for (const k of ks) {
    out[`recall@${k}`] = recallAtK(rankedIds, qrel, k);
    out[`ndcg@${k}`] = ndcgAtK(rankedIds, qrel, k);
    out[`precision@${k}`] = precisionAtK(rankedIds, qrel, k);
  }
  return out;
}

/** Mean of each metric across per-query score objects. */
export function meanScores(perQuery) {
  const keys = perQuery.length ? Object.keys(perQuery[0]) : [];
  const mean = {};
  for (const key of keys) {
    mean[key] = perQuery.reduce((s, q) => s + (q[key] || 0), 0) / (perQuery.length || 1);
  }
  return mean;
}

// ── Context-pack (E13 / #460) set-based metrics ──────────────────────────────
// The pack is a SET of nodes (the subgraph handed to an agent), not a ranked
// list, so coverage/precision are set operations against the binary gold set.

/** Deterministic, model-free token proxy: ceil(chars/4) over the given text.
 *  Applied identically to every strategy so token budgets compare fairly. */
export function countTokens(text) {
  return Math.ceil((text || '').length / 4);
}

/** COVERAGE@budget = |pack ∩ gold| / |gold|. Fraction of the needed node set
 *  the pack contains. gold may be an array or a Set of ids (compared as Strings). */
export function coverage(packIds, gold) {
  const goldSet = gold instanceof Set ? gold : new Set([...gold].map(String));
  if (goldSet.size === 0) return 0;
  const pack = new Set(packIds.map(String));
  let hit = 0;
  for (const g of goldSet) if (pack.has(g)) hit++;
  return hit / goldSet.size;
}

/** PRECISION/density = |pack ∩ gold| / |pack| — is the pack bloated? */
export function setPrecision(packIds, gold) {
  const goldSet = gold instanceof Set ? gold : new Set([...gold].map(String));
  const pack = [...new Set(packIds.map(String))];
  if (pack.length === 0) return 0;
  let hit = 0;
  for (const id of pack) if (goldSet.has(id)) hit++;
  return hit / pack.length;
}

/** Percentile (0..100) of a numeric array via nearest-rank. */
export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
