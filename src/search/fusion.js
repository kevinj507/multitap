// Fusion strategies — the Joiner leg of the pipeline (#173 §11). Pure,
// dependency-free, unit-tested. Mirrors Haystack's DocumentJoiner join_mode:
// the default is Reciprocal Rank Fusion (RRF), with merge / concat as
// alternates. Fusion combines N ranked candidate lists into one ranked list.
//
// KEY PROPERTY (this is the P2.0 eval gate): RRF over a SINGLE list preserves
// that list's order exactly — score 1/(k+rank) is strictly decreasing in rank,
// so a lexical-only pipeline ranks identically to raw lexicalSearch. Adding a
// second retriever later changes nothing about how the first is read.

import { makeCandidate } from './types.js';

const DEFAULT_RRF_K = 60;

/** Key candidates by node id, compared as strings so number/string ids from
 *  different retrievers (lexical=int rows, dense=int rows) interoperate. */
function keyOf(c) {
  return String(c.taskId);
}

/**
 * Reciprocal Rank Fusion. score(d) = Σ_i  weight_i / (k + rank_i(d)), where
 * rank_i is the 1-based position of d in list i (absent ⇒ no contribution).
 * Rank-based, so it needs no score normalization across heterogeneous
 * retrievers — its whole reason for being the default.
 *
 * @param {Array<Array<Object>>} lists  ranked candidate lists (strongest first)
 * @param {{k?:number, weights?:number[]}} [opts]
 * @returns {Array<Object>} fused candidates, strongest first
 */
export function rrf(lists, opts = {}) {
  const k = opts.k ?? DEFAULT_RRF_K;
  const weights = opts.weights;
  const acc = new Map(); // key -> { cand, score, order, sources }
  let order = 0;
  lists.forEach((list, li) => {
    const w = weights ? (weights[li] ?? 1) : 1;
    list.forEach((cand, idx) => {
      const rank = idx + 1;
      const contribution = w / (k + rank);
      const key = keyOf(cand);
      const existing = acc.get(key);
      if (existing) {
        existing.score += contribution;
        existing.sources.add(cand.source);
        // Keep the richest representative: prefer one that carries a snippet.
        if (!existing.cand.snippet && cand.snippet) existing.cand = cand;
      } else {
        acc.set(key, { cand, score: contribution, order: order++, sources: new Set([cand.source]) });
      }
    });
  });
  return finalize(acc, 'rrf');
}

/**
 * Merge / weighted-sum fusion: sum each candidate's own `score` across the
 * lists it appears in. Requires comparable scores, so it's a niche alternate;
 * RRF is the default precisely because it doesn't.
 */
export function merge(lists, opts = {}) {
  const weights = opts.weights;
  const acc = new Map();
  let order = 0;
  lists.forEach((list, li) => {
    const w = weights ? (weights[li] ?? 1) : 1;
    for (const cand of list) {
      const key = keyOf(cand);
      const existing = acc.get(key);
      const contribution = w * (Number(cand.score) || 0);
      if (existing) {
        existing.score += contribution;
        existing.sources.add(cand.source);
        if (!existing.cand.snippet && cand.snippet) existing.cand = cand;
      } else {
        acc.set(key, { cand, score: contribution, order: order++, sources: new Set([cand.source]) });
      }
    }
  });
  return finalize(acc, 'merge');
}

/**
 * Concat: first-list-wins de-dup, preserving each list's internal order. No
 * re-scoring — the simplest joiner, useful when one retriever is authoritative.
 */
export function concat(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const cand of list) {
      const key = keyOf(cand);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...cand, source: cand.source });
    }
  }
  return out;
}

/** Sort the accumulator by fused score desc, breaking ties by first-seen order
 *  (a stable sort then preserves single-list ordering exactly), and stamp the
 *  combined score + fusion source onto fresh Candidate objects.
 *
 *  `source` stays a single retriever name (the richest representative — see
 *  the snippet preference above) for back-compat with callers that expect
 *  one stage name. But when a candidate was retrieved by more than one
 *  retriever, picking just one silently erases that a second leg agreed —
 *  e.g. every node both lexical AND dense found ends up tagged 'lexical',
 *  making dense look like it contributed nothing even when it shaped the
 *  rank. `meta.sources` carries the full, deduped list of contributing
 *  retrievers so callers can tell agreement from single-leg-only hits. */
function finalize(acc, mode) {
  const rows = [...acc.values()];
  rows.sort((a, b) => (b.score - a.score) || (a.order - b.order));
  return rows.map(({ cand, score, sources }) =>
    makeCandidate(cand.taskId, score, cand.source, {
      ...(cand.snippet ? { snippet: cand.snippet } : {}),
      meta: { ...(cand.meta || {}), fusedBy: mode, sources: [...sources].sort() },
    }),
  );
}

const STRATEGIES = { rrf, merge, concat };

/** Resolve a joiner by config mode. Unknown modes fall back to RRF (the safe
 *  default) rather than throwing — fusion should never be the thing that hard-
 *  fails a search. Config validation rejects unknown modes up front anyway. */
export function getJoiner(mode = 'rrf') {
  const fn = STRATEGIES[mode] || rrf;
  return { name: mode in STRATEGIES ? mode : 'rrf', fuse: fn };
}

export default { rrf, merge, concat, getJoiner, DEFAULT_RRF_K };
