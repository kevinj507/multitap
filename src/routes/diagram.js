// Server-derived report diagram (read-gated at the mount). Pure derivation
// over the same rows GET /graph serves — never mutates, never bumps versions.
//   GET /api/graphs/:gid/diagram?kind=fan|chain|cluster&node=<id>[&to=<id>][&maxNodes=N]
//     → { markdown, stats }   a finished `.gt-fig` figure to paste VERBATIM
//     → 404 { error }         seed missing / no qualifying edges / no path
// The drafting contract (SKILL.md § Document form) is fetch-and-paste — the
// diagram IS the live edge list, so pasting it carries zero fidelity risk.
import { Router } from 'express';
import pool from '../db.js';
import { buildDiagram, KINDS, MAX_NODES_CEILING } from '../diagram.js';

const router = Router({ mergeParams: true });

const POS_INT = /^\d+$/;

router.get('/', async (req, res, next) => {
  try {
    const { gid } = req.params;
    const { kind, node, to, maxNodes } = req.query;

    if (!kind || !KINDS.includes(kind)) {
      return res.status(400).json({ error: `kind must be one of ${KINDS.join('|')}` });
    }
    if (!node || !POS_INT.test(node) || Number(node) < 1) {
      return res.status(400).json({ error: 'node must be a positive integer' });
    }
    if (to !== undefined) {
      if (kind !== 'chain') {
        return res.status(400).json({ error: 'to is only valid for kind=chain' });
      }
      if (!POS_INT.test(to) || Number(to) < 1) {
        return res.status(400).json({ error: 'to must be a positive integer' });
      }
    }
    // maxNodes: malformed → 400; out-of-range → clamped inside buildDiagram
    // (forgiving cap, mirroring /context's style).
    if (maxNodes !== undefined && !POS_INT.test(maxNodes)) {
      return res.status(400).json({ error: 'maxNodes must be a positive integer' });
    }

    const [tasks, edges] = await Promise.all([
      pool.query(
        `SELECT id, meta->>'title' AS title, meta->>'status' AS status, meta
           FROM tasks WHERE graph_id = $1 ORDER BY id`,
        [gid]
      ),
      pool.query(
        `SELECT source_id AS source, target_id AS target, purpose
           FROM edges WHERE graph_id = $1 ORDER BY id`,
        [gid]
      ),
    ]);

    const out = buildDiagram({
      kind,
      nodes: tasks.rows,
      links: edges.rows,
      seed: Number(node),
      to: to !== undefined ? Number(to) : null,
      maxNodes: maxNodes !== undefined ? Math.min(Number(maxNodes), MAX_NODES_CEILING) : null,
      gid,
    });
    res.set('Cache-Control', 'no-store');
    if (out.error) return res.status(404).json({ error: out.error });
    res.json(out);
  } catch (err) {
    next(err);
  }
});

export default router;
