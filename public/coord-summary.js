// What the panel says about a coordination node — the pure half of S2a of the
// one-data-model design (Multitap er289bkv2zkcs5w6 #11334). A coordination
// node carries the coordination engine's document under `meta.coord` (a proposition,
// a line, the engine's finding, assumption or decision); this module turns that
// document into plain-words rows the panel lists, so the canvas can show a
// proposition without calling the engine. The document the server stores has its
// credentials removed already (the store keeps them apart); nothing here is
// secret, but `token`-named keys are skipped anyway, belt and braces.
//
// Browser: index.html hangs this on window.CoordSummary. Tests import it
// directly (tests/coord-summary.test.js).

export const COORD_NOTE =
  'Kept by the coordination engine. Position and colour can change here; the statement and these ' +
  'fields change through the engine — a finding against the proposition, a decision, an amendment, a release.';

const KIND_WORDS = {
  proposition: 'Proposition — a piece of work one agent holds for a while',
  finding: "Finding — something observed that bears on the engine's propositions",
  assumption: 'Assumption — a rule the repository promises',
  decision: 'Decision — a question with a deadline and a default',
  line: 'Line — a repository branch and what is served from it',
};

export function kindWords(kind) {
  return KIND_WORDS[kind] || (kind ? String(kind) : 'Coordination record');
}

function when(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function shortSha(sha) {
  return typeof sha === 'string' && sha.length > 12 ? sha.slice(0, 12) : sha;
}

function list(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x !== '') : [];
}

// Rows for the panel: [{ label, value }], in reading order. `now` is only for
// saying whether a lease has run out; pass Date.now() in the browser.
export function summarize(coord, now = Date.now()) {
  if (!coord || typeof coord !== 'object') return [];
  const rows = [];
  const kind = typeof coord.kind === 'string' ? coord.kind : (coord.name && coord.head !== undefined ? 'line' : '');
  const add = (label, value) => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return;
    rows.push({ label, value: Array.isArray(value) ? value.join(', ') : String(value) });
  };
  add('What it is', kindWords(kind));
  add('Engine id', coord.id || coord.name);
  if (coord.status) add("Engine's status", coord.status);

  if (kind === 'proposition' || coord.lease || coord.scope) {
    const lease = coord.lease && typeof coord.lease === 'object' ? coord.lease : null;
    if (lease && lease.holder) {
      const until = when(lease.expiresAt);
      const expired = typeof lease.expiresAt === 'number' && lease.expiresAt < now;
      add('Held by', `${lease.holder}${until ? ` — until ${until}${expired ? ' (run out)' : ''}` : ''}`);
    } else if (kind === 'proposition') {
      add('Held by', 'nobody');
    }
    add('Line', coord.line);
    add('Repository', coord.repo);
    add('May change', list(coord.scope));
    const pushes = list(coord.pushes);
    if (pushes.length) add('Pushes', `${pushes.length}, last ${shortSha(pushes[pushes.length - 1])}`);
    if (coord.headSha) add('Head', shortSha(coord.headSha));
    if (coord.landing && typeof coord.landing === 'object' && coord.landing.status) {
      const files = list(coord.landing.files);
      add('Landing', `${coord.landing.status}${files.length ? ` — ${files.join(', ')}` : ''}`);
    }
    if (coord.landedSha) add('Landed as', shortSha(coord.landedSha));
    add('Contradicted by', list(coord.contradicted));
    add('Repairs', list(coord.repairs));
    add('Rests on (hedged)', list(coord.hedgeOn));
  }
  if (kind === 'finding') {
    add('Effect', coord.effect);
    add('Found by', coord.finder);
    add('Trust', coord.trust);
    add('Targets', list(coord.targets));
    add('Routed to', coord.where);
    if (coord.resolution && typeof coord.resolution === 'object') add('Resolution', coord.resolution.status || coord.resolution.cause);
  }
  if (kind === 'assumption') {
    add('Check', coord.check);
    add('Covers', list(coord.paths));
    if (coord.fixtureRun && typeof coord.fixtureRun === 'object') add('Fixtures', coord.fixtureRun.status);
    add('Superseded by', coord.supersededBy);
  }
  if (kind === 'decision') {
    add('About', coord.about);
    add('Proposition', coord.proposition);
    add('Deadline', when(coord.deadline));
    add('If nobody answers', coord.defaultAction);
    add('Answer', coord.answer);
    add('Reason', coord.reason);
  }
  if (kind === 'line') {
    add('Head', shortSha(coord.head));
    add('Served', coord.served === true ? 'yes' : coord.served === false ? 'no' : null);
    add('Inherits from', coord.from || coord.inherits);
    if (coord.landing && typeof coord.landing === 'object') add('Landing', coord.landing.status || (coord.landing.proposition ? `landing ${coord.landing.proposition}` : null));
    add('Articles', list(coord.articles));
  }
  return rows;
}

// The document for the "everything" fold-out, pretty-printed, with any
// token-named key removed (the server already keeps them out; this is the
// belt to that brace).
export function documentText(coord) {
  const strip = (v) => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) {
        if (/token/i.test(k)) continue;
        out[k] = strip(val);
      }
      return out;
    }
    return v;
  };
  try {
    return JSON.stringify(strip(coord), null, 2);
  } catch {
    return '';
  }
}
