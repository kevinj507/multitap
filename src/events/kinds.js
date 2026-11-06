// E18.1 — the event vocabulary and the JS mirror of the SQL classifiers.
//
// PURE MODULE. It imports nothing — no `pg`, no `db.js`, no express — for the
// same reason planRegions.js / signedCycles.js / edgePurpose.js do: the fold
// (E18.1 STEP 3) and the asOf reader have to be unit-testable with no database,
// and the classifier parity test (STEP 4) has to be able to hold this file and
// `gt_classify_node` / `gt_classify_edge` side by side.
//
// The DB is the authority at write time: the row triggers in db/schema.sql call
// the SQL classifiers and stamp `payload.kinds`. These functions exist so that
//   (a) a reader can re-derive kinds from a `changes` object without a round
//       trip, and
//   (b) the parity test fails loudly the moment the two implementations drift.
// Every function below is a line-for-line translation of its SQL counterpart;
// if you change one, change both, and the parity test will tell you if you did.

// The complete `kind` vocabulary, in the same order as the `events_kind_valid`
// CHECK in db/schema.sql. `kind` is TEXT + CHECK and never an enum precisely so
// E18.2/E18.4 can add a value with a one-block edit and no 55P04 boot risk.
export const EVENT_KINDS = Object.freeze([
  'node.created',
  'node.patched',
  'node.removed',
  'status.changed',
  'field.set',
  'claim.verified',
  'claim.refuted',
  'decision.made',
  'decision.reopened',
  // E18.4. An ANNOTATION, not state: the state of "is A superseded at time t?"
  // is the EDGE SET the fold reconstructs, and this event is a dated assertion
  // by an actor that A's story ended. There is deliberately no
  // `node.unsuperseded` — withdrawing the supersedes edge does not un-happen
  // the assertion, it revises it, and the revision is the edge.removed /
  // edge.retyped event. It is emitted by gt_log_supersede with a literal
  // `kinds` array and never enters gt_classify_edge's output, so the classifier
  // parity test is untouched by it.
  'node.superseded',
  // E18.6. The excision RECORD. Subject = the node whose history was blanked;
  // payload = reason, count and seq range of the blanked rows, `node_present`,
  // and — while the node exists — `after` (meta/version/content_sha, never a
  // body) so HEAD still folds to the live row. Emitted by gt_excise_node with
  // a literal `kinds` array, like node.superseded, and never classified. The
  // rows it blanked keep their own kinds and gain `excised: true`.
  'node.excised',
  'edge.added',
  'edge.removed',
  'edge.retyped',
  'edge.rewired',
  'edge.patched',
  'graph.id_rotated',
  'graph.deleted',
]);

// The meta keys `gt_classify_node` reads by name. Anything OUTSIDE this set
// that appears in `changes` also contributes `node.patched` — which is what
// makes a body rewrite, an `external_id` change or a brand-new meta key
// visible instead of silently classified as one of the named transitions.
export const NODE_SEMANTIC_KEYS = Object.freeze([
  'meta.decided_at',
  // E18.2 — the negative half of the verification vocabulary. `refuted_at` is
  // a scalar for the same reason `verified_at` is: a failed check must MOVE
  // something, or failing a never-verified claim would produce ch = '{}' and
  // record nothing at all.
  'meta.refuted_at',
  'meta.verified_at',
  'meta.status',
  'meta.confidence',
  'meta.significance',
]);

// Same idea for edges. `meta` is diffed under a `meta.` prefix, so a curve or
// colour tweak lands outside this set and reads as `edge.patched`.
export const EDGE_SEMANTIC_KEYS = Object.freeze([
  'source_id',
  'target_id',
  'purpose',
  'type',
]);

// `ch ? 'k'` in SQL is key EXISTENCE, not truthiness: a change to JSON null
// still counts. Object.prototype.hasOwnProperty is the exact equivalent.
function present(changes, key) {
  return !!changes && Object.prototype.hasOwnProperty.call(changes, key);
}

// `ch #>> '{k,to}' IS NOT NULL` in SQL. `#>>` yields SQL NULL for a missing
// path AND for a JSON null, and a text rendering for everything else — so
// `!= null` in JS (which catches both `null` and `undefined`) is exact.
// Note this is deliberately NOT a truthiness test: `to: ""` and `to: 0` are
// "set" on both sides.
function toIsSet(changes, key) {
  if (!present(changes, key)) return false;
  const entry = changes[key];
  if (entry === null || entry === undefined) return false;
  return entry.to !== null && entry.to !== undefined;
}

// `(ch - ARRAY[...]) <> '{}'::jsonb` — is anything left after removing the
// named keys?
function hasKeysOutside(changes, keys) {
  if (!changes) return false;
  for (const k of Object.keys(changes)) {
    if (!keys.includes(k)) return true;
  }
  return false;
}

// Mirror of gt_classify_node(ch jsonb) RETURNS text[].
//
// `changes` is the `payload.changes` object: `{ "<field>": {from, to}, ... }`,
// with meta keys prefixed `meta.`. Returns the kinds array in the SAME ORDER
// the SQL builds it — order is load-bearing, because `headline()` takes ks[0].
export function classifyNode(changes) {
  const ks = [];
  if (present(changes, 'meta.decided_at')) {
    ks.push(toIsSet(changes, 'meta.decided_at') ? 'decision.made' : 'decision.reopened');
  }
  // Before claim.verified: a change asserting both headlines the doubt.
  if (toIsSet(changes, 'meta.refuted_at')) ks.push('claim.refuted');
  if (toIsSet(changes, 'meta.verified_at')) ks.push('claim.verified');
  if (present(changes, 'meta.status')) ks.push('status.changed');
  if (present(changes, 'meta.confidence') || present(changes, 'meta.significance')) {
    ks.push('field.set');
  }
  if (ks.length === 0 || hasKeysOutside(changes, NODE_SEMANTIC_KEYS)) ks.push('node.patched');
  return ks;
}

// Mirror of gt_classify_edge(ch jsonb) RETURNS text[].
//
// `edge.rewired` is a kind of its own (not a flavour of `edge.patched`)
// because E18.4 worldlines need a rewire to close one validity interval and
// open another — the same reason `edge.retyped` is separate.
export function classifyEdge(changes) {
  const ks = [];
  if (present(changes, 'source_id') || present(changes, 'target_id')) ks.push('edge.rewired');
  if (present(changes, 'purpose') || present(changes, 'type')) ks.push('edge.retyped');
  if (ks.length === 0 || hasKeysOutside(changes, EDGE_SEMANTIC_KEYS)) ks.push('edge.patched');
  return ks;
}

// Mirror of gt_headline(ks text[]).
//
// A route may PROMOTE a mechanically-derived kind to the headline by setting
// `gt.intent`; it can never invent one. `gt.intent='decision.made'` on a
// status-only change is ignored, because the DB — not the caller — is the
// authority on what actually changed. In SQL a NULL intent makes
// `NULL = ANY(ks)` NULL, i.e. falsy, and the CASE falls through to ks[1]
// (1-based); this returns ks[0].
export function headline(kinds, intent = null) {
  const ks = Array.isArray(kinds) ? kinds : [];
  if (intent && ks.includes(intent)) return intent;
  return ks.length > 0 ? ks[0] : null;
}

// ── E18.2 — decay eligibility and the weakening hook ────────────────────────

// Which nodes DECAY — i.e. whose verification goes stale with time.
//
// Measured against the production corpus before this was written: there is no
// `claim` node type at all; 2983 of 4103 nodes are untyped; 1043 of the 1298
// nodes carrying `verified_at` are untyped, and 190 are `reference`. A type
// allowlist would therefore key the whole feature on a field 73% of the
// relevant nodes do not have — and naming `claim` / `measurement` would
// specialise E18 for one domain.
//
// So the gate is the population predicate `/frontier` has ALWAYS used
// (`confidence IS NOT NULL OR type = 'reference'` — which is also the house
// definition of a claim, SKILL.md), plus ONE general per-node opt-out,
// `meta.decay: false`. Zero corpus nodes carry a `decay` key, so introducing it
// cannot move any existing ranking; it moves only when someone sets it, which
// is the point. A node that is a fixed MEASUREMENT (an extracted constant, a
// quoted spec value, a definition, a contract clause) sets `decay: false` and
// keeps R pinned at 1 — without E18 ever learning the words "claim" or
// "measurement".
//
// The tri-state contract is unchanged from the E18.1 stub: `null` means "E18
// takes no position", which a caller can tell apart from "not eligible".
export function isDecayEligible(event, nodeMeta = null) {
  const meta = nodeMeta && typeof nodeMeta === 'object' ? nodeMeta : null;
  if (meta) {
    // Explicit opt-out wins over everything, including `confidence`.
    if (meta.decay === false) return false;
    if (meta.confidence !== null && meta.confidence !== undefined) return true;
    if (meta.type === 'reference') return true;
    return false;
  }
  // No node given: answer from the event alone, using `payload.node_kind` —
  // the node's `meta.type` at event time, which E18.1 already stamps on every
  // event. Only `reference` is decisive from a type alone; anything else needs
  // the node's `confidence`, which an event does not carry.
  const nodeKind = event?.payload?.node_kind ?? null;
  if (nodeKind === 'reference') return true;
  return null;
}

// E18.3 seed extractor. Turns one event into "this made something less
// believed", with a caller-interpretable magnitude and NO propagation weight,
// NO attenuation constant and no decay-rate domain priors — those are the next
// rung's to choose, not this one's to hardcode.
//
// The stability fold deliberately IGNORES `confidence_drop`: confidence already
// reaches the frontier through `lowConfidence`, and letting it also move S
// would make the two knobs interact invisibly.
export function weakening(event) {
  if (!event || typeof event !== 'object') return null;
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const kinds = Array.isArray(payload.kinds) ? payload.kinds : [];
  const seq = event.seq ?? null;
  const subjectId = event.subject_id ?? null;
  const happenedAt = event.happened_at ?? null;

  if (kinds.includes('claim.refuted')) {
    return { kind: 'refutation', magnitude: 1, seq, subject_id: subjectId, happened_at: happenedAt };
  }
  // E18.4 — a supersession is the third seed. Magnitude 1, like a refutation:
  // the fact's story ended. It carries `superseded_by` (the successor node) and
  // `cause_id` (the edge event that opened it) so E18.3's front can walk the
  // cause chain without re-reading the log. NO propagation weight and NO
  // attenuation constant, same standing rule as the other two.
  //
  // A supersession is NOT a check: stability.js's VERIFY_EVENTS_SQL filters an
  // explicit ['claim.verified','claim.refuted'] allowlist, so checkFromEvent()
  // keeps returning null here with no edit. Letting a supersession move S would
  // be exactly the invisible knob interaction E18.2 refused for
  // `confidence_drop` — nobody re-verified anything.
  if (kinds.includes('node.superseded')) {
    return {
      kind: 'supersession',
      magnitude: 1,
      seq,
      subject_id: subjectId,
      happened_at: happenedAt,
      superseded_by: payload.superseded_by ?? null,
      cause_id: event.cause_id ?? null,
    };
  }
  const entry = payload.changes && typeof payload.changes === 'object'
    ? payload.changes['meta.confidence']
    : null;
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const from = entry.from;
    const to = entry.to;
    if (typeof from === 'number' && typeof to === 'number'
        && Number.isFinite(from) && Number.isFinite(to) && to < from) {
      return {
        kind: 'confidence_drop',
        magnitude: from - to,
        seq,
        subject_id: subjectId,
        happened_at: happenedAt,
      };
    }
  }
  return null;
}
