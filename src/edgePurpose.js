// E15.A1 — pure edge `purpose` derivation. Kept dependency-free (no db, no
// express) so it's trivially unit-testable and importable without spinning up
// the DB pool. `purpose` is the canonical (and only accepted) edge field on
// writes; `type` is the derived-internal structural column the cycle/traversal
// SQL still keys off and reads still emit.

// The structural edge types (the derived-internal column). 'required for' is
// the only purpose that derives 'dependency'.
export const VALID_TYPES = ['dependency', 'related'];

// The canonical purposes (directed source → target). Grew from four to five in
// E18.4: `supersedes` (source = the SUCCESSOR, target = the fact it replaces)
// is the relation the corpus was already expressing in prose and mis-filing as
// `contradicts` — 33 candidate edges across 7 graphs, 11 of them typed
// `contradicts`, when measured. `contradicts` means they cannot both be true;
// `supersedes` means the target WAS right for its time and the source replaces
// it. Adding a purpose is a THREE-LIST edit: this array, ALL_PURPOSES in
// src/planRegions.js, and the edges_purpose_valid CHECK in db/schema.sql
// (widened IN PLACE — see the comment there, an appended widening is a
// boot-killer).
export const EDGE_PURPOSES = ['required for', 'supports', 'contradicts', 'related to', 'supersedes'];
export const DEFAULT_PURPOSE = 'related to';

// ONE rendering of the vocabulary for every error message. It used to be typed
// out twice here and a third time in src/routes/edges.js — which is exactly how
// a vocabulary drifts: the list grows and one of the copies keeps telling
// callers the old truth.
const PURPOSE_LIST = EDGE_PURPOSES.map((p) => `'${p}'`).join(', ');
export const PURPOSE_REQUIRED_ERROR = `purpose is required (one of ${PURPOSE_LIST})`;
export const PURPOSE_ERROR = `purpose must be one of ${PURPOSE_LIST}`;

// `supersedes` needs NO branch here and must never get one: it derives
// 'related', which is what this already returns for everything that is not
// 'required for'. Deriving 'dependency' would silently make "B supersedes A"
// mean "B is a prerequisite of A" — A un-ready until B is done — and would make
// a legitimate revert chain (B supersedes A, later A' supersedes B) get
// REJECTED as a cycle by the transactional cycle check.
export function purposeToType(purpose) {
  return purpose === 'required for' ? 'dependency' : 'related';
}

// Resolve the canonical purpose + derived type from a write body. `purpose` is
// REQUIRED on every write (create / bulk / batch / patch); a legacy `type` is
// no longer accepted as input. Returns { purpose, type } or { error }.
export function resolveEdgeKind(body = {}) {
  const purpose = body.purpose;
  if (purpose === undefined || purpose === null) {
    return { error: PURPOSE_REQUIRED_ERROR };
  }
  if (!EDGE_PURPOSES.includes(purpose)) {
    return { error: PURPOSE_ERROR };
  }
  return { purpose, type: purposeToType(purpose) };
}
