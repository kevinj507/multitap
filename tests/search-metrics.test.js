import { describe, it, expect } from 'vitest';
import {
  recallAtK, precisionAtK, mrr, ndcgAtK, averagePrecision,
  meanScores, percentile,
} from '../eval/metrics.js';

// Known-value checks so the GATE itself is trustworthy (graph task #173 §8).
describe('recall@k / precision@k', () => {
  const qrel = { '1': 3, '2': 1, '5': 2 }; // 3 relevant
  it('recall counts relevant in top k over total relevant', () => {
    expect(recallAtK(['1', '9', '2'], qrel, 3)).toBeCloseTo(2 / 3);
    expect(recallAtK(['1', '2', '5'], qrel, 3)).toBe(1);
    expect(recallAtK(['9', '8'], qrel, 3)).toBe(0);
  });
  it('precision counts relevant over k', () => {
    expect(precisionAtK(['1', '9', '2'], qrel, 2)).toBe(0.5);
  });
});

describe('mrr', () => {
  it('is the reciprocal of the first relevant rank', () => {
    expect(mrr(['9', '1'], { '1': 3 })).toBe(0.5);
    expect(mrr(['1'], { '1': 3 })).toBe(1);
    expect(mrr(['9', '8'], { '1': 3 })).toBe(0);
  });
});

describe('ndcg@k (graded)', () => {
  it('is 1.0 for the ideal ordering', () => {
    const qrel = { '1': 3, '2': 2, '3': 1 };
    expect(ndcgAtK(['1', '2', '3'], qrel, 3)).toBeCloseTo(1);
  });
  it('penalizes a worse ordering', () => {
    const qrel = { '1': 3, '2': 2, '3': 1 };
    const worse = ndcgAtK(['3', '2', '1'], qrel, 3);
    expect(worse).toBeLessThan(1);
    expect(worse).toBeGreaterThan(0);
  });
  it('matches a hand-computed value', () => {
    // ranked [A(rel2), B(rel0), C(rel1)], k=3
    // DCG = (2^2-1)/log2(2) + 0 + (2^1-1)/log2(4) = 3/1 + 1/2 = 3.5
    // IDCG ideal [2,1] = 3/1 + 1/log2(3) = 3 + 0.6309 = 3.6309
    const qrel = { A: 2, C: 1 };
    expect(ndcgAtK(['A', 'B', 'C'], qrel, 3)).toBeCloseTo(3.5 / 3.6309, 3);
  });
});

describe('average precision / MAP building block', () => {
  it('averages precision at each relevant hit', () => {
    // relevant at ranks 1 and 3 → (1/1 + 2/3)/2 = 0.8333
    expect(averagePrecision(['1', '9', '2'], { '1': 1, '2': 1 })).toBeCloseTo((1 + 2 / 3) / 2);
  });
});

describe('aggregation helpers', () => {
  it('meanScores averages each metric key', () => {
    const m = meanScores([{ a: 1, b: 0 }, { a: 0, b: 1 }]);
    expect(m).toEqual({ a: 0.5, b: 0.5 });
  });
  it('percentile uses nearest-rank', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4], 100)).toBe(4);
  });
});
