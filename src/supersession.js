// E18.4 — supersession: the pure half.
//
// `supersedes` is an ordinary edge purpose (src/edgePurpose.js), directed
// source(SUCCESSOR) → target(SUPERSEDED), deriving type='related'. Everything
// in this file is a function of an EDGE SET, and that is the whole design:
//
//   THE STATE IS THE EDGE SET, NOT A FLAG.
//
// "Is A superseded at time t?" is answered by asking whether a supersedes edge
// targeting A is in the edge set the fold reconstructed for that (axis, asOf,
// known) rectangle. Nothing is denormalised onto `tasks` — no
// `meta.superseded_at`, no `meta.superseded_by`, ever. A stored flag would be
// permanent (time travel breaks), forgeable by any PATCH (the log's
// unforgeability collapses), and would need a trigger that writes back to
// `tasks`, which E18.1 locked out. Because the predicate is over a
// reconstructed edge set, exclusion is a function of time on BOTH axes with no
// special-case code:
//
//   * learned axis, superseded later  — the edge.added has seq > S, is not in
//     the tail, is not in `links`  → not excluded. Automatic.
//   * happened axis, superseded later — happened_at > asOf, filtered by
//     HAPPENED_TAIL_SQL           → not in `links` → not excluded. Automatic.
//
// PURE MODULE: no db, no express, same rule as edgePurpose.js / planRegions.js
// / signedCycles.js / events/kinds.js.

export const SUPERSEDES = 'supersedes';

// Walk caps. UNLIKE the cause graph — a strict DAG by CHECK
// (events_cause_precedes), which provably terminates with no visited set — a
// supersedes cycle is STORABLE and legitimate: `supersedes` derives
// type='related', so it is not cycle-checked, and a revert (B supersedes A,
// later A' supersedes B, later A again) is real history. Every walk here
// therefore carries a visited set AND a cap. Stating the asymmetry loudly
// because E18.3 sits next to it and is told the opposite about causes.
export const MAX_GENERATIONS = 64;
export const MAX_WORLDLINE_NODES = 256;

// ── the exclusion predicate, in its two forms ────────────────────────────────

// HEAD form. The live `edges` table IS the fold at head (the standing
// diffFoldVsLive fsck is the proof), so /frontier, /ready and
// /decisions/at-risk run this and are exact for "now". `$1` is the graph id, by
// the house convention every one of those queries already uses. Served by the
// partial index `edges_supersedes_idx (graph_id, target_id) WHERE purpose =
// 'supersedes'` — an Index Only Scan, 2 buffers.
export function notSupersededSql(alias, graphParam = '$1') {
  return `NOT EXISTS (SELECT 1 FROM edges se
                       WHERE se.graph_id = ${graphParam} AND se.purpose = '${SUPERSEDES}'
                         AND se.target_id = ${alias}.id)`;
}

// FOLD form, for any (axis, asOf, known). Takes a `/graph` payload's `links`
// array (or any {target, purpose} rows) and returns the set of superseded node
// ids. A test pins that this and the SQL above return the same set at head.
export function supersededIds(links) {
  const out = new Set();
  for (const link of links ?? []) {
    if (link?.purpose !== SUPERSEDES) continue;
    const target = Number(link.target ?? link.target_id);
    if (Number.isFinite(target)) out.add(target);
  }
  return out;
}

// The endpoints one STRUCTURAL edge's outcome BEARS ON — "who did this happen
// to" — for a view that pairs an edge against a node.
//
// `contradicts` is SYMMETRIC: a contradiction names both ends, which is the
// either-direction rule /decisions/at-risk already applies (its `contra` CTE
// unions source_id and target_id). `supersedes` is DIRECTED, and the SUCCESSOR
// is the end nothing happened to: it did the replacing.
//
// THE DIRECTION IS NOT RESTATED HERE. It is read off supersededIds(), the one
// function that owns it, because a second copy of the semantics is exactly how
// the confrontation view came to report a surviving ground as replaced.
export function outcomeEndpoints(link) {
  if (link?.purpose === SUPERSEDES) return [...supersededIds([link])];
  const source = Number(link?.source ?? link?.source_id);
  const target = Number(link?.target ?? link?.target_id);
  return [source, target].filter((n) => Number.isFinite(n));
}

// The supersession relations in an edge set, normalised. `successor` is the
// edge's SOURCE (the replacement), `superseded` its TARGET (the fact whose
// story ended).
export function supersessionsFromLinks(links) {
  const out = [];
  for (const link of links ?? []) {
    if (link?.purpose !== SUPERSEDES) continue;
    const successor = Number(link.source ?? link.source_id);
    const superseded = Number(link.target ?? link.target_id);
    if (!Number.isFinite(successor) || !Number.isFinite(superseded)) continue;
    out.push({ edge_id: Number(link.id ?? link.edge_id ?? 0) || null, successor, superseded });
  }
  return out;
}

// ── worldlines ───────────────────────────────────────────────────────────────

function ms(value) {
  if (value === null || value === undefined) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}

// The interval-closing order, and it is deliberately the SAME KEY
// `orderEvents('happened')` uses (fold.js: happened_at, then seq). A worldline
// can therefore never order two supersessions differently from the state
// reconstruction that produced its edge set.
//
// MIN, not max: when two successors both claim a fact, the EARLIEST is the one
// that ended the story. The probe produced a real two-successor case, so this
// is not hypothetical.
function earlier(a, b) {
  if (!a) return b;
  if (!b) return a;
  const am = ms(a.opened_at);
  const bm = ms(b.opened_at);
  // A record with no readable date sorts LAST: it cannot be shown to have
  // closed the interval earlier than one that is dated.
  if (am !== bm) {
    if (am === null) return b;
    if (bm === null) return a;
    return am < bm ? a : b;
  }
  const as = a.event_seq ?? Number.MAX_SAFE_INTEGER;
  const bs = b.event_seq ?? Number.MAX_SAFE_INTEGER;
  if (as !== bs) return as < bs ? a : b;
  return (a.edge_id ?? 0) <= (b.edge_id ?? 0) ? a : b;
}

// `(valid_from ASC, event_seq ASC, id ASC)`. valid_from first because the
// earliest successor is the one that actually closed the interval; event_seq is
// the deterministic total tie-break, and it is what separates two successors of
// ONE predecessor — they share a valid_from by construction (see below).
function byGenerationOrder(a, b) {
  const am = ms(a.valid_from);
  const bm = ms(b.valid_from);
  if (am !== bm) {
    if (am === null) return 1;
    if (bm === null) return -1;
    return am - bm;
  }
  const as = a._seq ?? Number.MAX_SAFE_INTEGER;
  const bs = b._seq ?? Number.MAX_SAFE_INTEGER;
  if (as !== bs) return as - bs;
  return a.id - b.id;
}

// Build one node's worldline from a dated supersession set.
//
// `records`: [{edge_id, successor, superseded, opened_at, event_seq, via,
//              approximate}] — one per LIVE supersedes edge in the rectangle,
//             dated by the `node.superseded` event that opened it (or, for an
//             edge that predates E18.4, by `edges.created_at` with
//             `approximate: true`).
// `nodeInfo`: Map id -> {title, created_at, created_event_at}.
//
// Intervals are half-open, left-closed: `[valid_from, valid_to)`, so a
// predecessor's valid_to and its successor's valid_from are the SAME instant
// and the timeline has no gap and no overlap.
//   valid_from(gen 0) = the node's `node.created` happened_at, falling back to
//                       its row `created_at` with approximate_from: true
//                       (measured: all 4103 corpus nodes predate the log, so
//                       the fallback is the common case today and sharpens from
//                       ship day forward, exactly as history_starts_at does);
//   valid_from(gen k) = valid_to(gen k-1) — the successor's fact starts when the
//                       predecessor's ENDED, which is NOT the successor node's
//                       own created_at (that is when we wrote it down). Both
//                       are reported; neither is collapsed into the other.
//   valid_to          = the MIN over live supersessions targeting the node,
//                       or null = still open.
//
// Returns `{generations, roots, branches, merges, truncated}`. `roots` and
// `merges` exist because A WORLDLINE IS NOT ALWAYS A LINE: a merge (two facts,
// one replacement) has two roots, and both are reported at generation 0 rather
// than one being chosen and the other dropped. `truncated` covers BOTH caps —
// and the window it cuts is centred on the queried node, which is never removed.
export function buildWorldline(nodeId, records, nodeInfo = new Map(), opts = {}) {
  const maxGenerations = opts.maxGenerations ?? MAX_GENERATIONS;
  const maxNodes = opts.maxNodes ?? MAX_WORLDLINE_NODES;

  const successorsOf = new Map();   // superseded -> [record]
  const predecessorsOf = new Map(); // successor  -> [record]
  for (const r of records ?? []) {
    if (!successorsOf.has(r.superseded)) successorsOf.set(r.superseded, []);
    successorsOf.get(r.superseded).push(r);
    if (!predecessorsOf.has(r.successor)) predecessorsOf.set(r.successor, []);
    predecessorsOf.get(r.successor).push(r);
  }

  // The closing record for each node: MIN over its live supersessions.
  const closedBy = new Map();
  for (const [superseded, rs] of successorsOf) {
    let best = null;
    for (const r of rs) best = earlier(best, r);
    closedBy.set(superseded, best);
  }

  let truncated = false;

  // Walk BACK to the chain head. A node's predecessors are the TARGETS of the
  // supersedes edges it is the SOURCE of.
  //
  // DEPTH-LIMITED, and that is a fix, not an optimisation. The forward walk
  // below stops after `maxGenerations` counted from the ROOT, so on a chain
  // longer than the cap an unbounded backward walk puts the queried node PAST
  // the cut and the answer omits the very node the caller named. The window is
  // therefore CENTRED ON THE SUBJECT: at most `backLimit` generations of
  // ancestry are seeded, which leaves the subject at generation <= backLimit
  // and the remaining budget (>= half) for its descendants. Truncation may
  // shorten a worldline at either end; it may never remove its subject.
  const backLimit = Math.max(0, Math.floor((maxGenerations - 1) / 2));
  const seenBack = new Set([nodeId]);
  let backFrontier = [nodeId];
  for (let depth = 0; depth < backLimit && backFrontier.length; depth += 1) {
    const nextBack = [];
    for (const n of backFrontier) {
      for (const r of predecessorsOf.get(n) ?? []) {
        if (seenBack.has(r.superseded)) continue;      // cycle: visited set, mandatory
        if (seenBack.size >= maxNodes) { truncated = true; continue; }
        seenBack.add(r.superseded);
        nextBack.push(r.superseded);
      }
    }
    backFrontier = nextBack;
  }
  // Whatever the depth limit refused to expand is a cut, and it is reported.
  for (const n of backFrontier) {
    for (const r of predecessorsOf.get(n) ?? []) {
      if (!seenBack.has(r.superseded)) truncated = true;
    }
  }

  // ROOTS, PLURAL. A worldline is not always a line: a MERGE — two old facts
  // both superseded by one new fact — is backward-reachable from two roots, and
  // seeding the forward walk with one of them (the lowest id, say) silently
  // drops the other root and everything reachable only from it, with nothing in
  // the response saying so. Every root is seeded; `merges` names the nodes where
  // the lines join so the shape is legible rather than implied.
  //
  // A root is a backward-reached node with no predecessor INSIDE the reached
  // set — which is the same thing as "no predecessor at all" when the walk ran
  // to completion, and is also the right answer for a node the depth/node cap
  // cut off mid-ancestry. A pure cycle (A supersedes B, B supersedes A) has no
  // root, so the lowest id stands in — deterministic, and every member still
  // appears exactly once.
  const roots = [...seenBack].filter(
    (n) => !(predecessorsOf.get(n) ?? []).some((r) => seenBack.has(r.superseded)),
  );
  const seeds = (roots.length ? roots : [[...seenBack].sort((a, b) => a - b)[0]])
    .slice()
    .sort((a, b) => a - b);

  // Forward BFS, generation = depth. valid_from of a child is its PARENT's
  // valid_to, so two successors of one predecessor share a valid_from and the
  // event_seq tie-break is what orders them.
  const generations = [];
  const branches = [];
  const merges = [];
  const visited = new Set();
  let frontier = seeds.map((id) => ({ id, validFrom: null, approximateFrom: null }));
  for (let gen = 0; frontier.length > 0; gen += 1) {
    if (gen >= maxGenerations) { truncated = true; break; }
    const rows = [];
    for (const item of frontier) {
      if (visited.has(item.id)) continue;
      if (visited.size >= maxNodes) { truncated = true; break; }
      visited.add(item.id);
      const info = nodeInfo.get(item.id) ?? {};
      const close = closedBy.get(item.id) ?? null;
      const isRoot = item.validFrom === null && gen === 0;
      const validFrom = isRoot ? (info.created_event_at ?? info.created_at ?? null) : item.validFrom;
      const approximateFrom = isRoot
        ? info.created_event_at === null || info.created_event_at === undefined
        : item.approximateFrom === true;
      const validTo = close ? close.opened_at ?? null : null;
      // The two axes are allowed to disagree and the fold must not reconcile
      // them (E18.1), so a supersession BACKDATED to before the fact it ends
      // was itself recorded as starting keeps both timestamps exactly as
      // recorded — no clamp, no zero-length substitute. What is NOT allowed is
      // handing back `[later, earlier)` as if it were an ordinary interval:
      // the flag is how the output stops claiming a negative duration, and it
      // is also what explains the one place `valid_from` stops ascending from
      // one generation to the next.
      const fromMs = ms(validFrom);
      const toMs = ms(validTo);
      rows.push({
        generation: gen,
        id: item.id,
        title: info.title ?? null,
        valid_from: validFrom ?? null,
        approximate_from: approximateFrom === true,
        created_at: info.created_at ?? null,
        valid_to: validTo,
        open: close === null,
        interval_inverted: fromMs !== null && toMs !== null && toMs < fromMs,
        closed_by: close
          ? {
              edge_id: close.edge_id ?? null,
              successor: close.successor,
              event_seq: close.event_seq ?? null,
              via: close.via ?? null,
              approximate: close.approximate === true,
            }
          : null,
        _seq: close ? close.event_seq ?? null : null,
      });
    }
    rows.sort(byGenerationOrder);
    // Deduped by id: a merge node is pushed by every predecessor in this
    // generation, and the EARLIEST of their valid_to is its left edge — the
    // same MIN rule `earlier()` uses to close an interval. An unreadable date
    // sorts last, so it never wins over a dated one.
    const next = new Map();
    for (const row of rows) {
      const { _seq, ...out } = row;
      generations.push(out);
      const rs = successorsOf.get(row.id) ?? [];
      const succ = rs
        .map((r) => r.successor)
        .filter((id, i, arr) => arr.indexOf(id) === i)
        .sort((a, b) => a - b);
      if (succ.length > 1) branches.push({ generation: row.generation, id: row.id, successors: succ });
      const preds = (predecessorsOf.get(row.id) ?? [])
        .map((r) => r.superseded)
        .filter((id, i, arr) => arr.indexOf(id) === i)
        .sort((a, b) => a - b);
      if (preds.length > 1) merges.push({ generation: row.generation, id: row.id, predecessors: preds });
      for (const r of rs) {
        if (visited.has(r.successor)) continue;
        const item = {
          id: r.successor,
          // The predecessor's story ended at ITS valid_to, which is the MIN over
          // all of its supersessions — so both siblings of a branch inherit the
          // same left edge.
          validFrom: row.valid_to,
          approximateFrom: row.closed_by?.approximate === true,
        };
        const held = next.get(r.successor);
        if (!held) { next.set(r.successor, item); continue; }
        const heldMs = ms(held.validFrom);
        const itemMs = ms(item.validFrom);
        if (heldMs === null ? itemMs !== null : itemMs !== null && itemMs < heldMs) {
          next.set(r.successor, item);
        }
      }
    }
    frontier = [...next.values()];
  }

  return { generations, roots: seeds, branches, merges, truncated };
}
