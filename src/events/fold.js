// E18.1 STEP 3 — the pure fold: events -> graph state -> /graph payload.
//
// DEPENDENCY-FREE, the planRegions.js / signedCycles.js / edgePurpose.js house
// rule: no `pg`, no `src/db.js`, no express, no npm package. The single import
// is `node:crypto`, a Node builtin, because a content digest and a state digest
// are the whole point of the snapshot chain and hashing in SQL would key jsonb
// by Postgres's own (length, bytes) order instead of this file's canonical form.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE INVARIANT EVERYTHING RESTS ON
//
// The fold is FORWARD-ONLY, `to`-ONLY, LAST-WRITER-WINS, and it NEVER reads
// `changes[*].from`. Two consequences, both load-bearing:
//
//   1. Re-applying an event the state already reflects is a NO-OP, so
//      OVER-REPLAY IS SAFE. That is what makes genesis-at-seq-0 race-free: the
//      genesis base is seq 0, every write that races the backfill has seq >= 1
//      and is therefore replayed, and replaying a change the state already
//      shows changes nothing. There is no window in which an edit is both
//      absent from the base and skipped by the tail.
//
//   2. On the HAPPENED axis the `from` values are actively WRONG. They were
//      captured by the row triggers against the materialized present — i.e.
//      against LEARNED order — so a backdated event's `from` describes a state
//      that never existed at that point on the happened timeline. (Worked
//      example in PLAN.md §3 STEP 5: e3 records
//      `meta.status: {from:"done", to:"todo"}` while the prior value on the
//      happened axis is null.) Ignoring `from` is therefore a CORRECTNESS
//      requirement, not an optimisation. The divergence between the two axes is
//      the signal; the fold must not reconcile it.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THE STATE CARRIES NO BODIES
//
// `GET /graph` (src/routes/graphView.js) returns
//   nodes: id, title, description, status, meta, version, external_id
//   links: id, source, target, purpose, type, meta, version
// and NEVER returns `content`. So neither the fold state nor any snapshot
// stores a body — a node keeps only `content_sha`, which is enough to verify
// the chain from ship day forward. Measured against the live database that
// turns a would-be 10 MB genesis (4103 tasks, 10.0 MB of content across 65
// graphs) into roughly 1 MB.
//
// `title` / `description` / `status` are NOT stored either: they are derived
// from `meta` at projection time by `toGraphPayload`, which reproduces the
// `meta->>'key'` coercion exactly (see `jsonbText`). Storing them would be a
// second copy of the same fact and a place for the two to drift.

import { createHash } from 'node:crypto';

// Bumped only when the meaning of a stored `state` changes. It is written to
// graph_snapshots.fold_version so a snapshot built by an older fold can be
// recognised and rebuilt rather than silently trusted.
export const FOLD_VERSION = 1;

export const AXES = Object.freeze(['learned', 'happened']);

// ─── canonical JSON ──────────────────────────────────────────────────────────

// Root key order. `db/schema.sql`'s gt_seed_genesis writes the seq-0 substrate
// as the LITERAL `{"v":1,"nodes":[],"edges":[]}` and tests/e18-schema.test.js
// pins both that string and its sha256. canonicalJson(emptyState()) MUST
// reproduce it byte-for-byte, so the envelope keys sort by this rank rather
// than alphabetically. The rank applies at the ROOT ONLY; everywhere below the
// root (node/edge records, and arbitrary user `meta`) keys sort by UTF-16 code
// unit, so a user meta key that happens to be called "nodes" is never
// reordered by a rule that has nothing to do with it.
const ROOT_KEY_ORDER = Object.freeze(['v', 'nodes', 'edges']);

function byCodeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function rootKeyCompare(a, b) {
  const ra = ROOT_KEY_ORDER.indexOf(a);
  const rb = ROOT_KEY_ORDER.indexOf(b);
  const ka = ra === -1 ? ROOT_KEY_ORDER.length : ra;
  const kb = rb === -1 ? ROOT_KEY_ORDER.length : rb;
  if (ka !== kb) return ka - kb;
  return byCodeUnit(a, b);
}

// Deterministic JSON with sorted object keys and no whitespace. Insertion order
// of the input can never change the output — that is the whole contract, since
// two folds that reach the same state by different routes must hash the same.
export function canonicalJson(value) {
  return serialize(value, true);
}

function serialize(value, isRoot) {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  const t = typeof value;
  if (t === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (t === 'boolean' || t === 'string') return JSON.stringify(value);
  if (t === 'bigint') return value.toString();
  if (Array.isArray(value)) {
    // Matches JSON.stringify: a hole or an explicit undefined becomes null.
    return `[${value.map((v) => serialize(v, false)).join(',')}]`;
  }
  if (t !== 'object') return 'null'; // function / symbol — same as JSON.stringify
  // Matches JSON.stringify: keys whose value is undefined are omitted.
  const keys = Object.keys(value).filter((k) => value[k] !== undefined);
  keys.sort(isRoot ? rootKeyCompare : byCodeUnit);
  return `{${keys.map((k) => `${JSON.stringify(k)}:${serialize(value[k], false)}`).join(',')}}`;
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// The identity of a state. Equal shas means byte-equal canonical JSON means the
// same graph, which is what lets the snapshotter self-verify by re-deriving its
// predecessor and comparing one string.
export function stateSha(state) {
  return sha256Hex(canonicalJson(state));
}

// ─── the state ───────────────────────────────────────────────────────────────

// The empty substrate. MUST canonicalise to `{"v":1,"nodes":[],"edges":[]}`.
export function emptyState() {
  return { v: FOLD_VERSION, nodes: [], edges: [] };
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function numOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Timestamps arrive as Postgres ISO text from `to_jsonb(row)` ("...+00:00"), as
// a `Date` from a driver-typed column read, or already normalised from an
// earlier fold. Normalising to one ISO spelling is what keeps a state built
// from live rows byte-identical to the same state built by replay.
function isoOrNull(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : d.toISOString();
}

function msOrNaN(value) {
  if (value === null || value === undefined) return NaN;
  return (value instanceof Date ? value : new Date(value)).getTime();
}

function byId(a, b) {
  return a.id - b.id;
}

// Working form. Maps make the fold O(1) per event instead of O(nodes); the
// canonical array form is materialised once at the end by `fromIndex`.
function toIndex(state) {
  const ix = { v: state?.v ?? FOLD_VERSION, nodes: new Map(), edges: new Map() };
  for (const n of state?.nodes ?? []) ix.nodes.set(n.id, n);
  for (const e of state?.edges ?? []) ix.edges.set(e.id, e);
  return ix;
}

// `ORDER BY id` in both arrays, matching graphView.js, so the projection needs
// no sort and the canonical form is independent of the order events arrived in.
function fromIndex(ix) {
  return {
    v: ix.v,
    nodes: [...ix.nodes.values()].sort(byId),
    edges: [...ix.edges.values()].sort(byId),
  };
}

// ─── ordering ────────────────────────────────────────────────────────────────

function cmpSeq(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return 0;
  return x < y ? -1 : x > y ? 1 : 0;
}

// Returns a NEW array; the caller's list is never mutated.
//
// 'learned' is ORDER BY seq and nothing else. seq is allocated under the graphs
// row lock held to commit (gt_next_seq), so it is gapless and commit-ordered:
// seq order IS learned order, and no (learned_at, seq) composite or settled
// horizon is needed anywhere.
//
// 'happened' is ORDER BY happened_at, seq. seq is the tie-break, which keeps a
// cascade contiguous (node.removed and the edge.removed rows it caused share a
// happened_at and the cause always has the lower seq) and makes the order
// total, hence stable.
export function orderEvents(events, axis = 'learned') {
  const list = Array.from(events ?? []);
  if (axis === 'learned') return list.sort((a, b) => cmpSeq(a?.seq, b?.seq));
  if (axis === 'happened') {
    return list.sort((a, b) => {
      const ta = msOrNaN(a?.happened_at);
      const tb = msOrNaN(b?.happened_at);
      // An unreadable happened_at falls through to seq rather than sorting to
      // an arbitrary edge of the timeline.
      if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta < tb ? -1 : 1;
      return cmpSeq(a?.seq, b?.seq);
    });
  }
  throw new Error(`unknown axis: ${axis}`);
}

// ─── applying one event ──────────────────────────────────────────────────────

const OP_BY_KIND = Object.freeze({
  'node.created': 'INSERT',
  'node.removed': 'DELETE',
  'node.patched': 'UPDATE',
  'status.changed': 'UPDATE',
  'field.set': 'UPDATE',
  'claim.verified': 'UPDATE',
  'claim.refuted': 'UPDATE',
  'decision.made': 'UPDATE',
  'decision.reopened': 'UPDATE',
  'edge.added': 'INSERT',
  'edge.removed': 'DELETE',
  'edge.retyped': 'UPDATE',
  'edge.rewired': 'UPDATE',
  'edge.patched': 'UPDATE',
});

// graph-level events carry no row state. The cascade that a graph DELETE fires
// emits a node.removed / edge.removed per row in the same transaction with
// higher seqs, so emptying the state is already covered by those; the tombstone
// itself must not empty it, or a truncated tail would erase a graph that the
// replay had not yet been told about row by row.
const GRAPH_KINDS = new Set(['graph.id_rotated', 'graph.deleted']);

// E18.4 — ANNOTATIONS carry no row state either, but for a different reason
// than the graph kinds above: `node.superseded` describes an edge write that
// ALREADY produced its own edge event, and the supersession's state is that
// edge. Without this guard the event falls through applyToIndex's UPDATE branch
// and, when the subject node is ABSENT from the state (reachable via
// happened-axis re-sorting, or a node deleted after being superseded),
// MATERIALISES A GHOST NODE `{id, meta:{}, version:null}` plus a
// `subject_absent_materialised_from_post_image` anomaly — a real corruption of
// the reconstructed graph. Measured against this exact file before the guard.
//
// FOLD_VERSION deliberately stays 1: the kind folds to a no-op, so no stored
// snapshot's meaning changes and nothing has to be rebuilt.
const ANNOTATION_KINDS = new Set(['node.superseded']);

function note(anomalies, event, reason) {
  if (!Array.isArray(anomalies)) return;
  anomalies.push({
    seq: numOrNull(event?.seq),
    kind: event?.kind ?? null,
    subject_kind: event?.subject_kind ?? null,
    subject_id: numOrNull(event?.subject_id),
    reason,
  });
}

// `changes` entries are `{from, to}` (and, for `content`,
// `{from_sha, to, to_sha, to_len, truncated}`). ONLY the `to` side is read.
function toOf(change) {
  if (change === null || change === undefined) return null;
  return change.to === undefined ? null : change.to;
}

// A meta key is USER-CONTROLLED TEXT, so it may be `__proto__` — jsonb stores
// it like any other key, and `{...row.meta}` (stateFromLiveRows, and the create
// path below) keeps it as an OWN property because spread DEFINES rather than
// assigns. Plain `meta[k] = to` does not: for `__proto__` it invokes
// Object.prototype's setter, which silently discards a string value and
// silently re-parents the object for an object value. Either way the key never
// appears in the folded state while the live row still has it, and nothing
// warns — `anomalies` stays empty. defineProperty is the assignment that
// matches what the spread already does everywhere else in this file.
//
// `Object.create(null)` was considered as the base for `meta` and NOT used: it
// would have to be applied at every construction site to mean anything, and one
// of those sites is out of this module's reach — the genesis substrate arrives
// as jsonb parsed by `pg`, i.e. with the ordinary prototype. The result would be
// a state whose meta objects have mixed prototypes depending on which path built
// them, which is a subtler trap than the one being fixed, for no gain: with
// defineProperty here, no user key can reach a prototype setter at all.
function setMetaKey(meta, k, value) {
  Object.defineProperty(meta, k, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function applyMetaChanges(meta, changes) {
  for (const [key, change] of Object.entries(changes)) {
    if (!key.startsWith('meta.')) continue;
    const k = key.slice(5);
    const to = toOf(change);
    // WAS THE KNOWN LOSSY POINT. `->` returns JSON null both for "key absent"
    // and for "key present with the value null", so `to` alone cannot say which
    // happened and `from` cannot disambiguate it either. That was fixed at the
    // source: gt_diff (db/schema.sql) now emits `to_present` ALONGSIDE `to`,
    // but ONLY on the entries where `to` is JSON null — i.e. exactly the
    // ambiguous ones — so every unambiguous entry keeps its historic
    // `{from, to}` shape and the payload does not grow by a constant `true` on
    // every changed column.
    //
    // Four cases, and the LAST one is what keeps every event ALREADY IN A LOG
    // folding exactly as it did before:
    //   to !== null                      → set (to_present is absent and moot)
    //   to === null, to_present === true  → set the key to null (the fix)
    //   to === null, to_present === false → delete: genuinely removed
    //   to === null, to_present absent    → LEGACY event, written before the
    //     flag existed. Delete, which is what this function has always done —
    //     so a pre-fix log replays to the pre-fix state, byte for byte, and no
    //     stored snapshot or FOLD_VERSION is invalidated.
    if (to === null && toPresent(change) !== true) delete meta[k];
    else setMetaKey(meta, k, to);
  }
}

// `undefined` means the writer predates the flag; see applyMetaChanges.
function toPresent(change) {
  if (change === null || typeof change !== 'object') return undefined;
  return change.to_present;
}

// E18.6 — what an excised node looks like at any seq its bytes are gone from.
// A fresh object every call: fold state is never shared between snapshots.
function excisedMeta() {
  return { title: '[excised]', excised: true };
}

function applyToIndex(ix, event, anomalies) {
  const kind = event?.kind ?? null;
  if (GRAPH_KINDS.has(kind) || ANNOTATION_KINDS.has(kind)) return;

  const payload = plainObject(event?.payload);

  // E18.6 — the excision record. `node_present` says whether the node existed
  // when its history was blanked. `after` is the re-declared present and is
  // itself content: a LATER excision of the same node strips it, leaving
  // `node_present: true` with no `after` — the node existed and its state is
  // unrecoverable, which is the placeholder, never a delete.
  if (kind === 'node.excised') {
    const id = numOrNull(event?.subject_id ?? payload.id);
    if (id === null) {
      note(anomalies, event, 'unrecognised_event');
      return;
    }
    if (payload.node_present !== true) {
      ix.nodes.delete(id);
      return;
    }
    const hasAfter = payload.after !== null && typeof payload.after === 'object';
    const after = plainObject(payload.after);
    const prev = ix.nodes.get(id);
    ix.nodes.set(id, {
      id,
      meta: hasAfter ? { ...plainObject(after.meta) } : excisedMeta(),
      version: numOrNull(after.version ?? prev?.version ?? null),
      external_id: hasAfter ? (after.external_id ?? null) : null,
      content_sha: hasAfter ? (after.content_sha ?? null) : null,
      created_at: isoOrNull(after.created_at) ?? prev?.created_at ?? null,
    });
    return;
  }
  const table =
    payload.table ??
    (event?.subject_kind === 'node' ? 'tasks' : event?.subject_kind === 'edge' ? 'edges' : null);
  const op = payload.op ?? OP_BY_KIND[kind] ?? null;
  const id = numOrNull(event?.subject_id ?? payload.id);

  if (table === null || op === null || id === null) {
    note(anomalies, event, 'unrecognised_event');
    return;
  }

  const after = plainObject(payload.after);
  const changes = plainObject(payload.changes);

  if (table === 'tasks') {
    if (op === 'INSERT') {
      // Last-writer-wins: a create for an id already present REPLACES it, which
      // is exactly what makes re-applying a create a no-op.
      ix.nodes.set(id, {
        id,
        // E18.6 — a blanked create has no `after`; the node existed, its
        // bytes do not. Every later blanked patch folds as a version bump
        // over this placeholder, because `changes` is gone too.
        meta: payload.excised === true ? excisedMeta() : { ...plainObject(after.meta) },
        version: numOrNull(payload.version ?? after.version),
        external_id: after.external_id ?? null,
        content_sha:
          after.content !== undefined && after.content !== null
            ? sha256Hex(String(after.content))
            : (after.content_sha ?? null),
        created_at: isoOrNull(after.created_at),
      });
      return;
    }
    if (op === 'DELETE') {
      // A delete for a subject that is not present is a silent no-op, never an
      // anomaly: that is the over-replay case the whole design depends on.
      ix.nodes.delete(id);
      return;
    }
    // UPDATE
    const prev = ix.nodes.get(id);
    if (!prev) {
      // Re-sorting onto the happened axis can put a patch before its create or
      // after its delete. Materialise what the post-image tells us rather than
      // dropping the event, and say so.
      note(anomalies, event, 'subject_absent_materialised_from_post_image');
    }
    const next = prev
      ? { ...prev, meta: { ...prev.meta } }
      : { id, meta: {}, version: null, external_id: null, content_sha: null, created_at: null };
    applyMetaChanges(next.meta, changes);
    if (Object.prototype.hasOwnProperty.call(changes, 'content')) {
      next.content_sha = changes.content?.to_sha ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'external_id')) {
      next.external_id = toOf(changes.external_id);
    }
    // Every other top-level task column in `changes` (run_id today, whatever a
    // future ALTER TABLE adds) is deliberately ignored: it is not part of the
    // /graph payload, so carrying it would bloat every snapshot for nothing.
    const v = numOrNull(payload.version);
    if (v !== null) next.version = v;
    ix.nodes.set(id, next);
    return;
  }

  if (table === 'edges') {
    if (op === 'INSERT') {
      ix.edges.set(id, {
        id,
        source: numOrNull(after.source_id ?? after.source),
        target: numOrNull(after.target_id ?? after.target),
        purpose: after.purpose ?? null,
        type: after.type ?? null,
        meta: { ...plainObject(after.meta) },
        version: numOrNull(payload.version ?? after.version),
        created_at: isoOrNull(after.created_at),
      });
      return;
    }
    if (op === 'DELETE') {
      ix.edges.delete(id);
      return;
    }
    const prev = ix.edges.get(id);
    if (!prev) note(anomalies, event, 'subject_absent_materialised_from_post_image');
    const next = prev
      ? { ...prev, meta: { ...prev.meta } }
      : {
          id,
          source: null,
          target: null,
          purpose: null,
          type: null,
          meta: {},
          version: null,
          created_at: null,
        };
    applyMetaChanges(next.meta, changes);
    if (Object.prototype.hasOwnProperty.call(changes, 'source_id')) {
      next.source = numOrNull(toOf(changes.source_id));
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'target_id')) {
      next.target = numOrNull(toOf(changes.target_id));
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'purpose')) {
      next.purpose = toOf(changes.purpose);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'type')) {
      next.type = toOf(changes.type);
    }
    const v = numOrNull(payload.version);
    if (v !== null) next.version = v;
    ix.edges.set(id, next);
    return;
  }

  note(anomalies, event, 'unrecognised_event');
}

// Apply ONE event. Pure: `state` is never mutated, a new state is returned.
// `opts.anomalies`, when an array, collects `{seq, kind, subject_kind,
// subject_id, reason}` for events that could not be applied cleanly.
export function applyEvent(state, event, opts = {}) {
  const ix = toIndex(state);
  applyToIndex(ix, event, opts.anomalies);
  return fromIndex(ix);
}

// Apply a LIST of events, in the order given — `foldEvents` deliberately does
// NOT sort. Ordering is `orderEvents`' job, and E18.5 overlays hand this
// function an arbitrary event list on purpose.
export function foldEvents(state, events, opts = {}) {
  const ix = toIndex(state);
  for (const event of events ?? []) applyToIndex(ix, event, opts.anomalies);
  return fromIndex(ix);
}

// ─── genesis on the happened axis ────────────────────────────────────────────

function bornBy(row, cutoffMs) {
  const ms = msOrNaN(row?.created_at);
  // A row with no readable created_at is kept: genesis rows predate the log, so
  // "cannot prove it was born later" must not delete history from the view.
  if (Number.isNaN(ms)) return true;
  return ms <= cutoffMs;
}

// The genesis substrate is a snapshot of the world on ship day, so on the
// HAPPENED axis it is wrong for any asOf before ship day: it contains rows that
// had not been created yet. Each row carries its own `created_at`, which is the
// only pre-history fact the log can honour, so filter by it. Edges whose
// endpoints are filtered out go too — a link that does not resolve is not a
// state a reader can use. Periodic snapshots are NEVER filtered this way (they
// encode learned-order outcomes); genesis is the exempt one.
export function filterGenesisByHappened(state, asOf) {
  const cutoff = msOrNaN(asOf);
  const v = state?.v ?? FOLD_VERSION;
  if (Number.isNaN(cutoff)) {
    return { v, nodes: [...(state?.nodes ?? [])], edges: [...(state?.edges ?? [])] };
  }
  const nodes = (state?.nodes ?? []).filter((n) => bornBy(n, cutoff));
  const alive = new Set(nodes.map((n) => n.id));
  const edges = (state?.edges ?? []).filter(
    (e) => bornBy(e, cutoff) && alive.has(e.source) && alive.has(e.target),
  );
  return { v, nodes, edges };
}

// ─── projection to the /graph payload ────────────────────────────────────────

// Postgres renders jsonb object keys in (length, then bytes) order, not
// lexicographically. Only `jsonbText` needs this — it is NOT the canonical form
// used for hashing.
function jsonbKeyCompare(a, b) {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return ba.length - bb.length;
  return Buffer.compare(ba, bb);
}

// jsonb's own text output: `, ` between members, `: ` after a key.
function jsonbLiteral(value) {
  if (value === null || value === undefined) return 'null';
  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (Array.isArray(value)) return `[${value.map(jsonbLiteral).join(', ')}]`;
  if (t === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined);
    keys.sort(jsonbKeyCompare);
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${jsonbLiteral(value[k])}`).join(', ')}}`;
  }
  return 'null';
}

// `meta->>'key'` — EXACTLY. The `->>` operator does not require a string: it
// coerces. JSON 5 yields the TEXT '5', true yields 'true', an object yields its
// jsonb rendering, and JSON null — like a missing key — yields SQL NULL, which
// is `null` here. Getting this wrong would make an asOf reconstruction differ
// from a plain GET /graph for any node whose title was written as a number.
//
// One documented divergence: jsonb stores numbers as `numeric` and preserves
// the written form, so `5.0` reads back as '5.0'; JSON.parse has already
// collapsed that to the JS number 5 before this function ever sees it, and
// nothing can recover the trailing zero. Immaterial for title/description/
// status, which are string-typed by applyDefaults and by the CHECK constraints.
function jsonbText(obj, key) {
  const source = plainObject(obj);
  if (!Object.prototype.hasOwnProperty.call(source, key)) return null;
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return jsonbLiteral(value);
}

// Reproduce `GET /api/graphs/:gid/graph` from a folded state: the same column
// list, the same names, the same ORDER BY id. Links whose endpoints are not in
// the state are dropped — the live tables cannot hold a dangling edge (FK), so
// emitting one would be a shape the canvas has never had to handle. A drop here
// is always the tail of a re-ordering the caller already sees in `anomalies`.
export function toGraphPayload(state) {
  const nodes = (state?.nodes ?? []).map((n) => ({
    id: n.id,
    title: jsonbText(n.meta, 'title'),
    description: jsonbText(n.meta, 'description'),
    status: jsonbText(n.meta, 'status'),
    meta: plainObject(n.meta),
    version: n.version ?? null,
    external_id: n.external_id ?? null,
  }));
  const alive = new Set(nodes.map((n) => n.id));
  const links = (state?.edges ?? [])
    .filter((e) => alive.has(e.source) && alive.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      purpose: e.purpose ?? null,
      type: e.type ?? null,
      meta: plainObject(e.meta),
      version: e.version ?? null,
    }));
  return { nodes, links };
}
