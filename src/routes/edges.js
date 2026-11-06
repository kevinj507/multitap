import { Router } from 'express';
import pool from '../db.js';
import {
  eventQuery,
  withEventTx,
  parseHappenedAt,
  rejectBadCauseId,
  HAPPENED_AT_HEADER,
} from '../events/context.js';
import { requireIntegerParam } from './_validate.js';
import { mergeFields, flattenJsonb, unflattenJsonb } from '../merge.js';
import {
  VALID_TYPES,
  EDGE_PURPOSES,
  DEFAULT_PURPOSE,
  PURPOSE_ERROR,
  purposeToType,
  resolveEdgeKind,
} from '../edgePurpose.js';
// E18.3 — the per-edge doubt-propagation weight. The interval lives in the pure
// module beside the default weight map, so the write path and the walk cannot
// disagree about what a legal weight is.
import { MIN_PROPAGATION, MAX_PROPAGATION } from '../doubt.js';
// E18.5 — the option tag. The validator lives beside the readers in the pure
// module so the write path and the branch derivation cannot disagree about what
// a legal role is.
import { BRANCH_META_KEY, normalizeBranch } from '../branches.js';

// Re-export the pure derivation helpers so existing importers (batch.js, tests)
// can keep pulling them from the edges route module.
export {
  VALID_TYPES,
  EDGE_PURPOSES,
  DEFAULT_PURPOSE,
  PURPOSE_ERROR,
  purposeToType,
  resolveEdgeKind,
};

const router = Router({ mergeParams: true });
const validateId = requireIntegerParam('id');

// E18.1 — backdating gate. See the identical note in src/routes/tasks.js:
// `happened_at` (world time) is a caller input and may be in the past;
// `learned_at` (belief time) is stamped by the database and accepted from
// nowhere. Rejecting a malformed value here means a bad request writes no row
// and therefore no event.
function rejectBadHappenedAt(req, res) {
  const h = parseHappenedAt(req.body?.happened_at ?? req.headers?.[HAPPENED_AT_HEADER]);
  if (h.error) {
    res.status(400).json({ error: h.error });
    return true;
  }
  return false;
}

// Shape edges use for OCC merge: top-level scalar fields + meta keys
// flattened to `meta.<key>` so concurrent edits to different meta keys
// (e.g. one writer touches color, the other touches curve) merge cleanly.
// Keyed on `purpose` (canonical), NOT `type` — `type` is re-derived after the
// merge so two writers can't disagree on the derived value.
export function flattenEdge(row) {
  return flattenJsonb(
    {
      source_id: row.source_id,
      target_id: row.target_id,
      purpose: row.purpose ?? DEFAULT_PURPOSE,
      meta: row.meta || {},
    },
    'meta',
  );
}
export function unflattenEdge(flat) {
  const out = unflattenJsonb(flat, 'meta');
  const purpose = out.purpose ?? DEFAULT_PURPOSE;
  return {
    source_id: out.source_id,
    target_id: out.target_id,
    purpose,
    type: purposeToType(purpose),
    meta: out.meta || {},
  };
}
const MAX_CURVE = 500;
const MIN_WEIGHT = 0.10;
const MAX_WEIGHT = 0.90;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

class CycleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CycleError';
  }
}

class CrossGraphError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CrossGraphError';
  }
}

export function normalizeMeta(raw = {}) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'meta must be an object' };
  }
  const meta = {};
  if (raw.curve !== undefined && raw.curve !== null && raw.curve !== '') {
    let distance, weight;
    if (typeof raw.curve === 'object' && !Array.isArray(raw.curve)) {
      // Canonical form: { distance, weight } — distance is the perpendicular
      // offset (legacy "curve"); weight is the bezier control-point position
      // along the edge (0..1, 0.5 = midpoint).
      distance = Number(raw.curve.distance);
      weight = raw.curve.weight === undefined ? 0.5 : Number(raw.curve.weight);
    } else {
      // Legacy: a bare number meant perpendicular offset with weight=0.5.
      distance = Number(raw.curve);
      weight = 0.5;
    }
    if (!Number.isFinite(distance) || Math.abs(distance) > MAX_CURVE) {
      return { error: `curve.distance must be a number between -${MAX_CURVE} and ${MAX_CURVE}` };
    }
    if (!Number.isFinite(weight) || weight < MIN_WEIGHT || weight > MAX_WEIGHT) {
      return { error: `curve.weight must be a number between ${MIN_WEIGHT} and ${MAX_WEIGHT}` };
    }
    meta.curve = {
      distance: Math.round(distance * 100) / 100,
      weight: Math.round(weight * 1000) / 1000,
    };
  }
  if (raw.color !== undefined && raw.color !== null && raw.color !== '') {
    const color = String(raw.color).trim();
    if (!HEX_COLOR.test(color)) {
      return { error: 'color must be a 6-digit hex value' };
    }
    meta.color = color;
  }
  // E18.3 — `propagation`: how much of a weakening this relation carries to its
  // target, in (0, 1]. The deterministic-engine hook — a pipeline that knows the
  // exact magnitude writes it on the RELATION and the ripple carries it exactly,
  // which is what a per-request weight map cannot express.
  //
  // NOT `meta.weight`, and the reason is three lines up: `meta.curve.weight` is
  // already the bezier control-point position along the edge, 0..1, with
  // MIN_WEIGHT / MAX_WEIGHT taken for it in this very file. A sibling
  // `meta.weight` meaning "doubt attenuation" would sit one key away from a
  // rendering parameter with the same name and the same range.
  //
  // THE INTERVAL IS OPEN AT ZERO AND CLOSED AT ONE, and that is not tidiness:
  // it is E18.3's termination argument. A weight > 1 lets a `supports` cycle
  // amplify without bound and demotes a correctness property to a configuration
  // accident. So: 400, never a clamp.
  if (raw.propagation !== undefined && raw.propagation !== null && raw.propagation !== '') {
    const propagation = Number(raw.propagation);
    if (!Number.isFinite(propagation)
        || propagation <= MIN_PROPAGATION || propagation > MAX_PROPAGATION) {
      return {
        error: `propagation must be a number greater than ${MIN_PROPAGATION} and at most ${MAX_PROPAGATION}`,
      };
    }
    meta.propagation = propagation;
  }
  // E18.5 — `branch`: which road this option edge is. `{role: 'chosen' |
  // 'alternative'}` on a `related to` edge from a decision to an option node,
  // and the ONLY new vocabulary the branch-point rung adds.
  //
  // THIS FUNCTION IS AN ALLOWLIST — it builds a FRESH object and copies only the
  // keys it knows — so a key it does not learn is dropped SILENTLY, with a 200.
  // Ship the branch reader before this line and the tagging simply disappears
  // with no error anywhere, which is why this is the first edit of the rung and
  // not the last.
  if (raw[BRANCH_META_KEY] !== undefined && raw[BRANCH_META_KEY] !== null
      && raw[BRANCH_META_KEY] !== '') {
    const branch = normalizeBranch(raw[BRANCH_META_KEY]);
    if (branch.error) return { error: branch.error };
    meta[BRANCH_META_KEY] = branch.value;
  }
  return { meta };
}

// Verify both endpoints exist and belong to this graph. Done inside the same
// txn as the cycle check so a concurrent task move can't slip past us.
async function assertEndpointsInGraph(client, gid, sourceId, targetId) {
  const r = await client.query(
    `SELECT id FROM tasks WHERE id = ANY($1::int[]) AND graph_id = $2`,
    [[sourceId, targetId], gid]
  );
  if (r.rows.length !== 2) {
    throw new CrossGraphError('source and target must both exist in this graph');
  }
}

router.post('/', async (req, res) => {
  const { gid } = req.params;
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;
  const { source_id, target_id } = req.body;
  const normalizedMeta = normalizeMeta(req.body.meta || {});
  if (normalizedMeta.error) return res.status(400).json({ error: normalizedMeta.error });

  if (!source_id) return res.status(400).json({ error: 'source_id is required' });
  if (!target_id) return res.status(400).json({ error: 'target_id is required' });
  const kind = resolveEdgeKind(req.body);
  if (kind.error) return res.status(400).json({ error: kind.error });
  const { purpose, type } = kind;
  if (source_id === target_id)
    return res.status(400).json({ error: 'source and target must be different' });

  try {
    // withEventTx is withTx plus one statement: the actor context, applied right
    // after BEGIN. The LOCK TABLE below is unaffected — it simply runs second.
    const row = await withEventTx(req, async (client) => {
      // Serialize concurrent edge writers in this graph so the cycle check below
      // can't be raced. Reads still proceed (SHARE ROW EXCLUSIVE allows SELECT).
      // LOCK ORDER: the graphs row FIRST, then the edges table. A task DELETE
      // acquires them in exactly that order — its BEFORE-DELETE trigger calls
      // gt_next_seq (graphs row) before ON DELETE CASCADE reaches edges — so an
      // edge route that took the table first and the row second would deadlock
      // against any concurrent task delete in the same graph. Both 500. This
      // SELECT costs nothing new: bump_graph_updated_at() takes the same
      // NO KEY UPDATE lock on the same row before this transaction commits
      // anyway; it is only being taken EARLIER so the two orders agree.
      // tests/e18-concurrency.test.js pins it.
      await client.query('SELECT 1 FROM graphs WHERE id = $1 FOR NO KEY UPDATE', [gid]);
      await client.query('LOCK TABLE edges IN SHARE ROW EXCLUSIVE MODE');
      await assertEndpointsInGraph(client, gid, source_id, target_id);

      if (type === 'dependency') {
        const cycle = await client.query(
          `WITH RECURSIVE chain AS (
            SELECT target_id AS node FROM edges
            WHERE source_id = $1 AND type = 'dependency' AND graph_id = $3
            UNION
            SELECT e.target_id FROM edges e
            JOIN chain c ON e.source_id = c.node
            WHERE e.type = 'dependency' AND e.graph_id = $3
          )
          SELECT 1 FROM chain WHERE node = $2 LIMIT 1`,
          [target_id, source_id, gid]
        );
        if (cycle.rows.length > 0)
          throw new CycleError('adding this edge would create a cycle');
      }

      const result = await client.query(
        `INSERT INTO edges (graph_id, source_id, target_id, type, purpose, meta, last_modified_by, last_modified_by_user)
         VALUES ($1, $2, $3, $4::edge_type, $5, $6, $7, $8) RETURNING *`,
        [gid, source_id, target_id, type, purpose, JSON.stringify(normalizedMeta.meta), req.writerType, req.user?.id ?? null]
      );
      return result.rows[0];
    });
    res.status(201).json(row);
  } catch (err) {
    if (err instanceof CycleError) return res.status(400).json({ error: err.message });
    if (err instanceof CrossGraphError) return res.status(400).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'edge already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'referenced task does not exist' });
    if (err.code === '23514') return res.status(400).json({ error: 'invalid edge' });
    throw err;
  }
});

// Transactional bulk-insert. Either every edge in the batch lands or none —
// the agent's mental model is "I either got my whole DAG wired or nothing
// happened, retry." Validates input shape up front; runs cycle detection
// once after all rows are inserted so multi-edge cycles (A→B + B→A in the
// same call) are caught.
router.post('/bulk', async (req, res) => {
  const { gid } = req.params;
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;
  const list = req.body && req.body.edges;
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'edges must be an array' });
  }
  if (list.length === 0) {
    return res.status(400).json({ error: 'edges must not be empty' });
  }
  if (list.length > 500) {
    return res.status(400).json({ error: 'edges must be 500 or fewer per call' });
  }

  // Pre-validate every spec so we can fail fast with the offending index.
  const normalized = [];
  for (let i = 0; i < list.length; i++) {
    const spec = list[i] || {};
    const { source_id, target_id } = spec;
    if (!Number.isInteger(source_id))
      return res.status(400).json({ error: 'source_id must be an integer', failedAt: i });
    if (!Number.isInteger(target_id))
      return res.status(400).json({ error: 'target_id must be an integer', failedAt: i });
    const kind = resolveEdgeKind(spec);
    if (kind.error)
      return res.status(400).json({ error: kind.error, failedAt: i });
    if (source_id === target_id)
      return res.status(400).json({ error: 'source and target must be different', failedAt: i });
    const normMeta = normalizeMeta(spec.meta || {});
    if (normMeta.error)
      return res.status(400).json({ error: normMeta.error, failedAt: i });
    normalized.push({ source_id, target_id, type: kind.type, purpose: kind.purpose, meta: normMeta.meta });
  }

  try {
    // One HTTP request, up to 500 inserted rows, so up to 500 edge.added events
    // — one per CHANGED row, which is the restated DONE-WHEN. They share a
    // single request_id, which is what groups the fan-out back into one action.
    const rows = await withEventTx(req, async (client) => {
      // Graphs row first, then the edges table — see the lock-order note on
      // POST / above. Must match the order a task DELETE takes.
      await client.query('SELECT 1 FROM graphs WHERE id = $1 FOR NO KEY UPDATE', [gid]);
      await client.query('LOCK TABLE edges IN SHARE ROW EXCLUSIVE MODE');

      // Verify every referenced task belongs to this graph in one shot.
      const allTaskIds = [...new Set(normalized.flatMap((e) => [e.source_id, e.target_id]))];
      const taskCheck = await client.query(
        `SELECT id FROM tasks WHERE id = ANY($1::int[]) AND graph_id = $2`,
        [allTaskIds, gid]
      );
      if (taskCheck.rows.length !== allTaskIds.length) {
        throw new CrossGraphError('one or more endpoints are not tasks in this graph');
      }

      // Insert all edges. Tag failures with the input index so the client
      // can report which edge tripped a duplicate / FK violation.
      const inserted = [];
      for (let i = 0; i < normalized.length; i++) {
        const e = normalized[i];
        try {
          const r = await client.query(
            `INSERT INTO edges (graph_id, source_id, target_id, type, purpose, meta, last_modified_by, last_modified_by_user)
             VALUES ($1, $2, $3, $4::edge_type, $5, $6, $7, $8) RETURNING *`,
            [gid, e.source_id, e.target_id, e.type, e.purpose, JSON.stringify(e.meta), req.writerType, req.user?.id ?? null]
          );
          inserted.push(r.rows[0]);
        } catch (err) {
          err._failedAt = i;
          throw err;
        }
      }

      // Cycle check after all rows are in place. For any cycle through
      // these new edges, at least one of them must close a loop, so
      // running the per-edge check on each new dep edge catches all cases
      // including A→B + B→A in the same batch.
      for (let i = 0; i < inserted.length; i++) {
        const row = inserted[i];
        if (row.type !== 'dependency') continue;
        const cycle = await client.query(
          `WITH RECURSIVE chain AS (
            SELECT target_id AS node FROM edges
            WHERE source_id = $1 AND type = 'dependency' AND graph_id = $3
            UNION
            SELECT e.target_id FROM edges e
            JOIN chain c ON e.source_id = c.node
            WHERE e.type = 'dependency' AND e.graph_id = $3
          )
          SELECT 1 FROM chain WHERE node = $2 LIMIT 1`,
          [row.target_id, row.source_id, gid]
        );
        if (cycle.rows.length > 0) {
          const err = new CycleError('bulk insert would create a cycle');
          err._failedAt = i;
          throw err;
        }
      }

      return inserted;
    });
    res.status(201).json({ edges: rows });
  } catch (err) {
    const failedAt = err._failedAt;
    const respond = (status, message) => {
      const body = { error: message };
      if (failedAt !== undefined) body.failedAt = failedAt;
      return res.status(status).json(body);
    };
    if (err instanceof CycleError) return respond(400, err.message);
    if (err instanceof CrossGraphError) return respond(400, err.message);
    if (err.code === '23505') return respond(409, 'edge already exists between these nodes');
    if (err.code === '23503') return respond(400, 'referenced task does not exist');
    if (err.code === '23514') return respond(400, 'invalid edge');
    throw err;
  }
});

router.get('/', async (req, res) => {
  const { gid } = req.params;
  const result = await pool.query(
    'SELECT * FROM edges WHERE graph_id = $1 ORDER BY created_at DESC',
    [gid]
  );
  res.json(result.rows);
});

router.patch('/:id', validateId, async (req, res) => {
  const { gid, id } = req.params;
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;
  const { source_id, target_id, base_version, base_row } = req.body;

  // Resolve the writer's intended purpose: `purpose` when given, else undefined
  // = "not changing the purpose" → inherit it from the base row in writerRow
  // below. `type` is no longer accepted as input.
  let writerPurpose;
  if (req.body.purpose !== undefined && req.body.purpose !== null) {
    // The message is imported, never retyped: this branch is the third copy of
    // the vocabulary and was the one most likely to go stale when E18.4 added
    // a fifth purpose.
    if (!EDGE_PURPOSES.includes(req.body.purpose))
      return res.status(400).json({ error: PURPOSE_ERROR });
    writerPurpose = req.body.purpose;
  }

  const current = await pool.query(
    `SELECT e.*, g.owner_user_id AS graph_owner_user_id
       FROM edges e
       JOIN graphs g ON g.id = e.graph_id
      WHERE e.id = $1 AND e.graph_id = $2`,
    [id, gid]
  );
  if (current.rows.length === 0) return res.status(410).json({ error: 'edge no longer exists' });
  const existing = current.rows[0];

  // The writer's "base view" — the row state they think they're editing
  // against. Used both as the diff base for the merge and as the source of
  // truth for fields the writer didn't mention in this PATCH. Falls back to
  // the current row when the client hasn't opted in to OCC.
  const base = base_row || existing;
  // Fall back to the EXISTING row's purpose, never to the global default. A
  // client that sends a base_row without a `purpose` key is saying "I did not
  // look at the purpose", not "set it to 'related to'" — and the canvas sends
  // exactly that shape for a colour or curve edit. Falling back to
  // DEFAULT_PURPOSE silently retyped a `supersedes` edge to 'related to' on any
  // such edit, which UN-SUPERSEDES the fact: it reappears in the re-check
  // queues and its worldline loses a generation. Pinned by
  // tests/e18-supersedes.test.js.
  const basePurpose = base.purpose ?? existing.purpose ?? DEFAULT_PURPOSE;

  // Build the writer's intended full row: their base view with the partial
  // changes applied. Meta is a shallow merge so writers can patch individual
  // keys (color, curve) without overwriting the rest.
  let writerMeta = { ...(base.meta || {}) };
  if (req.body.meta !== undefined) {
    const normalizedMeta = normalizeMeta(req.body.meta);
    if (normalizedMeta.error) return res.status(400).json({ error: normalizedMeta.error });
    writerMeta = { ...writerMeta, ...normalizedMeta.meta };
    if (req.body.meta.curve === null) delete writerMeta.curve;
    if (req.body.meta.color === null) delete writerMeta.color;
    if (req.body.meta.propagation === null) delete writerMeta.propagation;
    if (req.body.meta[BRANCH_META_KEY] === null) delete writerMeta[BRANCH_META_KEY];
  }
  const writerRow = {
    source_id: source_id !== undefined ? source_id : base.source_id,
    target_id: target_id !== undefined ? target_id : base.target_id,
    purpose: writerPurpose !== undefined ? writerPurpose : basePurpose,
    meta: writerMeta,
  };

  // Three-way merge runs only when the client opted in (sent base_row +
  // base_version) AND a concurrent write has happened. Without those, fall
  // back to the writer's row directly (backward compat for older clients
  // and for paths that don't carry OCC fields yet).
  let finalRow;
  if (base_row && base_version !== undefined && base_version !== existing.version) {
    const { merged } = mergeFields(
      flattenEdge(base),
      flattenEdge(writerRow),
      flattenEdge(existing),
      {
        writerType: req.writerType,
        currentWriterType: existing.last_modified_by,
        writerOwnerId: req.user?.id ?? null,
        currentOwnerId: existing.last_modified_by_user ?? null,
        graphOwnerId: existing.graph_owner_user_id ?? null,
        // UI-managed edge keys: hover-handle drag writes `meta.curve`,
        // palette writes `meta.color`. Agents that PATCH edges without
        // those keys (typical when rewiring source/target/type) would
        // otherwise wipe user bezier shaping and color.
        // `meta.propagation` (E18.3) joins them on the same reasoning E18.2
        // used for `refuted_at` and `decay`: it is a STRUCTURAL property of the
        // relation — how much doubt this edge conducts — and an agent rewiring
        // an edge without mentioning it must not wipe it.
        // E18.5's `meta.branch` joins them for the same reason, and the stakes
        // are the highest yet: it is WHICH ROAD WAS TAKEN. An agent PATCHing an
        // edge to fix a colour must not be able to erase that — this is the
        // `meta.propagation` incident's exact shape, one rung along.
        protectedFromAgentRemoval: [
          'meta.color', 'meta.curve', 'meta.propagation', `meta.${BRANCH_META_KEY}`,
        ],
      },
    );
    finalRow = unflattenEdge(merged);
  } else {
    finalRow = writerRow;
  }

  const newSource = finalRow.source_id;
  const newTarget = finalRow.target_id;
  const newPurpose = finalRow.purpose ?? DEFAULT_PURPOSE;
  const newType = purposeToType(newPurpose);
  const newMeta = finalRow.meta;

  if (newSource === newTarget)
    return res.status(400).json({ error: 'source and target must be different' });

  try {
    const row = await withEventTx(req, async (client) => {
      // Graphs row first, then the edges table — see the lock-order note on
      // POST / above. Must match the order a task DELETE takes.
      await client.query('SELECT 1 FROM graphs WHERE id = $1 FOR NO KEY UPDATE', [gid]);
      await client.query('LOCK TABLE edges IN SHARE ROW EXCLUSIVE MODE');
      await assertEndpointsInGraph(client, gid, newSource, newTarget);

      if (newType === 'dependency') {
        const cycle = await client.query(
          `WITH RECURSIVE chain AS (
            SELECT target_id AS node FROM edges
            WHERE source_id = $1 AND type = 'dependency' AND id <> $3 AND graph_id = $4
            UNION
            SELECT e.target_id FROM edges e
            JOIN chain c ON e.source_id = c.node
            WHERE e.type = 'dependency' AND e.id <> $3 AND e.graph_id = $4
          )
          SELECT 1 FROM chain WHERE node = $2 LIMIT 1`,
          [newTarget, newSource, id, gid]
        );
        if (cycle.rows.length > 0)
          throw new CycleError('change would create a cycle');
      }

      const result = await client.query(
        `UPDATE edges
            SET source_id = $1,
                target_id = $2,
                type = $3::edge_type,
                purpose = $4,
                meta = $5,
                version = version + 1,
                last_modified_by = $6,
                last_modified_by_user = $7
          WHERE id = $8 AND graph_id = $9
        RETURNING *`,
        [newSource, newTarget, newType, newPurpose, JSON.stringify(newMeta), req.writerType, req.user?.id ?? null, id, gid]
      );
      return result.rows[0];
    });
    res.json(row);
  } catch (err) {
    if (err instanceof CycleError) return res.status(400).json({ error: err.message });
    if (err instanceof CrossGraphError) return res.status(400).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'edge already exists between these nodes' });
    if (err.code === '23503') return res.status(400).json({ error: 'referenced task does not exist' });
    if (err.code === '23514') return res.status(400).json({ error: 'invalid edge' });
    throw err;
  }
});

router.delete('/:id', validateId, async (req, res) => {
  const { gid, id } = req.params;
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;
  const result = await eventQuery(
    req,
    'DELETE FROM edges WHERE id = $1 AND graph_id = $2 RETURNING id',
    [id, gid]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: result.rows[0].id });
});

export default router;
