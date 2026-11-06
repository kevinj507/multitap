// E15 universal-schema unit + integration tests (plan node T-unit #2627).
// Covers A1 (edge `purpose`) + A2 (node reserved typed fields) + the YAML
// parse-error-vs-missing-title fix, the legacy migration, OCC/merge protection,
// derivation round-trips, and the A1+A2 COMPOSE chain test that gates `done`.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import {
  validateMeta,
  applyDefaults,
  parseMarkdown,
  isIsoDatetime,
} from '../src/markdown.js';
// Import the derivation helpers from the PURE module (no db.js) so this static
// import doesn't create the DB pool before beforeAll sets DATABASE_URL.
import {
  resolveEdgeKind,
  purposeToType,
  EDGE_PURPOSES,
} from '../src/edgePurpose.js';

let app;
let pool;
let gid;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
});

// Three tasks with stable ids 1,2,3 (TRUNCATE … RESTART IDENTITY in setup).
beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e15') RETURNING id");
  gid = g.rows[0].id;
  const mk = (t) => [`---\ntitle: ${t}\nstatus: todo\n---\n`, JSON.stringify({ title: t, status: 'todo' })];
  const [cA, mA] = mk('A');
  const [cB, mB] = mk('B');
  const [cC, mC] = mk('C');
  await pool.query(
    `INSERT INTO tasks (graph_id, content, meta) VALUES ($1,$2,$3),($1,$4,$5),($1,$6,$7)`,
    [gid, cA, mA, cB, mB, cC, mC],
  );
});

const tasksUrl = () => `/api/graphs/${gid}/tasks`;
const edgesUrl = () => `/api/graphs/${gid}/edges`;
const batchUrl = () => `/api/graphs/${gid}/batch`;
const graphUrl = () => `/api/graphs/${gid}/graph`;
const node = (meta, body = '') => {
  const fm = Object.entries(meta).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
  return `---\n${fm}\n---\n${body}`;
};

// ───────────────────────── A1: pure derivation helpers ─────────────────────
describe('A1 derivation helpers', () => {
  it('purposeToType: only "required for" derives dependency', () => {
    expect(purposeToType('required for')).toBe('dependency');
    expect(purposeToType('supports')).toBe('related');
    expect(purposeToType('contradicts')).toBe('related');
    expect(purposeToType('related to')).toBe('related');
  });

  it('resolveEdgeKind: purpose wins, derives type', () => {
    expect(resolveEdgeKind({ purpose: 'supports' })).toEqual({ purpose: 'supports', type: 'related' });
    expect(resolveEdgeKind({ purpose: 'required for' })).toEqual({ purpose: 'required for', type: 'dependency' });
  });

  it('resolveEdgeKind: a legacy `type` is no longer accepted as input', () => {
    // type is not read at all → a body with only `type` is missing `purpose`.
    expect(resolveEdgeKind({ type: 'dependency' }).error).toMatch(/purpose is required/);
    expect(resolveEdgeKind({ type: 'related' }).error).toMatch(/purpose is required/);
  });

  it('resolveEdgeKind: a stray `type` alongside purpose is ignored', () => {
    expect(resolveEdgeKind({ purpose: 'contradicts', type: 'dependency' }))
      .toEqual({ purpose: 'contradicts', type: 'related' });
  });

  it('resolveEdgeKind: rejects a write with no purpose (required on write)', () => {
    expect(resolveEdgeKind({}).error).toMatch(/purpose is required/);
  });

  it('resolveEdgeKind: rejects an invalid purpose', () => {
    expect(resolveEdgeKind({ purpose: 'causes' }).error).toMatch(/purpose must be one of/);
  });

  // E18.4 grew this list from four to five. The vocabulary is still LOCKED —
  // adding a purpose is a deliberate, three-list edit (EDGE_PURPOSES,
  // planRegions' ALL_PURPOSES, the edges_purpose_valid CHECK) — this assertion
  // is what makes an accidental fourth copy or a silent drop fail loudly.
  // `supersedes` joined on 2026-09-12 because the corpus was already expressing
  // the relation in prose and mis-filing it as `contradicts` (33 candidate
  // edges across 7 graphs, 11 of them typed `contradicts`).
  it('EDGE_PURPOSES is the locked five-value vocabulary', () => {
    expect(EDGE_PURPOSES).toEqual([
      'required for', 'supports', 'contradicts', 'related to', 'supersedes',
    ]);
  });
});

// ───────────────────────── A1: edge write paths ────────────────────────────
describe('A1 edge purpose — create / bulk / batch / patch', () => {
  it('POST derives dependency from "required for" and emits purpose + type', async () => {
    const res = await request(app).post(edgesUrl()).send({ source_id: 1, target_id: 2, purpose: 'required for' });
    expect(res.status).toBe(201);
    expect(res.body.purpose).toBe('required for');
    expect(res.body.type).toBe('dependency');
  });

  it('POST "supports" / "contradicts" derive related but keep the distinct purpose', async () => {
    const a = await request(app).post(edgesUrl()).send({ source_id: 1, target_id: 2, purpose: 'supports' });
    expect(a.body.purpose).toBe('supports');
    expect(a.body.type).toBe('related');
    const b = await request(app).post(edgesUrl()).send({ source_id: 1, target_id: 3, purpose: 'contradicts' });
    expect(b.body.purpose).toBe('contradicts');
    expect(b.body.type).toBe('related');
  });

  it('POST is rejected when purpose is missing', async () => {
    const res = await request(app).post(edgesUrl()).send({ source_id: 1, target_id: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/purpose is required/);
  });

  it('POST: a legacy `type` (no purpose) is rejected — purpose is the only accepted edge field', async () => {
    const res = await request(app).post(edgesUrl()).send({ source_id: 1, target_id: 2, type: 'dependency' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/purpose is required/);
  });

  it('"required for" is cycle-checked; other purposes are not', async () => {
    await request(app).post(edgesUrl()).send({ source_id: 1, target_id: 2, purpose: 'required for' });
    const cycle = await request(app).post(edgesUrl()).send({ source_id: 2, target_id: 1, purpose: 'required for' });
    expect(cycle.status).toBe(400);
    expect(cycle.body.error).toMatch(/cycle/);
    // A "contradicts" edge (derived: related) may freely point 2→1.
    const ok = await request(app).post(edgesUrl()).send({ source_id: 2, target_id: 1, purpose: 'contradicts' });
    expect(ok.status).toBe(201);
  });

  it('bulk derives + stores purpose per edge', async () => {
    const res = await request(app).post(`${edgesUrl()}/bulk`).send({
      edges: [
        { source_id: 1, target_id: 2, purpose: 'required for' },
        { source_id: 1, target_id: 3, purpose: 'supports' },
        { source_id: 2, target_id: 3, purpose: 'related to' },
      ],
    });
    expect(res.status).toBe(201);
    const byEnd = Object.fromEntries(res.body.edges.map((e) => [`${e.source_id}-${e.target_id}`, e]));
    expect(byEnd['1-2']).toMatchObject({ purpose: 'required for', type: 'dependency' });
    expect(byEnd['1-3']).toMatchObject({ purpose: 'supports', type: 'related' });
    expect(byEnd['2-3']).toMatchObject({ purpose: 'related to', type: 'related' });
  });

  it('bulk fails fast with failedAt on a bad purpose', async () => {
    const res = await request(app).post(`${edgesUrl()}/bulk`).send({
      edges: [
        { source_id: 1, target_id: 2, purpose: 'required for' },
        { source_id: 1, target_id: 3, purpose: 'nonsense' },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.failedAt).toBe(1);
  });

  it('batch upsert stores purpose and the cross-batch cycle check fires on derived dependency', async () => {
    const ok = await request(app).post(batchUrl()).send({
      nodes: [],
      edges: [
        { source: 1, target: 2, purpose: 'required for' },
        { source: 2, target: 3, purpose: 'supports' },
      ],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.edges.find((e) => e.source_id === 1).purpose).toBe('required for');
    expect(ok.body.edges.find((e) => e.source_id === 1).type).toBe('dependency');

    // A→B + B→A both "required for" in one batch must trip the cycle check.
    const cyc = await request(app).post(`/api/graphs/${gid}/batch`).send({
      nodes: [],
      edges: [
        { source: 1, target: 3, purpose: 'required for' },
        { source: 3, target: 1, purpose: 'required for' },
      ],
    });
    expect(cyc.status).toBe(400);
    expect(cyc.body.error).toMatch(/cycle/);
  });

  it('PATCH into "required for" re-runs cycle detection', async () => {
    // 1→2 required for, 2→3 required for (a chain). A related 3→1 is fine…
    await request(app).post(`${edgesUrl()}/bulk`).send({
      edges: [
        { source_id: 1, target_id: 2, purpose: 'required for' },
        { source_id: 2, target_id: 3, purpose: 'required for' },
      ],
    });
    const rel = await request(app).post(edgesUrl()).send({ source_id: 3, target_id: 1, purpose: 'related to' });
    expect(rel.status).toBe(201);
    const eid = rel.body.id;
    // …but promoting it to "required for" would close 1→2→3→1.
    const promote = await request(app).patch(`${edgesUrl()}/${eid}`).send({ purpose: 'required for' });
    expect(promote.status).toBe(400);
    expect(promote.body.error).toMatch(/cycle/);
  });

  it('PATCH out of "required for" drops the dependency and is allowed', async () => {
    const dep = await request(app).post(edgesUrl()).send({ source_id: 1, target_id: 2, purpose: 'required for' });
    const res = await request(app).patch(`${edgesUrl()}/${dep.body.id}`).send({ purpose: 'related to' });
    expect(res.status).toBe(200);
    expect(res.body.purpose).toBe('related to');
    expect(res.body.type).toBe('related');
  });

  it('PATCH purpose preserves user-set edge color (OCC protection still holds)', async () => {
    const dep = await request(app).post(edgesUrl())
      .send({ source_id: 1, target_id: 2, purpose: 'related to', meta: { color: '#abcdef' } });
    // Concurrent bump so the three-way merge path runs.
    await request(app).patch(`${edgesUrl()}/${dep.body.id}`)
      .send({ base_version: dep.body.version, base_row: dep.body, meta: { curve: { distance: 20, weight: 0.5 } } });
    // Agent rewires the purpose with a STALE base, omitting color.
    const agent = await request(app).patch(`${edgesUrl()}/${dep.body.id}`)
      .set('X-Writer-Type', 'agent')
      .send({ purpose: 'supports', base_version: dep.body.version, base_row: dep.body });
    expect(agent.status).toBe(200);
    expect(agent.body.purpose).toBe('supports');
    expect(agent.body.meta.color).toBe('#abcdef'); // survived
  });

  it('normalizeMeta still strips truly-unknown edge meta keys (purpose is a column, not meta)', async () => {
    const res = await request(app).post(edgesUrl())
      .send({ source_id: 1, target_id: 2, purpose: 'supports', meta: { color: '#ffffff', bogus: 'x', purpose: 'sneaky' } });
    expect(res.status).toBe(201);
    expect(res.body.meta).toEqual({ color: '#ffffff' }); // bogus + a meta-level "purpose" both stripped
    expect(res.body.purpose).toBe('supports'); // the real (column) purpose is unaffected
  });

  it('/graph links carry purpose AND derived type', async () => {
    await request(app).post(edgesUrl()).send({ source_id: 1, target_id: 2, purpose: 'required for' });
    await request(app).post(edgesUrl()).send({ source_id: 1, target_id: 3, purpose: 'contradicts' });
    const res = await request(app).get(graphUrl());
    expect(res.status).toBe(200);
    const links = res.body.links;
    expect(links.every((l) => EDGE_PURPOSES.includes(l.purpose))).toBe(true);
    const dep = links.find((l) => l.source === 1 && l.target === 2);
    expect(dep).toMatchObject({ purpose: 'required for', type: 'dependency' });
    const con = links.find((l) => l.source === 1 && l.target === 3);
    expect(con).toMatchObject({ purpose: 'contradicts', type: 'related' });
  });
});

// ───────────────────────── A1: legacy migration ────────────────────────────
describe('A1 migration: backfill purpose from type', () => {
  it('promotes legacy dependency rows to "required for", leaves related as "related to"', async () => {
    // Simulate the post-ADD-COLUMN, pre-UPDATE state: a dependency edge whose
    // purpose got the column default 'related to'. Insert via raw SQL to bypass
    // the route (which would already set purpose correctly).
    await pool.query(
      `INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1,1,2,'dependency','related to')`,
      [gid],
    );
    await pool.query(
      `INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1,2,3,'related','related to')`,
      [gid],
    );
    // The exact migration statement from db/schema.sql.
    await pool.query(`UPDATE edges SET purpose = 'required for' WHERE type = 'dependency' AND purpose <> 'required for'`);
    const dep = await pool.query(`SELECT purpose FROM edges WHERE source_id=1 AND target_id=2 AND graph_id=$1`, [gid]);
    expect(dep.rows[0].purpose).toBe('required for');
    const rel = await pool.query(`SELECT purpose FROM edges WHERE source_id=2 AND target_id=3 AND graph_id=$1`, [gid]);
    expect(rel.rows[0].purpose).toBe('related to');
  });

  it('the purpose CHECK constraint rejects an out-of-vocabulary value', async () => {
    await expect(
      pool.query(`INSERT INTO edges (graph_id, source_id, target_id, type, purpose) VALUES ($1,1,2,'related','causes')`, [gid]),
    ).rejects.toThrow();
  });
});

// ───────────────────────── A2: validateMeta (unit) ─────────────────────────
describe('A2 validateMeta — reserved typed fields', () => {
  const base = { title: 'X', status: 'todo' };
  it('accepts significance/confidence in [0,1]', () => {
    expect(validateMeta({ ...base, significance: 0 })).toBeNull();
    expect(validateMeta({ ...base, significance: 0.5, confidence: 1 })).toBeNull();
  });
  it('rejects out-of-range and non-number significance/confidence', () => {
    expect(validateMeta({ ...base, significance: 2 })).toMatch(/significance/);
    expect(validateMeta({ ...base, significance: -0.1 })).toMatch(/significance/);
    expect(validateMeta({ ...base, confidence: 1.1 })).toMatch(/confidence/);
    expect(validateMeta({ ...base, confidence: 'high' })).toMatch(/confidence/);
    expect(validateMeta({ ...base, significance: NaN })).toMatch(/significance/);
  });
  it('accepts a parseable ISO verified_at, rejects malformed', () => {
    expect(validateMeta({ ...base, verified_at: '2026-06-24' })).toBeNull();
    expect(validateMeta({ ...base, verified_at: '2026-06-24T12:00:00Z' })).toBeNull();
    expect(validateMeta({ ...base, verified_at: '2026-06-24T12:00:00.000+02:00' })).toBeNull();
    expect(validateMeta({ ...base, verified_at: 'not-a-date' })).toMatch(/verified_at/);
    expect(validateMeta({ ...base, verified_at: 'tomorrow' })).toMatch(/verified_at/);
    expect(validateMeta({ ...base, verified_at: '2026-13-45' })).toMatch(/verified_at/);
    expect(validateMeta({ ...base, verified_at: '2026' })).toMatch(/verified_at/);
  });
  it('caps node type length, accepts short strings', () => {
    expect(validateMeta({ ...base, type: 'reference' })).toBeNull();
    expect(validateMeta({ ...base, type: 'x'.repeat(40) })).toBeNull();
    expect(validateMeta({ ...base, type: 'x'.repeat(41) })).toMatch(/type/);
  });
  it('all reserved fields are optional (none required)', () => {
    expect(validateMeta({ ...base })).toBeNull();
  });
  it('explicit null passes validation (clear/escape-hatch)', () => {
    expect(validateMeta({ ...base, significance: null, confidence: null, verified_at: null, type: null })).toBeNull();
  });
  it('isIsoDatetime accepts a Date instance', () => {
    expect(isIsoDatetime(new Date('2026-06-24T00:00:00Z'))).toBe(true);
    expect(isIsoDatetime(new Date('invalid'))).toBe(false);
  });
  it('applyDefaults coerces a verified_at Date to a canonical ISO string', () => {
    const out = applyDefaults({ title: 'X', verified_at: new Date('2026-06-24T12:00:00Z') });
    expect(out.verified_at).toBe('2026-06-24T12:00:00.000Z');
  });
  it('applyDefaults leaves significance/confidence as numbers and preserves null', () => {
    const out = applyDefaults({ title: 'X', significance: 0.4, confidence: null });
    expect(out.significance).toBe(0.4);
    expect(out.confidence).toBeNull();
  });
});

// ───────────────────────── A2: route + round-trip ──────────────────────────
describe('A2 node fields — POST round-trip + rejection', () => {
  it('stores all reserved fields through POST and reads them back', async () => {
    const content = node({ title: 'Claim', status: 'review', type: 'reference', significance: 0.8, confidence: 0.6, verified_at: '2026-06-24T12:00:00Z' });
    const res = await request(app).post(tasksUrl()).send({ content });
    expect(res.status).toBe(201);
    expect(res.body.meta).toMatchObject({ type: 'reference', significance: 0.8, confidence: 0.6, verified_at: '2026-06-24T12:00:00Z' });
  });
  it('rejects a bad confidence via POST', async () => {
    const res = await request(app).post(tasksUrl()).send({ content: node({ title: 'Bad', confidence: 5 }) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/confidence/);
  });
  it('a plain coding node needs no reserved fields', async () => {
    const res = await request(app).post(tasksUrl()).send({ content: node({ title: 'Plain task', status: 'todo' }) });
    expect(res.status).toBe(201);
    expect(res.body.meta.confidence).toBeUndefined();
    expect(res.body.meta.verified_at).toBeUndefined();
  });
});

// ───────────────────────── A2: merge protection ────────────────────────────
describe('A2 merge protection — research fields survive an omitting rewrite', () => {
  async function makeTask(content, writer = 'human') {
    const r = await request(app).post(tasksUrl()).set('X-Writer-Type', writer).send({ content });
    return r.body;
  }

  it('batch re-upsert that omits confidence/significance/verified_at keeps them', async () => {
    const ext = 'finding:1';
    const first = await request(app).post(batchUrl()).set('X-Writer-Type', 'agent').send({
      nodes: [{ external_id: ext, content: node({ title: 'Finding', status: 'review', significance: 0.7, confidence: 0.9, verified_at: '2026-06-20T00:00:00Z' }) }],
    });
    expect(first.status).toBe(200);
    // Re-run with a body rewrite that OMITS the three fields.
    const second = await request(app).post(batchUrl()).set('X-Writer-Type', 'agent').send({
      nodes: [{ external_id: ext, content: node({ title: 'Finding (revised)', status: 'review' }) }],
    });
    expect(second.status).toBe(200);
    const row = second.body.nodes[0];
    expect(row.meta.significance).toBe(0.7);
    expect(row.meta.confidence).toBe(0.9);
    expect(row.meta.verified_at).toBe('2026-06-20T00:00:00Z');
    expect(row.meta.title).toBe('Finding (revised)'); // the change the writer DID make landed
  });

  it('batch explicit null clears a protected research field (escape hatch)', async () => {
    const ext = 'finding:2';
    await request(app).post(batchUrl()).set('X-Writer-Type', 'agent').send({
      nodes: [{ external_id: ext, content: node({ title: 'F', status: 'review', confidence: 0.5, verified_at: '2026-06-20T00:00:00Z' }) }],
    });
    const cleared = await request(app).post(batchUrl()).set('X-Writer-Type', 'agent').send({
      nodes: [{ external_id: ext, content: node({ title: 'F', status: 'review', verified_at: null }) }],
    });
    expect(cleared.status).toBe(200);
    const row = cleared.body.nodes[0];
    expect(row.meta.verified_at == null).toBe(true); // cleared
    expect(row.meta.confidence).toBe(0.5); // untouched protected field survives
  });

  it('tasks PATCH: agent rewrite with a STALE base preserves a concurrently-present significance', async () => {
    const t = await makeTask(node({ title: 'N', status: 'todo', significance: 0.6 }));
    // A human PATCH bumps the version (keeps significance, as the canvas would).
    const human = await request(app).patch(`${tasksUrl()}/${t.id}`).set('X-Writer-Type', 'human').send({
      content: node({ title: 'N edited', status: 'todo', significance: 0.6 }),
      base_version: t.version,
      base_content: t.content,
    });
    expect(human.status).toBe(200);
    // Agent PATCHes with the STALE base (concurrent → three-way merge), omitting significance.
    const agent = await request(app).patch(`${tasksUrl()}/${t.id}`).set('X-Writer-Type', 'agent').send({
      content: node({ title: 'N', status: 'in_progress' }),
      base_version: t.version,
      base_content: t.content,
    });
    expect(agent.status).toBe(200);
    expect(agent.body.meta.significance).toBe(0.6); // protected, survived the omit
    expect(agent.body.meta.status).toBe('in_progress'); // the agent's real change landed
  });
});

// ───────────────────────── YAML (#2626) ────────────────────────────────────
describe('YAML parse-error vs missing-title', () => {
  it('an unquoted colon in a title returns a parse-error, not "title is required"', async () => {
    const res = await request(app).post(tasksUrl()).send({ content: `---\ntitle: Signal: ARR up\nstatus: todo\n---\n` });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not valid YAML|colon/i);
    expect(res.body.error).not.toMatch(/^title is required$/);
  });
  it('a genuinely missing title still returns "title is required"', async () => {
    const res = await request(app).post(tasksUrl()).send({ content: `---\nstatus: todo\n---\nbody only` });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('title is required');
  });
  it('a quoted colon title is accepted', async () => {
    const res = await request(app).post(tasksUrl()).send({ content: `---\ntitle: "Signal: ARR up"\nstatus: todo\n---\n` });
    expect(res.status).toBe(201);
    expect(res.body.meta.title).toBe('Signal: ARR up');
  });
  it('batch surfaces the parse-error with failedAt, distinct from missing-title', async () => {
    const parse = await request(app).post(batchUrl()).send({
      nodes: [{ external_id: 'p1', content: `---\ntitle: Bad: colon\n---\n` }],
    });
    expect(parse.status).toBe(400);
    expect(parse.body.error).toMatch(/not valid YAML|colon/i);
    expect(parse.body.failedAt).toEqual({ kind: 'node', index: 0 });
    const missing = await request(app).post(batchUrl()).send({
      nodes: [{ external_id: 'p2', content: `---\nstatus: todo\n---\n` }],
    });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('title is required');
  });
});

// ───────────── Integration / chain (T-unit #2627 done-gate for A1+A2+YAML) ──
describe('CHAIN: A1+A2 compose as the finished schema primitive', () => {
  it('builds typed nodes + purpose edges (incl. required-for cycle check), migrates, reads all back', async () => {
    // A2: a reference node carrying every reserved typed field.
    const ref = await request(app).post(tasksUrl()).send({
      content: node({ title: 'Source doc', status: 'review', type: 'reference', significance: 0.9, confidence: 0.8, verified_at: '2026-06-24T00:00:00Z' }),
    });
    expect(ref.status).toBe(201);
    const refId = ref.body.id;

    // A2: a finding (claim = confidence set AND type != reference).
    const finding = await request(app).post(tasksUrl()).send({
      content: node({ title: 'Finding', status: 'review', significance: 0.7, confidence: 0.6 }),
    });
    const findingId = finding.body.id;

    // A1: wire the schema with all four purposes in ONE batch.
    //   source --supports--> finding      (related)
    //   finding "required for" task 1      (dependency, cycle-checked)
    //   task 2 --contradicts--> finding    (related)
    const wired = await request(app).post(batchUrl()).send({
      nodes: [],
      edges: [
        { source: refId, target: findingId, purpose: 'supports' },
        { source: findingId, target: 1, purpose: 'required for' },
        { source: 2, target: findingId, purpose: 'contradicts' },
      ],
    });
    expect(wired.status).toBe(200);
    expect(wired.body.created.edges).toBe(3);

    // A1: a "required for" edge that would close a cycle is rejected.
    const cyc = await request(app).post(edgesUrl()).send({ source_id: 1, target_id: findingId, purpose: 'required for' });
    expect(cyc.status).toBe(400);
    expect(cyc.body.error).toMatch(/cycle/);

    // Migration is idempotent over the now-correct rows (no churn, no error).
    await pool.query(`UPDATE edges SET purpose = 'required for' WHERE type = 'dependency' AND purpose <> 'required for'`);

    // Read everything back through /graph: typed node fields + edge purpose + derived type.
    const map = await request(app).get(graphUrl());
    expect(map.status).toBe(200);
    const refNode = map.body.nodes.find((n) => n.id === refId);
    expect(refNode.meta).toMatchObject({ type: 'reference', significance: 0.9, confidence: 0.8, verified_at: '2026-06-24T00:00:00Z' });
    const findNode = map.body.nodes.find((n) => n.id === findingId);
    expect(findNode.meta.confidence).toBe(0.6);
    expect(findNode.meta.type).toBeUndefined(); // not a reference → a claim

    const links = map.body.links;
    const sup = links.find((l) => l.source === refId && l.target === findingId);
    expect(sup).toMatchObject({ purpose: 'supports', type: 'related' });
    const req = links.find((l) => l.source === findingId && l.target === 1);
    expect(req).toMatchObject({ purpose: 'required for', type: 'dependency' });
    const con = links.find((l) => l.source === 2 && l.target === findingId);
    expect(con).toMatchObject({ purpose: 'contradicts', type: 'related' });

    // Dependency traversal still keys off the derived type: finding "required
    // for" task 1 means finding is a recursive prereq (blocker) of task 1.
    const blockers = await request(app).get(`${tasksUrl()}/1/blockers`);
    expect(blockers.body.map((b) => b.id)).toContain(findingId);
  });
});
