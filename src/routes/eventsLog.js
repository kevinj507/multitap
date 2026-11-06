// E18.1 STEP 6 — GET /api/graphs/:gid/events?since= — the append-only log as a
// read API. Returns the graph's events in `seq` order, newest-last, one page at
// a time, so a client can poll for "what changed since I last looked" and an
// operator can read the history straight out of the API.
//
// WHY IT LIVES BEHIND THE SSE PATH INSTEAD OF ITS OWN MOUNT.
// `/api/graphs/:gid/events` is already registered on the app (src/app.js) as
// the Server-Sent-Events stream the browser opens with `EventSource`, and
// Express matches in registration order, so a router mounted at that prefix
// would never see a request. The locked spec spells the read API
// `GET /events?since=`, so rather than rename it, app.js branches to this
// handler on its FIRST line — before the connection slot is reserved and before
// any `text/event-stream` header is flushed. The browser opens the path bare,
// so the stream is untouched. `?format=json` is the escape hatch for reading
// the head of the log without passing a `since`.
//
// The gate is the one already on that line: `requireGraph('read')`. This is a
// pure read surface — it never writes, and it could not if it tried
// (`gt_events_append_only` raises 0A000 on any UPDATE or DELETE).
//
// WHY `next_since = head_seq` IS SAFE, and it is not obvious.
// `gt_next_seq()` allocates `seq` as `MAX(seq)+1` under the graphs-row lock,
// held to commit — the same lock every writer already takes via
// `bump_graph_updated_at()`. So the visible prefix is GAPLESS and
// COMMIT-ORDERED: there is no window in which seq N is visible while N-1 is
// still uncommitted. A poller that resumes from the head therefore cannot skip
// an event, and needs no settled-horizon / lagging-visibility hack.
//
// The one ordering subtlety that IS load-bearing: the head is read BEFORE the
// page, never after. Reading it after would let an event commit between the two
// queries, land above the page's last row, and be reported as `next_since` —
// silently skipping it forever. Reading it first can only UNDER-report, which
// the `Math.max` below repairs. Skipping is unrecoverable; re-delivering is not.

import pool from '../db.js';
import { EVENT_KINDS } from '../events/kinds.js';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const SUBJECT_KINDS = Object.freeze(['node', 'edge', 'graph']);

export const SINCE_ERROR = 'since must be a non-negative integer';
export const LIMIT_ERROR = `limit must be an integer between 1 and ${MAX_LIMIT}`;
export const KIND_ERROR = 'kind must be a known event kind';
export const SUBJECT_KIND_ERROR = "subject_kind must be 'node', 'edge' or 'graph'";
export const SUBJECT_ID_ERROR = 'subject_id must be a positive integer';

// Query strings are always strings (or, for a repeated parameter, an array —
// which is why every check below starts by insisting on a string). House
// `{value}` / `{error}` shape, cf. frontier.js.
function intParam(raw, name, dflt, { min, max, error }) {
  if (raw === undefined || raw === null || raw === '') return { value: dflt };
  if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) return { error };
  const n = Number(raw.trim());
  if (!Number.isSafeInteger(n) || n < min || n > max) return { error };
  return { value: n };
}

function enumParam(raw, allowed, error) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string' || !allowed.includes(raw)) return { error };
  return { value: raw };
}

export function parseEventsQuery(query) {
  const q = query ?? {};
  const since = intParam(q.since, 'since', 0, { min: 0, max: Number.MAX_SAFE_INTEGER, error: SINCE_ERROR });
  const limit = intParam(q.limit, 'limit', DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT, error: LIMIT_ERROR });
  const kind = enumParam(q.kind, EVENT_KINDS, KIND_ERROR);
  const subjectKind = enumParam(q.subject_kind, SUBJECT_KINDS, SUBJECT_KIND_ERROR);
  const subjectId = intParam(q.subject_id, 'subject_id', null, {
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    error: SUBJECT_ID_ERROR,
  });

  for (const r of [since, limit, kind, subjectKind, subjectId]) {
    if (r.error) return { error: r.error };
  }
  return {
    value: {
      since: since.value,
      limit: limit.value,
      kind: kind.value,
      subject_kind: subjectKind.value,
      subject_id: subjectId.value,
    },
  };
}

// `txid` is deliberately absent: it is a Postgres-internal transaction id, not
// a fact about the graph, and `request_id` already groups a fan-out write
// (`/batch`, `/edges/bulk`, a cascading DELETE) back into one user action.
const EVENT_COLS = `graph_id, seq, happened_at, learned_at, actor, kind,
                    subject_kind, subject_id, cause_id, request_id, payload`;

// The filters are bound as nullable parameters rather than concatenated, so
// there is exactly ONE prepared statement shape whatever the caller asks for.
// `seq > $2 ORDER BY seq` is an index-ordered range scan on the primary key
// (graph_id, seq) — no sort, no extra index.
// EXPORTED for src/routes/changes.js (E18.3), which is a thin PERSONAL wrapper
// over this reader and not a second one. It inherits, rather than re-derives,
// the load-bearing rule in this file's header — the head is read BEFORE the
// page — because two log readers is how two definitions of "what changed"
// drift. No logic moved; three names became exports.
export const PAGE_SQL = `SELECT ${EVENT_COLS}
     FROM events
    WHERE graph_id = $1 AND seq > $2
      AND ($3::text   IS NULL OR kind = $3)
      AND ($4::text   IS NULL OR subject_kind = $4)
      AND ($5::bigint IS NULL OR subject_id = $5)
    ORDER BY seq
    LIMIT $6`;

export const HEAD_SQL = `SELECT COALESCE(MAX(seq), 0) AS head_seq FROM events WHERE graph_id = $1`;

function isoOrNull(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// BIGINT comes back from `pg` as a string so nothing is lost on a 64-bit value.
// Per-graph seq is gapless and starts at 1, so it will not approach 2^53 in any
// universe this code runs in, and a JSON number is the shape a client wants to
// feed straight back as `?since=`.
function num(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function shapeEvent(row) {
  return {
    graph_id: row.graph_id,
    seq: num(row.seq),
    happened_at: isoOrNull(row.happened_at),
    learned_at: isoOrNull(row.learned_at),
    actor: row.actor,
    kind: row.kind,
    subject_kind: row.subject_kind,
    subject_id: num(row.subject_id),
    cause_id: num(row.cause_id),
    request_id: row.request_id,
    payload: row.payload,
  };
}

export async function eventsLogHandler(req, res, next) {
  const parsed = parseEventsQuery(req.query);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const p = parsed.value;
  const gid = req.params.gid;

  try {
    // HEAD FIRST — see the header. Under-reporting the head is repaired below;
    // over-reporting it would skip an event permanently.
    const headRows = await pool.query(HEAD_SQL, [gid]);
    const observedHead = Number(headRows.rows[0].head_seq);

    // limit+1 flags truncation without a second COUNT (frontier.js idiom).
    const { rows } = await pool.query(PAGE_SQL, [
      gid,
      p.since,
      p.kind,
      p.subject_kind,
      p.subject_id,
      p.limit + 1,
    ]);
    const truncated = rows.length > p.limit;
    const page = rows.slice(0, p.limit).map(shapeEvent);
    const lastSeq = page.length ? page[page.length - 1].seq : 0;

    // The page may legitimately have seen further than the head read did.
    const headSeq = Math.max(observedHead, lastSeq);
    // A truncated page resumes from its own last row; a complete page resumes
    // from the head, because everything between the last matching event and the
    // head was excluded by the caller's own filters. `since` floors it so the
    // cursor never moves backwards.
    const nextSince = truncated ? lastSeq : Math.max(headSeq, p.since);

    // The log grows; a cached page would go stale the moment it did. (A pinned
    // prefix IS cacheable — that is `GET /graph?asOfSeq=`, which says so.)
    res.set('Cache-Control', 'no-store');
    res.json({ events: page, head_seq: headSeq, next_since: nextSince, truncated });
  } catch (err) {
    next(err);
  }
}

export default eventsLogHandler;
