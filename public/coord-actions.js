// Which of the coordination engine's actions a person may take on a node —
// the pure half of S2b of the one-data-model design (Multitap
// er289bkv2zkcs5w6 #11334). The engine's routes that steer work are the
// owner's: answer a decision, verify or refute a finding, recheck, reopen or
// land a claim. (Filing a finding is a claim holder's act — it needs a lease —
// and there is no amendment of a claim's statement; see the design node.) The
// canvas calls these routes with its own session, which the engine accepts
// since S3; the server answers 401/403 when the person may not.
//
// Browser: index.html hangs this on window.CoordActions. Tests import it
// directly (tests/coord-actions.test.js).

const ANSWERS = ['continue-investigation', 'park-investigation'];

// actionsFor returns [{ id, label, path, method, body?, ask?, hint }] for the
// document of a coordination node. `path` is relative to /api/graphs/<gid>.
export function actionsFor(coord) {
  if (!coord || typeof coord !== 'object') return [];
  const kind = typeof coord.kind === 'string' ? coord.kind : '';
  const id = typeof coord.id === 'string' ? coord.id : '';
  const out = [];
  if (kind === 'claim' && id) {
    const st = coord.status;
    if (st === 'done') {
      out.push({ id: 'land', label: 'Land it', method: 'POST', path: `/claims/${id}/land`, hint: 'merge the finished claim into its line, through the checks' });
    }
    // Reopen is for a finished claim whose landing was given up on (platform
    // errors) or that waits on a broken line — the engine refuses it otherwise.
    const landing = coord.landing && typeof coord.landing === 'object' ? coord.landing.status : null;
    if (st === 'done' && (landing === 'failed' || landing === 'error' || landing === 'blocked' || landing === 'conflict')) {
      out.push({ id: 'reopen', label: 'Send it back', method: 'POST', path: `/claims/${id}/reopen`, hint: 'back to the ready set, for an agent to take up again' });
    }
    if (st === 'claimed' || st === 'done' || st === 'landed') {
      out.push({ id: 'recheck', label: 'Run the checks again', method: 'POST', path: `/claims/${id}/recheck`, hint: 'the gate checks the claim\'s latest push once more' });
    }
    // The owner's two direct moves (D12). "Say it is wrong" files a finding on
    // the person's authority — verified at once — against an assumption the
    // claim rests on, located in this claim; it needs that assumption's id,
    // which the panel asks for when the claim rests on more than one.
    // "Amend" changes the claim's words; a held claim turns stale and its
    // holder re-plans against them.
    if (st === 'open' || st === 'claimed' || st === 'stale') {
      out.push({ id: 'amend', label: 'Amend', method: 'POST', path: `/claims/${id}/amend`, ask: 'statement', hint: 'change what the claim says; the holder re-plans against it' });
      out.push({ id: 'finding', label: 'Say it is wrong', method: 'POST', path: '/findings/owner', ask: 'finding', body: { effect: 'contradicts', where: [id] }, hint: 'a finding on your authority: an assumption this claim rests on fails here; a held claim turns stale for its holder to re-plan, an open one carries the finding for whoever takes it up' });
    }
  }
  if (kind === 'finding' && id) {
    const st = coord.status;
    if (st === 'unverified') {
      out.push({ id: 'verify', label: 'Confirm it', method: 'POST', path: `/findings/${id}/verify`, hint: 'the finding holds; claims it contradicts turn stale' });
      out.push({ id: 'refute', label: 'Refute it', method: 'POST', path: `/findings/${id}/refute`, hint: 'the finding is wrong; nothing it touched changes' });
    }
  }
  if (kind === 'decision' && id && coord.status !== 'done') {
    for (const a of ANSWERS) {
      out.push({
        id: `answer:${a}`,
        label: a === 'continue-investigation' ? 'Answer: continue' : 'Answer: park it',
        method: 'POST',
        path: `/decisions/${id}/answer`,
        body: { answer: a },
        ask: 'reason',
        hint: a === 'continue-investigation' ? 'keep investigating; the claims it holds up go on' : 'park the investigation; the default action stands',
      });
    }
  }
  return out;
}

// A one-line plain-words message for an engine error body ({error, message}).
export function errorWords(status, body) {
  const msg = body && typeof body === 'object' && typeof body.message === 'string' ? body.message : '';
  if (status === 401 || status === 403) return 'You may not do that on this graph' + (msg ? ` (${msg})` : '');
  if (status === 404) return 'The engine does not know this graph or record';
  if (status === 409) return 'The engine refused: ' + (msg || 'the record is not in a state for this');
  if (status >= 500) return 'The engine could not do it right now' + (msg ? ` (${msg})` : '');
  return msg || `The engine answered ${status}`;
}
