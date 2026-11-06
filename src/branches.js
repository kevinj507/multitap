// E18.5 — decision branch points: the pure half.
//
// ONE new piece of vocabulary in the whole rung, and it is an EDGE:
//
//     D --related to--> O   with   meta.branch = { role: 'chosen' | 'alternative' }
//
// Everything else is DERIVED, never stored:
//
//   branch(O)   = O plus everything reachable forward from O over `required for`
//   overlay     = foldEvents(base, the events of that closure) — implemented as a
//                 projection of a state graphAsOf already built, which is the
//                 same value (see overlayFrom / overlayEvents below)
//   dormant     = in an un-chosen option's closure, in NO chosen option's
//                 closure, under a decision that is CURRENTLY committed
//   contingency = the same forward walk rooted at the decision instead of at an
//                 option
//
// PURE MODULE, the src/supersession.js / src/doubt.js / src/edgePurpose.js house
// rule: no `pg`, no `src/db.js`, no express. The one import is `./doubt.js`,
// itself pure, and importing it is the point — the contingency walk IS E18.3's
// layered walk, not a second copy of it.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY AN EDGE AND NOT A NEW KIND, A NEW PURPOSE, OR A NODE META KEY
//
// * No new event kind. `decision.made` / `decision.reopened` already exist and
//   are classified from `meta.decided_at` being set vs cleared, so
//   tests/e18-classify-parity.test.js and the `events_kind_valid` CHECK are
//   untouched, and the 55P04 enum trap is not approached at all. Tagging is
//   recorded by EXISTING capture: `edge.added` carries `after.meta.branch`, and
//   a role flip is `edge.patched` (`branch` is not in EDGE_SEMANTIC_KEYS —
//   correct: it is neither a rewire nor a retype).
//
// * `related to` derives type='related' (purposeToType), so an option edge is
//   STRUCTURALLY INERT by construction: it is not type='dependency' so it never
//   enters /ready's or /blockers' prereq CTEs; it is not in TRAVERSAL_PURPOSES
//   so it conducts no doubt; it is not in ('required for','supports') so
//   /decisions/at-risk cannot read an option as a GROUND (an alternative's
//   staleness putting its own decision at risk would be a false alarm by
//   construction); and it is not `supersedes`, so it touches no worldline.
//
// * Direction is decision → option. /decisions/at-risk's grounds CTE joins
//   `d.id = e.target_id`, so an option wired INTO the decision would be read as
//   a ground the moment anyone retyped the edge. Pointing outward keeps that
//   mis-retype benign.
//
// * NOT a node-meta list of ids (`meta.alternatives: [...]`): a jsonb array has
//   no foreign key, node deletion cascades edges but cannot reach it, and a
//   deleted option would leave a dangling id that `toGraphPayload` has no rule
//   for. NOT a new purpose either: that is the documented three-list edit plus a
//   CHECK widening, and it would add a traversable token to every vocabulary
//   that enumerates purposes — backwards for a relation that must be inert.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY MEMBERSHIP IS DERIVED AND NOT A PER-NODE TAG
//
// Shared substrate (requirements, findings) fans INTO the options, so it is
// UPSTREAM of them and appears in no option's forward closure — it stays live
// automatically, with no tagging labour. A per-node `meta.worldline` tag gets
// this wrong by construction: a shared requirement would need two tags and the
// second writer would overwrite the first. Derivation also makes dormancy a
// FUNCTION OF TIME — it reads the edge set, which graphAsOf reconstructs for any
// (axis, asOf, known) rectangle — exactly as E18.4 made supersession a function
// of the edge set rather than a flag on the row.

import {
  DEFAULT_CHAIN_LIMIT,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  DEFAULT_MAX_RESULTS,
  MAX_PROPAGATION,
  buildAdjacency,
  byNode,
  chainFor,
  layeredWalk,
} from './doubt.js';

// ── the vocabulary ───────────────────────────────────────────────────────────

export const BRANCH_META_KEY = 'branch';
// The option relation. Already legal; the CHECK on `edges.purpose` is untouched.
export const BRANCH_PURPOSE = 'related to';
// What a branch is made of. `supports` is deliberately NOT traversed: a finding
// that supports an option is evidence ABOUT it, not work UNDER it, and a shared
// finding would otherwise be dragged into a branch and go dormant.
export const CLOSURE_PURPOSE = 'required for';
export const ROLES = Object.freeze(['chosen', 'alternative']);

export const BRANCH_SHAPE_ERROR = 'branch must be an object';
export const BRANCH_ROLE_ERROR =
  `branch.role must be one of ${ROLES.map((r) => `'${r}'`).join(', ')}`;
export const BRANCH_KEY_ERROR = (key) => `branch may not carry '${key}'`;

// The write-side validator, in the house `{value}` / `{error}` shape.
//
// `role` is nested under `branch` rather than being a bare `branch: 'chosen'`
// so a later rung can add `branch.label` (a worldline name) or
// `branch.rejected_reason` without a second key or a type change — the same
// reason `meta.curve` grew from a bare number to `{distance, weight}`.
//
// An unknown key is a 400 and NEVER a coercion or a silent drop: edge meta is an
// ALLOWLIST (normalizeMeta builds a fresh object), so anything this function
// does not copy disappears with a 200 and no error anywhere.
export function normalizeBranch(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: BRANCH_SHAPE_ERROR };
  }
  for (const key of Object.keys(raw)) {
    if (key !== 'role') return { error: BRANCH_KEY_ERROR(key) };
  }
  if (!ROLES.includes(raw.role)) return { error: BRANCH_ROLE_ERROR };
  return { value: { role: raw.role } };
}

// ── reading the tag off an edge set ──────────────────────────────────────────

function numOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function linkSource(link) {
  return numOrNull(link?.source ?? link?.source_id);
}

function linkTarget(link) {
  return numOrNull(link?.target ?? link?.target_id);
}

// The role asserted by ONE link, or null when the link is not an option edge.
// A link whose purpose is anything but `related to`, or whose `meta.branch` is
// absent or malformed, is not an option — a reader must never guess.
export function branchRoleOf(link) {
  if (!link || link.purpose !== BRANCH_PURPOSE) return null;
  const meta = link.meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const branch = meta[BRANCH_META_KEY];
  if (!branch || typeof branch !== 'object' || Array.isArray(branch)) return null;
  return ROLES.includes(branch.role) ? branch.role : null;
}

// Every option edge in an edge set, optionally narrowed to one decision.
// `links` is a `/graph` payload's `links` array (or any {source, target,
// purpose, meta} rows) — so this answers for ANY rectangle graphAsOf can build,
// not only for head.
export function optionsFromLinks(links, decisionId = null) {
  const want = decisionId === null || decisionId === undefined ? null : Number(decisionId);
  const out = [];
  for (const link of links ?? []) {
    const role = branchRoleOf(link);
    if (role === null) continue;
    const decision = linkSource(link);
    const node = linkTarget(link);
    if (decision === null || node === null) continue;
    if (want !== null && decision !== want) continue;
    out.push({
      edge_id: numOrNull(link.id ?? link.edge_id),
      decision_id: decision,
      node_id: node,
      role,
    });
  }
  out.sort((a, b) => a.decision_id - b.decision_id || a.node_id - b.node_id);
  return out;
}

// ── the closure ──────────────────────────────────────────────────────────────

// source -> [target] over `required for` only. Built once per call site so a
// graph with a dozen options does not rebuild it a dozen times.
export function closureAdjacency(links, purpose = CLOSURE_PURPOSE) {
  const adjacency = new Map();
  for (const link of links ?? []) {
    if (link?.purpose !== purpose) continue;
    const source = linkSource(link);
    const target = linkTarget(link);
    if (source === null || target === null) continue;
    const held = adjacency.get(source);
    if (held) held.push(target);
    else adjacency.set(source, [target]);
  }
  for (const list of adjacency.values()) list.sort((a, b) => a - b);
  return adjacency;
}

// branch(O): O plus everything forward-reachable over `required for`.
//
// The visited set is mandatory even though `required for` derives
// type='dependency' and IS cycle-checked on the write path: a cycle written
// before that check existed, or one a future rung allows, must degrade to a
// short answer and never to an infinite loop on a READ path. Same posture as
// src/supersession.js's walks.
export function closureFrom(adjacency, rootId) {
  const root = Number(rootId);
  const seen = new Set();
  if (!Number.isFinite(root)) return seen;
  seen.add(root);
  let frontier = [root];
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      for (const target of adjacency.get(node) ?? []) {
        if (seen.has(target)) continue;
        seen.add(target);
        next.push(target);
      }
    }
    frontier = next;
  }
  return seen;
}

export function branchClosure(links, rootId) {
  return closureFrom(closureAdjacency(links), rootId);
}

// ── dormancy ─────────────────────────────────────────────────────────────────

// The decisions a rectangle's NODE set shows as currently committed. The test is
// `meta.decided_at` being set, which is EXACTLY what gt_classify_node reads to
// emit `decision.made` vs `decision.reopened` — so "committed" here and
// "committed" in the log are one definition. `type: 'decision'` is deliberately
// NOT required: the commitment is the scalar, and a decision that never carried
// the type would otherwise silently stop making its alternatives dormant.
export function committedDecisionIds(nodes) {
  const out = new Set();
  for (const node of nodes ?? []) {
    const meta = node?.meta;
    if (!meta || typeof meta !== 'object') continue;
    const decidedAt = meta.decided_at;
    if (decidedAt === null || decidedAt === undefined || decidedAt === '') continue;
    const id = numOrNull(node.id);
    if (id !== null) out.add(id);
  }
  return out;
}

// FOLD FORM, for any rectangle. Returns BOTH sets, because the derivation has
// one genuinely surprising outcome and a view that applied it silently would be
// unexplainable:
//
//   * `dormant`   — in some alternative's closure and in NO chosen closure.
//   * `contested` — reachable from an alternative AND from a chosen option.
//                   LIVE WINS. The work is needed either way, so calling it
//                   dormant would hide real work; naming it is what makes the
//                   rule legible.
//
// `committed` is the id set from committedDecisionIds(). An option under a
// REOPENED decision contributes nothing — reopening reactivates the branch
// point, so nothing under it is dormant. That is a derivation moving, not a
// status flipping: no row changes, and re-deciding moves it back.
export function dormantIds(links, committed) {
  const committedSet = committed instanceof Set
    ? committed
    : new Set([...(committed ?? [])].map(Number));
  const adjacency = closureAdjacency(links);
  const alternative = new Set();
  const chosen = new Set();
  for (const option of optionsFromLinks(links)) {
    if (!committedSet.has(option.decision_id)) continue;
    const into = option.role === 'chosen' ? chosen : alternative;
    for (const id of closureFrom(adjacency, option.node_id)) into.add(id);
  }
  const dormant = new Set();
  const contested = new Set();
  for (const id of alternative) {
    if (chosen.has(id)) contested.add(id);
    else dormant.add(id);
  }
  return { dormant, contested, alternative, chosen };
}

// HEAD FORM. The live tables ARE the fold at head (the standing diffFoldVsLive
// fsck is the proof of that), so /ready runs this and is exact for "now". A test
// pins that this and dormantIds() return the same set at head — exactly as
// src/supersession.js already does for notSupersededSql / supersededIds.
//
// Two recursive terms, both plain `UNION`-dedup, which is the house idiom and
// terminates on its own. NO depth column and NO path array, and that is measured
// rather than assumed: a path-carrying CTE over a 1204-node / 14-deep graph grew
// ~3x per hop (109 303 rows at depth<8, 252 ms) and did not finish at depth<12,
// while a depth-CARRYING UNION variant looked cheap (3.8 ms) and silently
// returned 1103 of 1203 nodes because its guard cut the walk short with no flag.
export function dormantCteSql(graphParam = '$1') {
  return `WITH RECURSIVE gt_branch_opt AS (
           SELECT e.target_id AS id, e.meta -> '${BRANCH_META_KEY}' ->> 'role' AS role
             FROM edges e
             JOIN tasks d ON d.id = e.source_id AND d.graph_id = ${graphParam}
            WHERE e.graph_id = ${graphParam}
              AND e.purpose = '${BRANCH_PURPOSE}'
              AND e.meta ? '${BRANCH_META_KEY}'
              AND e.meta -> '${BRANCH_META_KEY}' ->> 'role'
                  IN (${ROLES.map((r) => `'${r}'`).join(', ')})
              -- The empty-string test as well as NOT NULL, so this agrees with
              -- committedDecisionIds() on an empty scalar, which is neither a
              -- commitment nor a JSON null. The two forms are pinned equal at
              -- head by tests/e18-ready-dormant.test.js.
              AND d.meta ->> 'decided_at' IS NOT NULL
              AND d.meta ->> 'decided_at' <> ''
         ),
         gt_branch_alt AS (
           SELECT id FROM gt_branch_opt WHERE role = 'alternative'
           UNION
           SELECT e.target_id
             FROM edges e JOIN gt_branch_alt a ON e.source_id = a.id
            WHERE e.graph_id = ${graphParam} AND e.purpose = '${CLOSURE_PURPOSE}'
         ),
         gt_branch_chosen AS (
           SELECT id FROM gt_branch_opt WHERE role = 'chosen'
           UNION
           SELECT e.target_id
             FROM edges e JOIN gt_branch_chosen c ON e.source_id = c.id
            WHERE e.graph_id = ${graphParam} AND e.purpose = '${CLOSURE_PURPOSE}'
         )
         SELECT id FROM gt_branch_alt
         EXCEPT
         SELECT id FROM gt_branch_chosen`;
}

// The /ready term. UNCORRELATED on purpose — the sub-select names no outer
// column, so Postgres evaluates it once as an InitPlan rather than per row.
export function notDormantSql(alias, graphParam = '$1') {
  return `${alias}.id NOT IN (${dormantCteSql(graphParam)})`;
}

// ── overlays ─────────────────────────────────────────────────────────────────

function idSet(ids) {
  if (ids instanceof Set) return ids;
  return new Set([...(ids ?? [])].map(Number));
}

// THE DEFINITION. E18.1 fixed the signature — "an overlay is
// foldEvents(baseState, arbitraryEventList)" — and `foldEvents` applies events
// in the order given and does not sort, which is what makes an arbitrary list
// legal. This is that list: node events whose subject is in the branch, and edge
// events BOTH of whose endpoints are in it.
//
// An edge event's endpoints come from its own payload: `after` on an INSERT, the
// `endpoints` block E18.4 added to every edge UPDATE, `before` on a DELETE. An
// event that names no endpoints at all cannot be placed in or out of the branch
// and is left OUT — a projection may not invent membership.
export function overlayEvents(events, ids) {
  const set = idSet(ids);
  const out = [];
  for (const event of events ?? []) {
    if (event?.subject_kind === 'edge') {
      const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
      const from = payload.after ?? payload.endpoints ?? payload.before ?? null;
      const source = numOrNull(from?.source_id ?? from?.source);
      const target = numOrNull(from?.target_id ?? from?.target);
      if (source === null || target === null) continue;
      if (set.has(source) && set.has(target)) out.push(event);
      continue;
    }
    const subject = numOrNull(event?.subject_id ?? event?.payload?.id);
    if (subject !== null && set.has(subject)) out.push(event);
  }
  return out;
}

// THE IMPLEMENTATION — a projection of a state graphAsOf has ALREADY built, so
// an overlay costs NO EXTRA SQL.
//
// The two are the same value. `applyToIndex` touches exactly one record, keyed
// by the event's own subject id, so the fold is PER-SUBJECT INDEPENDENT:
// filtering the event list by subject is the same as filtering the resulting
// state by subject. tests/e18-overlay.test.js pins that equality by canonical
// JSON, which is the only thing stopping the cheap path drifting from the
// definition above.
//
// THE CAVEAT THE SAME TEST PINS: edges whose endpoints left the set MUST be
// dropped. A "naive" projection that keeps every edge is NOT equal — it retains
// danglers — and that drop is the rule `filterGenesisByHappened` and
// `toGraphPayload` already apply everywhere else.
//
// Shape in, shape out: a fold state ({v, nodes, edges}) projects to a fold
// state; a `/graph` payload ({nodes, links}) projects to a payload.
export function overlayFrom(state, ids) {
  const set = idSet(ids);
  const nodes = (state?.nodes ?? []).filter((n) => set.has(Number(n?.id)));
  const alive = new Set(nodes.map((n) => Number(n.id)));
  const isFoldState = Array.isArray(state?.edges);
  const edges = (isFoldState ? state.edges : (state?.links ?? [])).filter(
    (e) => alive.has(linkSource(e)) && alive.has(linkTarget(e)),
  );
  return isFoldState
    ? { v: state?.v ?? 1, nodes, edges }
    : { nodes, links: edges };
}

// What the "what if we had chosen B" view is ALLOWED to say.
//
// It reports the nodes and edges ACTUALLY RECORDED under an option — real ids,
// backed by real events — and nothing else. When a branch was never explored the
// answer is `empty: true, node_count: 0` plus a reason, NOT a projected plan,
// not a mirrored copy of the chosen branch with the names swapped, not an
// estimate. `fabricated` is a CONSTANT false rather than a computed flag,
// because there is no code path in this rung that invents a node: a road not
// taken has a RECORD, not an OUTCOME.
export const OVERLAY_EMPTY_REASON = 'no work was ever recorded under this option';

// `anchorId` is the option node itself, which is a member of its own closure.
// `empty` is keyed on the WORK — the nodes other than the anchor — because "the
// option node exists and nothing was ever recorded under it" is exactly the road
// not taken, and reporting `empty: false` there on the strength of the anchor's
// own existence would be the view dressing up one tag as evidence of a plan.
export function overlaySummary(state, ids, extra = {}) {
  const anchorId = extra.option_id === undefined ? null : Number(extra.option_id);
  const projected = overlayFrom(state, ids);
  const edges = projected.edges ?? projected.links ?? [];
  const nodeIds = projected.nodes.map((n) => Number(n.id)).sort((a, b) => a - b);
  const workCount = nodeIds.filter((id) => id !== anchorId).length;
  const empty = workCount === 0 && edges.length === 0;
  return {
    ...extra,
    node_ids: nodeIds,
    edge_ids: edges.map((e) => Number(e.id)).sort((a, b) => a - b),
    node_count: nodeIds.length,
    edge_count: edges.length,
    work_count: workCount,
    basis: 'log-projection',
    fabricated: false,
    empty,
    ...(empty ? { reason: OVERLAY_EMPTY_REASON } : {}),
    truncated: false,
  };
}

// ── the contingency closure ──────────────────────────────────────────────────

// Reopening D puts everything downstream of it back in play. The SET is the
// closure above; HOPS and CHAINS use E18.3's layered walk, unchanged.
//
// With every weight equal to 1 the max-product relaxation DEGENERATES TO
// BREADTH-FIRST SEARCH: the first time a node is reached is its minimum hop
// count, `prev.w >= nw - EPS` fires on every later arrival, and E18.3's
// termination proof carries over verbatim (weights in (0,1], a cycle can never
// strictly improve). Omitting `supports` from the weight map is what makes the
// walk skip it — `if (!(ew > MIN_PROPAGATION)) continue`.
// THE OPTION EDGE IS THE FIRST HOP, and that is not a convenience — it is
// forced by the shape of the data. `edges` carries UNIQUE(source_id, target_id),
// so the D->O pair is OCCUPIED by the `related to` option edge: a decision
// CANNOT also be wired to its own option by `required for` (409). A walk over
// `required for` alone therefore leaves a decision's blast radius EMPTY whenever
// the options are its only wiring, which is the normal case. Reopening D puts
// every option and everything under it back in play, so the option edge is
// traversed exactly once, at the root.
//
// `related to` is in this map, so THE ADJACENCY IS THE FILTER: contingencyLinks()
// admits ONLY this decision's own option edges, never `related to` at large.
export const CONTINGENCY_WEIGHTS = Object.freeze({
  [CLOSURE_PURPOSE]: MAX_PROPAGATION,
  [BRANCH_PURPOSE]: MAX_PROPAGATION,
});

// The edge slice a contingency walk may see: every `required for` edge, plus the
// option edges of THIS decision and no others.
export function contingencyLinks(links, decisionId) {
  const optionEdges = new Set(
    optionsFromLinks(links, decisionId).map((o) => o.edge_id).filter((id) => id !== null),
  );
  return (links ?? []).filter(
    (l) => l?.purpose === CLOSURE_PURPOSE || optionEdges.has(Number(l?.id ?? l?.edge_id)),
  );
}

// The walk is keyed by (node, trigger); contingency has exactly one root, so it
// has exactly one trigger and this is its id.
export const CONTINGENCY_TRIGGER = 0;

// CONTINGENCY IS STRUCTURAL, NOT DOUBT-WEIGHTED, so a per-edge
// `meta.propagation` must not attenuate it: an edge declared to conduct 0.3 of a
// doubt still makes its target fully contingent on the decision. buildAdjacency
// prefers `edge.propagation` over the purpose weight, so the column is blanked
// here rather than the preference being re-litigated inside the walk.
export function contingencyAdjacency(edgeRows) {
  return buildAdjacency((edgeRows ?? []).map((row) => ({
    id: row.id ?? row.edge_id ?? null,
    source_id: row.source_id ?? row.source,
    target_id: row.target_id ?? row.target,
    purpose: row.purpose ?? null,
    propagation: null,
  })));
}

export function contingencyFrom(adjacency, root, opts = {}) {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxNodes = opts.maxNodes ?? DEFAULT_MAX_NODES;
  const maxResults = opts.maxResults ?? DEFAULT_MAX_RESULTS;
  const chainLimit = opts.chainLimit ?? DEFAULT_CHAIN_LIMIT;
  const rootId = Number(root);

  const walk = layeredWalk(
    adjacency,
    [{ node: rootId, w: MAX_PROPAGATION, seq: CONTINGENCY_TRIGGER }],
    {
      weights: CONTINGENCY_WEIGHTS,
      // Every weight is exactly 1 and propagation is blanked, so no product can
      // fall below the floor; a floor of 1 therefore filters nothing and makes
      // any future attenuation a loud failure rather than a silent short walk.
      weightFloor: MAX_PROPAGATION,
      maxDepth,
      maxNodes,
    },
  );

  const grouped = byNode(walk.best);
  const reached = [];
  for (const [id, perTrigger] of grouped) {
    if (id === rootId) continue;
    const record = perTrigger.get(CONTINGENCY_TRIGGER);
    if (!record) continue;
    reached.push({ id, hops: record.hops });
  }
  reached.sort((a, b) => a.hops - b.hops || a.id - b.id);

  // Chains are allocated ONLY for the page actually returned — never for the
  // whole reached set, and never carried in SQL, which is exactly what makes the
  // path-carrying CTE exponential.
  const page = reached.slice(0, maxResults).map((item) => ({
    ...item,
    chain: chainFor(walk.best, item.id, CONTINGENCY_TRIGGER, chainLimit),
  }));

  const stoppedBy = new Set(walk.stoppedBy);
  if (page.some((item) => item.chain.truncated)) stoppedBy.add('chain');
  if (reached.length > maxResults) stoppedBy.add('max_results');

  return {
    root: rootId,
    nodes: page,
    count: reached.length,
    truncated: walk.truncated || reached.length > maxResults,
    stopped_by: [...stoppedBy].sort(),
    walk: {
      nodes_visited: walk.nodes,
      edges_relaxed: walk.relaxed,
      max_depth_reached: walk.deepest,
    },
  };
}
