// E18.1 STEP 3 — the pure fold.
//
// This file pins the one invariant the whole asOf feature rests on: the fold is
// forward-only, `to`-only, last-writer-wins, and it NEVER reads
// `changes[*].from`. Two things follow, and both are tested here rather than
// argued:
//
//   * re-applying an event the state already reflects is a NO-OP, so
//     over-replay is safe — which is what makes the genesis-at-seq-0 backfill
//     race-free (every write that races it has seq >= 1 and is replayed);
//   * on the happened axis the captured `from` values are actively WRONG (the
//     triggers recorded them against the materialized present, i.e. against
//     learned order), so ignoring them is a correctness requirement.
//
// src/events/fold.js and src/events/kinds.js are PURE — they import nothing
// that reaches src/db.js — so unlike every other e18 test file these can be
// imported statically. There is no database in this file at all.
import { describe, it, expect } from 'vitest';
import {
  FOLD_VERSION,
  emptyState,
  applyEvent,
  foldEvents,
  orderEvents,
  canonicalJson,
  stateSha,
  toGraphPayload,
  filterGenesisByHappened,
} from '../src/events/fold.js';
import { EVENT_KINDS, classifyNode, classifyEdge, headline } from '../src/events/kinds.js';

// ── event fixtures: the EXACT payload shapes db/schema.sql's row loggers write ──
//
// gt_log_task / gt_log_edge build these with jsonb_build_object; the column
// lists come from `to_jsonb(NEW) - 'graph_id'`. Keeping the fixtures faithful is
// the point — a fold that only works against hand-simplified payloads is not a
// fold that works.

let nextSeq = 0;
const bump = () => ++nextSeq;

function evt(fields) {
  return {
    graph_id: 'g1',
    seq: String(fields.seq ?? bump()),
    happened_at: fields.happened_at ?? '2026-01-01T10:00:00.000Z',
    learned_at: fields.learned_at ?? fields.happened_at ?? '2026-01-01T10:00:00.000Z',
    actor: { type: 'agent', name: 'claude' },
    kind: fields.kind,
    subject_kind: fields.subject_kind,
    subject_id: fields.subject_id === null ? null : String(fields.subject_id),
    cause_id: fields.cause_id === undefined ? null : fields.cause_id,
    request_id: 'req-1',
    txid: 100,
    payload: fields.payload,
  };
}

function taskRow({ id, meta, content, version = 1, created_at = '2026-01-01T09:00:00+00:00', external_id = null }) {
  return {
    id,
    content,
    meta,
    created_at,
    updated_at: created_at,
    version,
    last_modified_by: 'agent',
    last_modified_by_user: null,
    external_id,
    run_id: null,
    claimed_by: null,
    claimed_by_name: null,
    claim_expires_at: null,
  };
}

function nodeCreated(opts) {
  const row = taskRow(opts);
  return evt({
    ...opts,
    kind: 'node.created',
    subject_kind: 'node',
    subject_id: opts.id,
    payload: {
      v: 1,
      op: 'INSERT',
      table: 'tasks',
      kinds: ['node.created'],
      node_kind: opts.meta.type ?? null,
      version: opts.version ?? 1,
      after: row,
    },
  });
}

function nodeUpdated({ id, changes, version = 2, node_kind = null, reason = null, ...rest }) {
  const kinds = classifyNode(changes);
  return evt({
    ...rest,
    kind: headline(kinds),
    subject_kind: 'node',
    subject_id: id,
    payload: {
      v: 1,
      op: 'UPDATE',
      table: 'tasks',
      kinds,
      node_kind,
      version,
      reason,
      changes,
    },
  });
}

function nodeRemoved({ id, before = null, cause_id, ...rest }) {
  return evt({
    ...rest,
    kind: 'node.removed',
    subject_kind: 'node',
    subject_id: id,
    cause_id,
    payload: {
      v: 1,
      op: 'DELETE',
      table: 'tasks',
      kinds: ['node.removed'],
      node_kind: null,
      graph_deleted: false,
      before,
    },
  });
}

function edgeAdded({ id, source, target, purpose = 'related to', type = 'related', meta = {}, version = 1, created_at = '2026-01-01T09:30:00+00:00', ...rest }) {
  return evt({
    ...rest,
    kind: 'edge.added',
    subject_kind: 'edge',
    subject_id: id,
    payload: {
      v: 1,
      op: 'INSERT',
      table: 'edges',
      kinds: ['edge.added'],
      version,
      after: {
        id,
        source_id: source,
        target_id: target,
        type,
        meta,
        created_at,
        version,
        last_modified_by: 'agent',
        last_modified_by_user: null,
        external_id: null,
        run_id: null,
        purpose,
      },
    },
  });
}

function edgeUpdated({ id, changes, version = 2, reason = null, ...rest }) {
  const kinds = classifyEdge(changes);
  return evt({
    ...rest,
    kind: headline(kinds),
    subject_kind: 'edge',
    subject_id: id,
    payload: { v: 1, op: 'UPDATE', table: 'edges', kinds, version, reason, changes },
  });
}

function edgeRemoved({ id, cascade_from = null, cause_id = null, ...rest }) {
  return evt({
    ...rest,
    kind: 'edge.removed',
    subject_kind: 'edge',
    subject_id: id,
    cause_id,
    payload: {
      v: 1,
      op: 'DELETE',
      table: 'edges',
      kinds: ['edge.removed'],
      cascade_from,
      graph_deleted: false,
      before: null,
    },
  });
}

// sha256 of the body a fixture writes, the way gt_content_change computes it.
import { createHash } from 'node:crypto';
const sha = (s) => createHash('sha256').update(String(s), 'utf8').digest('hex');

function contentChange(from, to) {
  return {
    from_sha: sha(from),
    to,
    to_sha: sha(to),
    to_len: to.length,
    truncated: false,
  };
}

// A small, realistic graph: two nodes and an edge between them.
function seeded() {
  nextSeq = 0;
  const events = [
    nodeCreated({ id: 1, meta: { title: 'A', status: 'todo', type: 'claim' }, content: '---\ntitle: A\n---\nbody A' }),
    nodeCreated({ id: 2, meta: { title: 'B', status: 'todo' }, content: '---\ntitle: B\n---\nbody B' }),
    edgeAdded({ id: 1, source: 1, target: 2, purpose: 'required for', type: 'dependency' }),
  ];
  return { events, state: foldEvents(emptyState(), events) };
}

// ── the empty substrate ──────────────────────────────────────────────────────

describe('E18.1 fold — the genesis literal', () => {
  it('canonicalises emptyState() byte-for-byte to the literal db/schema.sql writes', () => {
    // gt_seed_genesis inserts this exact string for every new graph, and
    // tests/e18-schema.test.js pins it AND its sha from the database side. If
    // this assertion ever fails, every genesis snapshot in the database has a
    // state_sha the fold cannot reproduce.
    expect(canonicalJson(emptyState())).toBe('{"v":1,"nodes":[],"edges":[]}');
    expect(stateSha(emptyState())).toBe(
      '2c8358757dc8a60ccf34027708d7835d2761f65d68cdc40a5abf360a2aac9274',
    );
  });

  it('stamps the fold version into the state envelope', () => {
    expect(FOLD_VERSION).toBe(1);
    expect(emptyState().v).toBe(FOLD_VERSION);
  });
});

// ── canonical JSON ───────────────────────────────────────────────────────────

describe('E18.1 fold — canonicalJson', () => {
  it('is insertion-order independent at every depth', () => {
    const a = { v: 1, nodes: [{ id: 1, meta: { b: 2, a: { z: 1, y: 2 } }, version: 1 }], edges: [] };
    const b = { edges: [], nodes: [{ version: 1, meta: { a: { y: 2, z: 1 }, b: 2 }, id: 1 }], v: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(stateSha(a)).toBe(stateSha(b));
  });

  it('keeps the envelope in v/nodes/edges order but sorts everything below it', () => {
    const s = { edges: [], nodes: [{ zeta: 1, alpha: 2, id: 3 }], v: 1 };
    expect(canonicalJson(s)).toBe('{"v":1,"nodes":[{"alpha":2,"id":3,"zeta":1}],"edges":[]}');
  });

  it('does not reorder a user meta key that happens to be called "nodes"', () => {
    // The v/nodes/edges rank applies at the ROOT only. Inside `meta` the keys
    // are arbitrary user data and sort lexicographically like anything else.
    const s = { v: 1, nodes: [{ id: 1, meta: { nodes: 1, edges: 2, aaa: 3 } }], edges: [] };
    expect(canonicalJson(s)).toBe(
      '{"v":1,"nodes":[{"id":1,"meta":{"aaa":3,"edges":2,"nodes":1}}],"edges":[]}',
    );
  });

  it('matches JSON.stringify on undefined: dropped in objects, null in arrays', () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalJson([1, undefined, 2])).toBe('[1,null,2]');
  });

  it('gives a stable sha for a real folded state', () => {
    // A pinned literal, not a round-trip: it fails if the canonical form ever
    // changes shape, which would silently orphan every stored snapshot sha.
    const { state } = seeded();
    expect(canonicalJson(state)).toBe(
      '{"v":1,"nodes":[' +
        '{"content_sha":"' + sha('---\ntitle: A\n---\nbody A') + '",' +
        '"created_at":"2026-01-01T09:00:00.000Z","external_id":null,"id":1,' +
        '"meta":{"status":"todo","title":"A","type":"claim"},"version":1},' +
        '{"content_sha":"' + sha('---\ntitle: B\n---\nbody B') + '",' +
        '"created_at":"2026-01-01T09:00:00.000Z","external_id":null,"id":2,' +
        '"meta":{"status":"todo","title":"B"},"version":1}],' +
        '"edges":[{"created_at":"2026-01-01T09:30:00.000Z","id":1,"meta":{},' +
        '"purpose":"required for","source":1,"target":2,"type":"dependency","version":1}]}',
    );
    expect(stateSha(state)).toBe(stateSha(foldEvents(emptyState(), seeded().events)));
  });

  it('carries no bodies — only a content_sha per node', () => {
    const { state } = seeded();
    const json = canonicalJson(state);
    expect(json).not.toContain('body A');
    for (const n of state.nodes) {
      expect(n).not.toHaveProperty('content');
      expect(typeof n.content_sha).toBe('string');
      expect(n.content_sha).toHaveLength(64);
    }
  });
});

// ── idempotency, for every kind ──────────────────────────────────────────────

describe('E18.1 fold — applyEvent is idempotent for every kind', () => {
  // One event per kind in EVENT_KINDS, applied to a state that already holds
  // the subject. Applying it twice must produce byte-identical output: that is
  // over-replay safety, and it is what makes the genesis backfill race-free.
  function casesFor() {
    const { state } = seeded();
    return {
      'node.created': [state, nodeCreated({ id: 1, meta: { title: 'A2', status: 'todo' }, content: 'x', version: 3 })],
      'node.patched': [state, nodeUpdated({ id: 1, changes: { content: contentChange('body A', 'body A revised') } })],
      'node.removed': [state, nodeRemoved({ id: 1 })],
      'status.changed': [state, nodeUpdated({ id: 1, changes: { 'meta.status': { from: 'todo', to: 'review' } } })],
      'field.set': [state, nodeUpdated({ id: 1, changes: { 'meta.confidence': { from: null, to: 0.9 } } })],
      'claim.verified': [state, nodeUpdated({ id: 1, changes: { 'meta.verified_at': { from: null, to: '2026-02-02T00:00:00.000Z' } } })],
      // E18.2 — the negative half. A refute SETS refuted_at and CLEARS
      // verified_at in one change, which is what the verify route writes; the
      // cleared key carries `to_present: false`, the gt_diff shape for a key
      // that went away.
      'claim.refuted': [state, nodeUpdated({ id: 1, changes: {
        'meta.refuted_at': { from: null, to: '2026-02-02T00:00:00.000Z' },
        'meta.verified_at': { from: '2026-01-01T00:00:00.000Z', to: null, to_present: false },
      } })],
      'decision.made': [state, nodeUpdated({ id: 1, changes: { 'meta.decided_at': { from: null, to: '2026-02-02T00:00:00.000Z' } } })],
      'decision.reopened': [state, nodeUpdated({ id: 1, changes: { 'meta.decided_at': { from: '2026-02-02T00:00:00.000Z', to: null } } })],
      // E18.4 — an ANNOTATION. It folds to nothing at all: the state of a
      // supersession is the EDGE SET, and this event is a dated assertion
      // ABOUT a node, not a row change. The subject is deliberately id 1,
      // which the seeded state HOLDS, so this case proves the no-op; the
      // ABSENT-subject case (the ghost-node guard) is its own test below.
      'node.superseded': [state, evt({
        kind: 'node.superseded',
        subject_kind: 'node',
        subject_id: 1,
        cause_id: 7,
        payload: {
          v: 1, op: 'ANNOTATE', table: 'tasks',
          kinds: ['node.superseded'], node_kind: 'finding',
          superseded_by: 2, edge_id: 1, via: 'edge.added',
        },
      })],
      // E18.6 — the excision RECORD for a node the seeded state HOLDS. With
      // `after` present it re-declares the node (meta/version/content_sha, no
      // body); re-applying re-declares the same thing, byte for byte.
      'node.excised': [state, evt({
        kind: 'node.excised',
        subject_kind: 'node',
        subject_id: 1,
        payload: {
          v: 1, op: 'EXCISE', table: 'events',
          kinds: ['node.excised'], node_kind: 'finding',
          reason: 'legal request', node_present: true,
          excised_count: 2, excised_seq_min: 1, excised_seq_max: 2,
          after: { meta: { title: 'A', status: 'todo' }, version: 3, external_id: null,
                   content_sha: 'abc', created_at: '2026-01-01T09:00:00.000Z' },
        },
      })],
      'edge.added': [state, edgeAdded({ id: 1, source: 1, target: 2, purpose: 'supports', type: 'related', version: 4 })],
      'edge.removed': [state, edgeRemoved({ id: 1 })],
      'edge.retyped': [state, edgeUpdated({ id: 1, changes: { purpose: { from: 'required for', to: 'contradicts' }, type: { from: 'dependency', to: 'related' } } })],
      'edge.rewired': [state, edgeUpdated({ id: 1, changes: { source_id: { from: 1, to: 2 }, target_id: { from: 2, to: 1 } } })],
      'edge.patched': [state, edgeUpdated({ id: 1, changes: { 'meta.color': { from: null, to: '#f00' } } })],
      'graph.id_rotated': [state, evt({ kind: 'graph.id_rotated', subject_kind: 'graph', subject_id: null, payload: { v: 1, kinds: ['graph.id_rotated'], changes: { graph_id: { from: 'g1', to: 'g2' } } } })],
      'graph.deleted': [state, evt({ kind: 'graph.deleted', subject_kind: 'graph', subject_id: null, payload: { v: 1, kinds: ['graph.deleted'], node_count: 2, edge_count: 1, name: 'g' } })],
    };
  }

  it('covers the complete EVENT_KINDS vocabulary', () => {
    expect(Object.keys(casesFor()).sort()).toEqual([...EVENT_KINDS].sort());
  });

  for (const kind of EVENT_KINDS) {
    it(`${kind} — applying twice equals applying once`, () => {
      const [base, event] = casesFor()[kind];
      expect(event.kind).toBe(kind);
      const once = applyEvent(base, event);
      const twice = applyEvent(once, event);
      expect(canonicalJson(twice)).toBe(canonicalJson(once));
      expect(stateSha(twice)).toBe(stateSha(once));
    });

    it(`${kind} — never mutates the state it was handed`, () => {
      const [base, event] = casesFor()[kind];
      const before = canonicalJson(base);
      applyEvent(base, event);
      expect(canonicalJson(base)).toBe(before);
    });
  }

  it('re-folds a whole log over its own output with no change', () => {
    const { events, state } = seeded();
    const more = [
      nodeUpdated({ id: 1, changes: { 'meta.status': { from: 'todo', to: 'done' } } }),
      edgeUpdated({ id: 1, changes: { purpose: { from: 'required for', to: 'supports' }, type: { from: 'dependency', to: 'related' } } }),
      nodeRemoved({ id: 2 }),
      edgeRemoved({ id: 1, cascade_from: 2 }),
    ];
    const full = foldEvents(state, more);
    // Over-replay: hand it the ENTIRE log again, including the events already
    // reflected in `full`. Nothing may move.
    expect(canonicalJson(foldEvents(full, [...events, ...more]))).toBe(canonicalJson(full));
  });
});

// ── the fold never reads `from` ──────────────────────────────────────────────

describe('E18.1 fold — `from` is never read', () => {
  it('produces byte-identical output with deliberately wrong `from` values', () => {
    const build = (wrong) => {
      nextSeq = 0;
      const f = (real, lie) => (wrong ? lie : real);
      return [
        nodeCreated({ id: 1, meta: { title: 'A', status: 'todo' }, content: 'a' }),
        nodeUpdated({ id: 1, changes: { 'meta.status': { from: f('todo', 'NONSENSE'), to: 'review' } } }),
        nodeUpdated({ id: 1, changes: { 'meta.confidence': { from: f(null, 0.123456), to: 0.9 } } }),
        nodeUpdated({
          id: 1,
          changes: {
            content: {
              ...contentChange('a', 'a2'),
              from_sha: f(sha('a'), 'deadbeef'.repeat(8)),
            },
          },
        }),
        nodeCreated({ id: 2, meta: { title: 'B', status: 'todo' }, content: 'b' }),
        edgeAdded({ id: 1, source: 1, target: 2 }),
        edgeUpdated({
          id: 1,
          changes: {
            purpose: { from: f('related to', 'utter fiction'), to: 'supports' },
            source_id: { from: f(1, 9999), to: 2 },
            target_id: { from: f(2, -1), to: 1 },
          },
        }),
      ];
    };
    const honest = foldEvents(emptyState(), build(false));
    const lying = foldEvents(emptyState(), build(true));
    expect(canonicalJson(lying)).toBe(canonicalJson(honest));
    expect(stateSha(lying)).toBe(stateSha(honest));
  });

  it('keeps a "from": null entry intact in the payload while ignoring it', () => {
    // The payload is never jsonb_strip_nulls'd precisely so E18.4 can read
    // "this field was previously unset". The fold must not need it.
    const e = nodeUpdated({ id: 1, changes: { 'meta.confidence': { from: null, to: 0.9 } } });
    expect(e.payload.changes['meta.confidence']).toHaveProperty('from', null);
    const { state } = seeded();
    expect(applyEvent(state, e).nodes[0].meta.confidence).toBe(0.9);
  });
});

// ── ordering ─────────────────────────────────────────────────────────────────

describe('E18.1 fold — orderEvents', () => {
  // PLAN.md §3 STEP 5's worked divergence case, verbatim.
  // e1: learned 10:00, happened 10:00, todo -> review
  // e2: learned 11:00, happened 10:30, review -> done
  // e3: learned 12:00, happened 09:00 (BACKDATED), done -> todo + confidence
  const worked = () => {
    nextSeq = 0;
    const create = nodeCreated({
      id: 7,
      meta: { title: 'N', status: 'todo' },
      content: 'n',
      seq: 1,
      happened_at: '2026-01-01T08:00:00.000Z',
      learned_at: '2026-01-01T08:00:00.000Z',
    });
    const e1 = nodeUpdated({
      id: 7, seq: 2, version: 2,
      happened_at: '2026-01-01T10:00:00.000Z', learned_at: '2026-01-01T10:00:00.000Z',
      changes: { 'meta.status': { from: 'todo', to: 'review' } },
    });
    const e2 = nodeUpdated({
      id: 7, seq: 3, version: 3,
      happened_at: '2026-01-01T10:30:00.000Z', learned_at: '2026-01-01T11:00:00.000Z',
      changes: { 'meta.status': { from: 'review', to: 'done' } },
    });
    const e3 = nodeUpdated({
      id: 7, seq: 4, version: 4,
      happened_at: '2026-01-01T09:00:00.000Z', learned_at: '2026-01-01T12:00:00.000Z',
      changes: {
        'meta.status': { from: 'done', to: 'todo' },
        'meta.confidence': { from: null, to: 0.9 },
      },
    });
    return { create, e1, e2, e3, all: [create, e1, e2, e3] };
  };

  it('learned order is seq order, and a backdated event does NOT move', () => {
    const { all } = worked();
    expect(orderEvents(all, 'learned').map((e) => Number(e.seq))).toEqual([1, 2, 3, 4]);
  });

  it('happened order places the backdated event before events learned earlier', () => {
    const { all } = worked();
    // seq 4 was learned LAST but happened at 09:00, so it sorts second.
    expect(orderEvents(all, 'happened').map((e) => Number(e.seq))).toEqual([1, 4, 2, 3]);
  });

  it('defaults to the learned axis and never mutates the caller array', () => {
    const { all } = worked();
    const shuffled = [all[3], all[1], all[0], all[2]];
    const snapshot = shuffled.map((e) => Number(e.seq));
    expect(orderEvents(shuffled).map((e) => Number(e.seq))).toEqual([1, 2, 3, 4]);
    expect(shuffled.map((e) => Number(e.seq))).toEqual(snapshot);
  });

  it('breaks a happened_at tie by seq, keeping a cascade contiguous', () => {
    nextSeq = 0;
    const at = '2026-03-01T00:00:00.000Z';
    const removeNode = nodeRemoved({ id: 1, seq: 10, happened_at: at });
    const removeEdgeA = edgeRemoved({ id: 5, seq: 11, cascade_from: 1, cause_id: 10, happened_at: at });
    const removeEdgeB = edgeRemoved({ id: 6, seq: 12, cascade_from: 1, cause_id: 10, happened_at: at });
    const ordered = orderEvents([removeEdgeB, removeNode, removeEdgeA], 'happened');
    expect(ordered.map((e) => Number(e.seq))).toEqual([10, 11, 12]);
  });

  it('rejects an unknown axis loudly', () => {
    expect(() => orderEvents([], 'wibble')).toThrow(/unknown axis/);
  });

  it('the two axes genuinely disagree — and the fold must not reconcile them', () => {
    const { all } = worked();
    const learned = foldEvents(emptyState(), orderEvents(all, 'learned'));
    const happened = foldEvents(emptyState(), orderEvents(all, 'happened'));
    // Learned: the backdated correction was learned LAST, so it wins.
    expect(learned.nodes[0].meta.status).toBe('todo');
    // Happened: it happened FIRST, so e1 then e2 overwrite it — even though e2
    // was learned an hour earlier than e3. Its `from: "done"` is a lie on this
    // axis (the prior value here is "todo"), which is exactly why `from` is
    // never read.
    expect(happened.nodes[0].meta.status).toBe('done');
    // The confidence e3 set survives on both: nothing later touches it.
    expect(learned.nodes[0].meta.confidence).toBe(0.9);
    expect(happened.nodes[0].meta.confidence).toBe(0.9);
  });
});

// ── applying, in detail ──────────────────────────────────────────────────────

describe('E18.1 fold — applyEvent semantics', () => {
  it('materialises a node from the create post-image, minus the body', () => {
    const { state } = seeded();
    expect(state.nodes.map((n) => n.id)).toEqual([1, 2]);
    expect(state.nodes[0]).toEqual({
      id: 1,
      meta: { title: 'A', status: 'todo', type: 'claim' },
      version: 1,
      external_id: null,
      content_sha: sha('---\ntitle: A\n---\nbody A'),
      created_at: '2026-01-01T09:00:00.000Z',
    });
  });

  it('tracks a body rewrite by sha alone', () => {
    const { state } = seeded();
    const next = applyEvent(state, nodeUpdated({ id: 1, changes: { content: contentChange('body A', 'rewritten') } }));
    expect(next.nodes[0].content_sha).toBe(sha('rewritten'));
    expect(next.nodes[0].meta).toEqual({ title: 'A', status: 'todo', type: 'claim' });
  });

  it('keeps a truncated body change honest — the sha still advances', () => {
    const { state } = seeded();
    const big = { from_sha: sha('body A'), to: null, to_sha: sha('X'.repeat(200000)), to_len: 200000, truncated: true };
    const next = applyEvent(state, nodeUpdated({ id: 1, changes: { content: big } }));
    expect(next.nodes[0].content_sha).toBe(sha('X'.repeat(200000)));
  });

  it('removes a meta key when `to` is null and no `to_present` flag says otherwise', () => {
    // The LEGACY shape: gt_diff used to emit `{from, to}` and nothing else, and
    // `->` yields JSON null both for "key removed" and for "key set to JSON
    // null", so the fold had to guess and guessed removal. gt_diff now emits a
    // `to_present` flag on exactly those ambiguous entries
    // (tests/e18-meta-fidelity.test.js), but an event ALREADY IN A LOG carries
    // no flag and must keep folding the old way — otherwise every stored
    // snapshot stops re-deriving. That compatibility is what this pins.
    const { state } = seeded();
    const withConf = applyEvent(state, nodeUpdated({ id: 1, changes: { 'meta.confidence': { from: null, to: 0.9 } } }));
    expect(withConf.nodes[0].meta.confidence).toBe(0.9);
    const cleared = applyEvent(withConf, nodeUpdated({ id: 1, changes: { 'meta.confidence': { from: 0.9, to: null } } }));
    expect(cleared.nodes[0].meta).not.toHaveProperty('confidence');
  });

  it('applies an edge rewire and retype from the `to` side', () => {
    const { state } = seeded();
    const next = applyEvent(state, edgeUpdated({
      id: 1, version: 5,
      changes: {
        source_id: { from: 1, to: 2 },
        target_id: { from: 2, to: 1 },
        purpose: { from: 'required for', to: 'contradicts' },
        type: { from: 'dependency', to: 'related' },
      },
    }));
    expect(next.edges[0]).toMatchObject({ id: 1, source: 2, target: 1, purpose: 'contradicts', type: 'related', version: 5 });
  });

  it('ignores top-level columns that are not part of the /graph payload', () => {
    const { state } = seeded();
    const next = applyEvent(state, nodeUpdated({ id: 1, changes: { run_id: { from: null, to: 'r-9' } }, version: 2 }));
    expect(next.nodes[0]).not.toHaveProperty('run_id');
    // Nothing but the version moved: carrying run_id would bloat every
    // snapshot with a column /graph never returns.
    expect(next.nodes[0]).toEqual({ ...state.nodes[0], version: 2 });
  });

  it('tracks external_id, which /graph does return', () => {
    const { state } = seeded();
    const next = applyEvent(state, nodeUpdated({ id: 1, changes: { external_id: { from: null, to: 'todo:alpha' } } }));
    expect(next.nodes[0].external_id).toBe('todo:alpha');
  });

  it('folds a cascade: node.removed plus the edge.removed rows it caused', () => {
    const { state } = seeded();
    const after = foldEvents(state, [
      nodeRemoved({ id: 1 }),
      edgeRemoved({ id: 1, cascade_from: 1, cause_id: 4 }),
    ]);
    expect(after.nodes.map((n) => n.id)).toEqual([2]);
    expect(after.edges).toEqual([]);
  });

  it('treats a graph-level event as having no row state', () => {
    const { state } = seeded();
    const rotated = applyEvent(state, evt({
      kind: 'graph.id_rotated', subject_kind: 'graph', subject_id: null,
      payload: { v: 1, kinds: ['graph.id_rotated'], changes: { graph_id: { from: 'g1', to: 'g2' } } },
    }));
    expect(canonicalJson(rotated)).toBe(canonicalJson(state));
  });
});

// ── anomalies ────────────────────────────────────────────────────────────────

describe('E18.1 fold — anomalies', () => {
  it('materialises a patch that sorted before its create, and says so', () => {
    const anomalies = [];
    const state = applyEvent(
      emptyState(),
      nodeUpdated({ id: 42, seq: 99, changes: { 'meta.status': { from: 'todo', to: 'done' } } }),
      { anomalies },
    );
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]).toMatchObject({ id: 42, meta: { status: 'done' } });
    expect(anomalies).toEqual([
      { seq: 99, kind: 'status.changed', subject_kind: 'node', subject_id: 42, reason: 'subject_absent_materialised_from_post_image' },
    ]);
  });

  it('says nothing about removing a subject that is already gone — over-replay must be silent', () => {
    const anomalies = [];
    const state = foldEvents(emptyState(), [nodeRemoved({ id: 1 }), edgeRemoved({ id: 1 })], { anomalies });
    expect(state.nodes).toEqual([]);
    expect(anomalies).toEqual([]);
  });

  it('flags an event it cannot route instead of applying it blindly', () => {
    const anomalies = [];
    const state = applyEvent(emptyState(), evt({ seq: 77, kind: 'not.a.kind', subject_kind: 'node', subject_id: 3, payload: {} }), { anomalies });
    expect(canonicalJson(state)).toBe(canonicalJson(emptyState()));
    expect(anomalies).toEqual([
      { seq: 77, kind: 'not.a.kind', subject_kind: 'node', subject_id: 3, reason: 'unrecognised_event' },
    ]);
  });

  it('collects nothing when the caller does not ask for anomalies', () => {
    expect(() => applyEvent(emptyState(), nodeUpdated({ id: 42, changes: { 'meta.status': { from: null, to: 'done' } } }))).not.toThrow();
  });
});

// ── genesis on the happened axis ─────────────────────────────────────────────

describe('E18.1 fold — filterGenesisByHappened', () => {
  const genesis = () => ({
    v: 1,
    nodes: [
      { id: 1, meta: { title: 'old', status: 'todo' }, version: 1, external_id: null, content_sha: sha('o'), created_at: '2025-01-01T00:00:00.000Z' },
      { id: 2, meta: { title: 'new', status: 'todo' }, version: 1, external_id: null, content_sha: sha('n'), created_at: '2026-06-01T00:00:00.000Z' },
    ],
    edges: [
      { id: 1, source: 1, target: 2, purpose: 'supports', type: 'related', meta: {}, version: 1, created_at: '2026-06-02T00:00:00.000Z' },
    ],
  });

  it('drops rows that had not been created yet', () => {
    const filtered = filterGenesisByHappened(genesis(), '2025-06-01T00:00:00.000Z');
    expect(filtered.nodes.map((n) => n.id)).toEqual([1]);
    expect(filtered.edges).toEqual([]);
  });

  it('drops an edge whose endpoint was filtered out even if the edge predates the cutoff', () => {
    const g = genesis();
    g.edges[0].created_at = '2025-01-02T00:00:00.000Z';
    expect(filterGenesisByHappened(g, '2025-06-01T00:00:00.000Z').edges).toEqual([]);
  });

  it('keeps everything at a cutoff after the newest row, and never mutates the input', () => {
    const g = genesis();
    const before = canonicalJson(g);
    const filtered = filterGenesisByHappened(g, '2027-01-01T00:00:00.000Z');
    expect(filtered.nodes.map((n) => n.id)).toEqual([1, 2]);
    expect(filtered.edges.map((e) => e.id)).toEqual([1]);
    expect(canonicalJson(g)).toBe(before);
  });

  it('keeps a row with no readable created_at — absence of proof is not deletion', () => {
    const g = genesis();
    g.nodes[1].created_at = null;
    expect(filterGenesisByHappened(g, '2025-06-01T00:00:00.000Z').nodes.map((n) => n.id)).toEqual([1, 2]);
  });
});

// ── projection ───────────────────────────────────────────────────────────────

describe('E18.1 fold — toGraphPayload', () => {
  it('reproduces the GET /graph column list exactly', () => {
    const { state } = seeded();
    const { nodes, links } = toGraphPayload(state);
    expect(Object.keys(nodes[0]).sort()).toEqual(
      ['description', 'external_id', 'id', 'meta', 'status', 'title', 'version'],
    );
    expect(Object.keys(links[0]).sort()).toEqual(
      ['id', 'meta', 'purpose', 'source', 'target', 'type', 'version'],
    );
    expect(nodes[0]).toEqual({
      id: 1, title: 'A', description: null, status: 'todo',
      meta: { title: 'A', status: 'todo', type: 'claim' }, version: 1, external_id: null,
    });
    expect(links[0]).toEqual({
      id: 1, source: 1, target: 2, purpose: 'required for', type: 'dependency', meta: {}, version: 1,
    });
  });

  it('reproduces `meta->>` coercion of non-string JSON exactly', () => {
    // Verified against PostgreSQL 18: `'{"a":5}'::jsonb->>'a'` is the TEXT '5',
    // a boolean renders 'true'/'false', a JSON null and a missing key are both
    // SQL NULL, and a composite renders in jsonb's own text form — keys ordered
    // by (length, bytes), with `", "` and `": "` separators.
    const st = {
      v: 1,
      nodes: [{ id: 1, meta: { title: 5, description: true, status: null }, version: 1, external_id: null, content_sha: null, created_at: null }],
      edges: [],
    };
    expect(toGraphPayload(st).nodes[0]).toMatchObject({ title: '5', description: 'true', status: null });

    const st2 = { v: 1, nodes: [{ id: 1, meta: { title: { x: 1, yy: 2 }, description: [1, 'q', null] }, version: 1 }], edges: [] };
    const n2 = toGraphPayload(st2).nodes[0];
    expect(n2.title).toBe('{"x": 1, "yy": 2}');
    expect(n2.description).toBe('[1, "q", null]');
    expect(n2.status).toBe(null); // absent key -> SQL NULL, not undefined
  });

  it('does not emit a link whose endpoint is missing', () => {
    // The live tables cannot hold a dangling edge (FK), so neither may a
    // reconstruction. This only arises from a happened-axis re-ordering, which
    // the caller already sees in `anomalies`.
    const { state } = seeded();
    const orphaned = applyEvent(state, nodeRemoved({ id: 2 }));
    expect(orphaned.edges).toHaveLength(1);
    expect(toGraphPayload(orphaned).links).toEqual([]);
  });

  it('orders nodes and links by id, like graphView.js', () => {
    nextSeq = 0;
    const state = foldEvents(emptyState(), [
      nodeCreated({ id: 3, meta: { title: 'C', status: 'todo' }, content: 'c' }),
      nodeCreated({ id: 1, meta: { title: 'A', status: 'todo' }, content: 'a' }),
      nodeCreated({ id: 2, meta: { title: 'B', status: 'todo' }, content: 'b' }),
      edgeAdded({ id: 9, source: 3, target: 1 }),
      edgeAdded({ id: 4, source: 1, target: 2 }),
    ]);
    expect(toGraphPayload(state).nodes.map((n) => n.id)).toEqual([1, 2, 3]);
    expect(toGraphPayload(state).links.map((e) => e.id)).toEqual([4, 9]);
  });

  it('projects the empty substrate to an empty graph', () => {
    expect(toGraphPayload(emptyState())).toEqual({ nodes: [], links: [] });
  });
});

// ── E18.4 — the annotation guard ─────────────────────────────────────────────
//
// `node.superseded` is emitted BESIDE the edge event that opened a
// supersession. It carries no row state: the state of "is A superseded?" is the
// EDGE SET this fold reconstructs. Left ungated it falls through applyToIndex's
// UPDATE branch, which is harmless when the subject is present and CORRUPTING
// when it is absent — it materialises a ghost node from the post-image. The
// absent case is reachable (happened-axis re-sorting; a node deleted after
// being superseded), so the guard is a correctness requirement, not tidiness.
describe('E18.4 fold — node.superseded is an annotation, not state', () => {
  const annotation = (subjectId) =>
    evt({
      kind: 'node.superseded',
      subject_kind: 'node',
      subject_id: subjectId,
      cause_id: 4,
      payload: {
        v: 1, op: 'ANNOTATE', table: 'tasks',
        kinds: ['node.superseded'], node_kind: null,
        superseded_by: 99, edge_id: 1, via: 'edge.added',
      },
    });

  it('leaves a state holding the subject byte-identical', () => {
    const { state } = seeded();
    const before = canonicalJson(state);
    const anomalies = [];
    const after = applyEvent(state, annotation(1), { anomalies });
    expect(canonicalJson(after)).toBe(before);
    expect(stateSha(after)).toBe(stateSha(state));
    expect(anomalies).toEqual([]);
  });

  it('materialises NO ghost node and records NO anomaly when the subject is absent', () => {
    // Without the ANNOTATION_KINDS guard this produces
    // {id: 4242, meta: {}, version: null} plus a
    // subject_absent_materialised_from_post_image anomaly. Measured against
    // this exact file before the guard existed.
    const { state } = seeded();
    const anomalies = [];
    const after = applyEvent(state, annotation(4242), { anomalies });
    expect(after.nodes.map((n) => n.id)).not.toContain(4242);
    expect(canonicalJson(after)).toBe(canonicalJson(state));
    expect(anomalies).toEqual([]);
  });

  it('does not move stateSha when folded into a whole log', () => {
    // FOLD_VERSION stays 1 precisely because of this: the kind folds to a
    // no-op, so no stored snapshot's meaning changes and nothing is rebuilt.
    nextSeq = 0;
    const { events, state } = seeded();
    const withAnnotations = foldEvents(emptyState(), [...events, annotation(1), annotation(2)]);
    expect(stateSha(withAnnotations)).toBe(stateSha(state));
    expect(FOLD_VERSION).toBe(1);
  });
});
