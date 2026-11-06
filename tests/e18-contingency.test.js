// E18.5 — THE CONTINGENCY CLOSURE: everything that hangs off a decision, and
// therefore everything reopening it puts back in play.
//
// Two tiers, one definition. The SET is a plain UNION-dedup recursive CTE (the
// house idiom, and dormantCteSql is where it lives). HOPS AND CHAINS are E18.3's
// layered walk, unchanged — with every weight equal to 1 the max-product
// relaxation DEGENERATES TO BREADTH-FIRST SEARCH and E18.3's termination proof
// carries over verbatim.
//
// THE MEASURED REASON THERE IS NO PATH-CARRYING CTE: on a 1204-node / 14-deep
// graph the path-carrying variant grew ~3x per hop (109 303 rows at depth<8,
// 252 ms) and did not finish at depth<12, while a depth-CARRYING UNION variant
// looked cheap (3.8 ms) and silently returned 1103 of 1203 nodes because its
// guard cut the walk short WITH NO FLAG. Truncation must always be reported;
// that is most of what this file asserts.
//
// Wholly pure.
import { describe, it, expect } from 'vitest';
import {
  CONTINGENCY_WEIGHTS,
  branchClosure,
  closureAdjacency,
  closureFrom,
  contingencyAdjacency,
  contingencyFrom,
  contingencyLinks,
} from '../src/branches.js';

const link = (id, source, target, purpose, meta = {}) => ({ id, source, target, purpose, meta });
const requires = (id, s, t, meta = {}) => link(id, s, t, 'required for', meta);
const supports = (id, s, t) => link(id, s, t, 'supports');

// D -> A -> A1 -> A2        (the chosen road, 3 hops deep)
// D -> B -> B1              (the alternative)
// X --supports--> D         (a ground: upstream, never contingent)
// A1 --supports--> S1       (evidence hanging off the road: NOT contingent work)
const D = 1, A = 2, A1 = 3, A2 = 4, B = 5, B1 = 6, X = 7, S1 = 8;
const LINKS = [
  requires(101, D, A),
  requires(102, A, A1),
  requires(103, A1, A2),
  requires(104, D, B),
  requires(105, B, B1),
  supports(106, X, D),
  supports(107, A1, S1),
];

const adjacency = () => contingencyAdjacency(LINKS.filter((l) => l.purpose === 'required for'));

describe('E18.5 the contingency closure', () => {
  it('reaches everything downstream of the decision, with hop counts', () => {
    const out = contingencyFrom(adjacency(), D, {});
    expect(out.nodes.map((n) => n.id)).toEqual([A, B, A1, B1, A2]);
    expect(out.nodes.map((n) => n.hops)).toEqual([1, 1, 2, 2, 3]);
    expect(out.count).toBe(5);
    expect(out.truncated).toBe(false);
    expect(out.stopped_by).toEqual([]);
  });

  it('does NOT traverse `supports` — evidence is not contingent work', () => {
    // `supports` has no weight at all, which is what makes layeredWalk skip it
    // (`if (!(ew > MIN_PROPAGATION)) continue`). `related to` DOES have one,
    // because the option edge is the first hop out of a decision — and the
    // adjacency, not the weight map, is what keeps `related to` at large out.
    expect(Object.keys(CONTINGENCY_WEIGHTS).sort()).toEqual(['related to', 'required for']);
    expect(CONTINGENCY_WEIGHTS.supports).toBeUndefined();
    const out = contingencyFrom(contingencyAdjacency(LINKS), D, {});
    // S1 hangs off A1 by `supports`; X supports D from upstream. Neither is in.
    expect(out.nodes.map((n) => n.id)).not.toContain(S1);
    expect(out.nodes.map((n) => n.id)).not.toContain(X);
  });

  it('contingencyLinks admits THIS decision\'s option edges and no other `related to`', () => {
    const withOptions = [
      ...LINKS,
      { id: 108, source: D, target: A, purpose: 'related to', meta: { branch: { role: 'chosen' } } },
      { id: 109, source: 99, target: 98, purpose: 'related to', meta: { branch: { role: 'chosen' } } },
      { id: 110, source: A1, target: 97, purpose: 'related to', meta: {} },
    ];
    const admitted = contingencyLinks(withOptions, D).map((l) => l.id).sort((a, b) => a - b);
    expect(admitted).toEqual([101, 102, 103, 104, 105, 108]);
    // 109 belongs to another decision; 110 is an ordinary `related to` note.
    const out = contingencyFrom(contingencyAdjacency(contingencyLinks(withOptions, D)), D, {});
    expect(out.nodes.map((n) => n.id)).not.toContain(97);
    expect(out.nodes.map((n) => n.id)).not.toContain(98);
  });

  it('every chain multiplies back to its own path and ends at the node', () => {
    const out = contingencyFrom(adjacency(), D, {});
    for (const item of out.nodes) {
      expect(item.chain.hops.length).toBe(item.hops);
      expect(item.chain.hops[0].from).toBe(D);
      expect(item.chain.hops[item.chain.hops.length - 1].to).toBe(item.id);
      // Contiguous, and the product of the per-hop weights is the walk's own
      // weight — 1, because contingency is structural and does not attenuate.
      let product = 1;
      for (let i = 0; i < item.chain.hops.length; i += 1) {
        product *= item.chain.hops[i].weight;
        if (i > 0) expect(item.chain.hops[i].from).toBe(item.chain.hops[i - 1].to);
        expect(item.chain.hops[i].purpose).toBe('required for');
      }
      expect(product).toBe(1);
      expect(item.chain.truncated).toBe(false);
    }
  });

  it('a per-edge meta.propagation must NOT attenuate a structural closure', () => {
    // 0.05 would cut the walk dead at the first hop if the doubt weight were
    // honoured here. Contingency is "what hangs off this", not "how much doubt
    // flows through it".
    const attenuated = [
      requires(101, D, A, { propagation: 0.05 }),
      requires(102, A, A1, { propagation: 0.05 }),
    ];
    const out = contingencyFrom(contingencyAdjacency(attenuated), D, {});
    expect(out.nodes.map((n) => n.id)).toEqual([A, A1]);
  });
});

describe('E18.5 truncation is REPORTED, never silent', () => {
  // A 12-node chain, so a depth cap can bite in the middle of it.
  const chain = [];
  for (let i = 1; i < 12; i += 1) chain.push(requires(200 + i, i, i + 1));

  it('maxDepth reports `depth` and does not pretend the walk finished', () => {
    const out = contingencyFrom(contingencyAdjacency(chain), 1, { maxDepth: 3 });
    expect(out.nodes.map((n) => n.id)).toEqual([2, 3, 4]);
    expect(out.truncated).toBe(true);
    expect(out.stopped_by).toContain('depth');
    expect(out.walk.max_depth_reached).toBe(3);
  });

  it('maxNodes reports `node_cap`', () => {
    const out = contingencyFrom(contingencyAdjacency(chain), 1, { maxNodes: 4 });
    expect(out.truncated).toBe(true);
    expect(out.stopped_by).toContain('node_cap');
  });

  it('maxResults pages the answer and says the count is bigger than the page', () => {
    const out = contingencyFrom(contingencyAdjacency(chain), 1, { maxResults: 2 });
    expect(out.nodes.length).toBe(2);
    expect(out.count).toBe(11);
    expect(out.truncated).toBe(true);
    expect(out.stopped_by).toContain('max_results');
  });

  it('chainLimit cuts at the TRIGGER end and reports `chain`', () => {
    const out = contingencyFrom(contingencyAdjacency(chain), 1, { chainLimit: 2 });
    const deepest = out.nodes[out.nodes.length - 1];
    expect(deepest.id).toBe(12);
    expect(deepest.chain.hops.length).toBe(2);
    expect(deepest.chain.truncated).toBe(true);
    expect(deepest.chain.omitted_hops).toBe(9);
    // The hops nearest the ITEM are what a reader acts on, so those are kept.
    expect(deepest.chain.hops[deepest.chain.hops.length - 1].to).toBe(12);
    expect(out.stopped_by).toContain('chain');
  });
});

describe('E18.5 termination', () => {
  it('a `supports` CYCLE is present but untraversed, and the walk still ends', () => {
    const cyclic = [
      requires(301, D, A),
      requires(302, A, A1),
      supports(303, A1, A),     // a real cycle over the purpose we do not follow
      supports(304, A, A1),
    ];
    const out = contingencyFrom(contingencyAdjacency(cyclic), D, { maxDepth: 256 });
    expect(out.nodes.map((n) => n.id)).toEqual([A, A1]);
    expect(out.truncated).toBe(false);
  });

  it('a `required for` cycle terminates on the strict-improvement rule alone', () => {
    // Not writable through the API (dependency edges are cycle-checked), but a
    // READ path must degrade to a short answer and never to an infinite loop.
    const cyclic = [requires(401, 1, 2), requires(402, 2, 3), requires(403, 3, 1)];
    const out = contingencyFrom(contingencyAdjacency(cyclic), 1, { maxDepth: 256 });
    expect(out.nodes.map((n) => n.id).sort((a, b) => a - b)).toEqual([2, 3]);
    expect(out.truncated).toBe(false);
  });

  it('closureFrom carries a visited set for the same reason', () => {
    const cyclic = [requires(401, 1, 2), requires(402, 2, 3), requires(403, 3, 1)];
    expect([...closureFrom(closureAdjacency(cyclic), 1)].sort()).toEqual([1, 2, 3]);
  });

  it('branchClosure includes the option itself and stops at the branch boundary', () => {
    expect([...branchClosure(LINKS, B)].sort((a, b) => a - b)).toEqual([B, B1]);
    expect([...branchClosure(LINKS, A)].sort((a, b) => a - b)).toEqual([A, A1, A2]);
  });
});
