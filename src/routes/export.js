// OKF v0.2 export (read-gated at the mount). One GET, two shapes:
//   GET /api/graphs/:gid/export            → JSON envelope { graph, okf_version, files }
//   GET /api/graphs/:gid/export?format=tar → plain ustar download of the same bundle
// The bundle itself is built by the pure src/okfExport.js; this route only
// fetches rows and picks the wire shape. Everything is held in memory — fine
// at this app's scale (payloads are bounded by the write-side caps); streaming
// is the escalation path if bundles ever outgrow that.
import { Router } from 'express';
import pool from '../db.js';
import { buildOkfBundle } from '../okfExport.js';
import { tarball } from '../tar.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res, next) => {
  try {
    const { gid } = req.params;
    const format = req.query.format;
    if (format !== undefined && format !== 'tar') {
      return res.status(400).json({ error: "format must be 'tar'" });
    }
    const [tasks, edges, report] = await Promise.all([
      pool.query(
        `SELECT id, meta, content, version, updated_at, last_modified_by
           FROM tasks WHERE graph_id = $1 ORDER BY id`,
        [gid]
      ),
      pool.query(
        `SELECT id, source_id, target_id, purpose
           FROM edges WHERE graph_id = $1 ORDER BY id`,
        [gid]
      ),
      pool.query(
        `SELECT title, description, body, meta, generated_at
           FROM reports WHERE graph_id = $1`,
        [gid]
      ),
    ]);
    const now = new Date();
    const files = buildOkfBundle({
      graph: req.graph,
      tasks: tasks.rows,
      edges: edges.rows,
      report: report.rows[0] ?? null,
      now,
    });
    res.set('Cache-Control', 'no-store');
    if (format === 'tar') {
      const buf = tarball(files, { mtime: Math.floor(now.getTime() / 1000) });
      res.set('Content-Type', 'application/x-tar');
      // gid is header-safe: the schema CHECKs it to ^[a-z0-9]{4,32}$.
      res.set('Content-Disposition', `attachment; filename="${req.graph.id}.okf.tar"`);
      return res.send(buf);
    }
    res.json({
      graph: {
        id: req.graph.id,
        name: req.graph.name,
        description: req.graph.description,
        version: req.graph.version,
      },
      okf_version: '0.2',
      files: Object.fromEntries(files.map((f) => [f.path, f.content])),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
