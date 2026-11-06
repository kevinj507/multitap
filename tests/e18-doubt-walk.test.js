// E18.3 STEP 1 — the pure walk.
//
// No database, no express: src/doubt.js reaches neither, so this file may
// import it at module scope (the pure-module house rule — kinds.js, fold.js,
// planRegions.js, signedCycles.js, supersession.js all get the same treatment).
//
// The two things most likely to be quietly wrong live here:
//   * TERMINATION. It must be a proof, not a cap. The cycle test runs with NO
//     attenuation, the floor effectively removed and maxDepth 256, and asserts
//     the frontier emptied on its own.
//   * NO HARDCODED ATTENUATION. There is exactly one place the default weight
//     lives; a caller-supplied weight changes the front; a per-edge weight
//     overrides the per-request default; and layeredWalk's body carries no
//     numeric literal at all. All four are asserted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  AXES,
  ANCHOR_KINDS,
  CHAIN_LIMIT_CAP,
  DEFAULT_CHAIN_LIMIT,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  DEFAULT_PROPAGATION_WEIGHTS,
  DEFAULT_WEIGHT_FLOOR,
  MAX_PROPAGATION,
  MIN_PROPAGATION,
  TRAVERSAL_PURPOSES,
  WEIGHTS_SHAPE_ERROR,
  WEIGHT_MISSING_ERROR,
  WEIGHT_RANGE_ERROR,
  WEIGHT_UNKNOWN_ERROR,
  buildAdjacency,
  byNode,
  chainFor,
  layeredWalk,
  mergeWeights,
  onFront,
  seedsFromEvents,
  validatePropagation,
  verifiedAfterInWorld,
  walkKey,
} from '../src/doubt.js';

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

// ── fixtures ────────────────────────────────────────────────────────────────

const W = { ...DEFAULT_PROPAGATION_WEIGHTS };
const opts = (over = {}) => ({
  weights: W,
  weightFloor: DEFAULT_WEIGHT_FLOOR,
  maxDepth: DEFAULT_MAX_DEPTH,
  maxNodes: DEFAULT_MAX_NODES,
  ...over,
});

// edges as [id, source, target, purpose, propagation?]
const adj = (rows) =>
  buildAdjacency(rows.map(([id, source_id, target_id, purpose, propagation]) => ({
    id, source_id, target_id, purpose, propagation: propagation ?? null,
  })));

const seed = (node, over = {}) => ({ node, w: 1, seq: 100, kind: 'refutation', ...over });

const weightOf = (walk, node, trigger = 100) => walk.best.get(walkKey(node, trigger))?.w;

// ── the weight model ────────────────────────────────────────────────────────

describe('E18.3 the default weights — one place, exported, echoed', () => {
  it('names both traversal purposes and nothing else', () => {
    expect(TRAVERSAL_PURPOSES).toEqual(['required for', 'supports']);
    expect(Object.keys(DEFAULT_PROPAGATION_WEIGHTS).sort()).toEqual(['required for', 'supports']);
    // `required for` is HARD: a dependent cannot be more believed than its
    // prerequisite. `supports` is ATTENUATED: evidence weakens, it does not
    // refute.
    expect(DEFAULT_PROPAGATION_WEIGHTS['required for']).toBe(1);
    expect(DEFAULT_PROPAGATION_WEIGHTS.supports).toBeGreaterThan(MIN_PROPAGATION);
    expect(DEFAULT_PROPAGATION_WEIGHTS.supports).toBeLessThan(MAX_PROPAGATION);
  });

  it('is frozen — a caller cannot mutate the repo-wide default', () => {
    expect(Object.isFrozen(DEFAULT_PROPAGATION_WEIGHTS)).toBe(true);
  });

  it('validatePropagation enforces the OPEN-CLOSED interval (0, 1]', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, '0.5', null, undefined, {}]) {
      expect(validatePropagation(bad, 'w').error).toBe(WEIGHT_RANGE_ERROR('w'));
    }
    for (const good of [1, 0.0001, 0.5]) {
      expect(validatePropagation(good, 'w')).toEqual({ value: good });
    }
  });

  it('mergeWeights layers a request over the defaults and validates every value', () => {
    expect(mergeWeights(undefined).value).toEqual({ ...DEFAULT_PROPAGATION_WEIGHTS });
    expect(mergeWeights({ supports: 1 }).value).toEqual({ 'required for': 1, supports: 1 });
    expect(mergeWeights({ supports: 0 }).error).toBe(WEIGHT_RANGE_ERROR("weights['supports']"));
    expect(mergeWeights({ supports: 1.5 }).error).toBe(WEIGHT_RANGE_ERROR("weights['supports']"));
    expect(mergeWeights([]).error).toBe(WEIGHTS_SHAPE_ERROR);
    expect(mergeWeights({ contradicts: 0.5 }).error).toBe(WEIGHT_UNKNOWN_ERROR('contradicts'));
  });

  it('a traversal purpose with no weight is an ERROR, never a silent default', () => {
    // The requirement, reachable today because mergeWeights takes its defaults
    // and its purpose list as ARGUMENTS. If a later rung adds a traversable
    // purpose and forgets its weight, the route 400s instead of picking one.
    const out = mergeWeights({}, DEFAULT_PROPAGATION_WEIGHTS, [...TRAVERSAL_PURPOSES, 'refines']);
    expect(out.error).toBe(WEIGHT_MISSING_ERROR('refines'));
    expect(out.value).toBeUndefined();
  });
});

// ── attenuation ─────────────────────────────────────────────────────────────

describe('E18.3 attenuation — hard vs soft, multiplied in path order', () => {
  it('a `required for` chain keeps weight 1 at every hop', () => {
    const walk = layeredWalk(
      adj([[1, 1, 2, 'required for'], [2, 2, 3, 'required for'], [3, 3, 4, 'required for']]),
      [seed(1)], opts(),
    );
    expect(weightOf(walk, 4)).toBe(1);
  });

  it('a 3-hop `supports` chain at 0.6 yields 0.216', () => {
    const walk = layeredWalk(
      adj([[1, 1, 2, 'supports'], [2, 2, 3, 'supports'], [3, 3, 4, 'supports']]),
      [seed(1)], opts(),
    );
    expect(weightOf(walk, 4)).toBeCloseTo(0.216, 10);
  });

  it('a mixed chain multiplies in order', () => {
    const walk = layeredWalk(
      adj([[1, 1, 2, 'supports'], [2, 2, 3, 'required for'], [3, 3, 4, 'supports']]),
      [seed(1)], opts(),
    );
    expect(weightOf(walk, 4)).toBeCloseTo(0.36, 10);
  });

  it('A CALLER-SUPPLIED WEIGHT CHANGES THE FRONT', () => {
    const edges = adj([[1, 1, 2, 'supports'], [2, 2, 3, 'supports']]);
    const hard = layeredWalk(edges, [seed(1)], opts({ weights: { ...W, supports: 1 } }));
    const steep = layeredWalk(edges, [seed(1)], opts({ weights: { ...W, supports: 0.25 } }));
    expect(weightOf(hard, 3)).toBe(1);
    expect(weightOf(steep, 3)).toBeCloseTo(0.0625, 10);
    // And at the default floor the steep walk does not even reach hop 3.
    const pruned = layeredWalk(
      adj([[1, 1, 2, 'supports'], [2, 2, 3, 'supports'], [3, 3, 4, 'supports']]),
      [seed(1)], opts({ weights: { ...W, supports: 0.25 } }),
    );
    expect(weightOf(pruned, 4)).toBeUndefined();
    expect(pruned.stoppedBy).toContain('floor');
  });

  it('A PER-EDGE `propagation` OVERRIDES THE PER-REQUEST WEIGHT', () => {
    // Same purpose, same request weight, two different edges: the one carrying
    // meta.propagation uses ITS number, the other uses the request's.
    const edges = adj([[1, 1, 2, 'supports', 0.9], [2, 1, 3, 'supports']]);
    const walk = layeredWalk(edges, [seed(1)], opts({ weights: { ...W, supports: 0.2 } }));
    expect(weightOf(walk, 2)).toBeCloseTo(0.9, 10);
    expect(weightOf(walk, 3)).toBeCloseTo(0.2, 10);
  });

  it('max-product wins: the stronger of two paths sets the weight AND the chain', () => {
    // 1 -supports-> 2 -supports-> 4   = 0.6 * 0.6 = 0.36
    // 1 -required for-> 3 -e:0.25-> 4 = 1 * 0.25  = 0.25
    const edges = adj([
      [1, 1, 2, 'supports'], [2, 2, 4, 'supports'],
      [3, 1, 3, 'required for'], [4, 3, 4, 'supports', 0.25],
    ]);
    const walk = layeredWalk(edges, [seed(1)], opts());
    expect(weightOf(walk, 4)).toBeCloseTo(0.36, 10);
    const chain = chainFor(walk.best, 4, 100, DEFAULT_CHAIN_LIMIT);
    expect(chain.hops.map((h) => h.from)).toEqual([1, 2]);
  });

  it('the floor prunes at exactly the arithmetic reach: 0.6^5 >= 0.05 > 0.6^6', () => {
    const edges = adj(Array.from({ length: 8 }, (_, i) => [i + 1, i + 1, i + 2, 'supports']));
    const walk = layeredWalk(edges, [seed(1)], opts({ maxDepth: 64 }));
    expect(weightOf(walk, 6)).toBeCloseTo(0.6 ** 5, 10);   // 0.0778 — in
    expect(weightOf(walk, 7)).toBeUndefined();             // 0.0467 — out
    expect(walk.stoppedBy).toContain('floor');
    expect(walk.truncated).toBe(false);
  });
});

// ── termination ─────────────────────────────────────────────────────────────

describe('E18.3 TERMINATION IS A PROOF, NOT A CAP', () => {
  it('a `supports` cycle with NO attenuation and the floor removed still empties the frontier', () => {
    // A -> B -> C -> A, every edge at weight 1.0 (no attenuation at all), floor
    // 1e-9, maxDepth 256. If the strict-improvement guard is ever removed this
    // runs to the depth cap and reports truncated: true.
    const edges = adj([[1, 1, 2, 'supports'], [2, 2, 3, 'supports'], [3, 3, 1, 'supports']]);
    const walk = layeredWalk(edges, [seed(1)], opts({
      weights: { ...W, supports: 1 }, weightFloor: 1e-9, maxDepth: 256,
    }));
    expect(walk.nodes).toBe(3);
    expect(walk.truncated).toBe(false);
    expect(walk.stoppedBy).toEqual([]);
    // It emptied on its own, long before the cap.
    expect(walk.deepest).toBeLessThan(256);
    for (const id of [1, 2, 3]) expect(weightOf(walk, id)).toBe(1);
  });

  it('a two-node cycle with a self-reinforcing pair terminates too', () => {
    const edges = adj([[1, 1, 2, 'required for'], [2, 2, 1, 'required for']]);
    const walk = layeredWalk(edges, [seed(1)], opts({ maxDepth: 256, weightFloor: 1e-9 }));
    expect(walk.truncated).toBe(false);
    expect(walk.nodes).toBe(2);
  });

  it('maxDepth sets truncated and stopped_by: depth', () => {
    const edges = adj(Array.from({ length: 10 }, (_, i) => [i + 1, i + 1, i + 2, 'required for']));
    const walk = layeredWalk(edges, [seed(1)], opts({ maxDepth: 3 }));
    expect(walk.truncated).toBe(true);
    expect(walk.stoppedBy).toContain('depth');
    expect(weightOf(walk, 4)).toBe(1);
    expect(weightOf(walk, 5)).toBeUndefined();
  });

  it('maxNodes sets truncated and stopped_by: node_cap', () => {
    const edges = adj(Array.from({ length: 10 }, (_, i) => [i + 1, i + 1, i + 2, 'required for']));
    const walk = layeredWalk(edges, [seed(1)], opts({ maxNodes: 4 }));
    expect(walk.truncated).toBe(true);
    expect(walk.stoppedBy).toContain('node_cap');
    expect(walk.nodes).toBe(4);
  });
});

// ── seeds ───────────────────────────────────────────────────────────────────

describe('E18.3 seeds — from the log, through weakening(), unmodified', () => {
  const refutation = (over = {}) => ({
    seq: 11, subject_id: 5, happened_at: '2026-03-01T00:00:00.000Z', cause_id: null,
    payload: { kinds: ['claim.refuted'] }, ...over,
  });

  it('reads the three weakening kinds and skips everything else', () => {
    const seeds = seedsFromEvents([
      refutation(),
      { seq: 12, subject_id: 6, payload: { kinds: ['node.superseded'], superseded_by: 900 }, cause_id: 11 },
      { seq: 13, subject_id: 7, payload: { kinds: ['field.set'], changes: { 'meta.confidence': { from: 0.9, to: 0.4 } } } },
      { seq: 14, subject_id: 8, payload: { kinds: ['claim.verified'] } },
      { seq: 15, subject_id: 9, payload: { kinds: ['node.patched'] } },
    ]);
    expect(seeds.map((s) => s.node)).toEqual([5, 6, 7]);
    expect(seeds.map((s) => s.kind)).toEqual(['refutation', 'supersession', 'confidence_drop']);
    expect(seeds[0].w).toBe(1);
    expect(seeds[1].w).toBe(1);
    expect(seeds[1].superseded_by).toBe(900);
    expect(seeds[1].cause_id).toBe(11);
    expect(seeds[2].w).toBeCloseTo(0.5, 10);
    expect(seeds.every((s) => s.weight_source === 'magnitude')).toBe(true);
  });

  it('THE BIGINT TRAP: a string subject_id propagates identically to a number', () => {
    // `events.subject_id` is BIGINT so pg hands back a STRING; `edges.source_id`
    // is SERIAL so it hands back a NUMBER. Seeding the adjacency Map with the
    // raw value produces a walk of exactly the seeds and ZERO relaxations —
    // which reads as "nothing depends on this claim", not as a bug.
    const edges = adj([[1, 5, 6, 'required for'], [2, 6, 7, 'required for']]);
    const asString = seedsFromEvents([refutation({ subject_id: '5' })]);
    expect(asString[0].node).toBe(5);
    expect(typeof asString[0].node).toBe('number');
    const walk = layeredWalk(edges, asString, opts());
    expect(walk.relaxed).toBeGreaterThan(0);
    expect(walk.nodes).toBe(3);
    const numeric = layeredWalk(edges, seedsFromEvents([refutation({ subject_id: 5 })]), opts());
    expect([...walk.best.keys()].sort()).toEqual([...numeric.best.keys()].sort());
  });

  it('payload.weight is the TRIGGER seed, honoured in (0,1] and reported as such', () => {
    const [s] = seedsFromEvents([refutation({ payload: { kinds: ['claim.refuted'], weight: 0.4 } })]);
    expect(s.w).toBeCloseTo(0.4, 10);
    expect(s.weight_source).toBe('payload');
    // Out of range is ignored, never clamped into a silent amplifier.
    const [bad] = seedsFromEvents([refutation({ payload: { kinds: ['claim.refuted'], weight: 4 } })]);
    expect(bad.w).toBe(1);
    expect(bad.weight_source).toBe('magnitude');
  });

  it('seeds arrive in seq order whatever order the log page did', () => {
    const seeds = seedsFromEvents([refutation({ seq: 30 }), refutation({ seq: 10, subject_id: 6 })]);
    expect(seeds.map((s) => s.seq)).toEqual([10, 30]);
  });
});

// ── chains ──────────────────────────────────────────────────────────────────

describe('E18.3 chains — reconstructed from parent pointers, cut at the trigger end', () => {
  const line = (n) => adj(Array.from({ length: n }, (_, i) => [i + 1, i + 1, i + 2, 'required for']));

  it('the chain is the max-weight path, hop by hop, with purpose and per-hop weight', () => {
    const edges = adj([[7, 1, 2, 'supports'], [9, 2, 3, 'required for']]);
    const walk = layeredWalk(edges, [seed(1)], opts());
    const chain = chainFor(walk.best, 3, 100, DEFAULT_CHAIN_LIMIT);
    expect(chain).toEqual({
      hops: [
        { from: 1, to: 2, edge_id: 7, purpose: 'supports', weight: 0.6, from_superseded: false },
        { from: 2, to: 3, edge_id: 9, purpose: 'required for', weight: 1, from_superseded: false },
      ],
      truncated: false,
      omitted_hops: 0,
    });
  });

  it('from_superseded flags a CONDUCTOR inside the chain', () => {
    const walk = layeredWalk(adj([[7, 1, 2, 'supports']]), [seed(1)], opts());
    const chain = chainFor(walk.best, 2, 100, DEFAULT_CHAIN_LIMIT, new Set([1]));
    expect(chain.hops[0].from_superseded).toBe(true);
  });

  it('chainLimit cuts at the TRIGGER end and leaves the item end intact', () => {
    const walk = layeredWalk(line(9), [seed(1)], opts({ maxDepth: 64 }));
    const full = chainFor(walk.best, 10, 100, CHAIN_LIMIT_CAP);
    expect(full.hops).toHaveLength(9);
    const cut = chainFor(walk.best, 10, 100, 3);
    expect(cut.truncated).toBe(true);
    expect(cut.omitted_hops).toBe(6);
    expect(cut.hops).toHaveLength(3);
    // The hops nearest the ITEM survive; the trigger end is what was dropped.
    expect(cut.hops.map((h) => h.to)).toEqual([8, 9, 10]);
    expect(full.hops.slice(-3)).toEqual(cut.hops);
  });

  it('the DEFAULT configuration can never truncate a chain (maxDepth 12 < chainLimit 16)', () => {
    expect(DEFAULT_MAX_DEPTH).toBeLessThanOrEqual(DEFAULT_CHAIN_LIMIT);
    const walk = layeredWalk(line(40), [seed(1)], opts());
    for (const [, record] of walk.best) {
      const chain = chainFor(walk.best, record.node, 100, DEFAULT_CHAIN_LIMIT);
      expect(chain.truncated).toBe(false);
    }
  });

  it('is deterministic across a shuffled edge array, and prefers the lower edge id on a tie', () => {
    const rows = [
      [9, 1, 2, 'supports'], [3, 1, 2, 'supports'],     // two parallel, equal-weight
      [5, 2, 3, 'required for'],
    ];
    const forward = layeredWalk(adj(rows), [seed(1)], opts());
    const shuffled = layeredWalk(adj([...rows].reverse()), [seed(1)], opts());
    const a = chainFor(forward.best, 3, 100, DEFAULT_CHAIN_LIMIT);
    const b = chainFor(shuffled.best, 3, 100, DEFAULT_CHAIN_LIMIT);
    expect(a).toEqual(b);
    expect(a.hops[0].edge_id).toBe(3);
  });
});

// ── the item's three claims are ONE statement ───────────────────────────────

describe('E18.3 weight, hops and the chain must agree — TRUNCATED OR NOT', () => {
  // The shape that used to break it. Layer 1 relaxes 2 (0.6, via 1) and 3
  // (1, via 1). Layer 2 relaxes 4 FROM THE 0.6 RECORD and only THEN improves 2
  // to 1.0 via 3 — so 2's parent pointer now describes a better path than the
  // one 4's weight came from, and 4 is corrected on LAYER 3. Stop at maxDepth 2
  // and that correction never runs.
  const late = () => adj([
    [1, 1, 2, 'supports'],       // 1 -> 2   0.6
    [2, 1, 3, 'required for'],   // 1 -> 3   1
    [3, 2, 4, 'required for'],   // 2 -> 4   relaxed from the WORSE record
    [4, 3, 2, 'required for'],   // 3 -> 2   improves 2, one layer too late
  ]);

  it('a chain cut short by maxDepth explains the weight it is printed beside', () => {
    const walk = layeredWalk(late(), [seed(1)], opts({ maxDepth: 2 }));
    const record = walk.best.get(walkKey(4, 100));
    const chain = chainFor(walk.best, 4, 100, DEFAULT_CHAIN_LIMIT);
    expect(walk.truncated).toBe(true);
    expect(walk.stoppedBy).toContain('depth');
    // The reported numbers came from 1 -supports-> 2 -required for-> 4, and the
    // chain must be THAT path — not the better 1 -> 3 -> 2 -> 4 the walk had
    // found for 2 but had not yet pushed through to 4.
    expect(record.w).toBeCloseTo(0.6, 10);
    expect(chain.hops.map((h) => h.from)).toEqual([1, 2]);
    expect(chain.hops).toHaveLength(record.hops);
    expect(chain.hops.reduce((acc, h) => acc * h.weight, 1)).toBeCloseTo(record.w, 10);
  });

  it('one more layer finds the better path, and the chain moves WITH the weight', () => {
    const walk = layeredWalk(late(), [seed(1)], opts({ maxDepth: 3 }));
    const record = walk.best.get(walkKey(4, 100));
    const chain = chainFor(walk.best, 4, 100, DEFAULT_CHAIN_LIMIT);
    expect(record.w).toBe(1);
    expect(record.hops).toBe(3);
    expect(chain.hops.map((h) => h.from)).toEqual([1, 3, 2]);
    expect(chain.hops).toHaveLength(record.hops);
  });

  it('THE INVARIANT, over every reached record at every depth: w = product(chain), hops = |chain|', () => {
    // Not one shape but every prefix of the walk on a graph with parallel paths
    // of different lengths and different attenuations — the family where a
    // parent improves after a child has already been relaxed from it.
    const edges = adj([
      [1, 1, 2, 'supports'], [2, 1, 3, 'required for'], [3, 1, 6, 'supports', 0.3],
      [4, 2, 4, 'required for'], [5, 3, 2, 'required for'], [6, 4, 5, 'supports'],
      [7, 6, 4, 'required for'], [8, 5, 2, 'supports'], [9, 3, 7, 'supports'],
      [10, 7, 4, 'required for'], [11, 5, 7, 'required for'],
    ]);
    for (const maxDepth of [1, 2, 3, 4, 5, 6, 12]) {
      const walk = layeredWalk(edges, [seed(1)], opts({ maxDepth, weightFloor: 1e-9 }));
      for (const record of walk.best.values()) {
        const chain = chainFor(walk.best, record.node, record.triggerSeq, CHAIN_LIMIT_CAP);
        const product = chain.hops.reduce((acc, h) => acc * h.weight, 1);
        expect({ depth: maxDepth, node: record.node, hops: chain.hops.length, w: product })
          .toEqual({ depth: maxDepth, node: record.node, hops: record.hops, w: expect.closeTo(record.w, 10) });
        // And the chain is a real, connected path that starts at a seed.
        for (let i = 1; i < chain.hops.length; i += 1) {
          expect(chain.hops[i].from).toBe(chain.hops[i - 1].to);
        }
        if (chain.hops.length) expect(chain.hops[0].from).toBe(1);
      }
    }
  });
});

// ── the floor is ONE rule ───────────────────────────────────────────────────

describe('E18.3 weightFloor applies to SEEDS as well as relaxations', () => {
  it('a sub-floor seed is not an item either — the front cannot show a cause and hide its consequences', () => {
    // A confidence drop 0.9 -> 0.88 is magnitude 0.02, under the 0.05 default.
    // It used to be returned as an ITEM while its dependent across a
    // `required for` edge — weight 1, so EXACTLY as doubtful by definition —
    // was cut by the same floor one line later.
    const hard = adj([[1, 1, 2, 'required for']]);
    const walk = layeredWalk(hard, [seed(1, { w: 0.02 })], opts());
    expect(walk.best.size).toBe(0);
    expect(walk.nodes).toBe(0);
    // Said, not implied — and NOT `truncated`: the floor is a filter the caller
    // asked for, exactly as it already is on the relaxation side.
    expect(walk.stoppedBy).toContain('floor');
    expect(walk.truncated).toBe(false);
  });

  it('a seed AT the floor is kept, with everything the hard edge carries it to', () => {
    const hard = adj([[1, 1, 2, 'required for']]);
    const walk = layeredWalk(hard, [seed(1, { w: DEFAULT_WEIGHT_FLOOR })], opts());
    expect(walk.nodes).toBe(2);
    expect(weightOf(walk, 2)).toBeCloseTo(DEFAULT_WEIGHT_FLOOR, 10);
    expect(walk.stoppedBy).toEqual([]);
  });

  it('a caller who wants the whole front lowers the floor and gets the seed back', () => {
    const hard = adj([[1, 1, 2, 'required for']]);
    const walk = layeredWalk(hard, [seed(1, { w: 0.02 })], opts({ weightFloor: 1e-9 }));
    expect(walk.nodes).toBe(2);
    expect(weightOf(walk, 1)).toBeCloseTo(0.02, 10);
    expect(weightOf(walk, 2)).toBeCloseTo(0.02, 10);
  });
});

// ── per-trigger attribution ─────────────────────────────────────────────────

describe('E18.3 the walk is keyed by (node, trigger)', () => {
  it('two triggers reaching one node keep two exact paths and two exact weights', () => {
    const edges = adj([[1, 1, 3, 'supports'], [2, 2, 3, 'required for']]);
    const walk = layeredWalk(edges, [seed(1, { seq: 10 }), seed(2, { seq: 20 })], opts());
    expect(weightOf(walk, 3, 10)).toBeCloseTo(0.6, 10);
    expect(weightOf(walk, 3, 20)).toBe(1);
    const grouped = byNode(walk.best);
    expect([...grouped.get(3).keys()].sort((x, y) => x - y)).toEqual([10, 20]);
    // Each trigger's chain names its OWN path.
    expect(chainFor(walk.best, 3, 10, DEFAULT_CHAIN_LIMIT).hops[0].from).toBe(1);
    expect(chainFor(walk.best, 3, 20, DEFAULT_CHAIN_LIMIT).hops[0].from).toBe(2);
  });

  it('maxNodes counts DISTINCT NODES, not (node, trigger) pairs', () => {
    const edges = adj([[1, 1, 3, 'required for'], [2, 2, 3, 'required for']]);
    const walk = layeredWalk(edges, [seed(1, { seq: 10 }), seed(2, { seq: 20 })], opts());
    expect(walk.nodes).toBe(3);
    expect(walk.best.size).toBe(4);
  });
});

// ── the anchor gate ─────────────────────────────────────────────────────────

describe('E18.3 the anchor gate, on the learned axis', () => {
  it('the anchor allowlist is the POSITIVE HALF ONLY', () => {
    // E18.2's allowlist is ['claim.verified','claim.refuted'] — correct there,
    // catastrophic here: a refutation would be its own anchor by EQUALITY and
    // the refuted node would silence itself off the front it triggered.
    expect(ANCHOR_KINDS).toEqual(['claim.verified', 'decision.made']);
    expect(ANCHOR_KINDS).not.toContain('claim.refuted');
    expect(ANCHOR_KINDS).not.toContain('decision.reopened');
  });

  it('learned axis: a trigger newer than the anchor is on the front', () => {
    expect(onFront({ seq: 30 }, { seq: 20 }, 'learned')).toBe(true);
    expect(onFront({ seq: 20 }, { seq: 30 }, 'learned')).toBe(false);
    expect(onFront({ seq: 20 }, { seq: 20 }, 'learned')).toBe(false);   // equality silences
    expect(onFront({ seq: 1 }, { seq: 0 }, 'learned')).toBe(true);      // scalar/none anchor
    expect(onFront({ seq: 1 }, null, 'learned')).toBe(true);
  });

  it('THE BACKDATING CASE: the two axes disagree, and that disagreement is the signal', () => {
    // Verified in world-June, learned at seq 20. Weakening describes world-March
    // but we only learn of it at seq 90.
    const anchor = { seq: 20, happened_at: '2026-06-01T00:00:00Z' };
    const trigger = { seq: 90, happened_at: '2026-03-01T00:00:00Z' };
    expect(onFront(trigger, anchor, 'learned')).toBe(true);    // the June check did not know
    expect(onFront(trigger, anchor, 'happened')).toBe(false);  // the world moved first
    expect(verifiedAfterInWorld(trigger, anchor)).toBe(true);
    expect(AXES).toEqual(['learned', 'happened']);
  });

  it('WORLD TIME IS COMPARED IN MILLISECONDS, across the two types it really arrives in', () => {
    // A trigger's happened_at is the raw Date pg returns for a timestamptz
    // (seedsFromEvents copies it straight through); an anchor's has been through
    // the route's isoOrNull() and is an ISO STRING. `Date.parse` takes a string,
    // so a Date argument is coerced by toString() — "Thu Jun 04 2026 15:40:45
    // GMT+0000", WITH NO MILLISECONDS — and the trigger's world time was floored
    // to the whole second before every comparison. Events written in one burst
    // (one test, one agent run, one import) are exactly this close.
    const dateTrigger = (ms) => ({ happened_at: new Date(`2026-06-04T15:40:45.${ms}Z`) });
    const isoAnchor = (ms) => ({ happened_at: `2026-06-04T15:40:45.${ms}Z` });

    // 600 ms AFTER the last check: on the front, and NOT "verified after".
    expect(onFront(dateTrigger('800'), isoAnchor('200'), 'happened')).toBe(true);
    expect(verifiedAfterInWorld(dateTrigger('900'), isoAnchor('100'))).toBe(false);
    // 600 ms BEFORE it: off the happened front, and the later check is reported.
    expect(onFront(dateTrigger('200'), isoAnchor('800'), 'happened')).toBe(false);
    expect(verifiedAfterInWorld(dateTrigger('200'), isoAnchor('800'))).toBe(true);
    // Same instant is not "after", on either side.
    expect(onFront(dateTrigger('500'), isoAnchor('500'), 'happened')).toBe(false);
    expect(verifiedAfterInWorld(dateTrigger('500'), isoAnchor('500'))).toBe(false);

    // And the answer does not depend on WHICH SIDE is the Date: all four
    // type pairings agree.
    const asIso = (t) => ({ happened_at: t.happened_at.toISOString() });
    const asDate = (a) => ({ happened_at: new Date(a.happened_at) });
    for (const [t, a] of [['800', '200'], ['200', '800'], ['500', '500']]) {
      const T = dateTrigger(t);
      const A = isoAnchor(a);
      const pairs = [[T, A], [asIso(T), A], [T, asDate(A)], [asIso(T), asDate(A)]];
      const fronts = pairs.map(([x, y]) => onFront(x, y, 'happened'));
      const afters = pairs.map(([x, y]) => verifiedAfterInWorld(x, y));
      expect(new Set(fronts).size).toBe(1);
      expect(new Set(afters).size).toBe(1);
    }
  });

  it('happened axis: no anchor in any world means every weakening is newer', () => {
    expect(onFront({ happened_at: '2026-01-01Z' }, { happened_at: null }, 'happened')).toBe(true);
    expect(verifiedAfterInWorld({ happened_at: null }, { happened_at: '2026-01-01Z' })).toBe(false);
  });
});

// ── discipline ──────────────────────────────────────────────────────────────

describe('E18.3 discipline — the reader can point at the ONE place the weight lives', () => {
  function layeredWalkBody() {
    const source = fs.readFileSync(path.join(SRC_DIR, 'doubt.js'), 'utf-8');
    const start = source.indexOf('export function layeredWalk');
    expect(start).toBeGreaterThan(-1);
    // Balance braces from the function's opening one to its close.
    const open = source.indexOf('{', start);
    let depth = 0;
    let i = open;
    for (; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') { depth -= 1; if (depth === 0) break; }
    }
    return source.slice(open, i + 1);
  }

  it('layeredWalk carries NO attenuation constant — no fractional literal at all', () => {
    const body = layeredWalkBody()
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    // A decimal or exponent literal anywhere in the walk means someone inlined a
    // weight, a floor or an epsilon instead of taking it from the caller.
    const offenders = body.match(/\b\d+\.\d+\b|\b\d+e-?\d+\b/gi) ?? [];
    expect(offenders).toEqual([]);
    // And every knob it uses arrives through `opts`.
    expect(body).toContain('const { weights, weightFloor, maxDepth, maxNodes } = opts;');
    expect(body).toContain('edge.propagation ?? weights[edge.purpose]');
  });

  it('the literal 0.6 occurs EXACTLY ONCE in src/, in DEFAULT_PROPAGATION_WEIGHTS', () => {
    const hits = [];
    const walkDir = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walkDir(full); continue; }
        if (!entry.name.endsWith('.js')) continue;
        const lines = fs.readFileSync(full, 'utf-8').split('\n');
        lines.forEach((line, n) => {
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
          if (/\b0\.6\b/.test(line)) hits.push(`${path.relative(SRC_DIR, full)}:${n + 1}`);
        });
      }
    };
    walkDir(SRC_DIR);
    expect(hits).toEqual(['doubt.js:' + (fs.readFileSync(path.join(SRC_DIR, 'doubt.js'), 'utf-8')
      .split('\n').findIndex((l) => /\b0\.6\b/.test(l) && !l.trim().startsWith('//')) + 1)]);
    expect(hits).toHaveLength(1);
  });

  it('the defaults a route echoes are all exported from this one module', () => {
    expect(DEFAULT_WEIGHT_FLOOR).toBeGreaterThan(MIN_PROPAGATION);
    expect(DEFAULT_MAX_NODES).toBeGreaterThan(0);
    expect(CHAIN_LIMIT_CAP).toBeGreaterThanOrEqual(DEFAULT_CHAIN_LIMIT);
  });
});
