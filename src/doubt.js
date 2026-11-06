// E18.3 — transitive doubt propagation: the pure half.
//
// PURE MODULE. It reaches no database and no express. The one thing it imports
// is `weakening()` from events/kinds.js, which is itself pure — and importing
// it is the point: a second copy of "what counts as a weakening" is how two
// definitions drift. (`weakening()` is NOT modified by this rung;
// tests/e18-stability.test.js pins its return object with toEqual. The
// PROPAGATION POLICY lives here; the seed extractor ships exactly as built.)
//
// ─────────────────────────────────────────────────────────────────────────────
// THE MODEL
//
// A weakening event (a refutation, a supersession, a confidence drop) seeds a
// node with a weight in (0, 1]. Doubt flows FORWARD along the two load-bearing
// purposes — source(prereq/ground) -> target(dependent) — multiplying by a
// per-edge weight at every hop. A node's doubt weight is the MAX-PRODUCT over
// all paths from any seed: the strongest reason to doubt it.
//
// WHY THIS IS A LAYERED RELAXATION IN JS AND NOT A RECURSIVE CTE. The walk's
// state carries a weight AND a parent pointer, both of which differ per path,
// so `UNION` cannot dedup them (dedup is what makes /ready's idiom cheap) and
// `UNION ALL` with the array path-guard every chain needs enumerates every
// simple path — measured, on a graph 2x the largest real one, at 5 592 404 rows
// and 16.9 seconds to describe 595 distinct nodes. Postgres also forbids
// aggregates in a recursive term, so "keep the max weight per node" — the
// relaxation itself — cannot be written there at all. The house idiom is kept
// for what it is good at (the edge slice is one indexed range scan) and the
// model moves to a pure module, exactly as E18.2's PATH B moved the decay model
// out of SQL, and for the same reason: one pure, unit-testable place.
//
// ─────────────────────────────────────────────────────────────────────────────
// TERMINATION IS A PROOF, NOT A CAP
//
// Every weight, from every source, is constrained to (0, 1]. Path weight is
// therefore monotone non-increasing, a cycle multiplies by <= 1 and can never
// IMPROVE a node's best weight, and a node re-enters the frontier only on a
// STRICT improvement — so the frontier empties on its own. Verified with NO
// attenuation (supports = 1.0), floor 1e-9 and maxDepth 256 on a deliberately
// cyclic graph: every reachable node, `truncated: false`, frontier empty.
//
// The evidence graph IS cyclic (`supports` derives type='related' and is not
// cycle-checked), and the comfort the cause graph enjoys does NOT transfer:
// `events_cause_precedes CHECK (cause_id < seq)` makes causes a strict DAG that
// terminates with no visited set. Nothing here may inherit that. src/
// supersession.js states the same asymmetry for succession.
//
// The (0, 1] constraint is consequently not tidiness — it IS the termination
// argument. A weight > 1 lets a cycle amplify without bound and demotes a
// correctness property to a configuration accident. Hence: 400, never a clamp.

import { weakening } from './events/kinds.js';

// ── the vocabulary and the defaults ─────────────────────────────────────────

// What carries doubt is the same allowlist /frontier's importance CTE uses, so
// "what carries doubt" and "what carries importance" are ONE vocabulary.
// `contradicts` is deliberately absent: it is symmetric in meaning, and
// propagating along it would make two mutually-contradicting claims seed each
// other forever. `supersedes` is absent for a different reason — a supersession
// is a SEED (weakening() returns one), not a channel.
export const TRAVERSAL_PURPOSES = Object.freeze(['required for', 'supports']);

// THE ONLY PLACE A PROPAGATION NUMBER IS WRITTEN IN THIS REPO.
//
// This is a seed value for a CALLER-OWNED parameter, in exactly the sense
// `staleDays: 90` and `lowConfidenceBelow: 0.5` already are on /frontier — not
// a constant buried in a query. It is exported, echoed in `params.weights` on
// every response, and overridable per request (`weights`) and per edge
// (`meta.propagation`). `layeredWalk()` takes the weight map as an argument and
// contains no numeric literal at all.
//
// WHY 0.6, stated as arithmetic so a caller can choose their own instead of
// guessing: with the default floor the soft reach is floor(ln(floor)/ln(w))
// hops, so w=0.5 -> 4, w=0.6 -> 5, w=0.9 -> 28. Measured on a 1200-node probe
// at maxDepth 12: supports=0.6 -> 233 items, supports=1.0 -> 358,
// floor=1e-9 -> 1137 (the entire reachable set). 0.6 makes the DEFAULT front a
// readable page rather than the whole graph.
export const DEFAULT_PROPAGATION_WEIGHTS = Object.freeze({
  'required for': 1,   // HARD — a dependent cannot be more believed than its prereq.
  supports: 0.6,       // ATTENUATED — evidence weakens; it does not refute.
});

export const DEFAULT_WEIGHT_FLOOR = 0.05;
export const DEFAULT_MAX_DEPTH = 12;
export const DEFAULT_MAX_NODES = 2000;
export const DEFAULT_CHAIN_LIMIT = 16;
export const DEFAULT_MAX_TRIGGERS = 32;
export const DEFAULT_MAX_RESULTS = 50;

export const MAX_DEPTH_CAP = 256;
export const MAX_NODES_CAP = 20000;
export const CHAIN_LIMIT_CAP = 64;
export const MAX_TRIGGERS_CAP = 256;
export const MAX_RESULTS_CAP = 500;

// The open-closed interval (MIN_PROPAGATION, MAX_PROPAGATION].
//
// NOT `MIN_WEIGHT` / `MAX_WEIGHT`: those names are already taken in
// src/routes/edges.js for `meta.curve.weight`, the bezier control-point
// position along an edge — a rendering parameter, 0..1, one key away. The whole
// reason the per-edge knob is called `propagation` and not `weight` is that
// collision.
export const MIN_PROPAGATION = 0;
export const MAX_PROPAGATION = 1;

export const WEIGHT_RANGE_ERROR = (name) =>
  `${name} must be a number greater than ${MIN_PROPAGATION} and at most ${MAX_PROPAGATION}`;
export const WEIGHT_MISSING_ERROR = (purpose) =>
  `weights must supply a propagation weight for '${purpose}'`;
export const WEIGHT_UNKNOWN_ERROR = (purpose) =>
  `weights may only name traversal purposes (${TRAVERSAL_PURPOSES.map((p) => `'${p}'`).join(', ')}); got '${purpose}'`;
export const WEIGHTS_SHAPE_ERROR = 'weights must be an object of purpose -> number';

// Float slack for "is this weight strictly better?". Module-level, deliberately
// OUTSIDE layeredWalk: the discipline test greps that function's body for a
// numeric literal, because an attenuation constant inlined there is precisely
// the thing this rung promises does not exist.
const EPS = 1e-12;

// ── weight validation ───────────────────────────────────────────────────────

// House `{value}` / `{error}` shape, cf. frontier.js num() and
// eventsLog.js intParam().
export function validatePropagation(raw, name) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { error: WEIGHT_RANGE_ERROR(name) };
  if (raw <= MIN_PROPAGATION || raw > MAX_PROPAGATION) return { error: WEIGHT_RANGE_ERROR(name) };
  return { value: raw };
}

// Merge a caller's `weights` over the defaults.
//
// `defaults` and `purposes` are arguments, not closed-over constants, so the
// WEIGHT_MISSING_ERROR branch below is reachable from a test TODAY rather than
// only from a hypothetical future rung. That branch is the requirement: if a
// later rung adds a traversable purpose and no weight for it, the route must
// 400 — NEVER pick one. An undeclared weight silently defaulting is the exact
// failure the "no hardcoded attenuation" rule exists to prevent.
export function mergeWeights(
  requested,
  defaults = DEFAULT_PROPAGATION_WEIGHTS,
  purposes = TRAVERSAL_PURPOSES,
) {
  const out = { ...defaults };
  if (requested !== undefined && requested !== null) {
    if (typeof requested !== 'object' || Array.isArray(requested)) {
      return { error: WEIGHTS_SHAPE_ERROR };
    }
    for (const [purpose, value] of Object.entries(requested)) {
      if (!purposes.includes(purpose)) return { error: WEIGHT_UNKNOWN_ERROR(purpose) };
      const checked = validatePropagation(value, `weights['${purpose}']`);
      if (checked.error) return { error: checked.error };
      out[purpose] = checked.value;
    }
  }
  for (const purpose of purposes) {
    const held = out[purpose];
    if (typeof held !== 'number' || !Number.isFinite(held)
        || held <= MIN_PROPAGATION || held > MAX_PROPAGATION) {
      return { error: WEIGHT_MISSING_ERROR(purpose) };
    }
  }
  return { value: out };
}

// ── seeds ───────────────────────────────────────────────────────────────────

// Turn a page of events into doubt seeds.
//
// THE BIGINT TRAP, which fails SILENTLY and cost a debugging session to find.
// `events.subject_id` is BIGINT, so `pg` returns it as a STRING; `edges.
// source_id` is SERIAL (int4) and comes back as a NUMBER. Seeding the adjacency
// Map with the raw `subject_id` produces a walk of exactly the seeds and ZERO
// relaxations — which reads as "nothing depends on this claim" rather than as a
// bug. Hence Number() on every id, here and in buildAdjacency, and a test that
// pins a string subject_id propagating identically to a numeric one.
//
// SEED WEIGHT, and why the GUC lands here rather than on an edge. A writer who
// knows "this refutation is worth 0.4, not a full 1" sets `gt.propagation_weight`
// and the trigger enters the walk at 0.4 (`weight_source: 'payload'`). A GUC
// lands on ONE event: it describes the moment a fact was weakened, not the
// standing strength of a relation — and a relation's strength belongs on the
// relation (`meta.propagation`). Where nothing is set, the seed weight is
// weakening()'s `magnitude`, which is already in (0, 1] for all three kinds
// (refutation 1, supersession 1, confidence_drop from-to).
export function seedsFromEvents(rows) {
  const out = [];
  for (const row of rows ?? []) {
    const wk = weakening(row);
    if (!wk) continue;
    const node = Number(wk.subject_id);
    if (!Number.isFinite(node)) continue;

    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const declared = validatePropagation(
      typeof payload.weight === 'string' ? Number(payload.weight) : payload.weight,
      'payload.weight',
    );
    let w;
    let weightSource;
    if (declared.value !== undefined) {
      w = declared.value;
      weightSource = 'payload';
    } else {
      const magnitude = Number(wk.magnitude);
      if (!Number.isFinite(magnitude) || magnitude <= MIN_PROPAGATION) continue;
      w = Math.min(magnitude, MAX_PROPAGATION);
      weightSource = 'magnitude';
    }

    out.push({
      node,
      w,
      seq: Number(wk.seq),
      kind: wk.kind,
      magnitude: wk.magnitude,
      weight_source: weightSource,
      subject_id: node,
      happened_at: wk.happened_at ?? null,
      learned_at: row.learned_at ?? null,
      cause_id: row.cause_id === null || row.cause_id === undefined ? null : Number(row.cause_id),
      superseded_by: wk.superseded_by === null || wk.superseded_by === undefined
        ? null
        : Number(wk.superseded_by),
    });
  }
  // Deterministic, and the order the tie-break relies on.
  out.sort((a, b) => a.seq - b.seq);
  return out;
}

// ── adjacency ───────────────────────────────────────────────────────────────

// source -> [{id, target_id, purpose, propagation}], sorted by (target, edge id)
// so the walk's answer does not depend on the order the database handed rows
// back. A per-edge `meta.propagation` outside (0, 1] is IGNORED here rather
// than honoured; the write path validates it (edges.js normalizeMeta), so a
// bad value can only come from a row written before that validation existed,
// and silently amplifying doubt from one is worse than falling back to the
// purpose's weight.
export function buildAdjacency(edgeRows) {
  const adjacency = new Map();
  for (const row of edgeRows ?? []) {
    const source = Number(row.source_id ?? row.source);
    const target = Number(row.target_id ?? row.target);
    if (!Number.isFinite(source) || !Number.isFinite(target)) continue;
    const purpose = row.purpose ?? null;
    const raw = row.propagation === undefined ? row.meta?.propagation : row.propagation;
    const checked = validatePropagation(typeof raw === 'string' ? Number(raw) : raw, 'propagation');
    const entry = {
      id: Number(row.id ?? row.edge_id ?? 0) || null,
      target_id: target,
      purpose,
      propagation: checked.value === undefined ? null : checked.value,
    };
    const held = adjacency.get(source);
    if (held) held.push(entry);
    else adjacency.set(source, [entry]);
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => (a.target_id - b.target_id) || ((a.id ?? 0) - (b.id ?? 0)));
  }
  return adjacency;
}

// ── the walk ────────────────────────────────────────────────────────────────

export function walkKey(node, triggerSeq) {
  return `${node}:${triggerSeq}`;
}

// Layered max-product relaxation, keyed by (node, trigger).
//
// WHY THE STATE IS KEYED BY (node, trigger) AND NOT BY node ALONE. The anchor
// gate is per item — "is there a weakening we learned of AFTER we last checked
// THIS node?" — so an item can be put on the front by one trigger while another
// trigger's path to it is older than its anchor. Merging the triggers into one
// record makes the reported chain and the gate disagree: the item surfaces
// because of trigger B and is then explained by trigger A's path. Keying by the
// pair keeps each trigger's best path exact, makes `trigger_count` a count
// rather than an estimate, and costs one Map entry per (reached node, trigger)
// — 5685 entries on the 1200-node probe with five triggers. `maxTriggers` is
// what bounds it; seeds past the cap are dropped and SAID so.
//
// `opts` carries every number. There are none in this function.
export function layeredWalk(adjacency, seeds, opts) {
  const { weights, weightFloor, maxDepth, maxNodes } = opts;
  const best = new Map();          // "node:trigger" -> record
  const nodeCount = new Set();     // distinct nodes, for maxNodes
  let frontier = new Map();        // "node:trigger" -> the RECORD, not its weight
  let truncated = false;
  let relaxed = 0;
  let deepest = 0;
  const stoppedBy = new Set();

  for (const seed of seeds) {
    // THE FLOOR IS ONE RULE AND IT APPLIES TO SEEDS TOO.
    //
    // It used to guard relaxations only, which made the answer internally
    // incoherent: a seed of magnitude 0.02 was returned as an ITEM while its
    // dependent across a `required for` edge — weight 1, "a dependent cannot be
    // more believed than its prereq", so by definition EXACTLY as doubtful —
    // was cut by the same floor one line later. The front showed a cause and
    // hid its consequences. `weightFloor` is a caller-owned relevance threshold
    // on a doubt weight, so the coherent reading is "every item at or above the
    // floor", seeds included; a front that also carried sub-floor seeds but not
    // their dependents answered neither question. Reported via stoppedBy, NOT
    // via `truncated`: the floor is a filter the caller asked for and echoed in
    // `params.weightFloor`, exactly as it already is for relaxations.
    if (seed.w < weightFloor) { stoppedBy.add('floor'); continue; }
    const key = walkKey(seed.node, seed.seq);
    const prev = best.get(key);
    if (prev && prev.w >= seed.w) continue;
    const record = {
      node: seed.node,
      triggerSeq: seed.seq,
      w: seed.w,
      hops: 0,
      viaEdge: null,
      viaNode: null,
      viaPurpose: null,
      viaWeight: null,
      via: null,
    };
    best.set(key, record);
    nodeCount.add(seed.node);
    frontier.set(key, record);
  }

  for (let d = 1; d <= maxDepth && frontier.size > 0; d += 1) {
    const next = new Map();
    // THE FRONTIER CARRIES THE PRODUCING RECORD, NOT A LOOSE WEIGHT, and every
    // new record keeps a pointer to the one it was relaxed FROM (`via`).
    //
    // A node's parent pointer is overwritten whenever a strictly better path
    // turns up, and a node already relaxed from the older, worse record is only
    // corrected on a LATER layer. When the loop stops at maxDepth that later
    // layer never runs — so re-reading a LIVE parent pointer at chain time
    // described a different, better path than the one the reported `weight` and
    // `hops` came from: the numbers did not explain the chain and the chain's
    // own edge weights did not multiply back to the weight. Holding the exact
    // producing record makes the three agree by construction, at every depth,
    // truncated or not: `w` is the product along `via`, and `hops` is that
    // chain's length because it is counted from the parent rather than from the
    // layer number.
    for (const from of frontier.values()) {
      for (const edge of adjacency.get(from.node) ?? []) {
        relaxed += 1;
        // The ONLY place a weight is chosen, and it contains no number:
        // per-edge beats per-request beats the exported default.
        const ew = edge.propagation ?? weights[edge.purpose];
        if (!(ew > MIN_PROPAGATION)) continue;   // a purpose we do not traverse
        const nw = from.w * ew;
        if (nw < weightFloor) { stoppedBy.add('floor'); continue; }
        const targetKey = walkKey(edge.target_id, from.triggerSeq);
        const prev = best.get(targetKey);
        // ── THE TERMINATION PROOF, not an optimisation ──────────────────────
        // A node re-enters the frontier ONLY on a strict improvement. Every
        // weight is in (0, 1], so a cycle multiplies by <= 1 and can never
        // improve anything: the frontier empties on its own. Remove this line
        // and a `supports: 1.0` cycle runs to maxDepth and the cost becomes the
        // exponential column of the design's table.
        if (prev && prev.w >= nw - EPS) continue;
        if (!prev && !nodeCount.has(edge.target_id) && nodeCount.size >= maxNodes) {
          truncated = true;
          stoppedBy.add('node_cap');
          continue;
        }
        const record = {
          node: edge.target_id,
          triggerSeq: from.triggerSeq,
          w: nw,
          hops: from.hops + 1,
          viaEdge: edge.id,
          viaNode: from.node,
          viaPurpose: edge.purpose,
          viaWeight: ew,
          via: from,
        };
        best.set(targetKey, record);
        nodeCount.add(edge.target_id);
        const held = next.get(targetKey);
        if (held === undefined || held.w < nw) next.set(targetKey, record);
      }
    }
    frontier = next;
    deepest = d;
    if (d === maxDepth && next.size > 0) { truncated = true; stoppedBy.add('depth'); }
  }

  return {
    best,
    nodes: nodeCount.size,
    relaxed,
    deepest,
    truncated,
    stoppedBy: [...stoppedBy].sort(),
  };
}

// Group a walk's records by node: id -> Map(triggerSeq -> record).
export function byNode(best) {
  const out = new Map();
  for (const record of best.values()) {
    const held = out.get(record.node);
    if (held) held.set(record.triggerSeq, record);
    else out.set(record.node, new Map([[record.triggerSeq, record]]));
  }
  return out;
}

// ── chains ──────────────────────────────────────────────────────────────────

// Reconstruct one item's cause chain from the parent pointers — NEVER carried
// in SQL, which is exactly what makes the path-carrying CTE exponential.
// O(hops), and allocated only for the <= maxResults items actually returned.
//
// TRUNCATION CUTS AT THE TRIGGER END, not the item end: the hops nearest the
// item are what a reader acts on, and the trigger is reported separately in
// `triggers[]` regardless. Because maxDepth defaults to 12 and chainLimit to
// 16, the DEFAULT configuration can never truncate a chain.
//
// IT FOLLOWS `record.via` — THE RECORD THIS ONE WAS RELAXED FROM — AND NOT THE
// LIVE `best` ENTRY FOR `viaNode`. The two differ exactly when the parent was
// improved after the child was relaxed and the walk stopped (at maxDepth)
// before the child could be corrected; re-reading the live entry there returned
// a chain that described a DIFFERENT, better path than the `weight` and `hops`
// reported beside it. Following the producing record keeps the item's three
// claims — weight, hop count, chain — one statement: `weight` is the seed
// weight times the chain's own per-hop weights, and `hops` is the chain's
// length. `best` is still the way in (the caller names an item by id), and the
// walkKey lookup remains the fallback for a record from an older shape.
//
// The `seen` guard is belt-and-braces. `via` is assigned only on a strict
// weight improvement, so a cycle in the parent pointers is impossible by
// construction; the guard exists so a hypothetical corruption is non-fatal
// rather than an infinite loop on a read path.
export function chainFor(best, node, triggerSeq, limit, superseded = null) {
  const hops = [];
  const seen = new Set();
  let record = best.get(walkKey(node, triggerSeq));
  let omitted = 0;
  while (record) {
    if (seen.has(record)) break;
    seen.add(record);
    if (record.viaNode === null || record.viaNode === undefined) break;
    hops.push({
      from: record.viaNode,
      to: record.node,
      edge_id: record.viaEdge,
      purpose: record.viaPurpose,
      weight: record.viaWeight,
      from_superseded: superseded ? superseded.has(record.viaNode) : false,
    });
    record = record.via ?? best.get(walkKey(record.viaNode, triggerSeq));
  }
  hops.reverse();                     // trigger end first, item end last
  if (hops.length > limit) {
    omitted = hops.length - limit;
    hops.splice(0, omitted);          // cut at the TRIGGER end
  }
  return { hops, truncated: omitted > 0, omitted_hops: omitted };
}

// ── the anchor gate ─────────────────────────────────────────────────────────

export const AXES = Object.freeze(['learned', 'happened']);

// EPOCH MILLISECONDS FROM WHATEVER SHAPE A TIMESTAMP ARRIVES IN — the one place
// world time is turned into a number, used by BOTH comparisons below.
//
// The two sides genuinely arrive as different types and always will: an
// anchor's `happened_at` is run through the route's isoOrNull() and is an ISO
// STRING, while a trigger's is the raw `Date` pg returns for a timestamptz,
// copied straight through seedsFromEvents. `Date.parse` takes a string, so a
// Date argument is coerced by `Date.prototype.toString()` —
// "Thu Jun 04 2026 15:40:45 GMT+0000", WHICH RENDERS NO MILLISECONDS. The
// trigger's world time was therefore floored to the whole second before every
// comparison, and a weakening and a verification less than a second apart
// compared wrongly in both directions: measured, a trigger at .800 against an
// anchor at .200 read as NOT newer (the node was silenced off the front), and a
// trigger at .900 against an anchor at .100 read as "verified after in world"
// (a false demotion flag). Events written in one burst — one test, one agent
// run, one import — are exactly this close.
//
// Normalising HERE rather than at the seed factory because `onFront` and
// `verifiedAfterInWorld` are exported and take raw trigger/anchor objects from
// anywhere: fixing only seedsFromEvents would leave the gate itself
// type-fragile for the next caller. Date, ISO string and epoch number all land
// on the same number; anything else is NaN, and every comparison against NaN is
// false, which is the pre-existing behaviour for an unparseable timestamp.
function epochMs(value) {
  if (value === null || value === undefined) return NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return Date.parse(value);
}

// "Since it was last verified or decided."
//
// THE ALLOWLIST IS THE POSITIVE HALF ONLY — `claim.verified` and
// `decision.made`. This is a MEASURED fix, not a preference. E18.2's
// VERIFY_EVENTS_SQL uses ['claim.verified','claim.refuted'], because for the
// stability fold a failed check IS a check. Reusing that allowlist here is a
// silent, total bug: a `claim.refuted` event is both the trigger AND its own
// anchor, `trigger.seq <= anchor.seq` holds BY EQUALITY, and the refuted node
// SILENCES ITSELF off the front it just triggered. `decision.reopened` is out
// for the same reason — reopening a decision WITHDRAWS a commitment, it does
// not renew one. A NEGATIVE EVENT IS NEVER A REASSURANCE.
export const ANCHOR_KINDS = Object.freeze(['claim.verified', 'decision.made']);

// The gate, on the LEARNED axis by default.
//
// Both seqs come from the same per-graph sequence, which gt_next_seq() allocates
// under the graphs-row lock held to commit — gapless and commit-ordered. So this
// is a TOTAL ORDER with no clock, no timezone, no parse, and nothing a caller
// can forge (`learned_at` is stamped clock_timestamp() and accepted from
// nowhere).
//
// WHY BELIEF TIME AND NOT WORLD TIME. "Does this need re-checking?" is a
// question about what we KNOW. Work the acceptance scenario: the terms changed
// in MARCH, we verified the old-terms claim in JUNE, we learn of the change
// TODAY. On the happened axis the weakening (March) is OLDER than the check
// (June) and the claim does not surface — which is exactly wrong, because the
// June check did not know about the March change. On the learned axis the
// weakening's seq is today's, it exceeds the June verification's seq, and the
// claim surfaces. BACKDATED WEAKENINGS ARE THE NORMAL CASE for this feature: a
// correction always describes a world earlier than the moment we learn of it.
export function onFront(trigger, anchor, axis) {
  if (axis === 'happened') {
    const anchorAt = anchor?.happened_at ?? null;
    if (anchorAt === null) return true;              // never checked in any world
    const triggerAt = trigger?.happened_at ?? null;
    if (triggerAt === null) return false;
    return epochMs(triggerAt) > epochMs(anchorAt);
  }
  const anchorSeq = Number(anchor?.seq ?? 0) || 0;
  return Number(trigger?.seq ?? 0) > anchorSeq;
}

// Reported, NEVER filtering: "our last check was of a LATER world than this
// weakening describes, so it may already have accounted for it." It demotes
// within equal weight and is displayed. It must never suppress — a skewed
// client clock or a sloppy backdate would otherwise hide a live doubt, and the
// fold's standing rule is that the two axes are allowed to disagree and must
// not be reconciled.
export function verifiedAfterInWorld(trigger, anchor) {
  const anchorAt = anchor?.happened_at ?? null;
  const triggerAt = trigger?.happened_at ?? null;
  if (anchorAt === null || triggerAt === null) return false;
  const a = epochMs(anchorAt);
  const t = epochMs(triggerAt);
  if (!Number.isFinite(a) || !Number.isFinite(t)) return false;
  return a > t;
}
