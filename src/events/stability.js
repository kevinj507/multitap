// E18.2 — per-fact stability: the pure fold that turns a node's verification
// series into a decay WINDOW, and the retrievability curve read off it.
//
// PURE MODULE. It imports nothing — no `pg`, no `db.js`, no express — for the
// same reason kinds.js / fold.js / planRegions.js do: the whole decay model has
// to be unit-testable with no database, and a test file must be able to import
// it statically (anything reaching src/db.js may not be).
//
// ─────────────────────────────────────────────────────────────────────────────
// THE MODEL, IN ONE PARAGRAPH
//
// Every `claim.verified` / `claim.refuted` event is a CHECK: someone asked "is
// this still true?" and got an answer. FSRS's insight — spacing, not repetition,
// is what makes a memory durable — transfers exactly: a claim that survived a
// re-check after 90 idle days has earned a longer leash than one re-checked
// five times in one session. So S (the stability window, in days) grows by a
// factor that depends on how LATE the successful check was, and collapses on a
// failure. Retrievability is FSRS's power curve, R(t) = (1 + t/(9S))^-1.
//
// WHY THAT CURVE AND NOT AN EXPONENTIAL. With S = staleDays and the default
// threshold 0.9, "R below threshold" is ALGEBRAICALLY today's staleness test:
//
//     R(t) = (1 + t/(9S))^-1 ;  R = 0.9  <=>  t/(9S) = 1/9  <=>  t = S
//
// so `staleDays` is not deprecated by this rung — it is PROMOTED to S_INIT, and
// a graph with no verification events reproduces v1 exactly, per node.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE FLOAT64 TRAP — MEASURED. READ THIS BEFORE "SIMPLIFYING" isDue().
//
//     node -e "console.log(1/(1+90/(9*90)))"   ->   0.8999999999999999
//
// In IEEE-754 double, R(t = S) < 0.9 is TRUE for every S tested (1, 7, 30, 90,
// 180, 365). Today's SQL uses a strict interval comparison, so a node verified
// EXACTLY staleDays ago is NOT stale. Evaluating the gate in the R domain would
// therefore flip that node — a one-row, silent back-compat break.
//
// The gate is in the TIME domain and never in the R domain, and dueFactor(0.9)
// is pinned as the literal 1: every float64 spelling of the general formula is
// off by ulps (9*(1/0.9 - 1) = 1.0000000000000004, 9*(1-0.9)/0.9 =
// 0.9999999999999998), and at the default that factor multiplies `staleDays`
// straight into today's `NOW() - ($3 || ' days')::interval`.
//
// R is still computed and returned — for RANKING and DISPLAY only, where a
// 16th-digit wobble is deterministic for equal inputs and ties break on id ASC.

const MS_PER_DAY = 86400000;

// Module-level defaults, exported for tests. NOT route parameters: `sInitDays`
// is supplied per call (it is `staleDays`), the rest are the model's shape.
// No domain priors and no per-node decay rate live here — deliberately out of
// scope for v1.
export const STABILITY_DEFAULTS = Object.freeze({
  sInitDays: 90,   // S after the FIRST hold; the route passes `staleDays`
  growth: 2.0,     // the spacing reward multiplier
  lapseFactor: 0.1, // post-failure multiplier
  sMinDays: 1,
  sMaxDays: 3650,
});

export const DEFAULT_R_THRESHOLD = 0.9;

function withDefaults(params) {
  const p = params && typeof params === 'object' ? params : {};
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    sInitDays: num(p.sInitDays, STABILITY_DEFAULTS.sInitDays),
    growth: num(p.growth, STABILITY_DEFAULTS.growth),
    lapseFactor: num(p.lapseFactor, STABILITY_DEFAULTS.lapseFactor),
    sMinDays: num(p.sMinDays, STABILITY_DEFAULTS.sMinDays),
    sMaxDays: num(p.sMaxDays, STABILITY_DEFAULTS.sMaxDays),
  };
}

// ── the curve ───────────────────────────────────────────────────────────────

// R(t) = (1 + t/(9S))^-1. Display and ranking only — never the due gate.
// S <= 0 degenerates to "stale the instant it is not now", which is exactly
// what `staleDays: 0` means in v1.
export function retrievability(ageDays, s) {
  const age = typeof ageDays === 'number' && Number.isFinite(ageDays) ? Math.max(0, ageDays) : 0;
  if (!(typeof s === 'number') || !Number.isFinite(s) || s <= 0) return age > 0 ? 0 : 1;
  return 1 / (1 + age / (9 * s));
}

// The multiple of S at which R crosses `rThreshold`.
//
// dueFactor(0.9) === 1 EXACTLY, pinned as a literal rather than computed, so
// that at the default this multiplies `staleDays` into precisely today's
// interval. tests/e18-stability.test.js asserts the identity and quotes the
// measurement; do not "simplify" it back into the general formula.
export function dueFactor(rThreshold = DEFAULT_R_THRESHOLD) {
  if (rThreshold === DEFAULT_R_THRESHOLD) return 1;
  if (typeof rThreshold !== 'number' || !Number.isFinite(rThreshold)) return 1;
  if (rThreshold <= 0) return Infinity;   // never surfaces
  if (rThreshold >= 1) return 0;          // surfaces immediately
  return (9 * (1 - rThreshold)) / rThreshold;
}

// Days after the last HOLD at which this node becomes due.
export function dueDays(s, params = null, rThreshold = DEFAULT_R_THRESHOLD) {
  const p = withDefaults(params);
  const window = typeof s === 'number' && Number.isFinite(s) ? s : p.sInitDays;
  return dueFactor(rThreshold) * window;
}

// THE GATE. Strictly greater-than, in the time domain — the exact shape of
// v1's `verified_at < NOW() - interval`.
export function isDue(ageDays, s, params = null, rThreshold = DEFAULT_R_THRESHOLD) {
  const age = typeof ageDays === 'number' && Number.isFinite(ageDays) ? ageDays : 0;
  return age > dueDays(s, params, rThreshold);
}

// When this node becomes due, as an ISO string. `null` for a node that has
// never been held — it is already at R = 0, so there is no future crossing.
export function dueAt(lastHeldMs, s, params = null, rThreshold = DEFAULT_R_THRESHOLD) {
  if (typeof lastHeldMs !== 'number' || !Number.isFinite(lastHeldMs)) return null;
  const days = dueDays(s, params, rThreshold);
  if (!Number.isFinite(days)) return null;   // rThreshold 0: never due
  const at = lastHeldMs + days * MS_PER_DAY;
  if (!Number.isFinite(at)) return null;
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ── reading a check off an event ────────────────────────────────────────────

function msOrNull(v) {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

// One event -> `{subjectId, at, outcome, deliberate}` or null if it is not a
// check at all.
//
// WHY `at` PREFERS `changes['meta.verified_at'].to`. An ordinary PATCH writing
// `verified_at: 2026-03-01` today is asserting a MARCH check; the event's
// `happened_at` is September. The scalar is the field's declared meaning, so it
// wins — clamped by min(..., happened_at) so a future-dated scalar cannot buy
// recency it has not earned. The verify route sets both to the same instant, so
// the two rules agree there by construction.
export function checkFromEvent(event) {
  if (!event || typeof event !== 'object') return null;
  if (event.subject_kind !== undefined && event.subject_kind !== null
      && event.subject_kind !== 'node') return null;
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const kinds = Array.isArray(payload.kinds) ? payload.kinds : [];

  let outcome = null;
  if (kinds.includes('claim.refuted')) outcome = 'failed';
  else if (kinds.includes('claim.verified')) outcome = 'held';
  if (outcome === null) return null;

  const subjectId = event.subject_id ?? payload.id ?? null;
  if (subjectId === null || subjectId === undefined) return null;

  const happenedMs = msOrNull(event.happened_at);
  const changes = payload.changes && typeof payload.changes === 'object' ? payload.changes : {};
  const entry = changes['meta.verified_at'];
  const declaredMs = entry && typeof entry === 'object' && !Array.isArray(entry)
    ? msOrNull(entry.to)
    : null;

  let at;
  if (declaredMs !== null && happenedMs !== null) at = Math.min(declaredMs, happenedMs);
  else if (happenedMs !== null) at = happenedMs;
  else if (declaredMs !== null) at = declaredMs;
  else return null;   // nothing places this check in time; it cannot move S

  // `intent` DECLARES deliberateness (the verify route sets it; an incidental
  // PATCH does not). It is an AUDIT fact, never a policy input: the spacing
  // term already neutralises incidental inflation — five re-writes 60 s apart
  // buy 0.001 days of stability — so nothing below branches on it.
  const deliberate = payload.intent === 'claim.verified' || payload.intent === 'claim.refuted';

  return { subjectId: Number(subjectId), at, outcome, deliberate };
}

// ── the fold ────────────────────────────────────────────────────────────────

export function emptyStability() {
  return { atSeq: 0, byNode: {} };
}

// The per-node transition. Pure: `prev` is read, never written — the caller
// decides where the returned entry goes.
//
// Per-node state is a closed 6-tuple and this is a left fold, exactly like
// `foldEvents(state, events)` — which is what makes the incremental path a
// later change to the CALLER, not to the math.
function nextEntry(prev, check, p) {
  const next = prev
    ? { ...prev }
    : { s: null, held: 0, failed: 0, lastOutcome: null, lastCheckAt: null, deliberate: 0 };

  if (check.outcome === 'held') {
    if (next.s === null || next.lastCheckAt === null) {
      // The first hold sets the window to S_INIT EXACTLY — no clamping — so a
      // node whose only check is one legacy PATCH gets precisely its v1
      // treatment, including at `staleDays: 0`.
      next.s = p.sInitDays;
    } else {
      const d = Math.max(0, (check.at - next.lastCheckAt) / MS_PER_DAY);
      const rPrev = retrievability(d, next.s);
      next.s = Math.min(p.sMaxDays, next.s * (1 + p.growth * (1 - rPrev)));
    }
    next.held += 1;
    next.lastOutcome = 'held';
  } else {
    // A lapse collapses the window. `min(S, sInit)` first, so a claim that had
    // earned a 3000-day leash does not keep 300 days of it after failing.
    //
    // AND THE FLOOR MAY NEVER RAISE S. `sMinDays` is an absolute 1-day floor,
    // but `sInitDays` is `staleDays`, a CALLER-supplied parameter with `min: 0`.
    // Below `staleDays: 1` the floor exceeded the pre-lapse window and a FAILED
    // check came out with a LONGER leash than an unchecked node — the exact
    // inversion of what a failure means. MEASURED at staleDays 0.5, age 0.75 d:
    // failed S = 1, r = 0.923, stale = FALSE; unchecked S = 0.5, r = 0.857,
    // stale = TRUE — the failed claim dropped OUT of the frontier while its
    // untouched twin stayed in. So the lapse is clamped to be monotone
    // non-increasing in the window it starts from.
    //
    // This is a no-op for every `staleDays >= 1` — `base * 0.1 < 1 <= base`, so
    // `max` yields `sMinDays` and `min(base, sMinDays)` yields it back — which
    // covers every parameter set the design and the production sweep used.
    const cur = next.s === null ? p.sInitDays : next.s;
    const base = Math.min(cur, p.sInitDays);
    next.s = Math.min(base, Math.max(p.sMinDays, base * p.lapseFactor));
    next.failed += 1;
    next.lastOutcome = 'failed';
  }
  next.lastCheckAt = check.at;
  if (check.deliberate) next.deliberate += 1;
  return next;
}

// Apply ONE check. PURE: the state handed in is never mutated.
//
// This copies the whole node map, so folding a long series through it is
// quadratic — use foldChecks()/foldStability(), which copy the map once and
// then assign into their own copy. Measured on the largest real graph (508
// verified nodes, 1016 checks) the difference is ~300 ms per /frontier call.
export function applyCheck(state, check, params = null) {
  if (!check) return state ?? emptyStability();
  const p = withDefaults(params);
  const base = state ?? emptyStability();
  const key = String(check.subjectId);
  const next = nextEntry(base.byNode[key] ?? null, check, p);
  return { atSeq: base.atSeq, byNode: { ...base.byNode, [key]: next } };
}

// Left fold over already-extracted checks, in seq order.
//
// The checks are what `/frontier` caches, NOT the folded state: `checkFromEvent`
// takes no parameters, so one cached checks array serves every `staleDays` a
// caller may ask for, whereas a folded S depends on S_INIT and would be wrong
// the moment a caller varied it.
export function foldChecks(state, checks, params = null) {
  const base = state ?? emptyStability();
  if (!Array.isArray(checks) || checks.length === 0) return base;
  const p = withDefaults(params);
  // ONE copy of the map for the whole fold; every entry written into it is a
  // fresh object, so `state` and its entries are still untouched on return.
  const byNode = { ...base.byNode };
  for (const check of checks) {
    if (!check) continue;
    const key = String(check.subjectId);
    byNode[key] = nextEntry(byNode[key] ?? null, check, p);
  }
  return { atSeq: base.atSeq, byNode };
}

// Left fold over events in SEQ order. `atSeq` tracks the highest seq folded, so
// a caller can key a cache on it.
export function foldStability(state, events, params = null) {
  const base = state ?? emptyStability();
  if (!Array.isArray(events)) return base;
  let atSeq = base.atSeq ?? 0;
  const checks = [];
  for (const e of events) {
    const seq = Number(e?.seq);
    if (Number.isFinite(seq) && seq > atSeq) atSeq = seq;
    const check = checkFromEvent(e);
    if (check) checks.push(check);
  }
  const out = foldChecks(base, checks, params);
  return atSeq === (out.atSeq ?? 0) ? out : { atSeq, byNode: out.byNode };
}

// S for one node — `sInitDays` when the node has no checks at all, which is
// what makes a legacy `verified_at`-only node behave exactly as it does today
// even INSIDE a graph that has verification events.
export function stabilityFor(state, nodeId, params = null) {
  const p = withDefaults(params);
  const entry = state?.byNode?.[String(nodeId)] ?? null;
  if (!entry || typeof entry.s !== 'number' || !Number.isFinite(entry.s)) return p.sInitDays;
  return entry.s;
}

// The `checks` block the frontier reports per row. {0,0,0,null,null} for a node
// with no checks — which is every node on PATH A.
export function checksFor(state, nodeId) {
  const entry = state?.byNode?.[String(nodeId)] ?? null;
  if (!entry) return { held: 0, failed: 0, deliberate: 0, last_at: null, last_outcome: null };
  return {
    held: entry.held,
    failed: entry.failed,
    deliberate: entry.deliberate,
    last_at: entry.lastCheckAt === null ? null : new Date(entry.lastCheckAt).toISOString(),
    last_outcome: entry.lastOutcome,
  };
}

export const _MS_PER_DAY = MS_PER_DAY;
