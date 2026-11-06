// E15.B1 — Mongo/Pinecone-style metadata filter DSL over node `meta`. PURE: no
// DB, no express, so it unit-tests directly and imports without the pool.
//
// A filter is a JSON object. A flat object is an implicit AND of per-field
// conditions; `$and` / `$or` take arrays of sub-filters. A field condition is
// either a bare value (implicit `$eq`) or an operator object
// `{ $gte: 0.7, $ne: "x" }`. Field keys map to node meta keys
// (confidence / significance / verified_at / type / status / …).
//
// compileFilter(filter) validates the shape ONCE and returns { match(meta) } or
// { error }. The filter is applied at READ time to choose what to SEED / RETURN
// — never during traversal (see routes/context.js bridge rule).

const COMPARATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin']);

// Order comparison. Numbers compare numerically; ISO-8601 datetime strings
// compare chronologically (parse so offsets are honored, not just lexical);
// two non-date strings compare lexically. Mixed/uncomparable types → null, so
// an order operator yields no match (Mongo-like: incomparable ⇒ false).
function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    const da = Date.parse(a);
    const db = Date.parse(b);
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da < db ? -1 : da > db ? 1 : 0;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return null;
}

function valuesEqual(a, b) {
  return a === b;
}

// A field is "present" for filter purposes when the meta key exists with a
// non-null, non-undefined value. Comparison/$in operators require presence;
// $ne / $nin are the negations and therefore match an absent field (Mongo
// semantics: "field != x" is true when the field isn't there).
function present(meta, field) {
  return (
    Object.prototype.hasOwnProperty.call(meta, field) &&
    meta[field] !== undefined &&
    meta[field] !== null
  );
}

function makeOpTest(field, op, operand) {
  switch (op) {
    case '$eq':
      return (m) => (present(m, field) ? valuesEqual(m[field], operand) : operand === null);
    case '$ne':
      return (m) => !(present(m, field) ? valuesEqual(m[field], operand) : operand === null);
    case '$gt':
      return (m) => present(m, field) && compareValues(m[field], operand) === 1;
    case '$gte':
      return (m) => present(m, field) && [0, 1].includes(compareValues(m[field], operand));
    case '$lt':
      return (m) => present(m, field) && compareValues(m[field], operand) === -1;
    case '$lte':
      return (m) => present(m, field) && [-1, 0].includes(compareValues(m[field], operand));
    case '$in':
      if (!Array.isArray(operand)) throw new Error('$in requires an array');
      return (m) => present(m, field) && operand.some((v) => valuesEqual(m[field], v));
    case '$nin':
      if (!Array.isArray(operand)) throw new Error('$nin requires an array');
      return (m) => !(present(m, field) && operand.some((v) => valuesEqual(m[field], v)));
    default:
      throw new Error(`unknown operator "${op}"`);
  }
}

function compileFieldCond(field, cond) {
  // Bare value → implicit $eq.
  if (cond === null || typeof cond !== 'object' || Array.isArray(cond)) {
    return (m) => (present(m, field) ? valuesEqual(m[field], cond) : cond === null);
  }
  const tests = [];
  for (const [op, operand] of Object.entries(cond)) {
    if (!COMPARATORS.has(op)) throw new Error(`unknown operator "${op}" for field "${field}"`);
    tests.push(makeOpTest(field, op, operand));
  }
  return (m) => tests.every((t) => t(m));
}

function compileNode(nodeFilter) {
  if (nodeFilter === null || typeof nodeFilter !== 'object' || Array.isArray(nodeFilter)) {
    throw new Error('filter must be an object');
  }
  const tests = [];
  for (const [key, val] of Object.entries(nodeFilter)) {
    if (key === '$and' || key === '$or') {
      if (!Array.isArray(val) || val.length === 0) throw new Error(`${key} requires a non-empty array`);
      const subs = val.map(compileNode);
      tests.push(key === '$and' ? (m) => subs.every((s) => s(m)) : (m) => subs.some((s) => s(m)));
    } else if (key.startsWith('$')) {
      throw new Error(`unknown top-level operator "${key}"`);
    } else {
      tests.push(compileFieldCond(key, val));
    }
  }
  // An empty object constrains nothing → matches everything.
  return (m) => tests.every((t) => t(m));
}

/**
 * Compile a filter object into a matcher. Absent/null filter → match-all.
 * @returns {{ match: (meta:object)=>boolean }} on success, or {{ error:string }}.
 */
export function compileFilter(filter) {
  if (filter === undefined || filter === null) {
    return { match: () => true };
  }
  try {
    const test = compileNode(filter);
    return { match: (meta) => test(meta || {}) };
  } catch (e) {
    return { error: e.message };
  }
}

export default { compileFilter };
