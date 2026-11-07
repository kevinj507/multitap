// What it means when a person draws, changes or deletes an edge that touches
// one of the coordination engine's nodes — the pure half of choice (f) on the
// one-data-model design (Multitap er289bkv2zkcs5w6 #11334), as Kevin amended
// it on 2026-11-06 (#11339): the person is not ignored and not silently
// obeyed; they are told what the edge means, and a change with engine meaning
// travels as one of the engine's moves, so it carries their identity.
//
// Three cases:
//  1. `rests` — assumption → proposition, `required for` ("rests on"), added
//     as a new edge or removed by deleting the engine's own edge: an
//     amendment of what the proposition rests on, filed on the person's
//     authority (POST …/propositions/:id/amend {restsOn}).
//  2. `record` — an edge the engine keeps (meta.coord: a revision's
//     `supersedes`, a finding's `contradicts`, its own rests-on when the
//     change is not case 1): not changed or deleted from the canvas; the
//     server would answer 409 coordination_node, the modal says why first.
//  3. `own` — any other new edge, or change to a person's edge, touching an
//     engine node: it stays the person's and the engine won't see it; it is
//     written only once they say so. Deleting a person's own edge is theirs
//     to do without a word (`plain`).
//  And `plain` when no engine node or edge is involved.
//
// Browser: index.html hangs this on window.CoordEdges. Tests import it
// directly (tests/coord-edges.test.js).

// decide({ op, sourceKind, targetKind, purpose, engineEdge, restsOn, assumptionId })
//   op           'create' | 'change' | 'delete'
//   sourceKind   the engine kind of the edge's source node after the write
//                ('assumption', 'proposition', 'finding', …) or null for an
//                ordinary node; same for targetKind
//   purpose      the edge's purpose after the write ('required for', 'related to', …)
//   engineEdge   true when the edge being changed or deleted is the engine's (meta.coord)
//   restsOn      the proposition's current rests-on ids (case 1 only)
//   assumptionId the source assumption's engine id (case 1 only)
// Returns { case, ...}:
//   { case: 'plain' }
//   { case: 'rests', restsOn: <the list to file>, already: true }  (create of a rests-on that exists: nothing to file)
//   { case: 'rests', restsOn: <the list to file>, title, body, okText }
//   { case: 'record', title, body }
//   { case: 'own', title, body, okText }
export function decide({ op, sourceKind = null, targetKind = null, purpose = '', engineEdge = false, restsOn = [], assumptionId = null, propWords = 'the prop' } = {}) {
  const touches = !!(sourceKind || targetKind);
  if (!touches && !engineEdge) return { case: 'plain' };

  const restsShape = purpose === 'required for' && sourceKind === 'assumption' && targetKind === 'proposition';
  if (restsShape && assumptionId && (op === 'create' || (op === 'delete' && engineEdge))) {
    const now = Array.isArray(restsOn) ? restsOn.map(String) : [];
    if (op === 'create' && now.includes(assumptionId)) return { case: 'rests', restsOn: now, already: true };
    const next = op === 'create' ? [...now, assumptionId] : now.filter((x) => x !== assumptionId);
    return {
      case: 'rests',
      restsOn: next,
      title: op === 'create' ? 'Add to what the prop rests on?' : 'Remove from what the prop rests on?',
      body: `This changes what ${propWords} rests on. It will be filed as an amendment on your authority; if someone holds the prop it turns stale for them to re-plan. Continue?`,
      okText: 'File the amendment',
    };
  }

  if (engineEdge) {
    const what = purpose === 'supersedes' ? 'a revision of the prop'
      : purpose === 'contradicts' ? 'a finding'
        : purpose === 'required for' ? 'what the prop rests on'
          : 'something the engine recorded';
    return {
      case: 'record',
      title: 'The engine keeps this edge',
      body: `This edge records ${what}. To disagree, refute the finding or amend the prop; the edge itself is not ${op === 'delete' ? 'deleted' : 'changed'} here.`,
    };
  }

  if (op === 'delete') return { case: 'plain' };
  return {
    case: 'own',
    title: 'The engine has no move for this edge',
    body: `It stays yours; the engine won't see it. ${op === 'create' ? 'Draw it anyway?' : 'Change it anyway?'}`,
    okText: op === 'create' ? 'Draw it' : 'Change it',
  };
}
