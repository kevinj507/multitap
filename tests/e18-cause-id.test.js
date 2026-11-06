// E18.1 — the cause gate (src/events/context.js `rejectBadCauseId`).
//
// `cause_id` is a CALLER input — X-Cause-Id on the body-less routes, a
// `cause_id` field in the JSON body elsewhere — and it was only ever
// shape-checked ("positive integer"). The database enforces more than shape:
//
//   CONSTRAINT events_cause_precedes CHECK (cause_id IS NULL OR cause_id < seq)
//
// and it enforces it INSIDE the row trigger, so a well-formed value at or above
// the graph's next seq aborted the whole transaction with 23514. What the
// caller saw depended on which route they hit, and both answers were wrong:
// the task routes handle only 23503, so it fell through as a bare 500; the edge
// and batch routes catch 23514 and reported "invalid edge" / "a node or edge
// violated a constraint", blaming data that was never wrong.
//
// The gate mirrors the rejectBadHappenedAt() that every mutating route already
// had: one fixed 400, before any write, so a bad request leaves no row and no
// event. The last two tests are the ones that matter as much as the 400s — a
// legitimate cause_id must still land, and the cause_id the triggers set
// themselves (edge.removed → node.removed, on a cascade) must be untouched by
// any of this.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;
// Imported inside beforeAll, never statically: src/events/context.js pulls in
// src/db.js, which reads DATABASE_URL once at first import. A static import
// here would bind the pool to the wrong database before beforeAll could set it.
let CAUSE_ID_ERROR;
let CAUSE_ID_UNKNOWN_ERROR;

beforeAll(async () => {
  // MUST precede the import of app.js: src/db.js reads DATABASE_URL once.
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  ({ CAUSE_ID_ERROR, CAUSE_ID_UNKNOWN_ERROR } = await import('../src/events/context.js'));
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-cause') RETURNING id");
  gid = g.rows[0].id;
});

const md = (title) => `---\ntitle: ${title}\nstatus: todo\n---\n`;

async function makeTask(title) {
  const res = await request(app).post(`/api/graphs/${gid}/tasks`).send({ content: md(title) });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function headSeq() {
  const r = await pool.query('SELECT COALESCE(max(seq), 0)::int AS head FROM events WHERE graph_id = $1', [gid]);
  return r.rows[0].head;
}

describe('E18.1 cause_id gate', () => {
  it('400s (not 500s) a cause_id above the head on POST /tasks', async () => {
    const a = await makeTask('a');
    expect(a).toBeDefined();
    const res = await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .set('X-Cause-Id', String((await headSeq()) + 1000))
      .send({ content: md('boom') });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(CAUSE_ID_UNKNOWN_ERROR);
    // The rejected write left nothing behind: no task, no event.
    const t = await pool.query('SELECT count(*)::int AS n FROM tasks WHERE graph_id = $1', [gid]);
    expect(t.rows[0].n).toBe(1);
  });

  it('400s a body cause_id above the head on PATCH /tasks/:id', async () => {
    const id = await makeTask('a');
    const res = await request(app)
      .patch(`/api/graphs/${gid}/tasks/${id}`)
      .send({ content: md('a2'), cause_id: (await headSeq()) + 1000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(CAUSE_ID_UNKNOWN_ERROR);
  });

  it('400s with the cause message (not "invalid edge") on POST /edges', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    const res = await request(app)
      .post(`/api/graphs/${gid}/edges`)
      .set('X-Cause-Id', String((await headSeq()) + 1000))
      .send({ source_id: a, target_id: b, purpose: 'supports' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(CAUSE_ID_UNKNOWN_ERROR);
  });

  it('400s with the cause message (not a constraint message) on POST /batch', async () => {
    const res = await request(app)
      .post(`/api/graphs/${gid}/batch`)
      .set('X-Cause-Id', '999999')
      .send({ nodes: [{ external_id: 'n1', content: md('x') }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(CAUSE_ID_UNKNOWN_ERROR);
  });

  it('400s a cause_id from another graph', async () => {
    const other = await pool.query("INSERT INTO graphs (name) VALUES ('e18-cause-other') RETURNING id");
    const otherGid = other.rows[0].id;
    const created = await request(app).post(`/api/graphs/${otherGid}/tasks`).send({ content: md('elsewhere') });
    expect(created.status).toBe(201);
    const seqElsewhere = (
      await pool.query('SELECT max(seq)::int AS s FROM events WHERE graph_id = $1', [otherGid])
    ).rows[0].s;
    // Shape-valid, and a real event — just not one of THIS graph's.
    const res = await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .set('X-Cause-Id', String(seqElsewhere))
      .send({ content: md('boom') });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(CAUSE_ID_UNKNOWN_ERROR);
  });

  it('400s a malformed cause_id with the shape message', async () => {
    const res = await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .set('X-Cause-Id', 'nope')
      .send({ content: md('boom') });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(CAUSE_ID_ERROR);
  });

  it('400s a cause_id on DELETE /tasks/:id and leaves the task alive', async () => {
    const id = await makeTask('a');
    const res = await request(app)
      .delete(`/api/graphs/${gid}/tasks/${id}`)
      .set('X-Cause-Id', '999999');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(CAUSE_ID_UNKNOWN_ERROR);
    const still = await pool.query('SELECT count(*)::int AS n FROM tasks WHERE id = $1', [id]);
    expect(still.rows[0].n).toBe(1);
  });

  it('still accepts a cause_id naming a real earlier event', async () => {
    await makeTask('a');
    const cause = await headSeq();
    const res = await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .set('X-Cause-Id', String(cause))
      .send({ content: md('because of a') });
    expect(res.status).toBe(201);
    const ev = await pool.query(
      'SELECT cause_id::int AS cause_id FROM events WHERE graph_id = $1 ORDER BY seq DESC LIMIT 1',
      [gid],
    );
    expect(ev.rows[0].cause_id).toBe(cause);
  });

  it('leaves the mechanical cascade cause_id alone', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    const e = await request(app)
      .post(`/api/graphs/${gid}/edges`)
      .send({ source_id: a, target_id: b, purpose: 'supports' });
    expect(e.status).toBe(201);
    // No caller cause_id anywhere: the edge.removed the ON DELETE CASCADE
    // produces must still point at the node.removed that caused it.
    const del = await request(app).delete(`/api/graphs/${gid}/tasks/${a}`);
    expect(del.status).toBe(200);
    const rows = (
      await pool.query(
        `SELECT seq::int AS seq, kind, cause_id::int AS cause_id
           FROM events WHERE graph_id = $1 AND kind IN ('node.removed','edge.removed')
          ORDER BY seq`,
        [gid],
      )
    ).rows;
    const removed = rows.find((r) => r.kind === 'node.removed');
    const edgeRemoved = rows.find((r) => r.kind === 'edge.removed');
    expect(removed).toBeDefined();
    expect(edgeRemoved).toBeDefined();
    expect(edgeRemoved.cause_id).toBe(removed.seq);
  });
});
