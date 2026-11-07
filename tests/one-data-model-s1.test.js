// One data model, step S1 (Multitap er289bkv2zkcs5w6 #11334; Kevin, 2026-11-06).
//
// Two things the record gains so the coordination engine's records can live in
// it as nodes without touching how a graph without them behaves:
//
//   1. R1 — the shared node filter on the read routes: `types`, `exclude_types`
//      and `coord=include|exclude|only`. The marker for a coordination node is
//      the `meta.coord` DOCUMENT, not the type, because `finding` and `decision`
//      are ordinary types in daily use. Default `include`: with no knob every
//      route answers exactly as before. The filter touches RESULT ROWS ONLY on
//      /ready — a filtered prerequisite still blocks.
//   2. D5 — the `coord.*` event family: admitted by prefix in events_kind_valid,
//      written through gt_log_coord(), an annotation to the fold (never an
//      anomaly, never a state change), visible in the events log.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { parseNodeFilter, nodePassesFilter, filterGraphPayload } from '../src/nodeFilter.js';
import { isCoordKind } from '../src/events/kinds.js';
import { parseMarkdown } from '../src/markdown.js';
import { emptyState, foldEvents, toGraphPayload } from '../src/events/fold.js';

let app;
let pool;
let gid;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('one-data-model-s1') RETURNING id");
  gid = g.rows[0].id;
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

async function mkNode(title, extra = {}, body = '') {
  const res = await request(app).post(`/api/graphs/${gid}/tasks`)
    .send({ content: node({ title, status: 'todo', ...extra }, body) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

// The engine's documents arrive under meta.coord. The HTTP route keeps meta
// keys the frontmatter carries, so a frontmatter `coord:` object is the shape
// a node gets when the engine writes it (the Go store writes the row directly).
async function mkCoordNode(title, type, doc = {}) {
  return mkNode(title, { type, coord: { id: doc.id ?? 'c1', kind: type, ...doc } });
}

async function mkEdge(source, target, purpose) {
  const res = await request(app).post(`/api/graphs/${gid}/edges`)
    .send({ source_id: source, target_id: target, purpose });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

const ids = (rows) => rows.map((r) => Number(r.id)).sort((a, b) => a - b);

// A small mixed graph: two ordinary nodes (one a person's `decision`), one
// ordinary `finding`, and three coordination nodes (a proposition, the engine's own
// finding, a line) — so a type-based filter would wrongly lump the person's
// decision with the engine's, and the document marker tells them apart.
async function seed() {
  const task = await mkNode('Write the plan', { type: 'task' });
  const decision = await mkNode('Choose the stack', { type: 'decision' });
  const finding = await mkNode('Latency is fine', { type: 'finding' });
  const proposition = await mkCoordNode('Port the parser', 'proposition', { id: 'c1', status: 'claimed' });
  const efinding = await mkCoordNode('Check fails on main', 'finding', { id: 'f1' });
  const line = await mkCoordNode('main', 'line', { id: 'main' });
  await mkEdge(task, decision, 'required for');
  await mkEdge(proposition, task, 'related to');
  await mkEdge(efinding, proposition, 'contradicts');
  return { task, decision, finding, proposition, efinding, line };
}

describe('nodeFilter — the pure part', () => {
  it('parses nothing into an empty filter that keeps every node', () => {
    const f = parseNodeFilter({}).value;
    expect(f.isEmpty).toBe(true);
    expect(nodePassesFilter({ meta: { type: 'proposition', coord: {} } }, f)).toBe(true);
    expect(nodePassesFilter({ meta: {} }, f)).toBe(true);
  });

  it('accepts comma lists, arrays and repeated keys; rejects bad coord values', () => {
    expect(parseNodeFilter({ types: 'a, b,,a' }).value.types).toEqual(['a', 'b']);
    expect(parseNodeFilter({ types: ['a,b', 'c'] }).value.types).toEqual(['a', 'b', 'c']);
    expect(parseNodeFilter({ exclude_types: ['x'] }).value.excludeTypes).toEqual(['x']);
    expect(parseNodeFilter({ coord: 'only' }).value.coord).toBe('only');
    expect(parseNodeFilter({ coord: '' }).value.coord).toBe('include');
    expect(parseNodeFilter({ coord: 'yes' }).error).toMatch(/coord must be one of/);
    expect(parseNodeFilter({ types: 42 }).error).toMatch(/types/);
    expect(parseNodeFilter({ types: 'x'.repeat(65) }).error).toMatch(/longer than/);
  });

  it('exclude_types never drops a node with no type; types requires one', () => {
    const excl = parseNodeFilter({ exclude_types: 'task' }).value;
    expect(nodePassesFilter({ meta: {} }, excl)).toBe(true);
    expect(nodePassesFilter({ meta: { type: 'task' } }, excl)).toBe(false);
    const only = parseNodeFilter({ types: 'task' }).value;
    expect(nodePassesFilter({ meta: {} }, only)).toBe(false);
  });

  it('coord goes by the document, not the type', () => {
    const excl = parseNodeFilter({ coord: 'exclude' }).value;
    expect(nodePassesFilter({ meta: { type: 'decision' } }, excl)).toBe(true);
    expect(nodePassesFilter({ meta: { type: 'decision', coord: { id: 'd1' } } }, excl)).toBe(false);
    const only = parseNodeFilter({ coord: 'only' }).value;
    expect(nodePassesFilter({ meta: { type: 'decision' } }, only)).toBe(false);
    expect(nodePassesFilter({ meta: { type: 'decision', coord: { id: 'd1' } } }, only)).toBe(true);
  });

  it('filterGraphPayload keeps a link only when both ends survive', () => {
    const payload = {
      nodes: [{ id: 1, meta: { type: 'task' } }, { id: 2, meta: { type: 'proposition', coord: {} } }, { id: 3, meta: {} }],
      links: [{ source: 1, target: 2 }, { source: 1, target: 3 }],
      as_of: { seq: 9 },
    };
    const out = filterGraphPayload(payload, parseNodeFilter({ coord: 'exclude' }).value);
    expect(out.nodes.map((n) => n.id)).toEqual([1, 3]);
    expect(out.links).toEqual([{ source: 1, target: 3 }]);
    expect(out.as_of).toEqual({ seq: 9 });
  });
});

describe('R1 — the read routes', () => {
  it('GET /tasks: no knob is the old answer; types, exclude_types and coord narrow it', async () => {
    const s = await seed();
    const all = await request(app).get(`/api/graphs/${gid}/tasks`);
    expect(all.status).toBe(200);
    expect(ids(all.body)).toEqual(ids(Object.values(s).map((id) => ({ id }))));

    const onlyTasks = await request(app).get(`/api/graphs/${gid}/tasks?types=task`);
    expect(ids(onlyTasks.body)).toEqual([s.task]);

    const twoTypes = await request(app).get(`/api/graphs/${gid}/tasks?types=task,line`);
    expect(ids(twoTypes.body)).toEqual(ids([{ id: s.task }, { id: s.line }]));

    const noTasks = await request(app).get(`/api/graphs/${gid}/tasks?exclude_types=task`);
    expect(ids(noTasks.body)).toEqual(ids([s.decision, s.finding, s.proposition, s.efinding, s.line].map((id) => ({ id }))));

    const noCoord = await request(app).get(`/api/graphs/${gid}/tasks?coord=exclude`);
    expect(ids(noCoord.body)).toEqual(ids([s.task, s.decision, s.finding].map((id) => ({ id }))));

    const onlyCoord = await request(app).get(`/api/graphs/${gid}/tasks?coord=only`);
    expect(ids(onlyCoord.body)).toEqual(ids([s.proposition, s.efinding, s.line].map((id) => ({ id }))));

    // The two findings share a type; only the document tells them apart.
    const findings = await request(app).get(`/api/graphs/${gid}/tasks?types=finding&coord=exclude`);
    expect(ids(findings.body)).toEqual([s.finding]);

    const bad = await request(app).get(`/api/graphs/${gid}/tasks?coord=maybe`);
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/coord must be one of include, exclude, only/);
  });

  it('GET /tasks/leaves honours the filter', async () => {
    const s = await seed();
    const res = await request(app).get(`/api/graphs/${gid}/tasks/leaves?fields=id&coord=exclude`);
    expect(res.status).toBe(200);
    // task → decision is the only dependency edge: the decision is not a leaf.
    expect(ids(res.body)).toEqual(ids([s.task, s.finding].map((id) => ({ id }))));
    expect(res.body[0]).toEqual({ id: res.body[0].id });
  });

  it('GET /graph: nodes filtered, links kept only between survivors; no knob unchanged', async () => {
    const s = await seed();
    const all = await request(app).get(`/api/graphs/${gid}/graph`);
    expect(all.status).toBe(200);
    expect(all.body.nodes).toHaveLength(6);
    expect(all.body.links).toHaveLength(3);

    const res = await request(app).get(`/api/graphs/${gid}/graph?coord=exclude`);
    expect(res.status).toBe(200);
    expect(ids(res.body.nodes)).toEqual(ids([s.task, s.decision, s.finding].map((id) => ({ id }))));
    // proposition→task and efinding→proposition touch a hidden node and go with it.
    expect(res.body.links.map((l) => [l.source, l.target])).toEqual([[s.task, s.decision]]);

    const only = await request(app).get(`/api/graphs/${gid}/graph?coord=only`);
    expect(ids(only.body.nodes)).toEqual(ids([s.proposition, s.efinding, s.line].map((id) => ({ id }))));
    expect(only.body.links.map((l) => [l.source, l.target])).toEqual([[s.efinding, s.proposition]]);

    const bad = await request(app).get(`/api/graphs/${gid}/graph?types=${'x'.repeat(70)}`);
    expect(bad.status).toBe(400);
  });

  it('GET /graph?as_of=… applies the same filter to the folded past', async () => {
    const s = await seed();
    const head = await pool.query('SELECT MAX(seq) AS s FROM events WHERE graph_id = $1', [gid]);
    const seq = Number(head.rows[0].s);
    const past = await request(app).get(`/api/graphs/${gid}/graph?as_of=${seq}&coord=exclude`);
    expect(past.status).toBe(200);
    expect(ids(past.body.nodes)).toEqual(ids([s.task, s.decision, s.finding].map((id) => ({ id }))));
    expect(past.body.links.map((l) => [l.source, l.target])).toEqual([[s.task, s.decision]]);
    const pastAll = await request(app).get(`/api/graphs/${gid}/graph?as_of=${seq}`);
    expect(pastAll.body.nodes).toHaveLength(6);
  });

  it('GET /tasks/ready: filters result rows only — a filtered prerequisite still blocks', async () => {
    // proposition (todo, coordination) is required for task (todo). With coord=exclude the
    // proposition leaves the ANSWER but keeps BLOCKING: task must not become ready.
    const proposition = await mkCoordNode('Port the parser', 'proposition', { id: 'c1' });
    const task = await mkNode('Ship it', { type: 'task' });
    const free = await mkNode('Write docs', { type: 'task' });
    await mkEdge(proposition, task, 'required for');

    const all = await request(app).get(`/api/graphs/${gid}/tasks/ready`);
    expect(ids(all.body)).toEqual(ids([proposition, free].map((id) => ({ id }))));

    const res = await request(app).get(`/api/graphs/${gid}/tasks/ready?coord=exclude`);
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([free]);

    const byType = await request(app).get(`/api/graphs/${gid}/tasks/ready?types=proposition`);
    expect(ids(byType.body)).toEqual([proposition]);
  });

  it('POST /structure: the shape of the part that passes the filter', async () => {
    const s = await seed();
    const all = await request(app).post(`/api/graphs/${gid}/structure`).send({});
    expect(all.status).toBe(200);
    const allIds = new Set(JSON.stringify(all.body).match(/\d+/g).map(Number));
    expect(allIds.has(s.proposition)).toBe(true);

    const res = await request(app).post(`/api/graphs/${gid}/structure`).send({ coord: 'exclude' });
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    // No region, rollup or node list names a coordination node.
    for (const hidden of [s.proposition, s.efinding, s.line]) {
      expect(text.includes(`"${hidden}"`) || text.includes(`:${hidden},`) || text.includes(`[${hidden},`) || text.includes(`,${hidden}]`) || text.includes(`[${hidden}]`)).toBe(false);
    }
    expect(text.includes(String(s.task))).toBe(true);

    const bad = await request(app).post(`/api/graphs/${gid}/structure`).send({ coord: 'all' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/coord must be one of/);
  });
});

describe('D5 — the coord.* event family', () => {
  it('isCoordKind recognises the family and nothing else', () => {
    expect(isCoordKind('coord.proposition.landed')).toBe(true);
    expect(isCoordKind('coord.')).toBe(false);
    expect(isCoordKind('claim.verified')).toBe(false);
    expect(isCoordKind(null)).toBe(false);
  });

  it('gt_log_coord appends an annotation with the record seq, the engine seq and the propositions (payload key `claims`, kept while the Node app shares the database)', async () => {
    const proposition = await mkCoordNode('Port the parser', 'proposition', { id: 'c1' });
    const before = await pool.query('SELECT MAX(seq) AS s FROM events WHERE graph_id = $1', [gid]);
    const r = await pool.query(
      `SELECT gt_log_coord($1, 'proposition.landed', $2, 7, 1700000000000, '["c1"]'::jsonb, '{"sha":"abc"}'::jsonb) AS seq`,
      [gid, proposition],
    );
    const seq = Number(r.rows[0].seq);
    expect(seq).toBe(Number(before.rows[0].s) + 1);
    const row = (await pool.query('SELECT * FROM events WHERE graph_id = $1 AND seq = $2', [gid, seq])).rows[0];
    expect(row.kind).toBe('coord.proposition.landed');
    expect(row.subject_kind).toBe('node');
    expect(Number(row.subject_id)).toBe(proposition);
    expect(row.cause_id).toBeNull();
    expect(row.payload).toMatchObject({
      v: 1, op: 'ANNOTATE', kinds: ['coord.proposition.landed'], coord_seq: 7, at: 1700000000000, claims: ['c1'], data: { sha: 'abc' },
    });
    expect(typeof row.payload_hash).toBe('string'); // stamped like every event

    // A line event with no single node: subject NULL, defaults for propositions/data.
    const r2 = await pool.query(`SELECT gt_log_coord($1, 'reality.served', NULL, 8, 0, NULL, NULL) AS seq`, [gid]);
    const row2 = (await pool.query('SELECT * FROM events WHERE graph_id = $1 AND seq = $2', [gid, Number(r2.rows[0].seq)])).rows[0];
    expect(row2.subject_kind).toBeNull();
    expect(row2.subject_id).toBeNull();
    expect(row2.payload.claims).toEqual([]);
    expect(row2.payload.data).toEqual({});
  });

  it('the CHECK admits the family by prefix and still refuses an unknown kind; the function refuses a doubled prefix', async () => {
    await expect(pool.query(
      `INSERT INTO events (graph_id, seq, happened_at, learned_at, actor, kind, txid, payload)
       VALUES ($1, gt_next_seq($1), now(), now(), '{}'::jsonb, 'bogus.kind', 0, '{}'::jsonb)`,
      [gid],
    )).rejects.toThrow(/events_kind_valid/);
    await expect(pool.query(`SELECT gt_log_coord($1, 'coord.proposition.landed', NULL, 1, 0, NULL, NULL)`, [gid]))
      .rejects.toThrow(/bare event type/);
    await expect(pool.query(`SELECT gt_log_coord($1, '', NULL, 1, 0, NULL, NULL)`, [gid]))
      .rejects.toThrow(/bare event type/);
  });

  it('the fold treats a coord event as an annotation: same state, no anomaly', async () => {
    const proposition = await mkCoordNode('Port the parser', 'proposition', { id: 'c1' });
    const task = await mkNode('Ship it', { type: 'task' });
    await mkEdge(proposition, task, 'required for');
    const beforeRows = (await pool.query('SELECT * FROM events WHERE graph_id = $1 ORDER BY seq', [gid])).rows;
    await pool.query(`SELECT gt_log_coord($1, 'proposition.landed', $2, 1, 0, '["c1"]'::jsonb, '{}'::jsonb)`, [gid, proposition]);
    await pool.query(`SELECT gt_log_coord($1, 'reality.served', NULL, 2, 0, NULL, NULL)`, [gid]);
    const afterRows = (await pool.query('SELECT * FROM events WHERE graph_id = $1 ORDER BY seq', [gid])).rows;
    expect(afterRows).toHaveLength(beforeRows.length + 2);

    const a = foldEvents(emptyState(), beforeRows);
    const b = foldEvents(emptyState(), afterRows);
    expect(b.anomalies ?? []).toEqual([]);
    expect(toGraphPayload(b.state ?? b)).toEqual(toGraphPayload(a.state ?? a));
  });

  it('GET /events lists coord events and accepts ?kind=coord.… ; the kind filter still rejects junk', async () => {
    const proposition = await mkCoordNode('Port the parser', 'proposition', { id: 'c1' });
    await pool.query(`SELECT gt_log_coord($1, 'proposition.landed', $2, 1, 0, '["c1"]'::jsonb, '{}'::jsonb)`, [gid, proposition]);
    const all = await request(app).get(`/api/graphs/${gid}/events?format=json`);
    expect(all.status).toBe(200);
    const list = Array.isArray(all.body) ? all.body : all.body.events;
    expect(list.some((e) => e.kind === 'coord.proposition.landed')).toBe(true);

    const only = await request(app).get(`/api/graphs/${gid}/events?format=json&kind=coord.proposition.landed`);
    expect(only.status).toBe(200);
    const onlyList = Array.isArray(only.body) ? only.body : only.body.events;
    expect(onlyList.length).toBe(1);
    expect(onlyList[0].kind).toBe('coord.proposition.landed');

    const bad = await request(app).get(`/api/graphs/${gid}/events?format=json&kind=nonsense.kind`);
    expect(bad.status).toBe(400);
  });
});

describe('D4 — the owner rule: steer through recorded actions, not silent edits', () => {
  // The engine writes rows directly; through the HTTP routes a coordination
  // node's statement and `meta.coord` are refused for everyone, layout fields
  // are fine, and ordinary nodes are untouched by the rule.
  // The engine's document, as the store writes it: content and meta together,
  // the whole document under meta.coord.
  async function coordRow(doc = { id: 'c1', status: 'claimed' }) {
    return mkCoordNode('Port the parser', 'proposition', { statement: 'Port the parser', lease: { holder: 'agent-7' }, ...doc });
  }

  it('PATCH may move or recolour a coordination node, but not change its statement or its document', async () => {
    const id = await coordRow();
    const cur = (await pool.query('SELECT * FROM tasks WHERE id = $1', [id])).rows[0];
    const curMeta = parseMetaOf(cur.content);

    // Layout only: allowed.
    const moved = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
      .send({ content: node({ ...curMeta, x: 120, y: 40, color: '#abc' }), base_version: cur.version, base_content: cur.content });
    expect(moved.status).toBe(200);
    expect(moved.body.meta.x).toBe(120);
    expect(moved.body.meta.coord.lease).toEqual({ holder: 'agent-7' }); // untouched

    // The statement: refused, with the current row handed back.
    const retitled = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
      .send({ content: node({ ...curMeta, title: 'Port the lexer instead' }) });
    expect(retitled.status).toBe(409);
    expect(retitled.body.error).toBe('coordination_node');
    expect(retitled.body.detail).toMatch(/coordination routes/);
    expect(retitled.body.detail).toMatch(/meta.title/);
    expect(retitled.body.current.id).toBe(id);

    // The body text: refused.
    const rebodied = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
      .send({ content: node(curMeta, 'Actually do something else') });
    expect(rebodied.status).toBe(409);
    expect(rebodied.body.detail).toMatch(/\(changes body\)/);

    // The engine's document: refused, even by an agent, even with base fields.
    const fresh = (await pool.query('SELECT * FROM tasks WHERE id = $1', [id])).rows[0];
    const freshMeta = parseMetaOf(fresh.content);
    const forged = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
      .set('X-Writer-Type', 'agent')
      .send({ content: node({ ...freshMeta, coord: { ...freshMeta.coord, status: 'landed' } }), base_version: fresh.version, base_content: fresh.content });
    expect(forged.status).toBe(409);
    expect(forged.body.detail).toMatch(/\(changes coord\)/);

    // Status via the frontmatter: refused too (it is a projection of the engine's).
    const flipped = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
      .send({ content: node({ ...freshMeta, status: 'done' }) });
    expect(flipped.status).toBe(409);
    expect(flipped.body.detail).toMatch(/meta.status/);

    const after = (await pool.query('SELECT meta FROM tasks WHERE id = $1', [id])).rows[0].meta;
    expect(after.coord.status).toBe('claimed');
    expect(after.title).toBe('Port the parser');
  });

  it('an ordinary node is untouched by the rule', async () => {
    const id = await mkNode('Write the plan', { type: 'task' });
    const res = await request(app).patch(`/api/graphs/${gid}/tasks/${id}`)
      .send({ content: node({ title: 'Write the better plan', status: 'done', type: 'task' }, 'new body') });
    expect(res.status).toBe(200);
    expect(res.body.meta.title).toBe('Write the better plan');
  });

  it('DELETE refuses a coordination node and allows an ordinary one', async () => {
    const proposition = await coordRow();
    const plain = await mkNode('Write the plan', { type: 'task' });
    const r1 = await request(app).delete(`/api/graphs/${gid}/tasks/${proposition}`);
    expect(r1.status).toBe(409);
    expect(r1.body.error).toBe('coordination_node');
    const r2 = await request(app).delete(`/api/graphs/${gid}/tasks/${plain}`);
    expect(r2.status).toBe(200);
    const left = await pool.query('SELECT id FROM tasks WHERE graph_id = $1', [gid]);
    expect(ids(left.rows)).toEqual([proposition]);
  });

  it('a batch upsert by external_id cannot overwrite a proposition, but may lay it out', async () => {
    const id = await coordRow();
    await pool.query(`UPDATE tasks SET external_id = 'c1' WHERE id = $1`, [id]);
    const cur = (await pool.query('SELECT * FROM tasks WHERE id = $1', [id])).rows[0];
    const curMeta = parseMetaOf(cur.content);

    const overwrite = await request(app).post(`/api/graphs/${gid}/batch`)
      .send({ nodes: [{ external_id: 'c1', content: node({ ...curMeta, title: 'Something else entirely' }) }] });
    expect(overwrite.status).toBe(409);
    expect(overwrite.body.error).toMatch(/coordination_node/);

    const layout = await request(app).post(`/api/graphs/${gid}/batch`)
      .send({ nodes: [{ external_id: 'c1', content: node({ ...curMeta, x: 5, y: 6 }) }] });
    expect(layout.status).toBe(200);
    const after = (await pool.query('SELECT meta FROM tasks WHERE id = $1', [id])).rows[0].meta;
    expect(after.x).toBe(5);
    expect(after.title).toBe('Port the parser');
  });

  it("the engine's edges (meta.coord) cannot be re-purposed or deleted through the routes; a person's edge between propositions can", async () => {
    const a = await coordRow({ id: 'c1' });
    const b = await mkCoordNode('Port the lexer', 'proposition', { id: 'c2' });
    // An engine edge, as the store writes it.
    const ins = await pool.query(
      `INSERT INTO edges (graph_id, source_id, target_id, type, purpose, meta)
       VALUES ($1, $2, $3, 'dependency', 'required for', '{"coord": true, "order": true}'::jsonb) RETURNING id`,
      [gid, a, b],
    );
    const engineEdge = Number(ins.rows[0].id);
    const re = await request(app).patch(`/api/graphs/${gid}/edges/${engineEdge}`).send({ purpose: 'related to' });
    expect(re.status).toBe(409);
    expect(re.body.error).toBe('coordination_node');
    const del = await request(app).delete(`/api/graphs/${gid}/edges/${engineEdge}`);
    expect(del.status).toBe(409);

    // A person's edge between the same two nodes: ordinary, and the route's
    // meta allowlist means nobody can forge the marker through the API.
    const mine = await request(app).post(`/api/graphs/${gid}/edges`)
      .send({ source_id: b, target_id: a, purpose: 'supports', meta: { coord: true } });
    expect(mine.status).toBe(201);
    expect(mine.body.meta.coord).toBeUndefined();
    const delMine = await request(app).delete(`/api/graphs/${gid}/edges/${mine.body.id}`);
    expect(delMine.status).toBe(200);
  });
});

// Frontmatter of a stored row back into the object `node()` takes — the app's own parser.
function parseMetaOf(content) {
  return parseMarkdown(content).meta;
}
