// E18.5 — WHAT AN OVERLAY IS.
//
// E18.1 fixed the signature: "an overlay is foldEvents(baseState,
// arbitraryEventList) — one pure function signature everything routes through",
// and `foldEvents` applies events in the order given and does NOT sort, which is
// what makes an arbitrary list legal.
//
// The route does not fold a second time: it PROJECTS a state graphAsOf has
// already built. The two are the same value, and this file is what stops the
// cheap path drifting from the definition — plus the one caveat that makes the
// equality true (dangling edges MUST be dropped) and the refusal that is the
// whole intellectual point of the rung (NO FABRICATED COUNTERFACTUALS).
//
// Wholly pure: src/branches.js and src/events/fold.js reach no database.
import { describe, it, expect } from 'vitest';
import { canonicalJson, emptyState, foldEvents } from '../src/events/fold.js';
import {
  OVERLAY_EMPTY_REASON,
  branchClosure,
  overlayEvents,
  overlayFrom,
  overlaySummary,
} from '../src/branches.js';

// ── a small synthetic log ───────────────────────────────────────────────────

let seq = 0;
const created = (id, meta) => ({
  seq: (seq += 1),
  kind: 'node.created',
  subject_kind: 'node',
  subject_id: id,
  payload: {
    op: 'INSERT', table: 'tasks', version: 1,
    after: { meta, version: 1, content: `body ${id}`, created_at: '2026-01-01T00:00:00.000Z' },
  },
});
const patched = (id, changes) => ({
  seq: (seq += 1),
  kind: 'node.patched',
  subject_kind: 'node',
  subject_id: id,
  payload: { op: 'UPDATE', table: 'tasks', version: 2, changes },
});
const removed = (id) => ({
  seq: (seq += 1),
  kind: 'node.removed',
  subject_kind: 'node',
  subject_id: id,
  payload: { op: 'DELETE', table: 'tasks' },
});
// The CASCADED edge removal a node DELETE always produces: the BEFORE-DELETE
// task trigger lands node.removed first and each cascaded edge.removed points
// cause_id at it. Including it is not decoration — without it the fold's state
// keeps an edge whose endpoint node is gone (only `toGraphPayload` drops
// danglers at projection time), and the overlay equality below would be
// comparing a real log against one that cannot happen.
const edgeRemoved = (id, source, target, cause) => ({
  seq: (seq += 1),
  kind: 'edge.removed',
  subject_kind: 'edge',
  subject_id: id,
  cause_id: cause,
  payload: {
    op: 'DELETE', table: 'edges',
    before: { source_id: source, target_id: target, purpose: 'required for' },
  },
});
const edged = (id, source, target, purpose) => ({
  seq: (seq += 1),
  kind: 'edge.added',
  subject_kind: 'edge',
  subject_id: id,
  payload: {
    op: 'INSERT', table: 'edges', version: 1,
    after: { source_id: source, target_id: target, purpose, type: 'dependency', meta: {},
             version: 1, created_at: '2026-01-01T00:00:00.000Z' },
  },
});

//   1 decision, 2 chosen option, 3 alternative option
//   3 --required for--> 4 --required for--> 5   (the alternative's branch)
//   2 --required for--> 6                       (the chosen branch)
//   5 --required for--> 7, and 7 is REMOVED later
//   edge 205 crosses OUT of the branch (5 -> 6): a dangler under projection
const EVENTS = [
  created(1, { title: 'storage engine', type: 'decision' }),
  created(2, { title: 'Timescale' }),
  created(3, { title: 'ClickHouse' }),
  created(4, { title: 'clickhouse spike' }),
  created(5, { title: 'ingest bench' }),
  created(6, { title: 'ship it' }),
  created(7, { title: 'doomed' }),
  edged(201, 3, 4, 'required for'),
  edged(202, 4, 5, 'required for'),
  edged(203, 2, 6, 'required for'),
  edged(204, 5, 7, 'required for'),
  edged(205, 5, 6, 'required for'),
  patched(4, { 'meta.status': { from: 'todo', to: 'done' } }),
  patched(5, { 'meta.confidence': { from: null, to: 0.8 } }),
  removed(7),
  edgeRemoved(204, 5, 7, 15),
];

const BRANCH_B = new Set([3, 4, 5]);

describe('E18.5 an overlay is foldEvents(base, the branch\'s events)', () => {
  it('folding the FILTERED list equals projecting the FULL fold — byte for byte', () => {
    const a = foldEvents(emptyState(), overlayEvents(EVENTS, BRANCH_B));
    const b = overlayFrom(foldEvents(emptyState(), EVENTS), BRANCH_B);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    // ...and it is not vacuously equal: both hold the branch.
    expect(a.nodes.map((n) => n.id)).toEqual([3, 4, 5]);
    expect(a.edges.map((e) => e.id)).toEqual([201, 202]);
  });

  it('a NAIVE projection that keeps every edge is NOT equal — it keeps danglers', () => {
    const full = foldEvents(emptyState(), EVENTS);
    const naive = {
      v: full.v,
      nodes: full.nodes.filter((n) => BRANCH_B.has(n.id)),
      edges: full.edges.filter((e) => BRANCH_B.has(e.source) || BRANCH_B.has(e.target)),
    };
    const honest = overlayFrom(full, BRANCH_B);
    expect(canonicalJson(naive)).not.toBe(canonicalJson(honest));
    // 205 leaves the set (5 -> 6): kept by the naive rule, dropped by the honest
    // one, and it is the ONLY difference — which is what makes this a caveat and
    // not a different algorithm.
    expect(naive.edges.map((e) => e.id)).toContain(205);
    expect(honest.edges.map((e) => e.id)).not.toContain(205);
  });

  it('the per-subject independence the equality rests on holds for a DELETE too', () => {
    const withSeven = new Set([3, 4, 5, 7]);
    const a = foldEvents(emptyState(), overlayEvents(EVENTS, withSeven));
    const b = overlayFrom(foldEvents(emptyState(), EVENTS), withSeven);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(a.nodes.map((n) => n.id)).toEqual([3, 4, 5]);   // 7 was removed
  });

  it('a prefix of the log does not contain a node created later', () => {
    const beforeFive = EVENTS.filter((e) => e.seq < 5);   // node 5 is the 5th event
    const state = foldEvents(emptyState(), beforeFive);
    const overlay = overlayFrom(state, BRANCH_B);
    expect(overlay.nodes.map((n) => n.id)).toEqual([3, 4]);
    expect(overlay.nodes.some((n) => n.id === 5)).toBe(false);
  });
});

describe('E18.5 NO FABRICATED COUNTERFACTUALS', () => {
  const links = [
    { id: 201, source: 3, target: 4, purpose: 'required for', meta: {} },
    { id: 202, source: 4, target: 5, purpose: 'required for', meta: {} },
    { id: 203, source: 2, target: 6, purpose: 'required for', meta: {} },
  ];
  const payload = {
    nodes: [1, 2, 3, 4, 5, 6].map((id) => ({ id, title: `n${id}`, meta: {} })),
    links,
  };

  it('an option with work recorded shows EXACTLY that work and nothing else', () => {
    const overlay = overlaySummary(payload, branchClosure(links, 3), { option_id: 3, role: 'alternative' });
    expect(overlay.node_ids).toEqual([3, 4, 5]);
    expect(overlay.empty).toBe(false);
    expect(overlay.fabricated).toBe(false);
    expect(overlay.basis).toBe('log-projection');
    // The chosen branch is NOT mirrored into it with the names swapped.
    expect(overlay.node_ids).not.toContain(2);
    expect(overlay.node_ids).not.toContain(6);
  });

  it('a branch NEVER EXPLORED says so — it does not return something that reads as evidence', () => {
    // Option 9 exists as a node and carries no work at all.
    const lonely = { nodes: [...payload.nodes, { id: 9, title: 'ClickHouse', meta: {} }], links };
    const overlay = overlaySummary(lonely, branchClosure(links, 9), { option_id: 9, role: 'alternative' });
    expect(overlay.empty).toBe(true);
    expect(overlay.work_count).toBe(0);
    expect(overlay.edge_ids).toEqual([]);
    expect(overlay.reason).toBe(OVERLAY_EMPTY_REASON);
    expect(overlay.fabricated).toBe(false);
    // There is no key that could carry an invented plan.
    expect(Object.keys(overlay).sort()).toEqual([
      'basis', 'edge_count', 'edge_ids', 'empty', 'fabricated', 'node_count',
      'node_ids', 'option_id', 'reason', 'role', 'truncated', 'work_count',
    ]);
  });

  it('an option node that is not in the rectangle at all projects to nothing', () => {
    const overlay = overlaySummary(payload, branchClosure(links, 77), { option_id: 77, role: 'alternative' });
    expect(overlay.node_count).toBe(0);
    expect(overlay.empty).toBe(true);
    expect(overlay.fabricated).toBe(false);
  });

  it('`fabricated` is a constant, not a computed flag', () => {
    for (const ids of [[], [3], [3, 4, 5], [1, 2, 3, 4, 5, 6]]) {
      expect(overlaySummary(payload, new Set(ids), { option_id: ids[0] ?? null }).fabricated).toBe(false);
    }
  });
});
