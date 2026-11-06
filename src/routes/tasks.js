import { Router } from 'express';
import pool from '../db.js';
import {
  eventQuery,
  withEventTx,
  parseHappenedAt,
  rejectBadCauseId,
  HAPPENED_AT_HEADER,
} from '../events/context.js';
import { parseMarkdown, serializeMarkdown, validateMeta, applyDefaults } from '../markdown.js';
import { mergeFields } from '../merge.js';
import { requireIntegerParam } from './_validate.js';
import { notSupersededSql } from '../supersession.js';
import { notDormantSql } from '../branches.js';
import { worldlineHandler } from './worldline.js';
import { requireGraph } from '../auth/require.js';
import { exciseNodeFromGenesis } from '../events/snapshot.js';
import { dropDerivedForGraph } from '../derivedCache.js';

// Tasks store frontmatter (meta) + body in a single markdown blob. To do
// field-level three-way merge, we flatten {meta, body} into one object.
// Using a non-conventional key for body to avoid colliding with any meta key.
const BODY_KEY = '__body__';
function flattenTask(meta, body) {
  return { ...meta, [BODY_KEY]: body };
}
function unflattenTask(flat) {
  const meta = { ...flat };
  const body = meta[BODY_KEY] || '';
  delete meta[BODY_KEY];
  return { meta, body };
}

// mergeParams so :gid from the parent mount is visible here.
const router = Router({ mergeParams: true });
const validateId = requireIntegerParam('id');

// E18.1 — the backdating gate. `happened_at` is WORLD time and may be in the
// past; it arrives in the JSON body, or as X-Happened-At for the body-less
// DELETE routes. `learned_at` is BELIEF time and is accepted from nowhere — the
// database stamps it with clock_timestamp() and a caller can never falsify it.
//
// This runs BEFORE any write, so a malformed value yields a 400 and NO event,
// rather than a row written with a silently-dropped timestamp.
// eventContextFromRequest() deliberately does not throw on a bad value (the app
// has no custom Express error handler, so a throw would be a 500) — rejecting
// it is the route's job.
function rejectBadHappenedAt(req, res) {
  const h = parseHappenedAt(req.body?.happened_at ?? req.headers?.[HAPPENED_AT_HEADER]);
  if (h.error) {
    res.status(400).json({ error: h.error });
    return true;
  }
  return false;
}

// ---- task CRUD ----

router.post('/', async (req, res) => {
  const { gid } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;

  const { meta: rawMeta, body, frontmatterError } = parseMarkdown(content);
  if (frontmatterError)
    return res.status(400).json({ error: `frontmatter is not valid YAML — quote any title containing a colon (${frontmatterError})` });
  const meta = applyDefaults(rawMeta);

  const err = validateMeta(meta);
  if (err) return res.status(400).json({ error: err });

  const normalized = serializeMarkdown(meta, body);

  try {
    // eventQuery is a drop-in for pool.query that carries the actor down to the
    // row trigger as transaction-local GUCs. Same Result, and the SAME error
    // object rethrown after ROLLBACK — so the 23503 handling below is unchanged.
    const result = await eventQuery(
      req,
      `INSERT INTO tasks (graph_id, content, meta, last_modified_by, last_modified_by_user)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [gid, normalized, JSON.stringify(meta), req.writerType, req.user?.id ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'graph not found' });
    throw e;
  }
});

router.get('/', async (req, res) => {
  const { gid } = req.params;
  const result = await pool.query(
    'SELECT * FROM tasks WHERE graph_id = $1 ORDER BY created_at DESC',
    [gid]
  );
  res.json(result.rows);
});

// /leaves must come before /:id so the literal route wins
router.get('/leaves', async (req, res) => {
  const { gid } = req.params;
  // ?fields=id trims each row to a bare { id }. The canvas only needs ids
  // for leaf highlighting, and the full rows (markdown content included)
  // measured 4x the size of the entire /graph payload. Default shape stays
  // the full row so existing consumers are unaffected.
  const idsOnly = req.query.fields === 'id';
  const result = await pool.query(
    `SELECT ${idsOnly ? 't.id' : 't.*'} FROM tasks t
     WHERE t.graph_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM edges e
         WHERE e.target_id = t.id AND e.type = 'dependency'
       )
     ORDER BY t.id`,
    [gid]
  );
  res.json(result.rows);
});

// Tasks ready to start: status='todo' AND every recursive prerequisite is
// 'done'. Treats 'review' and 'in_progress' as not-yet-done — matches the
// agent convention where 'review' is "agent thinks it's finished, awaiting
// human confirmation."
//
// In a mixed world-model graph (plan nodes + knowledge nodes) `/ready` is a
// PLAN question — "what work can I start now?" — so it must return open
// QUESTIONS, not findings. Per the README role predicate an open question is
// `status: todo` WITH NO confidence; a confidence-bearing node is a claim/
// finding (its re-checking is the frontier's job, not /ready's). We therefore
// require `confidence IS NULL` here so a knowledge node that carries a
// confidence value never masquerades as ready work — even legacy/mislabeled
// rows that still sit at todo (the write side is permissive for human drags).
//
// Claim/lease interplay (3829): a claim flips the task to in_progress, so
// actively-claimed work already drops out of the todo branch — nothing extra
// to exclude. The second branch is the DERIVED revival: an in_progress task
// whose lease has EXPIRED is abandoned work, and surfacing it here is what
// makes a dead agent's claim self-release with no sweeper. A human-set
// in_progress (no claim fields) never matches — that's someone's active work,
// exactly as before. The todo branch deliberately ignores claim fields:
// a human dragging a claimed card back to todo IS the release/override.
router.get('/ready', async (req, res) => {
  const { gid } = req.params;
  // E18.4 — a SUPERSEDED node is not ready work: someone has declared that its
  // fact's story ended and a successor replaced it. Default-excluded, with
  // `?includeSuperseded=1` as the way back, so the change is auditable rather
  // than silent. Zero corpus rows are affected either way (no graph carries a
  // supersedes edge today).
  const includeSuperseded = req.query.includeSuperseded === '1'
    || req.query.includeSuperseded === 'true';
  // E18.5 — a DORMANT node is not ready work either: it sits under an option
  // nobody chose, on a decision that is currently committed. Same shape as the
  // supersession exclusion above — default-excluded, `?includeDormant=1` is the
  // way back — and zero corpus rows move today, because no edge in any graph
  // carries `meta.branch`.
  //
  // MEASURED, and the reason this exclusion exists at all: the dormant SUBTREE
  // already falls out for free (the un-chosen option is an un-done transitive
  // prerequisite), but the option NODE ITSELF is offered as ready work in every
  // case, and one human marking an alternative `done` — a plausible way to say
  // "we are not doing this" — LEAKS THE WHOLE BRANCH into the queue.
  const includeDormant = req.query.includeDormant === '1'
    || req.query.includeDormant === 'true';
  const result = await pool.query(
    `WITH RECURSIVE prereqs AS (
       SELECT t.id AS root, e.source_id AS prereq
         FROM tasks t
         JOIN edges e ON e.target_id = t.id AND e.type = 'dependency'
        WHERE t.graph_id = $1
       UNION
       SELECT p.root, e.source_id
         FROM prereqs p
         JOIN edges e ON e.target_id = p.prereq AND e.type = 'dependency'
        WHERE e.graph_id = $1
     )
     SELECT t.* FROM tasks t
      WHERE t.graph_id = $1
        AND (
          (t.meta->>'status' = 'todo' AND t.meta->>'confidence' IS NULL)
          OR (t.meta->>'status' = 'in_progress'
              AND t.claimed_by IS NOT NULL
              AND t.claim_expires_at < NOW())
        )
        AND NOT EXISTS (
          SELECT 1 FROM prereqs p
          JOIN tasks tp ON tp.id = p.prereq
          WHERE p.root = t.id AND tp.meta->>'status' <> 'done'
        )
        -- E18.4 exclusion. It filters the RESULT ROWS ONLY, and it must NEVER
        -- move into the recursive prereqs CTE above: dropping a superseded
        -- PREREQUISITE from that walk would treat it as SATISFIED and silently
        -- auto-unblock its dependents, violating the locked rule that nothing
        -- auto-flips status. A superseded prerequisite still blocks; the remedy
        -- is for someone to rewire the required-for edge onto the successor,
        -- which is a deliberate act and gets its own edge.rewired event.
        ${includeSuperseded ? '' : `AND ${notSupersededSql('t')}`}
        -- E18.5 exclusion. The SAME rule applies as one line above and it is
        -- the sharper trap here: this filters RESULT ROWS ONLY and must NEVER
        -- move into the recursive prereqs CTE. Dropping a dormant PREREQUISITE
        -- from that walk would treat it as SATISFIED and silently auto-unblock
        -- its dependents — the locked "nothing auto-flips a status" rule. A
        -- dormant prerequisite still blocks.
        ${includeDormant ? '' : `AND ${notDormantSql('t')}`}
      ORDER BY t.id`,
    [gid]
  );
  res.json(result.rows);
});

// E18.4 — a fact's worldline. Registered here rather than as its own mount so
// it inherits tasksRouter's read guard; the handler lives in ./worldline.js.
router.get('/:id/worldline', validateId, worldlineHandler);

router.get('/:id', validateId, async (req, res) => {
  const { gid, id } = req.params;
  const result = await pool.query(
    'SELECT * FROM tasks WHERE id = $1 AND graph_id = $2',
    [id, gid]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

router.patch('/:id', validateId, async (req, res) => {
  const { gid, id } = req.params;
  const { content, base_version, base_content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;

  const writerParsed = parseMarkdown(content);
  if (writerParsed.frontmatterError)
    return res.status(400).json({ error: `frontmatter is not valid YAML — quote any title containing a colon (${writerParsed.frontmatterError})` });
  const writerMeta = applyDefaults(writerParsed.meta);
  const writerBody = writerParsed.body;
  const validationErr = validateMeta(writerMeta);
  if (validationErr) return res.status(400).json({ error: validationErr });

  const currentRes = await pool.query(
    `SELECT t.*, g.owner_user_id AS graph_owner_user_id
       FROM tasks t
       JOIN graphs g ON g.id = t.graph_id
      WHERE t.id = $1 AND t.graph_id = $2`,
    [id, gid]
  );
  if (currentRes.rows.length === 0) {
    return res.status(410).json({ error: 'task no longer exists' });
  }
  const cur = currentRes.rows[0];

  let mergedMeta = writerMeta;
  let mergedBody = writerBody;

  // Three-way merge whenever the client opts in by sending both base_version
  // and base_content — NOT only when a concurrent write is detected. The
  // protected-key preservation (UI-managed x/y/color/background-image and the
  // research fields significance/confidence/verified_at) must apply on EVERY
  // agent PATCH that rebuilds content from scratch, even with no contention:
  // an agent that omits those keys would otherwise blind-wipe them on the
  // common no-concurrent-write path. When base_version === cur.version (no
  // concurrent write) base equals current, so the merge degenerates to
  // "writer's edits win, omitted-protected keys kept" — the same result as a
  // plain replace except the protected keys survive. (batch.js already merges
  // unconditionally for this reason; this aligns the single-task PATCH.)
  // Without base fields, fall back to simple replace — backward compat for
  // clients that don't yet send the base.
  const hasBaseFields =
    base_version !== undefined &&
    base_content !== undefined;

  if (hasBaseFields) {
    const baseParsed = parseMarkdown(base_content);
    const baseMeta = applyDefaults(baseParsed.meta);
    const currentParsed = parseMarkdown(cur.content);
    const currentMeta = applyDefaults(currentParsed.meta);

    const { merged } = mergeFields(
      flattenTask(baseMeta, baseParsed.body),
      flattenTask(writerMeta, writerBody),
      flattenTask(currentMeta, currentParsed.body),
      {
        writerType: req.writerType,
        currentWriterType: cur.last_modified_by,
        writerOwnerId: req.user?.id ?? null,
        currentOwnerId: cur.last_modified_by_user ?? null,
        graphOwnerId: cur.graph_owner_user_id ?? null,
        // UI-managed frontmatter keys: the canvas writes these whenever a
        // user drags or recolors a node. Agents that rebuild content from
        // scratch typically don't include them, so without this list they'd
        // silently wipe user state on every PATCH. The E15.A2 research fields
        // and E17's decided_at ride the same protection: a body-rewriting
        // agent PATCH that omits significance/confidence/verified_at/decided_at
        // must not wipe a value a human or an earlier pass set (explicit null
        // still clears).
        protectedFromAgentRemoval: [
          'x', 'y', 'color', 'background-image',
          'significance', 'confidence', 'verified_at', 'decided_at',
          // E18.2: `refuted_at` records a failed check and `decay` is a
          // structural property of the node. Both are exactly the kind of key
          // a body-rewriting agent PATCH omits and would otherwise wipe.
          'refuted_at', 'decay',
        ],
      },
    );
    const out = unflattenTask(merged);
    const mergedErr = validateMeta(out.meta);
    if (mergedErr) {
      return res.status(409).json({
        error: 'version_conflict',
        detail: `merged result invalid: ${mergedErr}`,
        current: cur,
      });
    }
    mergedMeta = out.meta;
    mergedBody = out.body;
  }

  const normalized = serializeMarkdown(mergedMeta, mergedBody);
  const result = await eventQuery(
    req,
    `UPDATE tasks
        SET content = $1,
            meta = $2,
            version = version + 1,
            last_modified_by = $3,
            last_modified_by_user = $4,
            updated_at = NOW()
      WHERE id = $5 AND graph_id = $6
    RETURNING *`,
    [normalized, JSON.stringify(mergedMeta), req.writerType, req.user?.id ?? null, id, gid]
  );
  if (result.rows.length === 0) {
    return res.status(410).json({ error: 'task no longer exists' });
  }
  res.json(result.rows[0]);
});

// E18.6 — EXCISION. The rare, owner-only, reason-required act that removes
// bytes from the log. Not deletion (DELETE /:id keeps its pre-image; that is
// the product) and not a correction (a mistake is superseded, E18.4). The
// mechanics — one `node.excised` event, every earlier event of the subject
// blanked to a marker the append-only trigger admits and nothing else, the
// periodic snapshots dropped — are gt_excise_node in db/schema.sql, so no
// route can do a wider rewrite; the genesis rewrite rides the same transaction.
//
// Works on a node that no longer exists (the common case: delete first, then
// excise its history) and on a live one (its present is re-declared in the
// event's `after` — meta and content_sha, never a body — so clean the present
// FIRST; the excision record is not itself excisable past its envelope).
//
// `manage` = the graph owner, the same gate as sharing, rotate-id and delete.
// `X-Writer-Type: agent` is refused: attribution-based, so it stops an honest
// agent following the skill; the manage gate is the hard floor.
router.post('/:id/excise', validateId, requireGraph('manage'), async (req, res, next) => {
  const { gid, id } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return res.status(400).json({ error: 'reason is required' });
  if (reason.length > 2000) {
    return res.status(400).json({ error: 'reason must be 2000 characters or less' });
  }
  if (req.writerType === 'agent') {
    return res.status(403).json({ error: 'excision is a human act; agents cannot excise' });
  }
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;

  try {
    const out = await withEventTx(
      req,
      async (client) => {
        const r = await client.query('SELECT gt_excise_node($1, $2, $3) AS out', [gid, id, reason]);
        const genesis = await exciseNodeFromGenesis(client, gid, id);
        // The derived cache (src/derivedCache.js) holds reconstructions keyed
        // by (graph, seq) on the premise that a pinned prefix is immutable —
        // and the frontier and doubt caches under the same graph key hold meta
        // too. Excision is the one write that changes what a settled prefix
        // says, so every entry for the graph goes: once here, so nothing
        // repopulates from a pre-commit read that raced us, and once after
        // COMMIT, so a read between the two cannot pin the old bytes.
        dropDerivedForGraph(gid);
        return { ...r.rows[0].out, genesis };
      },
      { reason },
    );
    dropDerivedForGraph(gid);
    return res.json(out);
  } catch (err) {
    // P0002 (no_data_found) is what gt_excise_node raises for a node with no
    // live row AND no history in this graph — nothing to excise.
    if (err?.code === 'P0002') {
      return res.status(404).json({ error: 'node is not known to this graph' });
    }
    return next(err);
  }
});

router.delete('/:id', validateId, async (req, res) => {
  const { gid, id } = req.params;
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;
  // The FK cascade destroys every incident edge and this handler never learns
  // their ids (it returns {deleted: <task id>}). The row triggers do: the
  // BEFORE-DELETE task trigger lands node.removed first, then each cascaded
  // edge.removed points cause_id at it. Running inside eventQuery's explicit
  // transaction is what gives that whole fan-out one actor and one request_id.
  const result = await eventQuery(
    req,
    'DELETE FROM tasks WHERE id = $1 AND graph_id = $2 RETURNING id',
    [id, gid]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: result.rows[0].id });
});

// ---- claim/lease (fleet coordination — node 3829) ----
// N agents pulling from /ready can otherwise double-grab the same task:
// OCC merge prevents write corruption but not duplicated work, and presence
// is advisory. POST /:id/claim is the atomic take: inside one row-locked
// transaction it flips todo → in_progress and records holder + lease expiry,
// so exactly one of two racing claimants wins (the loser's predicate fails on
// the committed state and gets a 409 naming the holder). The same holder
// POSTing again RENEWS the lease. Claimability is DERIVED from
// (status, claimed_by, claim_expires_at) — no sweeper: an expired lease just
// makes the task match /ready's claimable predicate again.
//
// Humans always override without this API: editing status is enough (a card
// dragged back to todo is claimable regardless of any lease — /ready's todo
// branch ignores claim fields on purpose). DELETE /:id/claim is the
// programmatic release for graceful abandonment and reassignment; it's
// edit-gated like every task write and deliberately NOT holder-only.

const CLAIM_DEFAULT_TTL_S = 30 * 60;
const CLAIM_MIN_TTL_S = 60;
const CLAIM_MAX_TTL_S = 4 * 60 * 60;

router.post('/:id/claim', validateId, async (req, res) => {
  const { gid, id } = req.params;
  const holder = req.writer?.id;
  // A lease without an identifiable holder can't be renewed or attributed —
  // same rule the presence/selection routes apply.
  if (!holder) return res.status(400).json({ error: 'X-Writer-Id is required to claim' });
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;
  let ttl = CLAIM_DEFAULT_TTL_S;
  if (req.body && req.body.ttl_seconds !== undefined) {
    ttl = Number(req.body.ttl_seconds);
    if (!Number.isFinite(ttl)) return res.status(400).json({ error: 'ttl_seconds must be a number' });
    ttl = Math.min(CLAIM_MAX_TTL_S, Math.max(CLAIM_MIN_TTL_S, Math.round(ttl)));
  }

  // reason:'claim' lands in payload.reason on the acquire event. The RENEWAL
  // branch below writes only claim_* columns, which the trigger's drop_cols
  // suppresses, so a renewal produces ch = '{}' and ZERO events — no per-site
  // rule needed, and a long-running agent's renewal loop never floods the log.
  const out = await withEventTx(req, async (client) => {
    const cur = await client.query(
      'SELECT * FROM tasks WHERE id = $1 AND graph_id = $2 FOR UPDATE',
      [id, gid],
    );
    if (cur.rows.length === 0) return { code: 404, body: { error: 'not found' } };
    const row = cur.rows[0];
    const meta = row.meta || {};
    const expired = row.claim_expires_at && new Date(row.claim_expires_at).getTime() < Date.now();

    // Renewal: the current holder keeps working — extend, don't re-acquire.
    // Allowed even just past expiry as long as nobody else took it (the row
    // lock serializes us against a competing acquire).
    if (meta.status === 'in_progress' && row.claimed_by === holder) {
      const upd = await client.query(
        `UPDATE tasks
            SET claim_expires_at = NOW() + make_interval(secs => $1),
                claimed_by_name = COALESCE($2, claimed_by_name)
          WHERE id = $3 RETURNING *`,
        [ttl, req.writer?.name ?? null, row.id],
      );
      return { code: 200, body: { claimed: true, renewed: true, task: upd.rows[0] } };
    }

    // Acquire: an open question at todo (same work predicate /ready uses —
    // confidence-bearing findings are never claimable work), or abandoned
    // in_progress work whose lease ran out.
    const claimableTodo = meta.status === 'todo' && meta.confidence == null;
    const claimableExpired = meta.status === 'in_progress' && row.claimed_by && expired;
    if (!claimableTodo && !claimableExpired) {
      return {
        code: 409,
        body: {
          error: 'task is not claimable',
          status: meta.status ?? null,
          claimed_by: row.claimed_by ?? null,
          claimed_by_name: row.claimed_by_name ?? null,
          claim_expires_at: row.claim_expires_at ?? null,
        },
      };
    }
    // Status flips in BOTH meta and content — they must never drift — and the
    // write carries normal attribution + version bump, so SSE, OCC and
    // last-modified provenance all see an ordinary edit.
    const parsed = parseMarkdown(row.content);
    const newMeta = { ...applyDefaults(parsed.meta), status: 'in_progress' };
    const normalized = serializeMarkdown(newMeta, parsed.body);
    const upd = await client.query(
      `UPDATE tasks
          SET content = $1, meta = $2,
              claimed_by = $3, claimed_by_name = $4,
              claim_expires_at = NOW() + make_interval(secs => $5),
              version = version + 1,
              last_modified_by = $6, last_modified_by_user = $7,
              updated_at = NOW()
        WHERE id = $8 RETURNING *`,
      [
        normalized, JSON.stringify(newMeta),
        holder, req.writer?.name ?? null, ttl,
        req.writerType, req.user?.id ?? null, row.id,
      ],
    );
    return { code: 200, body: { claimed: true, renewed: false, task: upd.rows[0] } };
  }, { reason: 'claim' });
  res.status(out.code).json(out.body);
});

router.delete('/:id/claim', validateId, async (req, res) => {
  const { gid, id } = req.params;
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;
  // The non-in_progress branch touches only claim_* columns (its version bump
  // is an artifact), so it too falls out as ch = '{}' and emits nothing.
  const out = await withEventTx(req, async (client) => {
    const cur = await client.query(
      'SELECT * FROM tasks WHERE id = $1 AND graph_id = $2 FOR UPDATE',
      [id, gid],
    );
    if (cur.rows.length === 0) return { code: 404, body: { error: 'not found' } };
    const row = cur.rows[0];
    if (!row.claimed_by) return { code: 404, body: { error: 'no active claim' } };
    const meta = row.meta || {};
    // Work abandoned mid-lease goes back to todo so /ready re-surfaces it
    // immediately; a task already moved on (review/done, or human-retargeted)
    // just sheds the stale lease fields.
    if (meta.status === 'in_progress') {
      const parsed = parseMarkdown(row.content);
      const newMeta = { ...applyDefaults(parsed.meta), status: 'todo' };
      const normalized = serializeMarkdown(newMeta, parsed.body);
      const upd = await client.query(
        `UPDATE tasks
            SET content = $1, meta = $2,
                claimed_by = NULL, claimed_by_name = NULL, claim_expires_at = NULL,
                version = version + 1,
                last_modified_by = $3, last_modified_by_user = $4,
                updated_at = NOW()
          WHERE id = $5 RETURNING *`,
        [normalized, JSON.stringify(newMeta), req.writerType, req.user?.id ?? null, row.id],
      );
      return { code: 200, body: { released: true, task: upd.rows[0] } };
    }
    const upd = await client.query(
      `UPDATE tasks
          SET claimed_by = NULL, claimed_by_name = NULL, claim_expires_at = NULL,
              version = version + 1
        WHERE id = $1 RETURNING *`,
      [row.id],
    );
    return { code: 200, body: { released: true, task: upd.rows[0] } };
  }, { reason: 'release' });
  res.status(out.code).json(out.body);
});

// ---- E18.2: the deliberate re-check ----
//
// POST /:id/verify is the one surface a FAILED check can be expressed on. A
// failure is not expressible as a `verified_at` assignment — clearing the
// scalar on a never-verified claim moves nothing, the trigger's `ch = '{}'`
// suppression fires, and the log records the failure NOWHERE. So `failed`
// writes a `refuted_at` scalar, which the SQL classifier reads as
// `claim.refuted`, mirroring decision.made / decision.reopened exactly.
//
// Inference from PATCH is UNCHANGED: a PATCH that sets `verified_at` still
// emits `claim.verified`. The only difference is `payload.intent`, which this
// route sets and an incidental PATCH does not — so deliberate and incidental
// verifications are distinguishable in the log by a key that is present on one
// and absent on the other. `gt.intent` still cannot FABRICATE a kind
// (gt_headline only promotes one the diff already produced), so the outcome
// remains mechanically derived from the row change and unforgeable.
//
// Clearing `verified_at` on a fail is also what makes v1 and v2 agree about
// refuted claims without either knowing about the other: today's frontier
// query already surfaces a node with no `verified_at` as stale.
//
// IDEMPOTENCE IS NOT SPECIAL-CASED. A repeat `held` at the same `happened_at`
// produces an identical row, hence `ch = '{}'`, hence NO second event — the
// existing suppression, not a new rule. The route still answers 200.
const VERIFY_OUTCOMES = ['held', 'failed'];

router.post('/:id/verify', validateId, async (req, res) => {
  const { gid, id } = req.params;
  const b = req.body || {};

  if (!VERIFY_OUTCOMES.includes(b.outcome)) {
    return res.status(400).json({ error: "outcome must be 'held' or 'failed'" });
  }
  // Validated BEFORE any write, so a malformed value yields a 400 and NO event.
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;

  const hasConfidence = Object.prototype.hasOwnProperty.call(b, 'confidence');
  if (hasConfidence && b.confidence !== null) {
    const c = b.confidence;
    if (typeof c !== 'number' || !Number.isFinite(c) || c < 0 || c > 1) {
      return res.status(400).json({ error: 'confidence must be a number between 0.0 and 1.0' });
    }
  }
  if (b.base_version !== undefined && !Number.isInteger(b.base_version)) {
    return res.status(400).json({ error: 'base_version must be an integer' });
  }

  // The world time of the CHECK. One instant for the whole event: the scalar
  // the handler writes and the event's `happened_at` are the SAME value, so
  // checkFromEvent()'s `min(verified_at.to, happened_at)` rule and the scalar
  // agree by construction.
  const happenedAt = parseHappenedAt(b.happened_at ?? req.headers?.[HAPPENED_AT_HEADER]).value
    ?? new Date().toISOString();

  const out = await withEventTx(
    req,
    async (client) => {
      // LOCK ORDER: the graphs row FIRST, then the task row. The UPDATE below
      // ends up taking the graphs row anyway (gt_next_seq, inside the trigger),
      // and every edge route takes the graphs row before it touches anything
      // else — so taking the task row first here inverted the order against
      // POST /edges and deadlocked, returning 500 on up to a quarter of
      // concurrent requests. Taking it up front costs no extra lock; it only
      // acquires earlier. tests/e18-concurrency.test.js pins it.
      await client.query('SELECT 1 FROM graphs WHERE id = $1 FOR NO KEY UPDATE', [gid]);
      const cur = await client.query(
        'SELECT * FROM tasks WHERE id = $1 AND graph_id = $2 FOR UPDATE',
        [id, gid],
      );
      if (cur.rows.length === 0) return { code: 410, body: { error: 'task no longer exists' } };
      const row = cur.rows[0];
      if (b.base_version !== undefined && row.version !== b.base_version) {
        return {
          code: 409,
          body: { error: 'version_conflict', detail: 'the task moved since base_version', current: row },
        };
      }

      // The handler NEVER touches the body, and rewrites exactly three meta
      // keys. held: verified_at := happened_at, refuted_at deleted.
      // failed: refuted_at := happened_at, verified_at deleted.
      const parsed = parseMarkdown(row.content);
      const meta = applyDefaults(parsed.meta);
      if (b.outcome === 'held') {
        meta.verified_at = happenedAt;
        delete meta.refuted_at;
      } else {
        meta.refuted_at = happenedAt;
        delete meta.verified_at;
      }
      if (hasConfidence) {
        if (b.confidence === null) delete meta.confidence;
        else meta.confidence = b.confidence;
      }

      const err = validateMeta(meta);
      if (err) return { code: 400, body: { error: err } };

      const normalized = serializeMarkdown(meta, parsed.body);
      const upd = await client.query(
        `UPDATE tasks
            SET content = $1, meta = $2, version = version + 1,
                last_modified_by = $3, last_modified_by_user = $4, updated_at = NOW()
          WHERE id = $5 AND graph_id = $6 RETURNING *`,
        [normalized, JSON.stringify(meta), req.writerType, req.user?.id ?? null, id, gid],
      );
      return { code: 200, body: upd.rows[0] };
    },
    {
      // `intent` PROMOTES the mechanically-derived kind to the headline and is
      // recorded in the payload; `reason` says which surface asked.
      intent: b.outcome === 'held' ? 'claim.verified' : 'claim.refuted',
      reason: 'verify',
      happened_at: happenedAt,
    },
  );
  res.status(out.code).json(out.body);
});

// ---- graph traversal queries ----
// Edge semantics: source_id → target_id means "source is prerequisite of target".

// Subtasks = all prerequisites (things that must be done before this task)
router.get('/:id/subtasks', validateId, async (req, res) => {
  const { gid, id } = req.params;
  const exists = await pool.query(
    'SELECT 1 FROM tasks WHERE id = $1 AND graph_id = $2',
    [id, gid]
  );
  if (exists.rows.length === 0) return res.status(404).json({ error: 'not found' });

  const result = await pool.query(
    `WITH RECURSIVE subtasks AS (
      SELECT source_id AS id FROM edges
      WHERE target_id = $1 AND type = 'dependency' AND graph_id = $2
      UNION
      SELECT e.source_id FROM edges e
      JOIN subtasks s ON e.target_id = s.id
      WHERE e.type = 'dependency' AND e.graph_id = $2
    )
    SELECT t.* FROM tasks t JOIN subtasks s ON t.id = s.id ORDER BY t.id`,
    [id, gid]
  );
  res.json(result.rows);
});

// Blockers = recursive prerequisites that aren't 'done' yet. Use this to
// answer "what's stopping me from finishing X?" — returns both
// in_progress/review tasks (work in flight) and todo tasks (not started).
router.get('/:id/blockers', validateId, async (req, res) => {
  const { gid, id } = req.params;
  const exists = await pool.query(
    'SELECT 1 FROM tasks WHERE id = $1 AND graph_id = $2',
    [id, gid]
  );
  if (exists.rows.length === 0) return res.status(404).json({ error: 'not found' });

  const result = await pool.query(
    `WITH RECURSIVE chain AS (
      SELECT source_id AS id FROM edges
      WHERE target_id = $1 AND type = 'dependency' AND graph_id = $2
      UNION
      SELECT e.source_id FROM edges e
      JOIN chain c ON e.target_id = c.id
      WHERE e.type = 'dependency' AND e.graph_id = $2
    )
    SELECT t.* FROM tasks t
    JOIN chain c ON t.id = c.id
    WHERE t.meta->>'status' <> 'done'
    ORDER BY t.id`,
    [id, gid]
  );
  res.json(result.rows);
});

// Unblocks = direct parent tasks that would become ready-to-start if THIS
// task were marked 'done'. Single-level only (a parent only becomes ready
// the moment its last blocker finishes; transitive unblocking happens as
// each level resolves). Use this to answer "if I finish review of X, what
// opens up?"
router.get('/:id/unblocks', validateId, async (req, res) => {
  const { gid, id } = req.params;
  const exists = await pool.query(
    'SELECT 1 FROM tasks WHERE id = $1 AND graph_id = $2',
    [id, gid]
  );
  if (exists.rows.length === 0) return res.status(404).json({ error: 'not found' });

  const result = await pool.query(
    `SELECT t.* FROM tasks t
     JOIN edges parent_edge
       ON parent_edge.target_id = t.id
      AND parent_edge.source_id = $1
      AND parent_edge.type = 'dependency'
      AND parent_edge.graph_id = $2
     WHERE t.graph_id = $2
       AND t.meta->>'status' = 'todo'
       AND NOT EXISTS (
         SELECT 1 FROM edges other
         JOIN tasks other_task ON other_task.id = other.source_id
         WHERE other.target_id = t.id
           AND other.type = 'dependency'
           AND other.graph_id = $2
           AND other.source_id <> $1
           AND other_task.meta->>'status' <> 'done'
       )
     ORDER BY t.id`,
    [id, gid]
  );
  res.json(result.rows);
});

// Ancestors = all dependents (things that depend on this task being done)
router.get('/:id/ancestors', validateId, async (req, res) => {
  const { gid, id } = req.params;
  const exists = await pool.query(
    'SELECT 1 FROM tasks WHERE id = $1 AND graph_id = $2',
    [id, gid]
  );
  if (exists.rows.length === 0) return res.status(404).json({ error: 'not found' });

  const result = await pool.query(
    `WITH RECURSIVE ancestors AS (
      SELECT target_id AS id FROM edges
      WHERE source_id = $1 AND type = 'dependency' AND graph_id = $2
      UNION
      SELECT e.target_id FROM edges e
      JOIN ancestors a ON e.source_id = a.id
      WHERE e.type = 'dependency' AND e.graph_id = $2
    )
    SELECT t.* FROM tasks t JOIN ancestors a ON t.id = a.id ORDER BY t.id`,
    [id, gid]
  );
  res.json(result.rows);
});

export default router;
