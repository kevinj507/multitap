import { Router } from 'express';
import pool from '../db.js';
import { cacheControlFor, graphAsOf, parseAsOfQuery } from '../events/store.js';

const router = Router({ mergeParams: true });

router.get('/shortest-path', async (req, res) => {
  const { gid } = req.params;
  const from = parseInt(req.query.from);
  const to = parseInt(req.query.to);

  if (!from || !to || isNaN(from) || isNaN(to))
    return res.status(400).json({ error: 'from and to must be valid integers' });

  // Undirected BFS over dependency edges via recursive CTE. Doesn't depend
  // on pgrouting (which isn't packaged for Postgres 18 yet); for the graph
  // sizes we expect, BFS through a recursive CTE is both fast and free of
  // external extensions. ORDER BY cost ASC + LIMIT 1 returns the path with
  // the fewest hops; ties broken arbitrarily.
  const result = await pool.query(
    `WITH RECURSIVE bfs AS (
       SELECT $1::int AS node, ARRAY[$1::int] AS path, 0 AS cost
       UNION ALL
       SELECT next.node, b.path || next.node, b.cost + 1
       FROM bfs b
       CROSS JOIN LATERAL (
         SELECT CASE WHEN e.source_id = b.node THEN e.target_id ELSE e.source_id END AS node
         FROM edges e
         WHERE (e.source_id = b.node OR e.target_id = b.node)
           AND e.type = 'dependency'
           AND e.graph_id = $3
       ) next
       WHERE NOT (next.node = ANY(b.path))
     )
     SELECT path, cost FROM bfs
     WHERE node = $2
     ORDER BY cost ASC
     LIMIT 1`,
    [from, to, gid]
  );

  if (result.rows.length === 0) {
    return res.json({ path: [], cost: null, tasks: [] });
  }

  const path = result.rows[0].path.map((n) => Number(n));
  const cost = Number(result.rows[0].cost);

  const tasks = await pool.query(
    `SELECT id, meta->>'title' AS title, meta->>'status' AS status
     FROM tasks WHERE id = ANY($1) AND graph_id = $2 ORDER BY array_position($1, id)`,
    [path, gid]
  );

  res.json({ path, cost, tasks: tasks.rows });
});

// E18.1 STEP 5 — `?asOf=<iso>` / `?asOfSeq=<n>` / `?axis=` / `?known=<iso>`
// reconstruct this same payload at a point on either clock, from the
// append-only log. See src/events/store.js for the two axes and why a periodic
// snapshot can only base the learned one.
//
// THE HOT PATH PAYS ZERO. With none of the four knobs present, `parseAsOfQuery`
// returns `{value: null}` without touching the database and the handler falls
// through to exactly the two queries it has always run — no snapshot lookup, no
// events lookup, same SQL, same body. That is a locked decision, and
// tests/e18-asof.test.js pins it with a `pool.query` spy.
router.get('/', async (req, res, next) => {
  const asOfParams = parseAsOfQuery(req.query);
  if (asOfParams.error) return res.status(400).json({ error: asOfParams.error });
  if (asOfParams.value) {
    try {
      const out = await graphAsOf(pool, req.params.gid, asOfParams.value);
      // The RESOLVED envelope decides the header, not just the query: an
      // asOfSeq past the head was clamped to the live head and is not immutable.
      res.set('Cache-Control', cacheControlFor(asOfParams.value, out.as_of));
      return res.json(out);
    } catch (err) {
      return next(err);
    }
  }

  const { gid } = req.params;
  const nodes = await pool.query(
    // external_id rides along so the node page can resolve wiki-links like
    // [[todo:fanout-claim-lease]] to a task id client-side (node.js
    // hydrateWikiRefs) without a second endpoint. Additive — the canvas
    // ignores it.
    `SELECT id, meta->>'title' AS title, meta->>'description' AS description,
            meta->>'status' AS status, meta, version, external_id
     FROM tasks WHERE graph_id = $1 ORDER BY id`,
    [gid]
  );
  const links = await pool.query(
    // Emit `purpose` (canonical, E15.A1) AND the derived `type` so the canvas
    // keeps rendering off `type` with no change while agents read `purpose`.
    `SELECT id, source_id AS source, target_id AS target, purpose, type, meta, version
     FROM edges WHERE graph_id = $1 ORDER BY id`,
    [gid]
  );
  res.json({ nodes: nodes.rows, links: links.rows });
});

export default router;
