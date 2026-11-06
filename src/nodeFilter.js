// Node filter shared by the read routes — requirement R1 of the one-data-model
// design (Multitap graph er289bkv2zkcs5w6, node 11334; Kevin, 2026-11-06):
//
//   "any time we need to query the graph we should have the ability to filter
//    and make specific queries that only address parts of the graph, so this
//    coordination stuff if we don't want to include in a query about the graph
//    it won't get included"
//
// Three knobs, each optional, read from the query string (GET routes) or the
// body (POST /structure):
//
//   types=a,b          keep only nodes whose `meta.type` is one of these
//   exclude_types=a,b  drop nodes whose `meta.type` is one of these (a node
//                      with no type is never dropped by this knob)
//   coord=include|exclude|only
//                      the coordination engine's nodes — claims, lines, the
//                      engine's findings, assumptions and decisions — are the
//                      nodes that carry a `meta.coord` document. The MARKER IS
//                      THE DOCUMENT, NOT THE TYPE: `finding` and `decision`
//                      are ordinary node types in daily use, so a type-based
//                      filter could not tell a person's decision from the
//                      engine's. Default `include`, so every existing client
//                      sees exactly what it saw before; the canvas asks for
//                      `exclude` by default (a knowledge graph or a research
//                      graph never has such nodes and must never show them).
//
// The SQL fragments filter RESULT ROWS ONLY. They must never move into a
// recursive prerequisite walk (/ready): dropping a filtered PREREQUISITE from
// that walk would treat it as satisfied and silently auto-unblock its
// dependents — the same locked rule that keeps the superseded and dormant
// exclusions out of the CTE. A filtered prerequisite still blocks.

export const COORD_MODES = Object.freeze(['include', 'exclude', 'only']);
export const COORD_META_KEY = 'coord';

const MAX_TYPES = 50;
const MAX_TYPE_LEN = 64;

function listOf(raw) {
  // Accepts "a,b", ["a","b"], or a repeated query key (["a,b","c"]).
  const parts = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const p of parts) {
    if (p === undefined || p === null) continue;
    if (typeof p !== 'string') return { error: 'must be a comma-separated string or an array of strings' };
    for (const t of p.split(',')) {
      const s = t.trim();
      if (s === '') continue;
      if (s.length > MAX_TYPE_LEN) return { error: `a type name is longer than ${MAX_TYPE_LEN} characters` };
      if (!out.includes(s)) out.push(s);
    }
  }
  if (out.length > MAX_TYPES) return { error: `at most ${MAX_TYPES} types` };
  return { value: out };
}

// Parse the three knobs off a query object or a body object. Returns
// `{ error }` for a 400 or `{ value }` with { types, excludeTypes, coord }.
// An absent knob is `null` (types) or 'include' (coord); `isEmpty` says
// whether anything was asked for at all, so callers can skip work.
export function parseNodeFilter(src) {
  const q = src && typeof src === 'object' ? src : {};
  const types = listOf(q.types);
  if (types.error) return { error: `types ${types.error}` };
  const excl = listOf(q.exclude_types);
  if (excl.error) return { error: `exclude_types ${excl.error}` };
  let coord = 'include';
  if (q.coord !== undefined && q.coord !== null && q.coord !== '') {
    if (typeof q.coord !== 'string' || !COORD_MODES.includes(q.coord)) {
      return { error: `coord must be one of ${COORD_MODES.join(', ')}` };
    }
    coord = q.coord;
  }
  const value = {
    types: types.value.length ? types.value : null,
    excludeTypes: excl.value.length ? excl.value : null,
    coord,
  };
  value.isEmpty = value.types === null && value.excludeTypes === null && coord === 'include';
  return { value };
}

// SQL for the filter against the tasks table aliased `alias`. Parameters are
// appended to `params` (an array the caller is building) and referenced by
// position, so the fragment composes with any existing query. Returns '' when
// the filter asks for nothing.
export function nodeFilterSql(filter, alias, params) {
  if (!filter || filter.isEmpty) return '';
  const a = alias ? `${alias}.` : '';
  const clauses = [];
  if (filter.types) {
    params.push(filter.types);
    clauses.push(`${a}meta->>'type' = ANY($${params.length}::text[])`);
  }
  if (filter.excludeTypes) {
    params.push(filter.excludeTypes);
    clauses.push(`COALESCE(${a}meta->>'type', '') <> ALL($${params.length}::text[])`);
  }
  if (filter.coord === 'exclude') clauses.push(`NOT (${a}meta ? '${COORD_META_KEY}')`);
  else if (filter.coord === 'only') clauses.push(`(${a}meta ? '${COORD_META_KEY}')`);
  return clauses.length ? ` AND ${clauses.join(' AND ')}` : '';
}

// The same filter over rows already in hand (as-of snapshots, which are folded
// from the event log rather than read from the table). `node.meta` is the
// parsed meta object.
export function isCoordNode(meta) {
  return !!(meta && typeof meta === 'object' && Object.prototype.hasOwnProperty.call(meta, COORD_META_KEY));
}

export function nodePassesFilter(node, filter) {
  if (!filter || filter.isEmpty) return true;
  const meta = node && typeof node.meta === 'object' && node.meta !== null ? node.meta : {};
  const type = typeof meta.type === 'string' ? meta.type : null;
  if (filter.types && (type === null || !filter.types.includes(type))) return false;
  if (filter.excludeTypes && type !== null && filter.excludeTypes.includes(type)) return false;
  const coord = isCoordNode(meta);
  if (filter.coord === 'exclude' && coord) return false;
  if (filter.coord === 'only' && !coord) return false;
  return true;
}

// Apply the filter to a { nodes, links } payload: nodes are filtered, and a
// link survives only when both of its ends do.
export function filterGraphPayload(payload, filter) {
  if (!filter || filter.isEmpty) return payload;
  const nodes = (payload.nodes ?? []).filter((n) => nodePassesFilter(n, filter));
  const alive = new Set(nodes.map((n) => n.id));
  const links = (payload.links ?? []).filter((l) => alive.has(l.source) && alive.has(l.target));
  return { ...payload, nodes, links };
}
