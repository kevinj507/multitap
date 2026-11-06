// E18.1 — the append primitive: carry WHO/WHEN/WHY down to the row triggers.
//
// Capture itself lives in the database (db/schema.sql, `gt_log_task` /
// `gt_log_edge` / `gt_log_graph`), because a handler-level log cannot see the
// task→edge ON DELETE CASCADE, the graph-delete cascade, the rotate-id mass
// UPDATE, the boot-time backfills in schema.sql, or any direct-SQL writer. What
// the database CANNOT see is the actor. That rides down as transaction-local
// GUCs set by this module, and the triggers read them back through `gt_ctx()`.
//
// Three rules that are not negotiable:
//
//  1. The prefix is `gt.`, never `app.`. This Postgres instance is shared with
//     the Wafer system DB; an `app.*` collision would misattribute silently
//     rather than fail loudly.
//  2. `is_local = true` on EVERY set_config. A session-level set survives the
//     transaction and leaks the previous request's actor onto the pooled
//     connection — every later write by anyone would be stamped with it.
//  3. Attribution FAILS OPEN, never closed. A write that reaches the database
//     without a context still produces a complete event with
//     `actor = {"type":"system"}` (the COALESCE in `gt_actor()`). A missing
//     actor is a smaller problem than a missing event: the first is an
//     incomplete record, the second is a corrupted fold.
//
// `SET LOCAL gt.actor = $1` cannot be parameterised (SET takes a literal), which
// is why every write here goes through `set_config(name, value, true)` instead.

import crypto from 'node:crypto';
import pool from '../db.js';
import { isIsoDatetime } from '../markdown.js';
import { operatorName, resolveAgentName } from '../writerName.js';

// Backdating for the body-less DELETE routes, which have nowhere to put a
// `happened_at` field. JSON-bodied routes may send `happened_at` in the body.
export const HAPPENED_AT_HEADER = 'x-happened-at';
export const CAUSE_ID_HEADER = 'x-cause-id';
export const REQUEST_ID_HEADER = 'x-request-id';

// One fixed message per knob, so a route can 400 with it verbatim and a test
// can match it without pinning a formatted value the caller supplied.
export const HAPPENED_AT_ERROR =
  'happened_at must be an ISO-8601 datetime between 1970-01-01 and 24 hours from now';
export const CAUSE_ID_ERROR = 'cause_id must be a positive integer';
// A shape-valid cause_id that names nothing in this graph's log. Separate from
// CAUSE_ID_ERROR because the two failures are different caller mistakes: a
// malformed value vs. a well-formed one pointing at an event that isn't there.
export const CAUSE_ID_UNKNOWN_ERROR =
  'cause_id must name an existing earlier event in this graph';

// How far into the future a caller may claim something happened. Small and
// fixed: it exists to absorb client clock skew, not to allow post-dating.
const FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;

// The GUCs `gt_actor()`, `gt_happened_at()` and the row loggers read. Every one
// is written on every applyEventContext() call — including the ones that are
// null — so a context can never inherit a stale value from an earlier
// transaction on the same connection. `gt.capture` is deliberately NOT here:
// it is a separate escape hatch owned by withoutCapture().
export const CONTEXT_KEYS = Object.freeze([
  'actor_type',
  'actor_id',
  'actor_name',
  'actor_user_id',
  'actor_via',
  'request_id',
  'happened_at',
  'cause_id',
  'reason',
  'intent',
]);

// ONE statement, one round trip, all local. Built once at module load.
const APPLY_SQL = `SELECT ${CONTEXT_KEYS.map(
  (k, i) => `set_config('gt.${k}', $${i + 1}, true)`,
).join(', ')}`;

const MAX_ID = 128;
const MAX_NAME = 64;

function clamp(value, max) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

// set_config(name, NULL, true) stores '' — which is exactly what gt_ctx()'s
// NULLIF turns back into SQL NULL. So nulls can be passed straight through as
// bind parameters; no branch, no string 'null' sentinel.
function asParam(v) {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return String(v);
}

// ── validators (house `{value}` / `{error}` shape, cf. frontier.js num()) ────

// Backdating is a first-class feature: `happened_at` is WORLD time and may be
// in the past. `learned_at` is BELIEF time, stamped by the database with
// clock_timestamp() and accepted from nowhere — it is the one clock a caller
// can never falsify.
export function parseHappenedAt(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (!isIsoDatetime(raw)) return { error: HAPPENED_AT_ERROR };
  const d = raw instanceof Date ? raw : new Date(raw);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return { error: HAPPENED_AT_ERROR };
  // Floor at the epoch to match the events_happened_at_sane CHECK, so a value
  // this accepts can never be rejected by the database mid-transaction.
  if (ms < 0) return { error: HAPPENED_AT_ERROR };
  if (ms > Date.now() + FUTURE_SLACK_MS) return { error: HAPPENED_AT_ERROR };
  return { value: d.toISOString() };
}

// `cause_id` names an EARLIER event in the same graph. The
// events_cause_precedes CHECK (cause_id < seq) makes the cause graph a strict
// DAG, which is what lets E18.3 traverse it without a visited-set hack.
export function parseCauseId(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw === 'boolean') return { error: CAUSE_ID_ERROR };
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n <= 0) return { error: CAUSE_ID_ERROR };
  return { value: n };
}

// Where a caller may put a cause_id: the JSON body, or X-Cause-Id for the
// body-less DELETE routes. Same precedence as happened_at, and the same
// precedence eventContextFromRequest() applies, so the gate below and the
// context that actually reaches the triggers can never disagree.
export function causeIdFromRequest(req) {
  return parseCauseId(req?.body?.cause_id ?? req?.headers?.[CAUSE_ID_HEADER]);
}

// E18.1 — the cause gate, the twin of each route's rejectBadHappenedAt().
//
// `cause_id` is not merely shape-checked by the database: events_cause_precedes
// CHECK (cause_id IS NULL OR cause_id < seq) is enforced inside the row trigger,
// so a well-formed but too-large value aborts the transaction with 23514 —
// which surfaced as a bare 500 on the task routes and, worse, as an "invalid
// edge" / "a node or edge violated a constraint" 400 on the edge and batch
// routes, blaming data that was never wrong. Rejecting it up front means a bad
// request writes no row, no event, and gets one honest message.
//
// Existence in the graph is the right test, not `<= head_seq`: every event
// already in the log has seq <= head < the seq this write is about to take, so
// "it exists" implies "it precedes". Rows are never deleted from the log, so
// the answer cannot go stale between this check and the write.
//
// Unlike the happened_at gate this one is async — it asks the database — which
// is why it lives here rather than being copy-pasted into four routers.
export async function rejectBadCauseId(req, res, gid) {
  const c = causeIdFromRequest(req);
  if (c.error) {
    res.status(400).json({ error: c.error });
    return true;
  }
  if (c.value === null) return false;
  const r = await pool.query(
    'SELECT 1 FROM events WHERE graph_id = $1 AND seq = $2',
    [gid, c.value],
  );
  if (r.rowCount === 0) {
    res.status(400).json({ error: CAUSE_ID_UNKNOWN_ERROR });
    return true;
  }
  return false;
}

// ── context ─────────────────────────────────────────────────────────────────

// Everything the triggers need to know about the caller, read off the request
// the middleware chain already built (src/writerType.js, src/auth/middleware.js,
// src/auth/require.js). Nothing here queries the database.
//
// `overrides` wins over the request on every key, so a route can pin a
// `reason` ('claim' / 'release'), promote an `intent`, or supply a
// `happened_at` it has already validated.
//
// On a malformed `happened_at` / `cause_id` this returns `error` and leaves the
// field null rather than throwing: a thrown error here would become a 500 (the
// app has no custom Express error handler). Routes that accept backdating MUST
// call parseHappenedAt() themselves and 400 before writing anything.
export function eventContextFromRequest(req, overrides = {}) {
  const o = overrides ?? {};
  const writer = req?.writer ?? {};
  const user = req?.user ?? null;
  const viaAgentToken = req?.viaAgentToken === true;

  // A bearer agent token IS an agent, whether or not the client also bothered
  // to send X-Writer-Type: agent.
  const actorType = o.actor_type ?? (req?.writerType === 'agent' || viaAgentToken ? 'agent' : 'human');

  // Agents are named authoritatively from the token owner (the operator), not
  // the client-sent X-Writer-Name — which the agent skill seeds from
  // `git config user.name` and is wrong on a shared repo. Humans keep the name
  // the browser gave them; src/auth/require.js:41-46 makes the same choice.
  const actorName =
    o.actor_name ??
    (actorType === 'agent'
      ? resolveAgentName({ user, clientName: clamp(writer.name, MAX_NAME) })
      : clamp(writer.name, MAX_NAME) ?? operatorName(user));

  const actorVia =
    o.actor_via ?? (viaAgentToken ? 'agent_token' : user ? 'session' : null);

  let error = null;

  const happened = parseHappenedAt(
    o.happened_at ??
      req?.body?.happened_at ??
      (req?.headers ? req.headers[HAPPENED_AT_HEADER] : undefined),
  );
  if (happened.error) error = happened.error;

  const cause = parseCauseId(
    o.cause_id ??
      req?.body?.cause_id ??
      (req?.headers ? req.headers[CAUSE_ID_HEADER] : undefined),
  );
  if (cause.error) error = error ?? cause.error;

  return {
    actor_type: actorType,
    actor_id: o.actor_id ?? clamp(writer.id, MAX_ID),
    actor_name: actorName ?? null,
    actor_user_id: o.actor_user_id ?? user?.id ?? null,
    actor_via: actorVia,
    // One HTTP request = one request_id, memoised on `req`, so the up-to-1500
    // rows a single /batch writes can be grouped back into one user action.
    request_id: o.request_id ?? requestIdFor(req),
    happened_at: happened.value ?? null,
    cause_id: cause.value ?? null,
    reason: o.reason ?? null,
    intent: o.intent ?? null,
    error,
  };
}

function requestIdFor(req) {
  if (!req || typeof req !== 'object') return crypto.randomUUID();
  if (req._gtRequestId) return req._gtRequestId;
  const supplied = clamp(req.headers?.[REQUEST_ID_HEADER], MAX_ID);
  const id = supplied ?? crypto.randomUUID();
  try {
    req._gtRequestId = id;
  } catch {
    // A frozen/proxied request object is not a reason to fail a write.
  }
  return id;
}

// Push a context onto an OPEN transaction's connection. Must run after BEGIN
// and before the DML; the values evaporate at COMMIT/ROLLBACK.
export async function applyEventContext(client, ctx) {
  const values = CONTEXT_KEYS.map((k) => asParam(ctx?.[k]));
  await client.query(APPLY_SQL, values);
  return ctx;
}

// ── the two call-site primitives ────────────────────────────────────────────

// Drop-in for withTx() (src/db.js:40-53) that stamps the actor first. The only
// difference from withTx is the applyEventContext line: same BEGIN/COMMIT,
// same ROLLBACK-then-rethrow, same release-in-finally. LOCK TABLE statements
// inside `fn` are unaffected — applyEventContext simply runs before them.
export async function withEventTx(req, fn, overrides = {}) {
  const ctx = eventContextFromRequest(req, overrides);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyEventContext(client, ctx);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Drop-in for pool.query(text, values) that stamps the actor first.
//
// Same signature, same resolved value (the pg Result — `.rows`, `.rowCount`,
// `.command`), and — critically — the SAME ERROR. The error is rethrown AFTER
// the ROLLBACK with nothing wrapped or swallowed, so the existing
// `e.code === '23503'` / `'23505'` / `'23514'` handling at tasks.js:49,
// edges.js:172-174 and refresh.js:64 keeps working untouched.
//
// The autocommit statement becomes an explicit transaction. That is a strict
// improvement: today a bare INSERT and any follow-up are separately committed;
// here the row write and its event are atomic by construction.
export async function eventQuery(req, text, values, overrides = {}) {
  const ctx = eventContextFromRequest(req, overrides);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyEventContext(client, ctx);
    const result =
      typeof text === 'object' || values === undefined
        ? await client.query(text)
        : await client.query(text, values);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // Roll back FIRST, then propagate the original error unchanged.
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection may already be unusable; the original error is the
      // one worth reporting.
    }
    throw err;
  } finally {
    client.release();
  }
}

// The documented escape hatch: run `fn` with capture suppressed.
//
// Scope is the enclosing TRANSACTION (is_local=true), so this takes an open
// client, not the pool — and it restores 'on' afterwards so the rest of the
// transaction is captured normally. A bare
// `pool.query("SELECT set_config('gt.capture','off',true)")` is a no-op by
// design: with no explicit transaction the setting dies with that statement
// and capture is back on for the next one.
export async function withoutCapture(client, fn) {
  await client.query("SELECT set_config('gt.capture', 'off', true)");
  try {
    return await fn(client);
  } finally {
    try {
      await client.query("SELECT set_config('gt.capture', 'on', true)");
    } catch {
      // fn aborted the transaction; the setting dies with it anyway.
    }
  }
}
