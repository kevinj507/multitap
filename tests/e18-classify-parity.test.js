// E18.1 STEP 4 — classifier parity: the JS mirror must equal the SQL original.
//
// The deciding architect's plan names this test as the standing mitigation for
// the one thing given up by choosing trigger-first capture (PLAN.md §0, "what I
// am giving up", item 3):
//
//     "The trigger logic is untyped SQL with no editor support and no coverage
//      tooling; a plpgsql bug ships as a silent misclassification rather than a
//      crash. Paid down by the JS/SQL classifier parity test (Step 4)."
//
// There are two implementations of one definition:
//
//   * `gt_classify_node` / `gt_classify_edge` in db/schema.sql — the AUTHORITY.
//     They run inside the row triggers and stamp `payload.kinds` at write time,
//     so whatever they say is what the log permanently records.
//   * `classifyNode` / `classifyEdge` in src/events/kinds.js — the MIRROR. A
//     reader (the fold, the asOf reader, E18.2's decay frontier) re-derives
//     kinds from a `changes` object without a database round trip.
//
// If the two ever disagree, a reader silently draws a different conclusion from
// the same bytes the writer recorded. Nothing above the database would notice:
// no exception, no constraint violation, just a quietly wrong answer. So this
// file holds them side by side over ~45 hand-built `changes` objects — the
// realistic ones and the awkward ones — and fails loudly, naming the exact
// object and both answers, the moment either side drifts.
//
// COMPARISON IS EXACT, INCLUDING ORDER. The plan makes the kinds order
// load-bearing: `gt_headline(ks)` returns `ks[1]` (1-based) — i.e. the FIRST
// derived kind — whenever `gt.intent` does not name a kind the diff already
// produced. So an order-insensitive comparison would let a reordering ship that
// silently changes every event's headline `kind` column. Headline parity is
// asserted alongside the array for the same reason, in both the default and the
// intent-promotion direction.
//
// No routes, no triggers, no fixtures: these are pure function calls on both
// sides. Capture behaviour through the real routes is STEP 2's subject
// (tests/e18-capture.test.js); this file pins only the classification rule.
import { describe, it, expect, beforeAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import {
  classifyNode,
  classifyEdge,
  headline,
  NODE_SEMANTIC_KEYS,
  EDGE_SEMANTIC_KEYS,
} from '../src/events/kinds.js';

// src/events/kinds.js is a PURE module (it imports nothing, by design), so a
// static import here is safe. Anything that reaches src/db.js would not be:
// db.js reads DATABASE_URL once at first import.
let pool;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_URL;
  pool = getTestPool();
});

// ── the fixture vocabulary ──────────────────────────────────────────────────
// Shapes the triggers actually produce, so the cases below read like real
// `payload.changes` objects rather than abstract jsonb.

// gt_diff emits `{from, to}` per changed key; meta keys carry a `meta.` prefix.
const d = (from, to) => ({ from, to });

// gt_content_change's shape for a body edit (tests/e18-capture.test.js pins it).
const body = (fromSha, to) => ({
  from_sha: fromSha,
  to,
  to_sha: 'b'.repeat(64),
  to_len: to.length,
  truncated: false,
});

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-02-01T00:00:00.000Z';

// ── NODE cases ──────────────────────────────────────────────────────────────
// Each is `[label, changes]`. The expected answer is deliberately NOT written
// down: the point of the test is that the two implementations agree, not that
// either matches a third transcription that could itself be wrong. The
// coverage guard below makes sure the set still exercises every kind.
const NODE_CASES = [
  // -- the realistic middle of the distribution -----------------------------
  ['empty changes (a write that changed nothing observable)', {}],
  ['a pure body edit', { content: body('a'.repeat(64), '# rewritten') }],
  ['status todo -> review', { 'meta.status': d('todo', 'review') }],
  ['status review -> done', { 'meta.status': d('review', 'done') }],
  ['status set from null (first transition)', { 'meta.status': d(null, 'todo') }],
  ['status cleared to null', { 'meta.status': d('done', null) }],
  ['confidence set from null', { 'meta.confidence': d(null, 0.9) }],
  ['confidence raised', { 'meta.confidence': d(0.4, 0.9) }],
  ['confidence cleared to null', { 'meta.confidence': d(0.9, null) }],
  ['significance set from null', { 'meta.significance': d(null, 3) }],
  ['confidence AND significance together', {
    'meta.confidence': d(null, 0.9),
    'meta.significance': d(1, 3),
  }],
  ['verified_at appearing', { 'meta.verified_at': d(null, T1) }],
  ['verified_at refreshed', { 'meta.verified_at': d(T1, T2) }],
  ['verified_at cleared (un-verification is NOT claim.verified)', {
    'meta.verified_at': d(T1, null),
  }],
  ['decided_at appearing', { 'meta.decided_at': d(null, T1) }],
  ['decided_at cleared (a decision reopened)', { 'meta.decided_at': d(T1, null) }],
  ['decided_at moved', { 'meta.decided_at': d(T1, T2) }],

  // -- E18.2: refuted_at, the negative half of the verification vocabulary ---
  ['refuted_at appearing (a check that FAILED)', { 'meta.refuted_at': d(null, T1) }],
  ['refuted_at cleared (clearing a refutation is NOT a refutation)', {
    'meta.refuted_at': d(T1, null),
  }],
  ['refuted_at moved (a second failed check)', { 'meta.refuted_at': d(T1, T2) }],
  // What POST /:id/verify {outcome:"failed"} actually writes: refuted_at set,
  // verified_at removed. gt_diff gives a removed key `to_present: false`.
  ['the verify route\u2019s FAIL shape', {
    'meta.refuted_at': d(null, T2),
    'meta.verified_at': { from: T1, to: null, to_present: false },
  }],
  // ... and its HOLD shape: verified_at set, refuted_at removed.
  ['the verify route\u2019s HOLD shape', {
    'meta.refuted_at': { from: T1, to: null, to_present: false },
    'meta.verified_at': d(null, T2),
  }],
  ['a fail that also drops confidence', {
    'meta.refuted_at': d(null, T1),
    'meta.confidence': d(0.9, 0.2),
  }],
  ['a fail that also moves status', {
    'meta.refuted_at': d(null, T1),
    'meta.status': d('done', 'review'),
  }],
  ['a fail alongside a body rewrite', {
    'meta.refuted_at': d(null, T1),
    content: body('a'.repeat(64), '# why it failed'),
  }],
  // BOTH set in one change: the doubt must headline, so claim.refuted comes
  // first in the array and gt_headline() takes ks[1] (1-based).
  ['refuted_at AND verified_at both SET', {
    'meta.refuted_at': d(null, T1),
    'meta.verified_at': d(null, T2),
  }],
  ['refuted_at declared AFTER verified_at (insertion order must not matter)', {
    'meta.verified_at': d(null, T2),
    'meta.refuted_at': d(null, T1),
  }],
  ['refuted_at with to:"" — SET, not truthy', { 'meta.refuted_at': d(null, '') }],
  ['refuted_at whose entry is JSON null', { 'meta.refuted_at': null }],
  ['all six semantic keys at once', {
    'meta.decided_at': d(null, T1),
    'meta.refuted_at': d(null, T1),
    'meta.verified_at': d(null, T2),
    'meta.status': d('todo', 'done'),
    'meta.confidence': d(null, 0.9),
    'meta.significance': d(null, 2),
  }],

  // -- simultaneous changes: order of the kinds array is the assertion -------
  ['status AND confidence in one patch', {
    'meta.status': d('todo', 'done'),
    'meta.confidence': d(null, 0.8),
  }],
  ['status AND confidence AND a body edit', {
    'meta.status': d('todo', 'done'),
    'meta.confidence': d(null, 0.8),
    content: body('a'.repeat(64), '# and the body moved too'),
  }],
  ['decided_at AND verified_at together', {
    'meta.decided_at': d(null, T1),
    'meta.verified_at': d(null, T2),
  }],
  ['decided_at AND status', {
    'meta.decided_at': d(null, T1),
    'meta.status': d('review', 'done'),
  }],
  ['all five semantic keys at once', {
    'meta.decided_at': d(null, T1),
    'meta.verified_at': d(null, T2),
    'meta.status': d('todo', 'done'),
    'meta.confidence': d(null, 0.9),
    'meta.significance': d(null, 2),
  }],
  ['all five semantic keys, decided_at and verified_at CLEARED', {
    'meta.decided_at': d(T1, null),
    'meta.verified_at': d(T2, null),
    'meta.status': d('done', 'todo'),
    'meta.confidence': d(0.9, null),
    'meta.significance': d(2, null),
  }],
  ['semantic keys declared in reverse insertion order', {
    'meta.significance': d(null, 2),
    'meta.confidence': d(null, 0.9),
    'meta.status': d('todo', 'done'),
    'meta.verified_at': d(null, T2),
    'meta.decided_at': d(null, T1),
  }],

  // -- the awkward edge of the distribution ---------------------------------
  ['an unknown column (external_id)', { external_id: d(null, 'ext-1') }],
  ['an unknown meta key (meta.color)', { 'meta.color': d(null, '#f00') }],
  ['status plus an unknown meta key', {
    'meta.status': d('todo', 'done'),
    'meta.x': d(10, 20),
  }],
  ['verified_at with to:"" — SET, not truthy', { 'meta.verified_at': d(null, '') }],
  ['verified_at with to:false — SET, not truthy', { 'meta.verified_at': d(null, false) }],
  ['confidence with to:0 — SET, not truthy', { 'meta.confidence': d(0.5, 0) }],
  ['decided_at whose entry is JSON null (no {from,to} at all)', {
    'meta.decided_at': null,
  }],
  ['decided_at whose entry is a bare scalar', { 'meta.decided_at': 5 }],
  ['verified_at whose entry is an array', { 'meta.verified_at': ['a', 'b'] }],
  ['verified_at whose to is an object', { 'meta.verified_at': { to: { a: 1 } } }],
  ['status whose entry is an empty object', { 'meta.status': {} }],
  ['confidence with a from and no to key', { 'meta.confidence': { from: 0.5 } }],
  ['unprefixed "status" — NOT the semantic key', { status: d('todo', 'done') }],
  ['a key that only LOOKS semantic', { 'meta.decided_at.extra': d(null, 1) }],
  ['meta.verified_at nested one level too deep', {
    meta: { verified_at: d(null, T1) },
  }],
  ['an edge-shaped diff handed to the node classifier', {
    source_id: d(1, 2),
    purpose: d('related to', 'supports'),
  }],
];

// ── EDGE cases ──────────────────────────────────────────────────────────────
const EDGE_CASES = [
  ['empty changes', {}],
  ['purpose retype', { purpose: d('related to', 'supports') }],
  ['type change alone', { type: d('related', 'dependency') }],
  ['purpose AND type (what purposeToType() produces together)', {
    purpose: d('related to', 'required for'),
    type: d('related', 'dependency'),
  }],
  ['rewire the target', { target_id: d(2, 3) }],
  ['rewire the source', { source_id: d(1, 4) }],
  ['rewire both endpoints', { source_id: d(1, 4), target_id: d(2, 3) }],
  ['rewire AND retype in one patch', {
    target_id: d(2, 3),
    purpose: d('related to', 'contradicts'),
  }],
  ['a meta-only patch (colour)', { 'meta.color': d(null, '#0f0') }],
  ['a meta-only patch (curve object)', {
    'meta.curve': d(0, { type: 'bezier', offset: 40 }),
  }],
  ['rewire plus a meta tweak', {
    source_id: d(1, 4),
    'meta.curve': d(null, { type: 'bezier' }),
  }],
  ['retype plus a meta tweak', {
    purpose: d('supports', 'contradicts'),
    'meta.color': d('#f00', '#0f0'),
  }],
  ['an unknown column (weight)', { weight: d(null, 2) }],
  ['all four semantic keys plus meta', {
    source_id: d(1, 4),
    target_id: d(2, 3),
    purpose: d('related to', 'required for'),
    type: d('related', 'dependency'),
    'meta.color': d(null, '#00f'),
  }],
  ['semantic keys declared in reverse insertion order', {
    type: d('related', 'dependency'),
    purpose: d('related to', 'required for'),
    target_id: d(2, 3),
    source_id: d(1, 4),
  }],
  ['a node-shaped diff handed to the edge classifier', {
    'meta.status': d('todo', 'done'),
    content: body('a'.repeat(64), '# body'),
  }],
  ['target_id whose entry is JSON null', { target_id: null }],
  ['purpose whose entry is a bare scalar', { purpose: 'supports' }],
];

// ── the comparison ──────────────────────────────────────────────────────────

// Both classifiers return text[]; `node-postgres` hands that back as a JS array
// of strings, so the two answers are directly comparable with no coercion.
async function sqlClassify(fn, changes) {
  const { rows } = await pool.query(
    `SELECT ${fn}($1::jsonb) AS ks, gt_headline(${fn}($1::jsonb)) AS headline`,
    [JSON.stringify(changes)],
  );
  return { kinds: rows[0].ks, headline: rows[0].headline };
}

// The failure message is the product here. It names the case, prints the exact
// `changes` object that split the two implementations, and shows both answers
// with the file each came from — so whoever broke it can see in one line which
// side to fix without re-deriving the case.
function assertParity(label, subject, changes, js, sql) {
  const same =
    JSON.stringify(js.kinds) === JSON.stringify(sql.kinds) &&
    js.headline === sql.headline;
  if (!same) {
    throw new Error(
      `E18 CLASSIFIER DRIFT — ${subject}: ${label}\n` +
        `  changes:  ${JSON.stringify(changes)}\n` +
        `  JS   src/events/kinds.js  kinds=${JSON.stringify(js.kinds)} headline=${JSON.stringify(js.headline)}\n` +
        `  SQL  db/schema.sql        kinds=${JSON.stringify(sql.kinds)} headline=${JSON.stringify(sql.headline)}\n` +
        '  The SQL side is the authority: it stamps payload.kinds at write time and\n' +
        '  the log keeps that forever. Fix whichever side is wrong in BOTH files —\n' +
        '  never relax this test to match.',
    );
  }
  // Belt and braces: the throw above carries the diagnosis, these carry the
  // structural assertion (and keep the case counted if the message changes).
  expect(js.kinds).toEqual(sql.kinds);
  expect(js.headline).toBe(sql.headline);
}

describe('E18.1 classifier parity — node', () => {
  it.each(NODE_CASES)('gt_classify_node ≡ classifyNode: %s', async (label, changes) => {
    const sql = await sqlClassify('gt_classify_node', changes);
    const kinds = classifyNode(changes);
    assertParity(label, 'node', changes, { kinds, headline: headline(kinds) }, sql);
  });
});

describe('E18.1 classifier parity — edge', () => {
  it.each(EDGE_CASES)('gt_classify_edge ≡ classifyEdge: %s', async (label, changes) => {
    const sql = await sqlClassify('gt_classify_edge', changes);
    const kinds = classifyEdge(changes);
    assertParity(label, 'edge', changes, { kinds, headline: headline(kinds) }, sql);
  });
});

describe('E18.1 classifier parity — headline promotion', () => {
  // gt_headline reads `gt.intent` through gt_ctx, so parity for the promotion
  // direction needs a transaction with the GUC set is_local (a session-level
  // set_config would leak the intent onto the pooled connection — the exact
  // hazard src/events/context.js exists to avoid).
  async function sqlHeadline(kinds, intent) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('gt.intent', $1, true)", [intent]);
      const { rows } = await client.query('SELECT gt_headline($1::text[]) AS h', [kinds]);
      return rows[0].h;
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  const PROMOTION_CASES = [
    // intent names a kind the diff DID derive -> promoted to headline.
    ['field.set promoted over status.changed', {
      'meta.status': d('todo', 'done'),
      'meta.confidence': d(null, 0.9),
    }, 'field.set'],
    ['claim.verified promoted over decision.made', {
      'meta.decided_at': d(null, T1),
      'meta.verified_at': d(null, T2),
    }, 'claim.verified'],
    ['node.patched promoted over status.changed', {
      'meta.status': d('todo', 'done'),
      'meta.x': d(1, 2),
    }, 'node.patched'],
    // intent names a kind the diff did NOT derive -> silently ignored.
    ['an underived intent is ignored', { 'meta.status': d('todo', 'done') }, 'decision.made'],
    ['an intent that is not a kind at all is ignored', { content: body('a'.repeat(64), 'x') }, 'nonsense'],
    ['an empty-string intent is ignored (gt_ctx NULLIFs it)', {
      'meta.confidence': d(null, 0.5),
    }, ''],
  ];

  it.each(PROMOTION_CASES)('gt_headline ≡ headline: %s', async (label, changes, intent) => {
    const kinds = classifyNode(changes);
    const js = headline(kinds, intent === '' ? null : intent);
    const sql = await sqlHeadline(kinds, intent);
    assertParity(
      label,
      `node headline (intent=${JSON.stringify(intent)})`,
      changes,
      { kinds, headline: js },
      { kinds, headline: sql },
    );
  });
});

describe('E18.1 classifier parity — the guard on the guard', () => {
  // A parity test that stopped covering a branch would keep passing while the
  // branch drifted. These three assertions are what keep the file honest.

  it('covers at least 30 hand-built changes objects', () => {
    expect(NODE_CASES.length + EDGE_CASES.length).toBeGreaterThanOrEqual(30);
  });

  it('exercises every kind either classifier can emit', async () => {
    const seen = new Set();
    for (const [, changes] of NODE_CASES) for (const k of classifyNode(changes)) seen.add(k);
    for (const [, changes] of EDGE_CASES) for (const k of classifyEdge(changes)) seen.add(k);
    // The complete output vocabulary of the two classifiers. The remaining
    // EVENT_KINDS (node.created/node.removed/edge.added/edge.removed/
    // graph.id_rotated/graph.deleted) are stamped as literals by the row
    // loggers and never pass through a classifier, so they are out of scope
    // here by construction.
    expect([...seen].sort()).toEqual(
      [
        'claim.verified',
        'claim.refuted',
        'decision.made',
        'decision.reopened',
        'edge.patched',
        'edge.retyped',
        'edge.rewired',
        'field.set',
        'node.patched',
        'status.changed',
      ].sort(),
    );
  });

  it('pins the semantic key sets the two implementations share', async () => {
    // The key lists are duplicated: once as JS constants, once inline in the
    // `ch - ARRAY[...]` subtraction in db/schema.sql. A key added to one and
    // not the other turns a semantic change into a silent `node.patched`, so
    // read the arrays straight back out of the installed function bodies.
    const { rows } = await pool.query(
      "SELECT prosrc FROM pg_proc WHERE proname IN ('gt_classify_node','gt_classify_edge')",
    );
    const src = rows.map((r) => r.prosrc).join('\n');
    for (const k of [...NODE_SEMANTIC_KEYS, ...EDGE_SEMANTIC_KEYS]) {
      expect(src, `${k} is missing from the installed SQL classifiers`).toContain(`'${k}'`);
    }
  });
});
