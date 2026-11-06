import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  withEventTx,
  parseHappenedAt,
  rejectBadCauseId,
  HAPPENED_AT_HEADER,
} from '../events/context.js';
import { parseMarkdown, serializeMarkdown, validateMeta, applyDefaults } from '../markdown.js';
import { mergeFields } from '../merge.js';
import { normalizeMeta, flattenEdge, unflattenEdge, resolveEdgeKind } from './edges.js';

// Batch upsert (E14.1) — write many nodes + edges in ONE transactional call.
// Built for dynamic-workflow write-back: an orchestrator commits a whole round
// of discovered nodes + their edges atomically instead of N racing single
// writes (which each open a request, a txn, and a pool connection — the actual
// memory pressure on a small box). Three properties beyond /edges/bulk:
//   1. UPSERT, not insert — a client-supplied `external_id` per node is the
//      idempotency key, so re-running a workflow round updates instead of
//      duplicating (partial-unique index tasks(graph_id, external_id)).
//   2. Nodes AND edges in the same atomic batch, with cross-batch cycle
//      detection (reuses the edges-route recursive-CTE + table lock).
//   3. Run attribution — every row written carries `run_id` so a run's
//      additions can be inspected/undone in one query.
// Embedding is intentionally NOT done here: task writes fire the same
// pg_notify('graph_change') trigger every other write path uses, and the chunk
// indexer (src/search/indexer.js) drains them serially off the request path —
// its comment explicitly anticipates "future bulk imports". Keeping it that way
// makes this endpoint additive and request-latency-free.

const router = Router({ mergeParams: true });

const MAX_NODES = 500;
const MAX_EDGES = 1000;
const MAX_ID_LEN = 200; // cap on client-supplied external_id / run_id (TEXT columns)
// Keys preserved when an agent re-upsert OMITS them. `status` is human/workflow
// owned progress — an agent re-running a round must not reset a human's
// in_progress/review/done back to todo. x/y/color/background-image are the
// canvas-owned drag/recolor/image keys the single-write PATCH already protects.
// significance/confidence/verified_at (E15.A2) and decided_at (E17) are the
// reserved typed fields: a body-rewriting re-run that omits them must not wipe
// a value a human or an earlier pass set. Explicit null still clears
// (mergeFields escape hatch).
const PROTECTED_TASK_KEYS = [
  'status', 'x', 'y', 'color', 'background-image',
  'significance', 'confidence', 'verified_at', 'decided_at',
  // E18.2 — refuted_at (a failed check) and decay (a structural property).
  'refuted_at', 'decay',
];
// MUST match `protectedFromAgentRemoval` in src/routes/edges.js. These are the
// keys an agent write that simply does not MENTION them must never delete:
// color and curve are the canvas's, and E18.3's `propagation` is a caller's
// declared doubt magnitude on this relation. /batch identifies an edge by its
// endpoints, so the ordinary agent re-run — `{source, target, purpose}` with no
// `meta`, exactly as the skill's own worked example writes it — reaches the
// merge with the key absent. Leaving `propagation` off this list silently
// dropped it, which is the 4283-live-edges mistake applied to the one knob this
// rung exists to provide: a node resting on a refuted claim fell off the doubt
// front entirely once its declared weight reverted to the default.
// E18.5 adds `meta.branch` — which road a decision took. /batch's ordinary
// agent re-run writes `{source, target, purpose}` with no `meta` at all, so it
// reaches the merge with the key absent; leaving it off this list would let a
// routine re-run silently un-tag the chosen option, and the whole rung derives
// from that tag.
const PROTECTED_EDGE_KEYS = ['meta.color', 'meta.curve', 'meta.propagation', 'meta.branch'];

// Order-independent deep stringify, so an idempotent re-run that produces
// semantically identical meta/body is detected as unchanged even when JSONB or
// frontmatter key order differs from what's stored.
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
function valueEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

// Tasks store {meta, body} in one markdown blob; flatten to a single object so
// mergeFields can resolve frontmatter keys and the body as independent fields.
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

// Carries the HTTP status + which item tripped, so the catch block can answer
// with the same {error, failedAt} shape /edges/bulk uses.
class BatchError extends Error {
  constructor(status, message, failedAt) {
    super(message);
    this.name = 'BatchError';
    this.status = status;
    this.failedAt = failedAt; // { kind: 'node'|'edge', index } | undefined
  }
}

// Does adding/keeping source→target as a dependency close a loop? (Identical
// recursive-CTE to the edges route, run over the post-upsert committed-in-txn
// state.) "Does target reach source via dependency edges in this graph?"
async function wouldCycle(client, gid, sourceId, targetId) {
  const r = await client.query(
    `WITH RECURSIVE chain AS (
       SELECT target_id AS node FROM edges
        WHERE source_id = $1 AND type = 'dependency' AND graph_id = $3
       UNION
       SELECT e.target_id FROM edges e
         JOIN chain c ON e.source_id = c.node
        WHERE e.type = 'dependency' AND e.graph_id = $3
     )
     SELECT 1 FROM chain WHERE node = $2 LIMIT 1`,
    [targetId, sourceId, gid],
  );
  return r.rows.length > 0;
}

// Resolve an edge endpoint that may be a numeric task id (existing node) or a
// string external_id (a node upserted in this same batch, or a pre-existing
// node carrying that external_id). Verifies the resolved id is in this graph.
async function resolveEndpoint(client, gid, extToId, ref, idx) {
  let id = null;
  if (typeof ref === 'number' && Number.isInteger(ref)) {
    id = ref;
  } else if (typeof ref === 'string') {
    if (extToId.has(ref)) {
      id = extToId.get(ref);
    } else {
      const r = await client.query(
        'SELECT id FROM tasks WHERE graph_id = $1 AND external_id = $2',
        [gid, ref],
      );
      if (r.rows.length === 0) {
        throw new BatchError(400, `edge endpoint external_id "${ref}" not found in this graph`, {
          kind: 'edge',
          index: idx,
        });
      }
      id = r.rows[0].id;
    }
  } else {
    throw new BatchError(400, 'edge source/target must be a task id or an external_id string', {
      kind: 'edge',
      index: idx,
    });
  }
  const chk = await client.query('SELECT 1 FROM tasks WHERE id = $1 AND graph_id = $2', [id, gid]);
  if (chk.rows.length === 0) {
    throw new BatchError(400, `edge endpoint ${ref} is not a task in this graph`, {
      kind: 'edge',
      index: idx,
    });
  }
  return id;
}

// E18.1 — backdating gate, identical to the one in tasks.js / edges.js.
// `happened_at` (world time) is a caller input; `learned_at` (belief time) is
// stamped by the database and accepted from nowhere.
function rejectBadHappenedAt(req, res) {
  const h = parseHappenedAt(req.body?.happened_at ?? req.headers?.[HAPPENED_AT_HEADER]);
  if (h.error) {
    res.status(400).json({ error: h.error });
    return true;
  }
  return false;
}

router.post('/', async (req, res) => {
  const { gid } = req.params;
  if (rejectBadHappenedAt(req, res)) return;
  if (await rejectBadCauseId(req, res, gid)) return;
  const body = req.body || {};
  const nodes = body.nodes ?? [];
  const edges = body.edges ?? [];
  const rawRunId = typeof body.run_id === 'string' ? body.run_id.trim() : '';
  if (rawRunId.length > MAX_ID_LEN)
    return res.status(400).json({ error: `run_id must be ${MAX_ID_LEN} characters or fewer` });
  const runId = rawRunId !== '' ? rawRunId : randomUUID();

  if (!Array.isArray(nodes)) return res.status(400).json({ error: 'nodes must be an array' });
  if (!Array.isArray(edges)) return res.status(400).json({ error: 'edges must be an array' });
  if (nodes.length === 0 && edges.length === 0)
    return res.status(400).json({ error: 'provide at least one node or edge' });
  if (nodes.length > MAX_NODES)
    return res.status(400).json({ error: `nodes must be ${MAX_NODES} or fewer per call` });
  if (edges.length > MAX_EDGES)
    return res.status(400).json({ error: `edges must be ${MAX_EDGES} or fewer per call` });

  // ---- pre-validate node specs (fail fast with the offending index) ----
  const nodeSpecs = [];
  const seenExt = new Set();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i] || {};
    const extId = typeof n.external_id === 'string' ? n.external_id.trim() : '';
    if (extId === '')
      return res
        .status(400)
        .json({ error: 'each node needs a non-empty external_id', failedAt: { kind: 'node', index: i } });
    if (extId.length > MAX_ID_LEN)
      return res
        .status(400)
        .json({ error: `external_id must be ${MAX_ID_LEN} characters or fewer`, failedAt: { kind: 'node', index: i } });
    if (seenExt.has(extId))
      return res
        .status(400)
        .json({ error: `duplicate external_id "${extId}" within batch`, failedAt: { kind: 'node', index: i } });
    seenExt.add(extId);
    if (typeof n.content !== 'string' || n.content === '')
      return res
        .status(400)
        .json({ error: 'each node needs content', failedAt: { kind: 'node', index: i } });
    const parsed = parseMarkdown(n.content);
    if (parsed.frontmatterError)
      return res.status(400).json({
        error: `node frontmatter is not valid YAML — quote any title containing a colon, e.g. title: "Signal: ARR up" (${parsed.frontmatterError})`,
        failedAt: { kind: 'node', index: i },
      });
    const meta = applyDefaults(parsed.meta);
    const vErr = validateMeta(meta);
    if (vErr) return res.status(400).json({ error: vErr, failedAt: { kind: 'node', index: i } });
    nodeSpecs.push({
      externalId: extId,
      meta, // defaulted — used for the CREATE path + up-front validation
      rawMeta: parsed.meta, // un-defaulted — the writer side of the merge, so an OMITTED key stays undefined and protected keys survive
      body: parsed.body,
      baseContent: typeof n.base_content === 'string' ? n.base_content : null,
    });
  }

  // ---- pre-validate edge specs (shape only; endpoints resolved in the txn) ----
  const edgeSpecs = [];
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i] || {};
    if (e.source === undefined || e.source === null)
      return res.status(400).json({ error: 'edge source is required', failedAt: { kind: 'edge', index: i } });
    if (e.target === undefined || e.target === null)
      return res.status(400).json({ error: 'edge target is required', failedAt: { kind: 'edge', index: i } });
    const kind = resolveEdgeKind(e);
    if (kind.error)
      return res.status(400).json({ error: kind.error, failedAt: { kind: 'edge', index: i } });
    const nm = normalizeMeta(e.meta || {});
    if (nm.error) return res.status(400).json({ error: nm.error, failedAt: { kind: 'edge', index: i } });
    edgeSpecs.push({
      source: typeof e.source === 'string' ? e.source.trim() : e.source,
      target: typeof e.target === 'string' ? e.target.trim() : e.target,
      type: kind.type,
      purpose: kind.purpose,
      meta: nm.meta,
      externalId: typeof e.external_id === 'string' ? e.external_id.trim() : null,
      index: i,
    });
  }

  try {
    // ONE transaction, up to 500 node upserts + 1000 edge upserts, ONE
    // request_id. Exactly one event per CHANGED row: the idempotent no-op
    // short-circuits below skip the write entirely, and even a write that
    // reaches the database with nothing actually different diffs to ch = '{}'
    // in the row trigger and emits nothing. An idempotent re-run is silent.
    const result = await withEventTx(req, async (client) => {
      const og = await client.query('SELECT owner_user_id FROM graphs WHERE id = $1', [gid]);
      if (og.rows.length === 0) throw new BatchError(404, 'graph not found');
      const graphOwnerId = og.rows[0].owner_user_id ?? null;

      // Serialize edge writers + freeze the graph for the cycle check, exactly
      // as the single + bulk edge routes do.
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

      const writerCtx = (currentRow, protectedKeys) => ({
        writerType: req.writerType,
        currentWriterType: currentRow.last_modified_by,
        writerOwnerId: req.user?.id ?? null,
        currentOwnerId: currentRow.last_modified_by_user ?? null,
        graphOwnerId,
        protectedFromAgentRemoval: protectedKeys,
      });

      // ---- upsert nodes ----
      const extToId = new Map();
      const outNodes = [];
      let createdNodes = 0;
      let updatedNodes = 0;
      let unchangedNodes = 0;

      for (let i = 0; i < nodeSpecs.length; i++) {
        const spec = nodeSpecs[i];
        // FOR UPDATE locks an existing row so a concurrent single-write PATCH
        // can't land between this read and our write (lost-update guard — the
        // edges table lock below doesn't serialize task writers).
        const existing = await client.query(
          'SELECT * FROM tasks WHERE graph_id = $1 AND external_id = $2 FOR UPDATE',
          [gid, spec.externalId],
        );

        if (existing.rows.length === 0) {
          const normalized = serializeMarkdown(spec.meta, spec.body);
          const ins = await client.query(
            `INSERT INTO tasks
               (graph_id, content, meta, external_id, run_id, last_modified_by, last_modified_by_user)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [gid, normalized, JSON.stringify(spec.meta), spec.externalId, runId, req.writerType, req.user?.id ?? null],
          );
          const row = ins.rows[0];
          extToId.set(spec.externalId, row.id);
          outNodes.push({ ...row, _op: 'created' });
          createdNodes++;
        } else {
          const cur = existing.rows[0];
          extToId.set(spec.externalId, cur.id);
          // Three-way merge so keys the writer OMITS survive: the protected keys
          // (status + canvas-owned x/y/color/bg) are kept from current. The
          // writer side is the RAW meta so an omitted key reads as `undefined`
          // (not a defaulted value), which is what trips the protection. base =
          // the client's base_content for true reconciliation, else current
          // (writer-wins on what it sets, omitted-protected kept).
          const baseContent = spec.baseContent != null ? spec.baseContent : cur.content;
          const baseParsed = parseMarkdown(baseContent);
          const baseMeta = applyDefaults(baseParsed.meta);
          const curParsed = parseMarkdown(cur.content);
          const curMeta = applyDefaults(curParsed.meta);
          const { merged } = mergeFields(
            flattenTask(baseMeta, baseParsed.body),
            flattenTask(spec.rawMeta, spec.body),
            flattenTask(curMeta, curParsed.body),
            writerCtx(cur, PROTECTED_TASK_KEYS),
          );
          const out = unflattenTask(merged);
          const finalMeta = applyDefaults(out.meta); // stringify text fields; default status only if truly absent on both sides
          const vErr = validateMeta(finalMeta);
          if (vErr) throw new BatchError(409, `merged node invalid: ${vErr}`, { kind: 'node', index: i });
          // Idempotent no-op: a re-run that changes nothing skips the write, so
          // it doesn't bump version/updated_at, fire SSE, or wake the indexer —
          // and run_id keeps its CREATION value (see schema comment).
          if (valueEqual(finalMeta, curMeta) && out.body === curParsed.body) {
            outNodes.push({ ...cur, _op: 'unchanged' });
            unchangedNodes++;
          } else {
            const normalized = serializeMarkdown(finalMeta, out.body);
            const upd = await client.query(
              `UPDATE tasks
                  SET content = $1, meta = $2, version = version + 1,
                      last_modified_by = $3, last_modified_by_user = $4, updated_at = NOW()
                WHERE id = $5 RETURNING *`,
              [normalized, JSON.stringify(finalMeta), req.writerType, req.user?.id ?? null, cur.id],
            );
            outNodes.push({ ...upd.rows[0], _op: 'updated' });
            updatedNodes++;
          }
        }
      }

      // ---- resolve + upsert edges (idempotent on their endpoints) ----
      const outEdges = [];
      let createdEdges = 0;
      let updatedEdges = 0;
      let unchangedEdges = 0;

      const resolved = [];
      for (const spec of edgeSpecs) {
        const sourceId = await resolveEndpoint(client, gid, extToId, spec.source, spec.index);
        const targetId = await resolveEndpoint(client, gid, extToId, spec.target, spec.index);
        if (sourceId === targetId)
          throw new BatchError(400, 'edge source and target must be different', {
            kind: 'edge',
            index: spec.index,
          });
        resolved.push({ ...spec, source_id: sourceId, target_id: targetId });
      }

      for (const spec of resolved) {
        // An edge is identified by its endpoints (UNIQUE(source_id, target_id)),
        // so re-running a batch updates rather than 409s — the idempotent path.
        const existing = await client.query(
          'SELECT * FROM edges WHERE graph_id = $1 AND source_id = $2 AND target_id = $3',
          [gid, spec.source_id, spec.target_id],
        );
        if (existing.rows.length === 0) {
          const ins = await client.query(
            `INSERT INTO edges
               (graph_id, source_id, target_id, type, purpose, meta, external_id, run_id, last_modified_by, last_modified_by_user)
             VALUES ($1, $2, $3, $4::edge_type, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [
              gid, spec.source_id, spec.target_id, spec.type, spec.purpose, JSON.stringify(spec.meta),
              spec.externalId, runId, req.writerType, req.user?.id ?? null,
            ],
          );
          outEdges.push({ ...ins.rows[0], _op: 'created' });
          createdEdges++;
        } else {
          const cur = existing.rows[0];
          // Merge keys on `purpose` (canonical); `type` is re-derived from the
          // merged purpose by unflattenEdge.
          const writerRow = {
            source_id: spec.source_id,
            target_id: spec.target_id,
            purpose: spec.purpose,
            meta: spec.meta,
          };
          const { merged } = mergeFields(
            flattenEdge(cur),
            flattenEdge(writerRow),
            flattenEdge(cur),
            writerCtx(cur, PROTECTED_EDGE_KEYS),
          );
          const fin = unflattenEdge(merged);
          // Idempotent no-op: skip the write (no version bump / SSE / run_id churn).
          if (fin.purpose === cur.purpose && valueEqual(fin.meta || {}, cur.meta || {})) {
            outEdges.push({ ...cur, _op: 'unchanged' });
            unchangedEdges++;
          } else {
            const upd = await client.query(
              `UPDATE edges
                  SET type = $1::edge_type, purpose = $2, meta = $3, version = version + 1,
                      last_modified_by = $4, last_modified_by_user = $5
                WHERE id = $6 RETURNING *`,
              [fin.type, fin.purpose, JSON.stringify(fin.meta), req.writerType, req.user?.id ?? null, cur.id],
            );
            outEdges.push({ ...upd.rows[0], _op: 'updated' });
            updatedEdges++;
          }
        }
      }

      // Cycle check after every edge is in place — one pass per dependency edge
      // catches loops closed across the batch (A→B + B→A in the same call).
      for (const spec of resolved) {
        if (spec.type !== 'dependency') continue;
        if (await wouldCycle(client, gid, spec.source_id, spec.target_id))
          throw new BatchError(400, 'batch would create a dependency cycle', {
            kind: 'edge',
            index: spec.index,
          });
      }

      return {
        run_id: runId,
        nodes: outNodes,
        edges: outEdges,
        created: { nodes: createdNodes, edges: createdEdges },
        updated: { nodes: updatedNodes, edges: updatedEdges },
        unchanged: { nodes: unchangedNodes, edges: unchangedEdges },
      };
    });

    res.status(200).json(result);
  } catch (err) {
    const failedAt = err.failedAt;
    const respond = (status, message) => {
      const out = { error: message };
      if (failedAt !== undefined) out.failedAt = failedAt;
      return res.status(status).json(out);
    };
    if (err instanceof BatchError) return respond(err.status, err.message);
    if (err.code === '23505')
      return respond(409, 'a node external_id or edge already exists (concurrent batch?)');
    if (err.code === '23503') return respond(400, 'referenced task or graph does not exist');
    if (err.code === '23514') return respond(400, 'a node or edge violated a constraint');
    throw err;
  }
});

export default router;
