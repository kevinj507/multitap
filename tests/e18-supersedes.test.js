// E18.4 — `supersedes`, cause-carrying invalidation, and fact worldlines.
//
// The rung's whole claim is that ONE relation, added to the edge vocabulary,
// buys three things at once:
//
//   1. a way to say "A was right for its time; B replaces it" that is NOT
//      `contradicts` (they cannot both be true) — the distinction the corpus
//      was already making in PROSE and mis-filing as a conflict;
//   2. an ANNOTATION event (`node.superseded`) whose subject is the SUPERSEDED
//      NODE and whose `cause_id` is the edge event that opened it, so E18.3's
//      doubt front has a seed in the right id-space with the cause chain
//      already attached;
//   3. exclusion from /frontier, /ready and /decisions/at-risk that is a
//      FUNCTION OF TIME on both axes for free — because the predicate is over
//      the reconstructed EDGE SET and never over a flag on the row.
//
// Point 3 is the one that would break silently, so it is attacked from both
// ends: the SQL head form and the pure fold form must return the same set, and
// a supersession that has not happened yet (or that we had not been told about
// yet) must not exclude anything.
//
// The other silent break this file exists to prevent is the auto-unblock: if
// the /ready exclusion ever moves into the recursive prereqs CTE, a superseded
// PREREQUISITE would read as satisfied and its dependents would go ready on
// their own. "Nothing auto-flips status" is locked; the test is named for it.
//
// Timestamps are explicit throughout (the e17-decisions.test.js:41 idiom),
// never sleep(). src/db.js is imported inside beforeAll, never at module scope.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
// Pure modules only at module scope: neither reaches src/db.js.
import {
  EDGE_PURPOSES,
  PURPOSE_ERROR,
  purposeToType,
  resolveEdgeKind,
} from '../src/edgePurpose.js';
import { EVENT_KINDS, weakening } from '../src/events/kinds.js';
import { findSignedInconsistencies } from '../src/signedCycles.js';
import {
  MAX_GENERATIONS,
  buildWorldline,
  supersededIds,
  supersessionsFromLinks,
} from '../src/supersession.js';

let app;
let pool;
let dbPool;
let applySchema;
let checkFromEvent;
let resetDerivedCache;
let gid;
let logMark = 0;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  dbPool = (await import('../src/db.js')).default;
  applySchema = (await import('../src/db.js')).applySchema;
  checkFromEvent = (await import('../src/events/stability.js')).checkFromEvent;
  resetDerivedCache = (await import('../src/derivedCache.js'))._resetDerivedCacheForTests;
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-supersedes') RETURNING id");
  gid = g.rows[0].id;
  logMark = 0;
  resetDerivedCache();
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const edgesUrl = (g = gid) => `/api/graphs/${g}/edges`;
const frontierUrl = (g = gid) => `/api/graphs/${g}/frontier`;
const worldlineUrl = (id, g = gid) => `/api/graphs/${g}/tasks/${id}/worldline`;

async function insNode(meta) {
  const m = { status: 'review', ...meta };
  const { rows } = await pool.query(
    'INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id',
    [gid, node(m), JSON.stringify(m)],
  );
  return Number(rows[0].id);
}

// A node created through the route with a BACKDATED happened_at, so it exists
// on the happened axis before today. Without this, every node's `node.created`
// happened at wall-clock NOW and a `?axis=happened&asOf=<march>` reconstruction
// correctly contains no nodes at all.
async function insNodeAt(meta, happenedAt) {
  const m = { status: 'review', ...meta };
  const res = await request(app).post(`/api/graphs/${gid}/tasks`)
    .send({ content: node(m), happened_at: happenedAt });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

// A raw edge insert: still fully captured (capture is a row trigger), but with
// no route in the way. `type` is derived exactly as purposeToType does.
async function insEdge(source, target, purpose = 'supports', happenedAt = null) {
  const type = purposeToType(purpose);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (happenedAt) await client.query('SELECT set_config($1,$2,true)', ['gt.happened_at', happenedAt]);
    const { rows } = await client.query(
      'INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1,$2,$3,$4::edge_type,$5) RETURNING id',
      [gid, source, target, type, purpose],
    );
    await client.query('COMMIT');
    return Number(rows[0].id);
  } finally {
    client.release();
  }
}

// There is NO way to clear the log — gt_events_append_only refuses DELETE with
// 0A000 unconditionally — so the window is a per-graph seq high-water mark.
async function markLog() {
  const { rows } = await pool.query('SELECT COALESCE(MAX(seq),0) AS s FROM events WHERE graph_id = $1', [gid]);
  logMark = Number(rows[0].s);
}
async function events() {
  const { rows } = await pool.query(
    `SELECT seq, kind, subject_kind, subject_id, cause_id, happened_at, payload
       FROM events WHERE graph_id = $1 AND seq > $2 ORDER BY seq`,
    [gid, logMark],
  );
  return rows.map((r) => ({ ...r, seq: Number(r.seq), subject_id: r.subject_id === null ? null : Number(r.subject_id), cause_id: r.cause_id === null ? null : Number(r.cause_id) }));
}

// ─────────────────────────── vocabulary ──────────────────────────────────────

describe('E18.4 vocabulary — a fifth purpose, deriving an EXISTING enum label', () => {
  it('EDGE_PURPOSES carries supersedes and purposeToType derives related', () => {
    expect(EDGE_PURPOSES).toContain('supersedes');
    // The 55P04 boot-killer is avoided by NOT needing a new enum value at all:
    // `related` already exists in edge_type. If this ever returns 'dependency',
    // "B supersedes A" silently becomes "B is a prerequisite of A".
    expect(purposeToType('supersedes')).toBe('related');
    expect(resolveEdgeKind({ purpose: 'supersedes' })).toEqual({ purpose: 'supersedes', type: 'related' });
  });

  it('the rejection message names all five purposes, from one source', () => {
    expect(PURPOSE_ERROR).toContain("'supersedes'");
    expect(resolveEdgeKind({ purpose: 'replaces' }).error).toBe(PURPOSE_ERROR);
  });

  it('POST /edges accepts it, stores type=related, and /graph emits both fields', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const res = await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'supersedes' });
    expect(res.status).toBe(201);
    expect(res.body.purpose).toBe('supersedes');
    expect(res.body.type).toBe('related');

    const graph = await request(app).get(`/api/graphs/${gid}/graph`);
    const link = graph.body.links.find((l) => l.id === res.body.id);
    expect(link).toMatchObject({ source: b, target: a, purpose: 'supersedes', type: 'related' });
  });

  it('PATCH /edges accepts it (the contradicts -> supersedes retype path)', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const created = await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'contradicts' });
    const res = await request(app).patch(`${edgesUrl()}/${created.body.id}`).send({ purpose: 'supersedes' });
    expect(res.status).toBe(200);
    expect(res.body.purpose).toBe('supersedes');
    expect(res.body.type).toBe('related');
  });

  it('is NOT cycle-checked — a revert chain is legitimate history', async () => {
    // `supersedes` derives `related`, so it never enters the transactional
    // cycle check. It HAS to be storable in both directions: B supersedes A,
    // then later A' supersedes B, then A again, is a real revert. The price is
    // that every walk over supersessions needs a visited set — the exact
    // OPPOSITE of the cause_id rule, which is a strict DAG by CHECK.
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const one = await request(app).post(edgesUrl()).send({ source_id: a, target_id: b, purpose: 'supersedes' });
    const two = await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'supersedes' });
    expect(one.status).toBe(201);
    expect(two.status).toBe(201);
  });

  it('POST /structure accepts supersedes as a purpose filter', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await insEdge(b, a, 'supersedes');
    const res = await request(app).post(`/api/graphs/${gid}/structure`).send({ purposes: ['supersedes'] });
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────── the schema ──────────────────────────────────────

describe('E18.4 schema — the widenings are IN PLACE, and that is testable', () => {
  it('both CHECK constraints carry the new values', async () => {
    const { rows } = await pool.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname IN ('edges_purpose_valid','events_kind_valid')`,
    );
    const byName = Object.fromEntries(rows.map((r) => [r.conname, r.def]));
    expect(byName.edges_purpose_valid).toContain("'supersedes'");
    expect(byName.events_kind_valid).toContain("'node.superseded'");
  });

  it('EVENT_KINDS is the 18-value vocabulary and node.superseded is in it', () => {
    expect(EVENT_KINDS).toContain('node.superseded');
    // 17 through E18.5; E18.6 added node.excised (tests/e18-excision.test.js).
    expect(EVENT_KINDS).toHaveLength(18);
  });

  it('applySchema runs twice cleanly on a database that ALREADY HOLDS the new rows', async () => {
    // THE BOOT-KILLER THIS RUNG NEARLY SHIPPED. schema.sql is one
    // multi-statement query and `ALTER TABLE ... ADD CONSTRAINT` validates
    // IMMEDIATELY. A widened CHECK APPENDED to the file rather than edited in
    // place leaves the original narrow block running first — and it then fails
    // on the rows the feature itself created:
    //   ERROR: check constraint "events_kind_valid" of relation "events"
    //          is violated by some row
    // A fresh test database cannot see that; a database with data can. So the
    // rows go in FIRST, and only then is the schema re-applied.
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await insEdge(b, a, 'supersedes');
    const { rows: ann } = await pool.query(
      "SELECT count(*)::int AS n FROM events WHERE graph_id = $1 AND kind = 'node.superseded'",
      [gid],
    );
    expect(ann[0].n).toBe(1);

    await expect(applySchema(pool)).resolves.toBeUndefined();
    await expect(applySchema(pool)).resolves.toBeUndefined();

    // and the rows survived both applies
    const { rows: after } = await pool.query(
      "SELECT count(*)::int AS n FROM edges WHERE graph_id = $1 AND purpose = 'supersedes'",
      [gid],
    );
    expect(after[0].n).toBe(1);
  });

  it('has the partial index that makes the exclusion an index-only scan', async () => {
    const { rows } = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname = 'edges_supersedes_idx'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("WHERE (purpose = 'supersedes'::text)");
  });
});

// ─────────────────────────── the event ───────────────────────────────────────

describe('E18.4 event — node.superseded is an annotation with a cause', () => {
  it('an INSERT emits exactly [edge.added, node.superseded]', async () => {
    const a = await insNode({ title: 'A (old fact)', type: 'finding' });
    const b = await insNode({ title: 'B (successor)' });
    await markLog();
    const created = await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'supersedes' });
    expect(created.status).toBe(201);

    const log = await events();
    expect(log.map((e) => e.kind)).toEqual(['edge.added', 'node.superseded']);
    const [edgeEvent, annotation] = log;
    // The SUBJECT is the superseded NODE, not the edge — that is the whole
    // reason this event exists. events_subject_idx answers "A's worldline" as
    // an index seek, and a seed extractor cannot mix id spaces.
    expect(annotation.subject_kind).toBe('node');
    expect(annotation.subject_id).toBe(a);
    // cause_id is the edge event's own seq, allocated one gt_next_seq() call
    // earlier — so the strict-DAG CHECK (cause_id < seq) holds BY CONSTRUCTION.
    expect(annotation.cause_id).toBe(edgeEvent.seq);
    expect(annotation.cause_id).toBeLessThan(annotation.seq);
    expect(annotation.payload).toMatchObject({
      v: 1, op: 'ANNOTATE', table: 'tasks',
      kinds: ['node.superseded'],
      node_kind: 'finding',
      superseded_by: b,
      via: 'edge.added',
    });
    expect(Number(annotation.payload.edge_id)).toBe(created.body.id);
  });

  it('a RETYPE from contradicts emits [edge.retyped, node.superseded] via edge.retyped', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const edge = await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'contradicts' });
    await markLog();
    const res = await request(app).patch(`${edgesUrl()}/${edge.body.id}`).send({ purpose: 'supersedes' });
    expect(res.status).toBe(200);

    const log = await events();
    expect(log.map((e) => e.kind)).toEqual(['edge.retyped', 'node.superseded']);
    expect(log[1].subject_id).toBe(a);
    expect(log[1].payload.via).toBe('edge.retyped');
    expect(log[1].cause_id).toBe(log[0].seq);
    // The separately-useful half: endpoints on the edge UPDATE event. Without
    // it, `changes` names purpose/type ONLY and nothing in the log says which
    // node this retype superseded.
    expect(log[0].payload.endpoints).toEqual({ source_id: b, target_id: a });
  });

  it('a REWIRE of a live supersedes edge annotates the NEW target', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const c = await insNode({ title: 'C' });
    const edge = await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'supersedes' });
    await markLog();
    const res = await request(app).patch(`${edgesUrl()}/${edge.body.id}`).send({ target_id: c });
    expect(res.status).toBe(200);

    const log = await events();
    expect(log.map((e) => e.kind)).toEqual(['edge.rewired', 'node.superseded']);
    expect(log[1].subject_id).toBe(c);
    expect(log[1].payload.via).toBe('edge.rewired');
  });

  // ── the four negatives, one `it` each ──────────────────────────────────────

  it('NEGATIVE: a meta-only patch on a live supersedes edge does not re-fire', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const edge = await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'supersedes' });
    await markLog();
    const res = await request(app).patch(`${edgesUrl()}/${edge.body.id}`).send({ meta: { color: '#ff0000' } });
    expect(res.status).toBe(200);
    const log = await events();
    expect(log.map((e) => e.kind)).toEqual(['edge.patched']);
  });

  it('NEGATIVE: retyping AWAY from supersedes does not fire', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const edge = await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'supersedes' });
    await markLog();
    await request(app).patch(`${edgesUrl()}/${edge.body.id}`).send({ purpose: 'contradicts' });
    const log = await events();
    expect(log.map((e) => e.kind)).toEqual(['edge.retyped']);
  });

  it('NEGATIVE: deleting the supersedes edge emits edge.removed ONLY', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const edge = await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'supersedes' });
    await markLog();
    const res = await request(app).delete(`${edgesUrl()}/${edge.body.id}`);
    expect(res.status).toBe(200);
    const log = await events();
    expect(log.map((e) => e.kind)).toEqual(['edge.removed']);
  });

  it('NEGATIVE: a cascade delete of an endpoint emits node.removed + edge.removed ONLY', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await insEdge(b, a, 'supersedes');
    await markLog();
    const res = await request(app).delete(`/api/graphs/${gid}/tasks/${a}`);
    expect(res.status).toBe(200);
    const log = await events();
    expect(log.map((e) => e.kind)).toEqual(['node.removed', 'edge.removed']);
  });

  it('backdating reaches BOTH events identically', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await markLog();
    const when = '2026-03-01T00:00:00.000Z';
    const res = await request(app).post(edgesUrl())
      .send({ source_id: b, target_id: a, purpose: 'supersedes', happened_at: when });
    expect(res.status).toBe(201);
    const log = await events();
    expect(log).toHaveLength(2);
    // One world-time instant by construction: both read gt_happened_at().
    expect(new Date(log[0].happened_at).toISOString()).toBe(when);
    expect(new Date(log[1].happened_at).toISOString()).toBe(when);
    // learned_at is a SERVER fact and is NOT backdated with it.
    const { rows } = await pool.query(
      'SELECT learned_at FROM events WHERE graph_id = $1 AND seq = $2', [gid, log[1].seq],
    );
    expect(new Date(rows[0].learned_at).getTime()).toBeGreaterThan(new Date(when).getTime());
  });

  it('weakening() yields the supersession seed; checkFromEvent() still returns null', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await markLog();
    await request(app).post(edgesUrl()).send({ source_id: b, target_id: a, purpose: 'supersedes' });
    const log = await events();
    const annotation = log[1];

    const seed = weakening(annotation);
    expect(seed).toMatchObject({
      kind: 'supersession',
      magnitude: 1,
      subject_id: a,
      superseded_by: b,
      cause_id: log[0].seq,
    });
    // NO propagation weight and NO attenuation constant: E18.3's to choose.
    expect(seed.weight).toBeUndefined();
    expect(seed.attenuation).toBeUndefined();
    // A supersession is NOBODY RE-VERIFYING ANYTHING. Letting it move S would
    // be the invisible knob interaction E18.2 refused for confidence_drop.
    expect(checkFromEvent(annotation)).toBeNull();
  });
});

// ─────────────────────── the state is the edge set ───────────────────────────

describe('E18.4 exclusion — one rule, two forms, and they agree', () => {
  it('supersededIds(links) equals the SQL NOT EXISTS set at head', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const c = await insNode({ title: 'C' });
    await insEdge(b, a, 'supersedes');
    await insEdge(c, b, 'supports');

    const graph = await request(app).get(`/api/graphs/${gid}/graph`);
    const fold = supersededIds(graph.body.links);
    const { rows } = await pool.query(
      `SELECT t.id FROM tasks t WHERE t.graph_id = $1
         AND EXISTS (SELECT 1 FROM edges se WHERE se.graph_id = $1
                      AND se.purpose = 'supersedes' AND se.target_id = t.id)`,
      [gid],
    );
    expect([...fold].sort()).toEqual(rows.map((r) => Number(r.id)).sort());
    expect([...fold]).toEqual([a]);
  });

  it('supersessionsFromLinks reads source as the SUCCESSOR and target as superseded', () => {
    const rels = supersessionsFromLinks([
      { id: 7, source: 2, target: 1, purpose: 'supersedes' },
      { id: 8, source: 3, target: 1, purpose: 'supports' },
    ]);
    expect(rels).toEqual([{ edge_id: 7, successor: 2, superseded: 1 }]);
  });
});

describe('E18.4 exclusion — /frontier', () => {
  async function claim(title, meta = {}) {
    const id = await insNode({ title, confidence: 0.8, ...meta });
    // enough out-degree to clear the default minImportance of 2
    for (let i = 0; i < 3; i += 1) {
      const leaf = await insNode({ title: `${title}-leaf-${i}` });
      await insEdge(id, leaf, 'supports');
    }
    return id;
  }

  it('a graph with NO supersedes edge keeps PATH A, byte-for-byte', async () => {
    // THE BACK-COMPAT GATE. All 65 real graphs are in this state, so all 65
    // keep running the v1 SQL object and no shipped ranking can move.
    await claim('c1');
    const spy = vi.spyOn(dbPool, 'query');
    try {
      const res = await request(app).post(frontierUrl()).send({});
      expect(res.status).toBe(200);
      expect(res.body.model.mode).toBe('scalar');
      const texts = spy.mock.calls.map((c) => (typeof c[0] === 'string' ? c[0] : c[0]?.text ?? ''));
      expect(texts.filter((t) => t.includes("(t.meta->>'verified_at') ASC NULLS FIRST"))).toHaveLength(1);
      expect(texts.filter((t) => t.includes('AS superseded'))).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('one supersedes edge flips the graph to PATH B and excludes the superseded claim', async () => {
    const c1 = await claim('c1');
    const c2 = await claim('c2');
    const before = await request(app).post(frontierUrl()).send({});
    expect(before.body.frontier.map((f) => f.id)).toEqual(expect.arrayContaining([c1, c2]));

    await insEdge(c2, c1, 'supersedes');
    resetDerivedCache();
    const after = await request(app).post(frontierUrl()).send({});
    expect(after.status).toBe(200);
    // A graph carrying supersessions MUST take the path that can read them,
    // the same honesty rule the has_e18_2_meta term states.
    expect(after.body.model.mode).toBe('decay');
    expect(after.body.frontier.map((f) => f.id)).not.toContain(c1);
    expect(after.body.frontier.map((f) => f.id)).toContain(c2);
  });

  it('includeSuperseded brings it back in the SAME position', async () => {
    const c1 = await claim('c1');
    const c2 = await claim('c2');
    await insEdge(c2, c1, 'supersedes');
    resetDerivedCache();
    const excluded = await request(app).post(frontierUrl()).send({});
    const included = await request(app).post(frontierUrl()).send({ includeSuperseded: true });
    expect(included.body.params.includeSuperseded).toBe(true);
    // The flag changes WHAT IS SHOWN, never how anything ranks: removing the
    // superseded rows from the included answer reproduces the excluded one.
    expect(included.body.frontier.filter((f) => f.superseded !== true).map((f) => f.id))
      .toEqual(excluded.body.frontier.map((f) => f.id));
    expect(included.body.frontier.find((f) => f.id === c1).superseded).toBe(true);
  });

  it('a supersedes edge contributes ZERO importance', async () => {
    // Superseding a node is not evidence SUPPORTING it. IMPORTANCE_CTE is
    // deliberately not extended, so the successor gains nothing by superseding.
    const a = await insNode({ title: 'A', confidence: 0.4 });
    const b = await insNode({ title: 'B', confidence: 0.4 });
    await insEdge(b, a, 'supersedes');
    resetDerivedCache();
    const res = await request(app).post(frontierUrl()).send({ minImportance: 1 });
    expect(res.body.frontier.map((f) => f.id)).not.toContain(b);
  });
});

describe('E18.4 exclusion — /tasks/ready', () => {
  const ready = (query = '') => request(app).get(`/api/graphs/${gid}/tasks/ready${query}`);

  it('a superseded todo node drops out, and includeSuperseded brings it back', async () => {
    const t1 = await insNode({ title: 'T1', status: 'todo' });
    const t2 = await insNode({ title: 'T2', status: 'todo' });
    await insEdge(t2, t1, 'supersedes');
    const out = await ready();
    expect(out.body.map((t) => Number(t.id))).toEqual([t2]);
    const back = await ready('?includeSuperseded=1');
    expect(back.body.map((t) => Number(t.id)).sort()).toEqual([t1, t2].sort());
  });

  it('A SUPERSEDED PREREQUISITE STILL BLOCKS — nothing auto-flips status', async () => {
    // The silent break this design exists to avoid. If the exclusion ever moves
    // into the recursive prereqs CTE, P disappears from the walk, reads as
    // SATISFIED, and D goes ready on its own — work auto-unblocked by an
    // editorial act. The remedy for a superseded prerequisite is a deliberate
    // rewire of the `required for` edge onto the successor, which gets its own
    // edge.rewired event.
    const p = await insNode({ title: 'P (prereq, not done)', status: 'todo' });
    const d = await insNode({ title: 'D (dependent)', status: 'todo' });
    const pPrime = await insNode({ title: "P' (successor)", status: 'todo' });
    await insEdge(p, d, 'required for');
    await insEdge(pPrime, p, 'supersedes');

    const out = await ready();
    const ids = out.body.map((t) => Number(t.id));
    expect(ids).not.toContain(d);       // still blocked
    expect(ids).not.toContain(p);       // superseded, so not offered as work
    expect(ids).toContain(pPrime);
  });
});

describe('E18.4 exclusion — /decisions/at-risk', () => {
  const atRisk = (body = {}) => request(app).post(`/api/graphs/${gid}/decisions/at-risk`).send(body);

  it('a superseded DECISION drops out; includeSuperseded brings it back', async () => {
    const ground = await insNode({ title: 'ground', confidence: 0.2 });
    const decision = await insNode({ title: 'D', type: 'decision' });
    const newer = await insNode({ title: "D'", type: 'decision' });
    await insEdge(ground, decision, 'supports');

    const before = await atRisk();
    expect(before.body.atRisk.map((d) => Number(d.id))).toContain(decision);

    await insEdge(newer, decision, 'supersedes');
    const after = await atRisk();
    expect(after.body.atRisk.map((d) => Number(d.id))).not.toContain(decision);
    const back = await atRisk({ includeSuperseded: true });
    expect(back.body.atRisk.map((d) => Number(d.id))).toContain(decision);
  });

  it('a superseded GROUND contributes the supersededGround reason', async () => {
    const ground = await insNode({ title: 'ground', confidence: 0.9, verified_at: new Date().toISOString() });
    const decision = await insNode({ title: 'D', type: 'decision', decided_at: new Date(Date.now() + 60000).toISOString() });
    const replacement = await insNode({ title: 'ground v2', confidence: 0.9 });
    await insEdge(ground, decision, 'supports');

    const quiet = await atRisk();
    expect(quiet.body.atRisk.map((d) => Number(d.id))).not.toContain(decision);

    await insEdge(replacement, ground, 'supersedes');
    const loud = await atRisk();
    const row = loud.body.atRisk.find((d) => Number(d.id) === decision);
    expect(row).toBeDefined();
    expect(row.reasons.find((r) => Number(r.id) === ground).kinds).toContain('supersededGround');
  });
});

describe('E18.4 — contradicts is untouched', () => {
  const scan = () => request(app).post(`/api/graphs/${gid}/inconsistencies`).send({});

  it('signedCycles IGNORES a supersedes edge even when handed one directly', () => {
    // TWO layers keep a supersession out of the scan: inconsistency.js's SQL
    // (`WHERE purpose IN ('supports','contradicts')`) never fetches one, and
    // signedCycles.js's SIGNED_PURPOSES allowlist drops one if it arrives
    // anyway. This is the second layer, tested where the route cannot reach:
    // 1 --contradicts--> 2 --supersedes--> 1 is a cycle with exactly ONE
    // contradicts, so it WOULD be flagged as a tension the moment `supersedes`
    // joined the allowlist — and it must not be. "2 replaces 1" is not a
    // contradiction closing a loop.
    const edges = [
      { source_id: 1, target_id: 2, purpose: 'contradicts' },
      { source_id: 2, target_id: 1, purpose: 'supersedes' },
    ];
    expect(findSignedInconsistencies(edges, {}).inconsistencies).toEqual([]);
    // ...and the same shape WITH a contradicts edge closing it still is.
    const real = [
      { source_id: 1, target_id: 2, purpose: 'contradicts' },
      { source_id: 2, target_id: 1, purpose: 'supports' },
    ];
    expect(findSignedInconsistencies(real, {}).inconsistencies.length).toBeGreaterThan(0);
  });

  it('a supersedes edge never enters the signed-cycle scan', async () => {
    // Both consumers filter by an explicit purpose allowlist
    // (signedCycles.js SIGNED_PURPOSES, inconsistency.js's WHERE clause), so
    // this is achieved by doing NOTHING — which is exactly why it needs a test.
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await insEdge(a, b, 'supports');
    await insEdge(b, a, 'supersedes');
    const res = await scan();
    expect(res.status).toBe(200);
    expect(res.body.inconsistencies).toEqual([]);
  });

  it('DECLARING A SUPERSESSION WITHDRAWS THE CONTRADICTION', async () => {
    // Correct, and surprising, so it is pinned and documented rather than
    // discovered: one edge per ordered pair (edges_source_id_target_id_key), so
    // an analyst who decides a conflict was really a replacement must RETYPE —
    // and the tension the scan was reporting disappears. "A isn't wrong, A is
    // past" is exactly not a tension.
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await insEdge(a, b, 'supports');
    const contra = await insEdge(b, a, 'contradicts');
    const before = await scan();
    expect(before.body.inconsistencies.length).toBeGreaterThan(0);

    const res = await request(app).patch(`${edgesUrl()}/${contra}`).send({ purpose: 'supersedes' });
    expect(res.status).toBe(200);
    const after = await scan();
    expect(after.body.inconsistencies).toEqual([]);
  });
});

describe('E18.4 — the fold still equals the live tables', () => {
  it('diffFoldVsLive is ok:true after a full supersession scenario', async () => {
    // THE FSCK, and the reason /frontier, /ready and /decisions/at-risk may
    // legitimately run the HEAD form (the live `edges` table) while the
    // worldline runs the FOLD form: at head they are the same thing. A rung
    // that added an event kind the fold mishandles would break this — which is
    // exactly what the ungated node.superseded did, by materialising a ghost
    // node whenever its subject was absent.
    const { diffFoldVsLive } = await import('../src/events/snapshot.js');
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const c = await insNode({ title: 'C' });
    const e1 = await insEdge(b, a, 'supersedes', '2026-03-01T00:00:00.000Z');
    await insEdge(c, a, 'contradicts');
    await request(app).patch(`${edgesUrl()}/${e1}`).send({ meta: { color: '#00ff00' } });
    const e2 = await request(app).post(edgesUrl()).send({ source_id: c, target_id: b, purpose: 'contradicts' });
    await request(app).patch(`${edgesUrl()}/${e2.body.id}`).send({ purpose: 'supersedes' });
    await request(app).delete(`${edgesUrl()}/${e1}`);

    const out = await diffFoldVsLive(dbPool, gid);
    expect(out.ok).toBe(true);
  });
});

// ─────────────────────────── worldlines ──────────────────────────────────────

describe('E18.4 worldline — intervals derived from the log', () => {
  it('a two-generation chain abuts exactly: valid_to(gen0) === valid_from(gen1)', async () => {
    const a = await insNode({ title: 'A (old fact)' });
    const b = await insNode({ title: 'B (successor)' });
    const when = '2026-03-01T00:00:00.000Z';
    await insEdge(b, a, 'supersedes', when);

    const res = await request(app).get(worldlineUrl(a));
    expect(res.status).toBe(200);
    expect(res.body.generations.map((g) => g.id)).toEqual([a, b]);
    const [gen0, gen1] = res.body.generations;
    expect(gen0.valid_to).toBe(when);
    expect(gen0.open).toBe(false);
    expect(gen0.closed_by).toMatchObject({ successor: b, via: 'edge.added', approximate: false });
    // Half-open [from, to): no gap, no overlap.
    expect(gen1.valid_from).toBe(when);
    expect(gen1.valid_to).toBeNull();
    expect(gen1.open).toBe(true);
    // The successor's own created_at is when we WROTE IT DOWN, and it is
    // reported beside valid_from rather than collapsed into it.
    expect(gen1.created_at).not.toBe(null);
    // All 4103 corpus nodes predate the log; these were created under capture,
    // so gen 0's left edge is exact.
    expect(gen0.approximate_from).toBe(false);
    expect(res.body.truncated).toBe(false);
  });

  it('the SAME worldline is reachable from the successor — generations start at the chain HEAD', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await insEdge(b, a, 'supersedes', '2026-03-01T00:00:00.000Z');
    const fromHead = await request(app).get(worldlineUrl(a));
    const fromTail = await request(app).get(worldlineUrl(b));
    expect(fromTail.body.generations).toEqual(fromHead.body.generations);
  });

  it('an edge.patched between two supersessions does NOT split an interval', async () => {
    // The exemption is load-bearing: a colour change on a supersedes edge must
    // not manufacture an interval boundary.
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const when = '2026-03-01T00:00:00.000Z';
    const edge = await insEdge(b, a, 'supersedes', when);
    await request(app).patch(`${edgesUrl()}/${edge}`).send({ meta: { color: '#00ff00' } });

    const res = await request(app).get(worldlineUrl(a));
    expect(res.body.generations).toHaveLength(2);
    expect(res.body.generations[0].valid_to).toBe(when);
  });

  it('MIN, not max: the EARLIEST successor is the one that ended the story', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const c = await insNode({ title: 'C' });
    const early = '2026-03-01T00:00:00.000Z';
    const late = '2026-06-01T00:00:00.000Z';
    await insEdge(c, a, 'supersedes', late);
    await insEdge(b, a, 'supersedes', early);

    const res = await request(app).get(worldlineUrl(a));
    expect(res.body.generations[0].valid_to).toBe(early);
    expect(res.body.generations[0].closed_by.successor).toBe(b);
    // Both successors are generation 1, ordered by (valid_from, event_seq, id)
    // — they SHARE a valid_from by construction, so event_seq is what separates
    // them, and it is the same tie-break orderEvents('happened') uses.
    expect(res.body.generations.slice(1).map((g) => g.generation)).toEqual([1, 1]);
    expect(res.body.branches).toEqual([{ generation: 0, id: a, successors: [b, c].sort((x, y) => x - y) }]);
  });

  it('a MERGE keeps BOTH predecessor lines — two roots, nothing dropped', async () => {
    // The realistic multi-root shape: two old facts, one replacement. The
    // backward walk finds two roots and seeding the forward walk with only one
    // of them (the lowest id) drops the other generation ENTIRELY — and drops
    // it silently: `truncated` stays false and `branches` is empty, because
    // neither reports a lost root. A worldline is not always a line, so the
    // shape says so: `roots` names every chain head and `merges` — the dual of
    // `branches` — names the node where the lines join.
    const a = await insNode({ title: 'A (old fact)' });
    const b = await insNode({ title: 'B (other old fact)' });
    const c = await insNode({ title: 'C (replaces both)' });
    await insEdge(c, a, 'supersedes', '2026-03-01T00:00:00.000Z');
    await insEdge(c, b, 'supersedes', '2026-04-01T00:00:00.000Z');

    const res = await request(app).get(worldlineUrl(c));
    expect(res.status).toBe(200);
    const asc = (x, y) => x - y;
    const gen0 = res.body.generations.filter((g) => g.generation === 0).map((g) => g.id);
    expect(gen0.slice().sort(asc)).toEqual([a, b].sort(asc));
    expect(res.body.roots).toEqual([a, b].sort(asc));
    expect(res.body.merges).toEqual([{ generation: 1, id: c, predecessors: [a, b].sort(asc) }]);
    expect(res.body.generations.map((g) => g.id).sort(asc)).toEqual([a, b, c].sort(asc));
    expect(res.body.truncated).toBe(false);
    // Both old facts are closed, and the merge node's left edge is the EARLIER
    // of the two closings — the same MIN rule that closes an interval.
    for (const g of res.body.generations.filter((x) => x.generation === 0)) expect(g.open).toBe(false);
    const merged = res.body.generations.find((g) => g.id === c);
    expect(merged.valid_from).toBe('2026-03-01T00:00:00.000Z');
  });

  it('?asOfSeq= AT the edge.added seq reports gen 0 OPEN, not closed-just-now', async () => {
    // `node.superseded` is a SECOND event in the same transaction, one seq
    // after `edge.added`. A prefix that lands between them holds the edge but
    // not the assertion that dated it, and "had we been told by then?" is a
    // learned-axis question whose answer is no. Dating it from
    // `edges.created_at` instead fabricated a valid_to — the wall clock of the
    // request, a value the pinned prefix cannot see at all — and flagged the
    // supersession approximate to cover for it.
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await insEdge(b, a, 'supersedes', '2026-03-01T00:00:00.000Z');
    const { rows } = await pool.query(
      "SELECT seq FROM events WHERE graph_id = $1 AND kind = 'edge.added' ORDER BY seq DESC LIMIT 1", [gid],
    );
    const addedSeq = Number(rows[0].seq);

    const at = await request(app).get(`${worldlineUrl(a)}?asOfSeq=${addedSeq}`);
    expect(at.status).toBe(200);
    expect(at.body.generations).toHaveLength(1);
    expect(at.body.generations[0]).toMatchObject({ id: a, open: true, valid_to: null, closed_by: null });

    // One seq later the annotation IS inside the prefix, and the fact closes on
    // its real world-time date — the ordinary path, unchanged.
    const after = await request(app).get(`${worldlineUrl(a)}?asOfSeq=${addedSeq + 1}`);
    expect(after.body.generations[0]).toMatchObject({
      open: false, valid_to: '2026-03-01T00:00:00.000Z',
    });
    expect(after.body.generations[0].closed_by).toMatchObject({ approximate: false, via: 'edge.added' });
  });

  it('a BACKDATED supersession is flagged, not clamped: the axes may disagree', async () => {
    // A correction can be backdated to before the fact it ends was itself
    // recorded as starting, and E18.1 forbids the fold from reconciling the two
    // axes — so both timestamps are reported exactly as recorded. What the
    // OUTPUT may not do is hand back `[later, earlier)` as an ordinary
    // half-open interval: `interval_inverted` is what stops it claiming a
    // negative duration, and it marks the one place `valid_from` stops
    // ascending from one generation to the next.
    const a = await insNodeAt({ title: 'A' }, '2026-06-01T00:00:00.000Z');
    const b = await insNodeAt({ title: 'B' }, '2026-07-01T00:00:00.000Z');
    await insEdge(b, a, 'supersedes', '2026-03-01T00:00:00.000Z');

    const res = await request(app).get(worldlineUrl(a));
    expect(res.status).toBe(200);
    const [gen0, gen1] = res.body.generations;
    expect(gen0).toMatchObject({
      id: a,
      valid_from: '2026-06-01T00:00:00.000Z',   // unclamped
      valid_to: '2026-03-01T00:00:00.000Z',     // unclamped, and EARLIER
      interval_inverted: true,
    });
    expect(gen1).toMatchObject({ id: b, valid_from: '2026-03-01T00:00:00.000Z', interval_inverted: false });
    // A forward-dated supersession on the same shape is NOT flagged.
    const c = await insNodeAt({ title: 'C' }, '2026-06-01T00:00:00.000Z');
    const d = await insNodeAt({ title: 'D' }, '2026-07-01T00:00:00.000Z');
    await insEdge(d, c, 'supersedes', '2026-08-01T00:00:00.000Z');
    const ok = await request(app).get(worldlineUrl(c));
    expect(ok.body.generations[0]).toMatchObject({ valid_to: '2026-08-01T00:00:00.000Z', interval_inverted: false });
  });

  it('a supersedes cycle terminates, with every node appearing exactly once', async () => {
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await insEdge(b, a, 'supersedes', '2026-03-01T00:00:00.000Z');
    await insEdge(a, b, 'supersedes', '2026-04-01T00:00:00.000Z');

    const res = await request(app).get(worldlineUrl(a));
    expect(res.status).toBe(200);
    const ids = res.body.generations.map((g) => g.id);
    expect(ids.slice().sort()).toEqual([a, b].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(res.body.truncated).toBe(false);
  });

  it('an edge with NO node.superseded event falls back to edges.created_at, flagged approximate', async () => {
    // Simulates a supersedes edge written before E18.4 (or with gt.capture off).
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('gt.capture','off',true)");
      await client.query(
        "INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1,$2,$3,'related','supersedes')",
        [gid, b, a],
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM events WHERE graph_id = $1 AND kind = 'node.superseded'", [gid],
    );
    expect(rows[0].n).toBe(0);

    const res = await request(app).get(worldlineUrl(a));
    expect(res.body.generations[0].closed_by).toMatchObject({ approximate: true, event_seq: null, via: null });
    expect(res.body.generations[0].valid_to).not.toBeNull();
  });

  it('404s on the happened axis for an asOf BEFORE the node was born', async () => {
    // Not a bug and not a special case: on the happened axis the genesis
    // substrate is filtered by birth time and a node.created with a later
    // happened_at is outside the rectangle, so the node does not exist yet in
    // that reconstruction. The worldline answers for the rectangle it was
    // asked about, and says so with a 404 rather than inventing a generation.
    const a = await insNodeAt({ title: 'A' }, '2026-05-01T00:00:00.000Z');
    const early = await request(app).get(`${worldlineUrl(a)}?axis=happened&asOf=2026-01-01T00:00:00.000Z`);
    expect(early.status).toBe(404);
    const later = await request(app).get(`${worldlineUrl(a)}?axis=happened&asOf=2026-06-01T00:00:00.000Z`);
    expect(later.status).toBe(200);
    expect(later.body.generations[0]).toMatchObject({ id: a, open: true });
  });

  it('caches a pinned ?asOfSeq= and never caches a wall clock', async () => {
    const a = await insNode({ title: 'A' });
    const live = await request(app).get(worldlineUrl(a));
    expect(live.headers['cache-control']).toBe('no-store');
    const pinned = await request(app).get(`${worldlineUrl(a)}?asOfSeq=1`);
    expect(pinned.headers['cache-control']).toBe('private, max-age=600');
  });

  it('GET /events?kind=node.superseded filters the new kind with no route edit', async () => {
    // The log route validates `kind` against EVENT_KINDS, so a vocabulary
    // addition reaches it for free — and a vocabulary addition that DIDN'T
    // update EVENT_KINDS would 400 here.
    const a = await insNode({ title: 'A' });
    const b = await insNode({ title: 'B' });
    await insEdge(b, a, 'supersedes');
    // `format=json` (or `since=`) picks the log reader; the bare path is the
    // SSE stream this route shares.
    const res = await request(app).get(`/api/graphs/${gid}/events?format=json&kind=node.superseded`);
    expect(res.status).toBe(200);
    expect(res.body.events.map((e) => e.kind)).toEqual(['node.superseded']);
    expect(Number(res.body.events[0].subject_id)).toBe(a);
  });

  it('404s for a node that is not in the graph, and shares the asOf parser errors', async () => {
    const a = await insNode({ title: 'A' });
    expect((await request(app).get(worldlineUrl(999999))).status).toBe(404);
    const noAsOf = await request(app).get(`${worldlineUrl(a)}?axis=happened`);
    expect(noAsOf.status).toBe(400);
    expect(noAsOf.body.error).toBe('axis=happened requires asOf');
    const badKnown = await request(app).get(`${worldlineUrl(a)}?known=2026-01-01T00:00:00Z`);
    expect(badKnown.status).toBe(400);
    expect(badKnown.body.error).toBe('known requires axis=happened');
  });
});

describe('E18.4 worldline — the pure walk', () => {
  const rec = (edge_id, successor, superseded, opened_at, event_seq) =>
    ({ edge_id, successor, superseded, opened_at, event_seq, via: 'edge.added', approximate: false });

  it('is capped and reports truncation rather than walking forever', () => {
    // MAX_GENERATIONS exists because a supersedes chain is NOT a strict DAG.
    const records = [];
    for (let i = 1; i <= MAX_GENERATIONS + 5; i += 1) {
      records.push(rec(i, i + 1, i, `2026-01-${String((i % 27) + 1).padStart(2, '0')}T00:00:00.000Z`, i));
    }
    const out = buildWorldline(1, records);
    expect(out.truncated).toBe(true);
    expect(out.generations.length).toBeLessThanOrEqual(MAX_GENERATIONS);
  });

  it('truncation never removes the SUBJECT — a long chain queried from its tail', () => {
    // The forward walk is capped from the chain HEAD, and the queried node sits
    // at the END of a long chain: counting the cap from the root puts the cut
    // in FRONT of the subject and the answer omits the very node the caller
    // named. The window is centred on the subject instead — at most half the
    // generation budget of ancestry is seeded, leaving the rest for what came
    // after — so a cut can shorten a worldline at either end but never remove
    // what it is a worldline OF.
    const records = [];
    for (let i = 1; i <= MAX_GENERATIONS + 5; i += 1) {
      records.push(rec(i, i + 1, i, `2026-01-${String((i % 27) + 1).padStart(2, '0')}T00:00:00.000Z`, i));
    }
    const tail = MAX_GENERATIONS + 6;
    const out = buildWorldline(tail, records);
    expect(out.truncated).toBe(true);
    expect(out.generations.length).toBeLessThanOrEqual(MAX_GENERATIONS);
    expect(out.generations.map((g) => g.id)).toContain(tail);
    // and it is the LAST generation: what was cut is the ancestry in front of it.
    expect(out.generations[out.generations.length - 1].id).toBe(tail);
  });

  it('reports approximate_from when the rectangle holds no creation event', () => {
    const out = buildWorldline(1, [rec(1, 2, 1, '2026-03-01T00:00:00.000Z', 5)], new Map([
      [1, { title: 'A', created_at: '2026-01-01T00:00:00.000Z', created_event_at: undefined }],
      [2, { title: 'B', created_at: '2026-02-01T00:00:00.000Z', created_event_at: '2026-02-01T00:00:00.000Z' }],
    ]));
    expect(out.generations[0]).toMatchObject({
      valid_from: '2026-01-01T00:00:00.000Z',
      approximate_from: true,
    });
    // gen 1's left edge is gen 0's right edge — NOT its own created_at.
    expect(out.generations[1]).toMatchObject({
      valid_from: '2026-03-01T00:00:00.000Z',
      created_at: '2026-02-01T00:00:00.000Z',
      approximate_from: false,
    });
  });
});

// ─────────────────────────── the chain test ──────────────────────────────────

describe('E18.4 CHAIN — supersession end to end, on both clocks', () => {
  it('event -> exclusion -> worldline -> time travel -> retraction', async () => {
    const H = '2026-03-01T00:00:00.000Z';

    // 1. A load-bearing claim A, a dependent C, a decision D grounded on A.
    const born = '2026-01-05T00:00:00.000Z';
    const a = await insNodeAt({ title: 'A (old fact)', confidence: 0.9, verified_at: '2026-02-01T00:00:00.000Z' }, born);
    const c = await insNodeAt({ title: 'C rests on A', status: 'todo' }, born);
    const d = await insNodeAt({ title: 'D (decision)', type: 'decision', decided_at: '2026-02-15T00:00:00.000Z' }, born);
    const b = await insNodeAt({ title: 'B (successor)', confidence: 0.9, verified_at: '2026-02-20T00:00:00.000Z' }, born);
    await insEdge(a, c, 'supports', born);
    await insEdge(a, d, 'required for', born);

    // 2. Before: A is on the frontier and D is not yet superseded-ground.
    resetDerivedCache();
    const beforeFrontier = await request(app).post(frontierUrl()).send({ minImportance: 1, staleDays: 1 });
    expect(beforeFrontier.body.frontier.map((f) => f.id)).toContain(a);
    const beforeGraph = await request(app).get(`/api/graphs/${gid}/graph`);
    const seqBefore = (await pool.query('SELECT MAX(seq) AS s FROM events WHERE graph_id = $1', [gid])).rows[0].s;
    expect(supersededIds(beforeGraph.body.links).size).toBe(0);

    // 3. B supersedes A, backdated to H.
    await markLog();
    const created = await request(app).post(edgesUrl())
      .send({ source_id: b, target_id: a, purpose: 'supersedes', happened_at: H, reason: 'B replaces A' });
    expect(created.status).toBe(201);

    // 4. THE EVENT — and the seed E18.3 inherits.
    const log = await events();
    expect(log.map((e) => e.kind)).toEqual(['edge.added', 'node.superseded']);
    const seed = weakening(log[1]);
    expect(seed).toMatchObject({ kind: 'supersession', subject_id: a, superseded_by: b, cause_id: log[0].seq });
    expect(new Date(seed.happened_at).toISOString()).toBe(H);

    // 5. THE EXCLUSION.
    resetDerivedCache();
    const frontier = await request(app).post(frontierUrl()).send({ minImportance: 1, staleDays: 1 });
    expect(frontier.body.model.mode).toBe('decay');
    expect(frontier.body.frontier.map((f) => f.id)).not.toContain(a);
    const atRisk = await request(app).post(`/api/graphs/${gid}/decisions/at-risk`).send({});
    const dRow = atRisk.body.atRisk.find((x) => Number(x.id) === d);
    expect(dRow.reasons.find((r) => Number(r.id) === a).kinds).toContain('supersededGround');
    // C is NOT auto-anything: the seed exists, the propagation is E18.3's.
    const ready = await request(app).get(`/api/graphs/${gid}/tasks/ready`);
    expect(ready.body.map((t) => Number(t.id))).toContain(c);

    // 6. THE WORLDLINE.
    const wl = await request(app).get(worldlineUrl(a));
    expect(wl.body.generations.map((g) => g.id)).toEqual([a, b]);
    // gen 0's left edge is A's own backdated birth — world time, not the
    // instant we wrote the row.
    expect(wl.body.generations[0].valid_from).toBe(born);
    expect(wl.body.generations[0].approximate_from).toBe(false);
    expect(wl.body.generations[0].valid_to).toBe(H);
    expect(wl.body.generations[1].valid_from).toBe(H);
    expect(wl.body.generations[1].open).toBe(true);

    // 7. TIME TRAVEL, both axes. `valid_to` is a HAPPENED-axis value; whether it
    //    EXISTS at all is a LEARNED-axis question, and they do not collapse.
    const past = await request(app).get(`/api/graphs/${gid}/graph?asOfSeq=${seqBefore}`);
    expect(past.body.links.some((l) => l.purpose === 'supersedes')).toBe(false);
    const wlPast = await request(app).get(`${worldlineUrl(a)}?asOfSeq=${seqBefore}`);
    expect(wlPast.body.generations).toHaveLength(1);
    expect(wlPast.body.generations[0].open).toBe(true);          // A is still open back then
    // Happened axis, before H: the supersession had not happened in the world
    // yet, even though it is in the log and we have long since been told.
    const wlBeforeH = await request(app).get(`${worldlineUrl(a)}?axis=happened&asOf=2026-02-01T00:00:00.000Z`);
    expect(wlBeforeH.body.generations).toHaveLength(1);
    expect(wlBeforeH.body.generations[0].open).toBe(true);
    // Happened axis, after H, is superseded even though we LEARNED it later.
    const wlAfterH = await request(app).get(`${worldlineUrl(a)}?axis=happened&asOf=2026-04-01T00:00:00.000Z`);
    expect(wlAfterH.body.generations[0].valid_to).toBe(H);

    // 8. RETRACTION. Withdrawing the edge un-supersedes A — and the
    //    node.superseded event is STILL IN THE LOG, unchanged and undeleted.
    const del = await request(app).delete(`${edgesUrl()}/${created.body.id}`);
    expect(del.status).toBe(200);
    resetDerivedCache();
    const afterWithdrawal = await request(app).post(frontierUrl()).send({ minImportance: 1, staleDays: 1 });
    expect(afterWithdrawal.body.frontier.map((f) => f.id)).toContain(a);
    const { rows: still } = await pool.query(
      "SELECT count(*)::int AS n FROM events WHERE graph_id = $1 AND kind = 'node.superseded'", [gid],
    );
    expect(still[0].n).toBe(1);
    const wlAfter = await request(app).get(worldlineUrl(a));
    expect(wlAfter.body.generations).toHaveLength(1);
    expect(wlAfter.body.generations[0].open).toBe(true);
  });
});

// REGRESSION — a partial PATCH must never silently retype an edge.
//
// PATCH /edges/:id accepts a `base_row`: the client's view of the row, used as
// the merge base and as the source of truth for fields this PATCH does not
// mention. The canvas builds it with edgeBaseRow() in public/app.js, which
// emits {source_id, target_id, type, meta, version} and NO `purpose` key at
// all. `basePurpose` fell back to DEFAULT_PURPOSE ('related to') whenever the
// base_row lacked that key — so recolouring or reshaping an edge on the canvas
// silently retyped it.
//
// This PREDATES the event log (the line and the canvas helper are both in the
// baseline commit) and it is not specific to `supersedes`: it rewrites any
// `supports`, `required for` or `contradicts` edge the same way, which is
// 4283 of the 7664 edges in the production graph. For a `supersedes` edge it
// also UN-SUPERSEDES the fact, so it returns to the re-check queues and its
// worldline loses a generation.
//
// The fallback is now the EXISTING row's purpose: a client that does not
// mention purpose is saying "I did not look at it", never "set it to the
// default".
describe('regression — a partial PATCH cannot retype an edge it never mentioned', () => {
  // Exactly what public/app.js edgeBaseRow() sends: no `purpose` key.
  const canvasBaseRow = (row) => ({
    source_id: row.source_id ?? row.source,
    target_id: row.target_id ?? row.target,
    type: row.type, meta: row.meta || {}, version: row.version,
  });

  async function edgeWith(purpose) {
    const from = await insNode({ title: `from ${purpose}`, confidence: 0.9 });
    const to = await insNode({ title: `to ${purpose}`, confidence: 0.9 });
    const res = await request(app).post(edgesUrl()).send({ source_id: from, target_id: to, purpose });
    expect(res.status).toBe(201);
    return { from, to, row: res.body };
  }

  const purposeOf = async (edgeId) =>
    (await pool.query('SELECT purpose FROM edges WHERE id = $1', [edgeId])).rows[0].purpose;

  for (const purpose of ['supersedes', 'supports', 'required for', 'contradicts']) {
    it(`a canvas colour edit keeps purpose '${purpose}'`, async () => {
      const { row } = await edgeWith(purpose);
      const res = await request(app).patch(`${edgesUrl()}/${row.id}`).send({
        base_version: row.version,
        base_row: canvasBaseRow(row),
        meta: { color: '#3366ff' },
      });
      expect(res.status).toBe(200);
      expect(await purposeOf(row.id)).toBe(purpose);
    });
  }

  it('a canvas curve edit keeps purpose supersedes', async () => {
    const { row } = await edgeWith('supersedes');
    const res = await request(app).patch(`${edgesUrl()}/${row.id}`).send({
      base_version: row.version,
      base_row: canvasBaseRow(row),
      meta: { curve: { distance: 30, weight: 0.5 } },
    });
    expect(res.status).toBe(200);
    expect(await purposeOf(row.id)).toBe('supersedes');
  });

  it('the superseded fact STAYS superseded after a canvas colour edit', async () => {
    const oldFact = await insNode({ title: 'Old terms', confidence: 0.9 });
    const newFact = await insNode({ title: 'New terms', confidence: 0.9 });
    const created = await request(app).post(edgesUrl())
      .send({ source_id: newFact, target_id: oldFact, purpose: 'supersedes' });
    expect(created.status).toBe(201);

    const before = await request(app).get(worldlineUrl(oldFact));
    expect(before.body.generations.length).toBe(2);

    const patched = await request(app).patch(`${edgesUrl()}/${created.body.id}`).send({
      base_version: created.body.version,
      base_row: canvasBaseRow(created.body),
      meta: { color: '#3366ff' },
    });
    expect(patched.status).toBe(200);

    const after = await request(app).get(worldlineUrl(oldFact));
    expect(after.body.generations.length).toBe(2);
  });

  it('an explicit purpose in the PATCH still retypes, as it always did', async () => {
    const { row } = await edgeWith('supersedes');
    const res = await request(app).patch(`${edgesUrl()}/${row.id}`).send({ purpose: 'related to' });
    expect(res.status).toBe(200);
    expect(await purposeOf(row.id)).toBe('related to');
  });

  it('a base_row that DOES name a purpose is still honoured as the merge base', async () => {
    const { row } = await edgeWith('supersedes');
    const res = await request(app).patch(`${edgesUrl()}/${row.id}`).send({
      purpose: 'contradicts',
      base_row: { ...canvasBaseRow(row), purpose: 'supersedes' },
      base_version: row.version,
    });
    expect(res.status).toBe(200);
    expect(await purposeOf(row.id)).toBe('contradicts');
  });
});
