// E18.1 STEP 5 — graph(t): `GET /graph?asOf=` on both clocks.
//
// STEP 3 proved the fold is right about a list of events. This file proves the
// SERVER is right about WHICH events, in WHICH order, from WHICH base — and
// that asking the question costs nothing when nobody asks it.
//
// Four things are pinned here, and each one is a place the feature would
// otherwise rot quietly:
//
//  1. THE HOT PATH PAYS ZERO. A plain `GET /graph` must issue exactly the two
//     queries it has always issued and never touch `events` or
//     `graph_snapshots`. Asserted with a spy on the real pool, not by reading
//     the source.
//
//  2. THE DONE-WHEN CHAIN. Seven writes through the real routes, reconstructed
//     at three points, plus `asOf=now` deep-equalling a plain `GET /graph`.
//     Timestamps come from the log itself (`learned_at` is stamped by
//     clock_timestamp() and cannot be forged) — never from sleep().
//
//  3. THE BACKDATING DIVERGENCE, the worked example from PLAN.md §3 STEP 5.
//     The same three events answer DIFFERENTLY on the two axes, and the
//     bitemporal rectangle `?axis=happened&asOf=10:15&known=11:30` answers
//     differently again. The divergence IS the signal; the fold must not
//     reconcile it, so these assertions are deliberately contradictory-looking.
//
//  4. THE CACHE IS INVISIBLE. A hit and a miss return byte-identical bodies;
//     only the query count differs.
//
// A note on precision, because it bit once already: `learned_at` is
// microsecond-precision and `pg` hands back a JS Date, which is
// millisecond-precision. Round-tripping a learned_at through `new Date()` can
// land BEFORE the event it names, so `learned_at <= asOf` would exclude it.
// `logTime()` pulls the value as microsecond text instead, and src/events/store.js
// binds the caller's raw string rather than a normalised Date for the same reason.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool; // the test pool (fixtures)
let appPool; // src/db.js's pool — what the routes actually call
let gid;
let resetDerivedCache;

beforeAll(async () => {
  // MUST precede the import of app.js: src/db.js reads DATABASE_URL once, at
  // first import, so a static import would bind the wrong database.
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  appPool = (await import('../src/db.js')).default;
  resetDerivedCache = (await import('../src/derivedCache.js'))._resetDerivedCacheForTests;
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-asof') RETURNING id");
  gid = g.rows[0].id;
  // Module state survives TRUNCATE. The key is `${graphId}:${seq}` precisely so
  // it cannot leak across tests, but clearing it keeps the query-count
  // assertions below honest.
  resetDerivedCache();
});

// ── fixtures ────────────────────────────────────────────────────────────────

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const graphUrl = (g = gid) => `/api/graphs/${g}/graph`;
const tasksUrl = (g = gid) => `/api/graphs/${g}/tasks`;
const edgesUrl = (g = gid) => `/api/graphs/${g}/edges`;

const view = (query) => request(app).get(graphUrl()).query(query ?? {});

async function makeTask(meta, happened_at) {
  const body = { content: node({ status: 'todo', ...meta }) };
  if (happened_at) body.happened_at = happened_at;
  const res = await request(app).post(tasksUrl()).send(body);
  expect(res.status).toBe(201);
  return res.body;
}

async function patchTask(id, meta, happened_at) {
  const body = { content: node(meta) };
  if (happened_at) body.happened_at = happened_at;
  const res = await request(app).patch(`${tasksUrl()}/${id}`).send(body);
  expect(res.status).toBe(200);
  return res.body;
}

async function makeEdge(source_id, target_id, purpose = 'required for') {
  const res = await request(app).post(edgesUrl()).send({ source_id, target_id, purpose });
  expect(res.status).toBe(201);
  return res.body;
}

// The learned_at of the newest event in this graph, as MICROSECOND text. See
// the precision note in the file header: a JS Date would truncate and land
// before the event it is meant to include.
async function logTime() {
  const { rows } = await pool.query(
    `SELECT to_char(learned_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS t
       FROM events WHERE graph_id = $1 ORDER BY seq DESC LIMIT 1`,
    [gid],
  );
  expect(rows).toHaveLength(1);
  return rows[0].t;
}

const byId = (rows) => [...rows].sort((a, b) => a.id - b.id);
const statusOf = (body, id) => body.nodes.find((n) => n.id === id)?.status ?? null;
const metaOf = (body, id) => body.nodes.find((n) => n.id === id)?.meta ?? null;

// Record every statement the ROUTES issue (src/db.js's pool), so "zero extra
// queries" is a measurement rather than a claim about the source.
function spyOnQueries() {
  const sqls = [];
  // Capture the real method BEFORE replacing it; `pg.Pool#query` needs its
  // receiver, hence the bind.
  const original = appPool.query.bind(appPool);
  const spy = vi.spyOn(appPool, 'query').mockImplementation((...args) => {
    sqls.push(typeof args[0] === 'string' ? args[0] : (args[0]?.text ?? ''));
    return original(...args);
  });
  return {
    sqls,
    restore: () => spy.mockRestore(),
    // Statements that read the event log. The hot path must produce none.
    log: () => sqls.filter((s) => /\bevents\b|graph_snapshots/.test(s)),
    rows: () => sqls.filter((s) => /FROM tasks\b|FROM edges\b/.test(s)),
  };
}

const squash = (sql) =>
  sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');

// ── 1. the hot path ─────────────────────────────────────────────────────────

describe('E18.1 asOf — the hot path pays zero', () => {
  it('a plain GET /graph runs the same two queries and never reads the log', async () => {
    const a = await makeTask({ title: 'A' });
    const b = await makeTask({ title: 'B' });
    await makeEdge(a.id, b.id);

    const spy = spyOnQueries();
    try {
      const res = await view();
      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(2);
      // The envelope is opt-in: no knobs, no as_of, same body shape as always.
      expect(res.body.as_of).toBeUndefined();
      expect(Object.keys(res.body)).toEqual(['nodes', 'links']);

      // ZERO statements against events / graph_snapshots.
      expect(spy.log()).toEqual([]);
      // EXACTLY the two row reads, with exactly the columns they have always
      // selected. Squashed (comments and whitespace dropped) so a reflow is not
      // a failure, but a changed column list or a third query is.
      const rows = spy.rows().map(squash);
      expect(rows).toEqual([
        "SELECT id, meta->>'title' AS title, meta->>'description' AS description, " +
          "meta->>'status' AS status, meta, version, external_id FROM tasks " +
          'WHERE graph_id = $1 ORDER BY id',
        'SELECT id, source_id AS source, target_id AS target, purpose, type, meta, version ' +
          'FROM edges WHERE graph_id = $1 ORDER BY id',
      ]);
    } finally {
      spy.restore();
    }
  });

  it('?asOf DOES read the log — the comparison that gives the previous test meaning', async () => {
    await makeTask({ title: 'A' });
    const spy = spyOnQueries();
    try {
      const res = await view({ asOf: new Date().toISOString() });
      expect(res.status).toBe(200);
      expect(spy.log().length).toBeGreaterThan(0);
      expect(spy.rows()).toEqual([]); // reconstructed from the log, not from tasks/edges
    } finally {
      spy.restore();
    }
  });
});

// ── 2. parameter validation ─────────────────────────────────────────────────

describe('E18.1 asOf — parameters', () => {
  it('rejects a malformed asOf, asOfSeq, known and axis with the house error shape', async () => {
    for (const [query, pattern] of [
      [{ asOf: 'yesterday' }, /asOf/],
      [{ asOf: '2024-13-45' }, /asOf/],
      [{ asOfSeq: '-1' }, /asOfSeq/],
      [{ asOfSeq: 'banana' }, /asOfSeq/],
      [{ axis: 'sideways' }, /axis/],
      [{ asOf: '2024-01-01T00:00:00Z', asOfSeq: '3' }, /combined/],
    ]) {
      const res = await view(query);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(pattern);
    }
  });

  it('?axis=happened without asOf is a 400 — a seq is a belief-time handle', async () => {
    const res = await view({ axis: 'happened' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/axis=happened requires asOf/);

    const withSeq = await view({ axis: 'happened', asOfSeq: '2' });
    expect(withSeq.status).toBe(400);
  });

  it('?known without ?axis=happened is a 400', async () => {
    const res = await view({ asOf: new Date().toISOString(), known: new Date().toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/known requires axis=happened/);
  });

  it('sets Cache-Control: no-store for ?asOf and max-age for the immutable ?asOfSeq', async () => {
    await makeTask({ title: 'A' });
    const byTime = await view({ asOf: new Date().toISOString() });
    expect(byTime.headers['cache-control']).toBe('no-store');
    // A pinned seq is genuinely immutable: seq is gapless and commit-ordered,
    // so no event can ever be inserted into an already-observed prefix.
    const bySeq = await view({ asOfSeq: '1' });
    expect(bySeq.headers['cache-control']).toBe('private, max-age=600');
  });

  it('does NOT declare an asOfSeq past head_seq cacheable — it is the moving head', async () => {
    // learnedAsOf clamps asOfSeq to the head, so this URL means "whatever the
    // head is right now". It answered 1 node here and 2 nodes a write later —
    // the same URL, two bodies. Ten minutes of max-age on that is a lie, so the
    // header is decided by the RESOLVED envelope, not by the query string.
    await makeTask({ title: 'A' });
    const ahead = await view({ asOfSeq: '999' });
    expect(ahead.status).toBe(200);
    expect(ahead.body.as_of).toMatchObject({ requested: 999, seq: 1, head_seq: 1 });
    expect(ahead.body.nodes).toHaveLength(1);
    expect(ahead.headers['cache-control']).toBe('no-store');

    await makeTask({ title: 'B' });
    const again = await view({ asOfSeq: '999' });
    expect(again.body.nodes).toHaveLength(2); // same URL, different body
    expect(again.headers['cache-control']).toBe('no-store');

    // A request AT the head is a settled prefix like any other and keeps its
    // max-age: the prefix seq<=2 can never gain a member.
    const atHead = await view({ asOfSeq: String(again.body.as_of.head_seq) });
    expect(atHead.body.as_of.seq).toBe(2);
    expect(atHead.headers['cache-control']).toBe('private, max-age=600');
  });

  it('is read-gated by the existing mount — nothing new to get wrong', async () => {
    const res = await request(app)
      .get(`/api/graphs/nosuchgraph/graph`)
      .query({ asOf: new Date().toISOString() });
    expect(res.status).toBe(404);
  });
});

// ── 3. the DONE-WHEN chain ──────────────────────────────────────────────────

describe('E18.1 asOf — reconstruction on the learned axis', () => {
  it('replays create → wire → flip → set → retype → delete at three points', async () => {
    // Seven writes, all through the real routes, so every middleware and every
    // row trigger fires exactly as in production.
    const a = await makeTask({ title: 'A' }); // seq 1
    const b = await makeTask({ title: 'B' }); // seq 2
    const e = await makeEdge(a.id, b.id, 'required for'); // seq 3
    const t1 = await logTime();

    await patchTask(a.id, { title: 'A', status: 'review' }); // seq 4
    await patchTask(b.id, { title: 'B', status: 'todo', confidence: 0.9 }); // seq 5
    const retyped = await request(app).patch(`${edgesUrl()}/${e.id}`).send({ purpose: 'supports' });
    expect(retyped.status).toBe(200); // seq 6
    const t2 = await logTime();

    const deleted = await request(app).delete(`${tasksUrl()}/${a.id}`);
    expect(deleted.status).toBe(200); // seq 7 (node.removed) + seq 8 (edge.removed, cascade)
    const t3 = await logTime();

    // POINT 1 — both nodes todo, the edge as first wired.
    const p1 = await view({ asOf: t1 });
    expect(p1.status).toBe(200);
    expect(byId(p1.body.nodes).map((n) => [n.id, n.title, n.status])).toEqual([
      [a.id, 'A', 'todo'],
      [b.id, 'B', 'todo'],
    ]);
    expect(p1.body.links).toHaveLength(1);
    expect(p1.body.links[0]).toMatchObject({
      id: e.id,
      source: a.id,
      target: b.id,
      purpose: 'required for',
      type: 'dependency',
    });
    expect(p1.body.as_of).toMatchObject({
      axis: 'learned',
      requested: t1,
      seq: 3,
      head_seq: 8,
      base: { kind: 'genesis', seq: 0 },
      events_replayed: 3,
      truncated: false,
      anomalies: [],
    });
    expect(p1.body.as_of.history_starts_at).toBeTruthy();

    // POINT 2 — A flipped, B carries confidence, the edge retyped. The
    // derived `type` follows `purpose` here exactly as it does in the live
    // table, because the trigger captured both columns in one diff.
    const p2 = await view({ asOf: t2 });
    expect(statusOf(p2.body, a.id)).toBe('review');
    expect(metaOf(p2.body, b.id).confidence).toBe(0.9);
    expect(p2.body.links[0]).toMatchObject({ purpose: 'supports', type: 'related' });
    expect(p2.body.as_of.seq).toBe(6);
    expect(p2.body.as_of.events_replayed).toBe(6);
    expect(p2.body.as_of.anomalies).toEqual([]);

    // POINT 3 — A is gone, and so is the edge the handler never knew it
    // destroyed. The ON DELETE CASCADE is in the log because the capture is in
    // the database; a handler-level log would reconstruct a dangling edge here.
    const p3 = await view({ asOf: t3 });
    expect(p3.body.nodes.map((n) => n.id)).toEqual([b.id]);
    expect(p3.body.links).toEqual([]);
    expect(p3.body.as_of.seq).toBe(8);
    expect(p3.body.as_of.head_seq).toBe(8);

    // asOf = now is the present, and the present is what /graph already says.
    const now = await view({ asOf: new Date(Date.now() + 1000).toISOString() });
    const live = await view();
    expect(now.body.nodes).toEqual(live.body.nodes);
    expect(now.body.links).toEqual(live.body.links);
    expect(now.body.as_of.seq).toBe(now.body.as_of.head_seq);
  });

  it('?asOfSeq pins the same prefix by seq, and clamps past the head', async () => {
    const a = await makeTask({ title: 'A' });
    await makeTask({ title: 'B' });

    const one = await view({ asOfSeq: '1' });
    expect(one.body.nodes.map((n) => n.id)).toEqual([a.id]);
    expect(one.body.as_of).toMatchObject({ requested: 1, seq: 1, head_seq: 2 });

    const far = await view({ asOfSeq: '9999' });
    expect(far.body.nodes).toHaveLength(2);
    expect(far.body.as_of.seq).toBe(2); // clamped to the head
  });

  it('an asOf before the graph existed returns the genesis substrate, truncated', async () => {
    await makeTask({ title: 'A' });
    const res = await view({ asOf: '2020-01-01T00:00:00Z' });
    expect(res.status).toBe(200);
    expect(res.body.nodes).toEqual([]);
    expect(res.body.links).toEqual([]);
    // The left edge of a timeline slider, not a 404.
    expect(res.body.as_of).toMatchObject({ seq: 0, events_replayed: 0, truncated: true });
    expect(res.body.as_of.base.kind).toBe('genesis');
  });

  it('scopes strictly to its own graph', async () => {
    const other = (await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id"))
      .rows[0].id;
    await request(app).post(`/api/graphs/${other}/tasks`).send({ content: node({ title: 'elsewhere', status: 'todo' }) });
    const mine = await makeTask({ title: 'mine' });

    const res = await view({ asOf: new Date(Date.now() + 1000).toISOString() });
    expect(res.body.nodes.map((n) => n.title)).toEqual(['mine']);
    expect(res.body.as_of.head_seq).toBe(1);
    expect(mine.id).toBeGreaterThan(0);
  });
});

// ── 4. the backdating divergence (PLAN.md §3 STEP 5, worked) ────────────────

describe('E18.1 asOf — the two axes disagree, and that is the point', () => {
  // World time. Belief time is whatever the clock says when the request lands;
  // learned_at is stamped by the database and cannot be forged, so the learned
  // asOf values are read back out of the log.
  const D = '2024-03-01T';
  const T_BORN = `${D}08:00:00.000Z`;
  const T_E1 = `${D}10:00:00.000Z`; // todo -> review
  const T_E2 = `${D}10:30:00.000Z`; // review -> done
  const T_E3 = `${D}09:00:00.000Z`; // done -> todo + confidence, learned LAST
  const T_0930 = `${D}09:30:00.000Z`;
  const T_1015 = `${D}10:15:00.000Z`;
  const T_1100 = `${D}11:00:00.000Z`;

  let n7;
  let L1;
  let L2;
  let L3;

  beforeEach(async () => {
    n7 = await makeTask({ title: 'N7' }, T_BORN);
    await patchTask(n7.id, { title: 'N7', status: 'review' }, T_E1);
    L1 = await logTime();
    await patchTask(n7.id, { title: 'N7', status: 'done' }, T_E2);
    L2 = await logTime();
    // The correction: learned an hour after e2, but claiming to describe the
    // world an hour BEFORE e1. This is the event that makes the axes diverge.
    await patchTask(n7.id, { title: 'N7', status: 'todo', confidence: 0.9 }, T_E3);
    L3 = await logTime();
  });

  it('learned axis: the backdated correction applies LAST, because that is when we learned it', async () => {
    const at1 = await view({ asOf: L1 });
    expect(statusOf(at1.body, n7.id)).toBe('review');
    expect(metaOf(at1.body, n7.id).confidence).toBeUndefined();

    const at2 = await view({ asOf: L2 });
    expect(statusOf(at2.body, n7.id)).toBe('done');

    const at3 = await view({ asOf: L3 });
    expect(statusOf(at3.body, n7.id)).toBe('todo');
    expect(metaOf(at3.body, n7.id).confidence).toBe(0.9);
    expect(at3.body.as_of.anomalies).toEqual([]);
  });

  it('happened axis: e1 overwrites the backdated correction, though it was learned an hour earlier', async () => {
    // 09:30 — the node was born at 08:00 and only the backdated e3 has
    // happened yet.
    const t0930 = await view({ axis: 'happened', asOf: T_0930 });
    expect(t0930.status).toBe(200);
    expect(t0930.body.as_of.axis).toBe('happened');
    expect(statusOf(t0930.body, n7.id)).toBe('todo');
    expect(metaOf(t0930.body, n7.id).confidence).toBe(0.9);
    expect(t0930.body.as_of.events_replayed).toBe(2); // birth + e3

    // 10:15 — THE DIVERGENCE. On the learned axis this graph never showed
    // `review` together with `confidence: 0.9`; on the happened axis it is the
    // only honest answer, because e1 describes a later moment than e3 even
    // though we were told about it first. e3's own `changes` claims
    // `{from:"done"}`, which is FALSE here — precisely why the fold never
    // reads `from`.
    const t1015 = await view({ axis: 'happened', asOf: T_1015 });
    expect(statusOf(t1015.body, n7.id)).toBe('review');
    expect(metaOf(t1015.body, n7.id).confidence).toBe(0.9);
    expect(t1015.body.as_of.events_replayed).toBe(3);
    expect(t1015.body.as_of.anomalies).toEqual([]);

    // 11:00 — everything has happened.
    const t1100 = await view({ axis: 'happened', asOf: T_1100 });
    expect(statusOf(t1100.body, n7.id)).toBe('done');
    expect(metaOf(t1100.body, n7.id).confidence).toBe(0.9);

    // And the base is genesis, never a periodic snapshot: a snapshot encodes
    // learned-order outcomes and is simply wrong for this ordering.
    expect(t1100.body.as_of.base.kind).toBe('genesis');
  });

  it('bitemporal: what we, believing what we believed at 11:30, would have said about 10:15', async () => {
    // known = the moment just after e2 was learned and before e3 was.
    const res = await view({ axis: 'happened', asOf: T_1015, known: L2 });
    expect(res.status).toBe(200);
    // e3 excluded — learned too late. e2 excluded — happened too late.
    expect(statusOf(res.body, n7.id)).toBe('review');
    expect(metaOf(res.body, n7.id).confidence).toBeUndefined();
    expect(res.body.as_of).toMatchObject({
      axis: 'happened',
      requested: T_1015,
      known: L2,
      events_replayed: 2, // birth + e1
    });
  });

  it('the same request on the two axes returns different states from the same log', async () => {
    const learned = await view({ asOf: L3 });
    const happened = await view({ axis: 'happened', asOf: T_1015 });
    expect(statusOf(learned.body, n7.id)).toBe('todo');
    expect(statusOf(happened.body, n7.id)).toBe('review');
    // Same graph, same events, same head.
    expect(learned.body.as_of.head_seq).toBe(happened.body.as_of.head_seq);
  });

  it('an event re-sorted before its subject exists is materialised and FLAGGED', async () => {
    // A correction backdated to before the node was even created. On the
    // learned axis this is unremarkable; on the happened axis the patch sorts
    // before the create, so applyEvent materialises from the post-image rather
    // than dropping the event, and says so in `anomalies`.
    await patchTask(n7.id, { title: 'N7', status: 'in_progress' }, `${D}07:00:00.000Z`);

    const res = await view({ axis: 'happened', asOf: `${D}07:30:00.000Z` });
    expect(res.status).toBe(200);
    expect(statusOf(res.body, n7.id)).toBe('in_progress');
    expect(res.body.as_of.anomalies).toHaveLength(1);
    expect(res.body.as_of.anomalies[0]).toMatchObject({
      subject_kind: 'node',
      subject_id: n7.id,
      reason: 'subject_absent_materialised_from_post_image',
    });

    // The learned axis, over the very same events, has nothing to report.
    const learned = await view({ asOf: await logTime() });
    expect(learned.body.as_of.anomalies).toEqual([]);
    expect(statusOf(learned.body, n7.id)).toBe('in_progress');
  });
});

// ── 5. the cache ────────────────────────────────────────────────────────────

describe('E18.1 asOf — the derived cache is invisible', () => {
  it('a hit returns the identical body and skips the log queries', async () => {
    await makeTask({ title: 'A' });
    await makeTask({ title: 'B' });

    const cold = spyOnQueries();
    let first;
    try {
      first = await view({ asOfSeq: '2' });
      expect(first.status).toBe(200);
      // base lookup + tail + the head/resolve round trip.
      expect(cold.log().length).toBe(3);
    } finally {
      cold.restore();
    }

    const warm = spyOnQueries();
    try {
      const second = await view({ asOfSeq: '2' });
      expect(second.body).toEqual(first.body); // a cache that changes the answer is not a cache
      // Only the head/resolve round trip survives: head_seq is live, the state
      // at a pinned seq is not.
      expect(warm.log().length).toBe(1);
    } finally {
      warm.restore();
    }
  });

  it('the key carries the graph id, so a fresh graph reusing seq 1 is not served the old answer', async () => {
    // tests/setup.js TRUNCATEs with RESTART IDENTITY before every test while
    // this module's cache survives, so a seq-only key would answer this wrong.
    const a = await makeTask({ title: 'first graph' });
    const one = await view({ asOfSeq: '1' });
    expect(one.body.nodes[0].title).toBe('first graph');

    const other = (await pool.query("INSERT INTO graphs (name) VALUES ('second') RETURNING id"))
      .rows[0].id;
    const created = await request(app)
      .post(`/api/graphs/${other}/tasks`)
      .send({ content: node({ title: 'second graph', status: 'todo' }) });
    expect(created.status).toBe(201);

    const two = await request(app).get(`/api/graphs/${other}/graph`).query({ asOfSeq: '1' });
    expect(two.body.nodes[0].title).toBe('second graph');
    expect(two.body.as_of.seq).toBe(1);
    expect(a.id).toBeGreaterThan(0);
  });
});
