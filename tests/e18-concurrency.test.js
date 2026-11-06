// E18.1 REGRESSION — the event log must not deadlock concurrent writers.
//
// Two lock-order defects shipped in the first cut of the event log, both
// reachable through the ordinary HTTP routes and both surfacing as a 500 with
// the user's write silently lost:
//
//   1. gt_next_seq() took `SELECT 1 FROM graphs ... FOR UPDATE`. `INSERT INTO
//      tasks` already holds FOR KEY SHARE on that same parent row for the
//      foreign key, and FOR UPDATE is the one mode that conflicts with
//      FOR KEY SHARE — so two overlapping inserts into one graph each waited on
//      the other. Measured before the fix: 10 concurrent inserts committed 1
//      and lost 99 to deadlock; 10 parallel POSTs through the route returned
//      two 500s. Fixed to FOR NO KEY UPDATE, which still conflicts with itself
//      (so seq stays gapless) but not with the FK's share lock.
//
//   2. A task DELETE takes the graphs row (in its BEFORE-DELETE trigger) and
//      THEN cascades into edges, while every edge route took `LOCK TABLE edges`
//      first and the graphs row second. Opposite orders, so the pair deadlocked.
//      Fixed by taking the graphs row first in the edge and batch routes.
//
// The original suite could not catch either one: its concurrency test called
// gt_next_seq() directly on two connections with no INSERT, so neither session
// ever held the FK lock that makes the cycle. These tests drive the real routes.
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
});

async function newGraph() {
  return (await pool.query("INSERT INTO graphs (name) VALUES ('conc') RETURNING id")).rows[0].id;
}
const md = (title, body = '') => `---\ntitle: ${title}\nstatus: todo\n---\n${body}`;

async function makeTask(gid, title) {
  const r = await request(app).post(`/api/graphs/${gid}/tasks`).send({ content: md(title) });
  expect(r.status).toBe(201);
  return r.body.id;
}

// Every status returned, so a failure reports the distribution rather than just
// "expected 201". A deadlock shows up as 500.
const tally = (results) =>
  results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {});

describe('E18.1 — concurrent writes through the real routes', () => {
  it('10 parallel node creations in ONE graph all succeed and get gapless seqs', async () => {
    const gid = await newGraph();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(app).post(`/api/graphs/${gid}/tasks`).send({ content: md(`n${i}`) }),
      ),
    );
    expect(tally(results)).toEqual({ 201: 10 });

    const seqs = (await pool.query('SELECT seq FROM events WHERE graph_id = $1 ORDER BY seq', [gid])).rows.map((r) => Number(r.seq));
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('learned_at stays monotone with seq under that contention', async () => {
    const gid = await newGraph();
    await Promise.all(Array.from({ length: 10 }, (_, i) =>
      request(app).post(`/api/graphs/${gid}/tasks`).send({ content: md(`m${i}`) })));

    const rows = (await pool.query(
      `SELECT seq, learned_at FROM events WHERE graph_id = $1 ORDER BY seq`, [gid])).rows;
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].learned_at.getTime()).toBeGreaterThanOrEqual(rows[i - 1].learned_at.getTime());
    }
  });

  it('parallel edge creation in one graph does not deadlock', async () => {
    const gid = await newGraph();
    const ids = [];
    for (let i = 0; i < 12; i++) ids.push(await makeTask(gid, `t${i}`));

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        request(app).post(`/api/graphs/${gid}/edges`).send({
          source_id: ids[i * 2], target_id: ids[i * 2 + 1], purpose: 'related to',
        })),
    );
    expect(tally(results)).toEqual({ 201: 6 });
  });

  // E18.4 — a supersedes edge write calls gt_next_seq() a SECOND time, inside
  // gt_log_supersede, to allocate the annotation's seq. That is the one thing
  // about this rung that could disturb the lock order this file exists to pin.
  // It cannot: the second call runs in the same transaction, where the graphs
  // row is ALREADY held FOR NO KEY UPDATE, so it acquires no new lock. Its only
  // other read is an unlocked `SELECT meta->>'type' FROM tasks` for the
  // payload's node_kind, against a row the FK has already pinned FOR KEY SHARE.
  it('parallel SUPERSEDES edge creation does not deadlock and keeps seq gapless', async () => {
    const gid = await newGraph();
    const ids = [];
    for (let i = 0; i < 20; i++) ids.push(await makeTask(gid, `t${i}`));

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(app).post(`/api/graphs/${gid}/edges`).send({
          source_id: ids[i * 2], target_id: ids[i * 2 + 1], purpose: 'supersedes',
        })),
    );
    expect(tally(results)).toEqual({ 201: 10 });

    const { rows } = await pool.query(
      `SELECT COALESCE(MAX(seq),0)::int AS head, count(*)::int AS n,
              count(*) FILTER (WHERE kind = 'node.superseded')::int AS ann,
              bool_and(cause_id IS NULL OR cause_id < seq) AS cause_ok
         FROM events WHERE graph_id = $1`, [gid],
    );
    // 20 creations + 10 edge.added + 10 node.superseded, and NO GAPS: the
    // annotation's seq comes from the same allocator as everything else.
    expect(rows[0].head).toBe(rows[0].n);
    expect(rows[0].ann).toBe(10);
    expect(rows[0].cause_ok).toBe(true);
  });

  // E18.2 — POST /tasks/:id/verify opens its transaction by locking the TASK
  // row FOR UPDATE, and the UPDATE it then issues takes the graphs row inside
  // the trigger. Every edge route takes the graphs row FIRST, and INSERT INTO
  // edges then takes FOR KEY SHARE on BOTH endpoint task rows for the foreign
  // keys — which conflicts with the verify's FOR UPDATE. So the two paths hold
  // and want each other's locks in opposite orders and deadlock, returning 500.
  //
  // The endpoints must be the SAME nodes being verified: that FK share lock is
  // the half of the cycle the edge route contributes, so a test wiring
  // unrelated spare nodes never reproduces it. The verify route now takes the
  // graphs row up front, which costs no extra lock and makes the orders agree.
  it('verifying a node while edges are wired TO THAT NODE does not deadlock', async () => {
    const gid = await newGraph();
    const hub = [];
    for (let i = 0; i < 6; i++) hub.push(await makeTask(gid, `hub${i}`));
    const leaf = [];
    for (let i = 0; i < 6; i++) leaf.push(await makeTask(gid, `leaf${i}`));

    // Three rounds: the race is probabilistic, and one round can miss it.
    for (let round = 0; round < 3; round++) {
      const results = await Promise.all([
        ...hub.map((id) =>
          request(app).post(`/api/graphs/${gid}/tasks/${id}/verify`).send({ outcome: 'held' })),
        ...hub.map((id, i) =>
          request(app).post(`/api/graphs/${gid}/edges`).send({
            source_id: id, target_id: leaf[i], purpose: 'related to',
          })),
      ]);
      const counts = tally(results);
      expect(counts[500], `round ${round} produced 500s: ${JSON.stringify(counts)}`).toBeUndefined();
      for (const r of results) {
        expect(JSON.stringify(r.body || {})).not.toMatch(/deadlock|40P01/i);
      }
      // Round 0 creates the edges; later rounds re-verify against a 409 dup,
      // which still exercises the same lock sequence.
      expect(counts[200]).toBe(6);
    }
  });

  // THE LOCK-ORDER INVERSION. A task delete cascades into edges while holding
  // the graphs row; an edge write wants the edges table then the graphs row.
  it('deleting nodes while edges are being written in the same graph does not deadlock', async () => {
    const gid = await newGraph();
    const doomed = [];
    const spare = [];
    for (let i = 0; i < 10; i++) doomed.push(await makeTask(gid, `d${i}`));
    for (let i = 0; i < 20; i++) spare.push(await makeTask(gid, `s${i}`));

    const work = [
      ...doomed.map((id) => request(app).delete(`/api/graphs/${gid}/tasks/${id}`)),
      ...Array.from({ length: 10 }, (_, i) =>
        request(app).post(`/api/graphs/${gid}/edges`).send({
          source_id: spare[i * 2], target_id: spare[i * 2 + 1], purpose: 'related to',
        })),
    ];
    const results = await Promise.all(work);
    const counts = tally(results);
    expect(counts[500]).toBeUndefined();
    expect(counts[200]).toBe(10);
    expect(counts[201]).toBe(10);
  });

  it('a node delete racing a bulk edge write does not deadlock', async () => {
    const gid = await newGraph();
    const ids = [];
    for (let i = 0; i < 24; i++) ids.push(await makeTask(gid, `b${i}`));

    const bulk = request(app).post(`/api/graphs/${gid}/edges/bulk`).send({
      edges: Array.from({ length: 8 }, (_, i) => ({
        source_id: ids[i + 8], target_id: ids[i + 16], purpose: 'related to',
      })),
    });
    const deletes = ids.slice(0, 8).map((id) => request(app).delete(`/api/graphs/${gid}/tasks/${id}`));

    const [bulkRes, ...delRes] = await Promise.all([bulk, ...deletes]);
    expect(bulkRes.status).toBe(201);
    expect(tally(delRes)).toEqual({ 200: 8 });
  });

  it('parallel batch writes to one graph do not deadlock', async () => {
    const gid = await newGraph();
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, w) =>
        request(app).post(`/api/graphs/${gid}/batch`).send({
          nodes: Array.from({ length: 5 }, (_, i) => ({
            external_id: `w${w}-n${i}`, content: md(`w${w}n${i}`),
          })),
          edges: [
            { source: `w${w}-n0`, target: `w${w}-n1`, purpose: 'related to' },
            { source: `w${w}-n2`, target: `w${w}-n3`, purpose: 'related to' },
          ],
        })),
    );
    expect(tally(results)).toEqual({ 200: 4 });
  });

  it('writers spread across DIFFERENT graphs never contend', async () => {
    const gids = await Promise.all(Array.from({ length: 6 }, () => newGraph()));
    const results = await Promise.all(
      gids.flatMap((gid) => Array.from({ length: 4 }, (_, i) =>
        request(app).post(`/api/graphs/${gid}/tasks`).send({ content: md(`g${i}`) }))),
    );
    expect(tally(results)).toEqual({ 201: 24 });
    for (const gid of gids) {
      const seqs = (await pool.query('SELECT seq FROM events WHERE graph_id = $1 ORDER BY seq', [gid])).rows.map((r) => Number(r.seq));
      expect(seqs).toEqual([1, 2, 3, 4]);
    }
  });

  it('no deadlock error reached any response body', async () => {
    // A belt-and-braces net: 40P01 anywhere in the stack means the lock order
    // regressed, even if some future handler maps it to a non-500 status.
    const gid = await newGraph();
    const ids = [];
    for (let i = 0; i < 8; i++) ids.push(await makeTask(gid, `x${i}`));
    const results = await Promise.all([
      ...ids.slice(0, 4).map((id) => request(app).delete(`/api/graphs/${gid}/tasks/${id}`)),
      ...Array.from({ length: 4 }, (_, i) =>
        request(app).post(`/api/graphs/${gid}/edges`).send({
          source_id: ids[4], target_id: ids[5 + (i % 3)], purpose: 'related to',
        })),
    ]);
    for (const r of results) {
      expect(JSON.stringify(r.body || {})).not.toMatch(/deadlock|40P01/i);
    }
  });
});
