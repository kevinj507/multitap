import { Router } from 'express';
import pool from '../db.js';
import {
  eventQuery,
  parseHappenedAt,
  rejectBadCauseId,
  HAPPENED_AT_HEADER,
} from '../events/context.js';
import { mergeFields, flattenJsonb, unflattenJsonb } from '../merge.js';
import { requireGraph } from '../auth/require.js';
import { authEnabled } from '../auth/index.js';
import { canEdit, canManage } from '../auth/access.js';
import { broadcastGraphEvent } from '../sse.js';

const router = Router();

const NAME_MAX = 80;
const DESCRIPTION_MAX = 500;
const ALLOWED_SETTINGS_KEYS = ['font', 'font_color', 'bg_color'];
const ALLOWED_ANON_ROLES = ['none', 'viewer', 'editor'];
const ALLOWED_FONT_IDS = ['inter', 'garamond', 'roboto'];
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// Validate a partial settings patch. Each key must be in ALLOWED_SETTINGS_KEYS;
// null clears the key (server merges and strips nulls). Returns an error
// string or null if valid.
function validateSettings(settings) {
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) {
    return 'settings must be an object';
  }
  for (const k of Object.keys(settings)) {
    if (!ALLOWED_SETTINGS_KEYS.includes(k)) return `unknown settings key: ${k}`;
    const v = settings[k];
    if (v === null) continue; // null clears the key
    if (k === 'font') {
      if (typeof v !== 'string' || !ALLOWED_FONT_IDS.includes(v)) {
        return `font must be one of: ${ALLOWED_FONT_IDS.join(', ')}`;
      }
    } else {
      // font_color / bg_color
      if (typeof v !== 'string' || !HEX_COLOR_RE.test(v)) {
        return `${k} must be a 6-digit hex color`;
      }
    }
  }
  return null;
}

function validateName(name) {
  if (typeof name !== 'string') return 'name is required';
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'name is required';
  if (name.length > NAME_MAX) return `name must be ${NAME_MAX} characters or less`;
  return null;
}

function validateDescription(description) {
  if (description === undefined || description === null) return null;
  if (typeof description !== 'string') return 'description must be a string';
  if (description.length > DESCRIPTION_MAX)
    return `description must be ${DESCRIPTION_MAX} characters or less`;
  return null;
}

// Listing endpoint. Post-Phase-B5c there's no public-directory concept —
// `anon_role` controls who can access a graph via its URL, not whether
// strangers can discover it. So the listing simply returns:
//   - authed:    graphs you own + graphs you're a member of
//   - anonymous: empty (legacy un-owned graphs remain reachable by URL only)
router.get('/', async (req, res) => {
  if (!req.user) return res.json([]);
  const result = await pool.query(
    `SELECT * FROM graphs
      WHERE owner_user_id = $1
         OR id IN (SELECT graph_id FROM graph_members WHERE user_id = $1)
      ORDER BY updated_at DESC, id DESC`,
    [req.user.id],
  );
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  // Orphan guard. On an accounts-enabled instance, silently creating an
  // owner-less graph for an unauthenticated caller is a footgun: it returns
  // 201 but the graph has owner_user_id = NULL, so it never shows in the
  // caller's "My graphs" and is reachable only by URL — easy to think you
  // saved work you actually orphaned. Refuse unless the caller either
  // authenticates (agent token / session) or explicitly opts in with
  // `allow_anonymous: true`. No-auth instances (authEnabled() === false) and
  // authenticated callers are unaffected. See auth-model.md.
  const allowAnonymous = req.body?.allow_anonymous === true;
  if (!req.user && authEnabled() && !allowAnonymous) {
    return res.status(401).json({
      error: 'refusing to create a graph with no owner',
      hint:
        'This instance has accounts enabled, but this request is unauthenticated — ' +
        'the graph would have no owner and never appear in your "My graphs". Send an ' +
        'agent token (Authorization: Bearer gt_…) to save it to your account, or pass ' +
        '{"allow_anonymous": true} to intentionally create an owner-less, URL-only graph.',
    });
  }

  const { name, description } = req.body;
  const nameErr = validateName(name);
  if (nameErr) return res.status(400).json({ error: nameErr });
  const descErr = validateDescription(description);
  if (descErr) return res.status(400).json({ error: descErr });

  // graphs.id has a Postgres DEFAULT that generates a random string. On the
  // negligible chance of an id collision, retry with a fresh DEFAULT. New
  // graphs default to is_public=false at the schema level. Anonymous create
  // is still allowed — those rows land with owner_user_id = NULL and behave
  // as legacy URL-bearer graphs forever, even on an auth-on deployment.
  const ownerUserId = req.user?.id ?? null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await pool.query(
        `INSERT INTO graphs (name, description, owner_user_id, last_modified_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name.trim(), description ?? null, ownerUserId, req.writerType]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code !== '23505') throw err; // unique_violation on id — retry
    }
  }
  res.status(500).json({ error: 'failed to allocate graph id' });
});

router.get('/:id', requireGraph('read'), async (req, res) => {
  // requireGraph already loaded the row into req.graph; no second query.
  // Annotate with the viewer's capabilities so the frontend can toggle
  // read-only mode without a second roundtrip.
  res.json({
    ...req.graph,
    viewer_can_edit: canEdit(req.user, req.graph, req.graphMember),
    viewer_can_manage: canManage(req.user, req.graph),
  });
});

router.patch('/:id', requireGraph('manage'), async (req, res) => {
  const { name, description, settings, anon_role, base_version, base_row } = req.body;

  // Caller has to ask for at least one field change. base_row / base_version
  // don't count — they describe intent for the merge, not the write itself.
  if (
    name === undefined &&
    description === undefined &&
    settings === undefined &&
    anon_role === undefined
  ) {
    return res.status(400).json({ error: 'nothing to update' });
  }

  if (name !== undefined) {
    const err = validateName(name);
    if (err) return res.status(400).json({ error: err });
  }
  if (description !== undefined) {
    const err = validateDescription(description);
    if (err) return res.status(400).json({ error: err });
  }
  if (settings !== undefined) {
    const err = validateSettings(settings);
    if (err) return res.status(400).json({ error: err });
  }
  if (anon_role !== undefined && !ALLOWED_ANON_ROLES.includes(anon_role)) {
    return res.status(400).json({ error: `anon_role must be one of ${ALLOWED_ANON_ROLES.join(', ')}` });
  }

  const curRes = await pool.query('SELECT * FROM graphs WHERE id = $1', [req.params.id]);
  if (curRes.rows.length === 0) return res.status(410).json({ error: 'graph no longer exists' });
  const existing = curRes.rows[0];

  // Build the writer's intended full row from their base view + partial
  // changes. Settings is a shallow merge so writers can patch individual
  // appearance keys without overwriting the rest; explicit `null` clears
  // a key back to the app default.
  const base = base_row || existing;
  let writerSettings = { ...(base.settings || {}) };
  if (settings !== undefined) {
    for (const [k, v] of Object.entries(settings)) {
      if (v === null) delete writerSettings[k];
      else writerSettings[k] = v;
    }
  }
  const writerRow = {
    name: name !== undefined ? name.trim() : base.name,
    description: description !== undefined ? description : base.description,
    settings: writerSettings,
    anon_role: anon_role !== undefined ? anon_role : base.anon_role,
  };

  // Three-way merge fires only when the client opted in (base_row +
  // base_version) AND a concurrent write happened. Otherwise the writer's
  // row is the final row (backward compat for older clients).
  let finalRow;
  if (base_row && base_version !== undefined && base_version !== existing.version) {
    const { merged } = mergeFields(
      flattenJsonb(base, 'settings'),
      flattenJsonb(writerRow, 'settings'),
      flattenJsonb(existing, 'settings'),
      { writerType: req.writerType, currentWriterType: existing.last_modified_by },
    );
    const unflat = unflattenJsonb(merged, 'settings');
    finalRow = {
      name: unflat.name,
      description: unflat.description,
      settings: unflat.settings || {},
      anon_role: writerRow.anon_role,
    };
  } else {
    finalRow = writerRow;
  }

  const result = await pool.query(
    `UPDATE graphs
        SET name = $1,
            description = $2,
            settings = $3::jsonb,
            anon_role = $4,
            version = version + 1,
            last_modified_by = $5,
            updated_at = NOW()
      WHERE id = $6
    RETURNING *`,
    [
      finalRow.name,
      finalRow.description,
      JSON.stringify(finalRow.settings || {}),
      finalRow.anon_role,
      req.writerType,
      req.params.id,
    ],
  );
  if (result.rows.length === 0) return res.status(410).json({ error: 'graph no longer exists' });
  // Push an SSE frame so live viewers refetch — without this, an anon_role
  // flip (e.g. viewer → none) doesn't reach an open incognito tab until the
  // viewer manually reloads. Same pattern as graph_members.DELETE; the
  // graphs table itself has no DB trigger.
  broadcastGraphEvent(result.rows[0].id, {
    graph_id: result.rows[0].id,
    kind: 'graphs',
    op: 'UPDATE',
    id: result.rows[0].id,
  });
  res.json(result.rows[0]);
});

// Claim a legacy (un-owned) graph as the signed-in user. Only succeeds when
// `owner_user_id IS NULL` — owned graphs are off-limits regardless of who
// requests. Idempotent if the requester is already the owner (no-op 200).
// The localStorage `created: true` flag in the browser drives auto-claim on
// sign-in (see public/app.js); this endpoint trusts URL-bearer access for
// legacy graphs since that was Phase A's model anyway.
router.post('/:id/claim', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'sign in required' });
  const cur = await pool.query('SELECT owner_user_id FROM graphs WHERE id = $1', [req.params.id]);
  if (cur.rows.length === 0) return res.status(404).json({ error: 'not found' });
  const ownerId = cur.rows[0].owner_user_id;
  if (ownerId === req.user.id) {
    return res.json({ claimed: false, already_owner: true });
  }
  if (ownerId !== null) {
    return res.status(403).json({ error: 'already claimed by another user' });
  }
  const r = await pool.query(
    `UPDATE graphs SET owner_user_id = $1, updated_at = NOW()
      WHERE id = $2 AND owner_user_id IS NULL RETURNING *`,
    [req.user.id, req.params.id],
  );
  if (r.rows.length === 0) {
    // Lost the race to another claimer in the milliseconds since the SELECT.
    return res.status(403).json({ error: 'already claimed by another user' });
  }
  res.json({ claimed: true, graph: r.rows[0] });
});

// E18.1 — backdating gate, identical to the one in tasks.js / edges.js.
function rejectBadHappenedAt(req, res) {
  const h = parseHappenedAt(req.body?.happened_at ?? req.headers?.[HAPPENED_AT_HEADER]);
  if (h.error) {
    res.status(400).json({ error: h.error });
    return true;
  }
  return false;
}

// The graph row is gone after this, and with it every task and edge via
// ON DELETE CASCADE — which is precisely when the log becomes the only record
// of what existed. events/graph_snapshots carry NO foreign key to graphs for
// that reason, so nothing here erases them. eventQuery (not pool.query) so the
// graph.deleted tombstone and the whole cascade carry a real actor instead of
// 'system', and land in one transaction.
router.delete('/:id', requireGraph('manage'), async (req, res) => {
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, req.params.id)) return;
  const result = await eventQuery(
    req,
    'DELETE FROM graphs WHERE id = $1 RETURNING id',
    [req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: result.rows[0].id });
});

// Rotate a graph's ID. The URL is the bearer token in the no-auth privacy
// model — rotating invalidates any previously shared link. ON UPDATE CASCADE
// on tasks/edges FKs propagates the new id automatically.
router.post('/:id/rotate-id', requireGraph('manage'), async (req, res) => {
  const oldId = req.params.id;
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, req.params.id)) return;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // eventQuery so the single graph.id_rotated event carries the actor. The
      // mass graph_id rewrite the ON UPDATE CASCADE performs on every task and
      // edge row is deliberately silent: graph_id is in the row loggers'
      // drop_cols, so each cascaded UPDATE diffs to ch = '{}' and emits
      // nothing. One rotation = one event, not one per row.
      const result = await eventQuery(
        req,
        `UPDATE graphs
            SET id = generate_short_graph_id(), updated_at = NOW()
          WHERE id = $1
        RETURNING *`,
        [oldId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
      return res.json(result.rows[0]);
    } catch (err) {
      if (err.code !== '23505') throw err; // unique_violation — retry
    }
  }
  res.status(500).json({ error: 'failed to allocate graph id' });
});

export default router;
