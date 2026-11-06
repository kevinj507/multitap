// E18.3 STEP 2 — `meta.propagation`, the per-edge doubt weight.
//
// WHY THIS IS A REAL EDIT AND NOT A CONVENTION. `normalizeMeta`
// (src/routes/edges.js) is an ALLOWLIST: it builds a fresh `meta` object
// containing only the keys it knows and SILENTLY DROPS everything else. Before
// this rung a caller could POST an edge with `meta: {propagation: 0.4}`, get a
// 201, and find the key gone — which, for a science pipeline writing exact
// magnitudes, looks exactly like working.
//
// One function, four call sites — POST /edges, POST /edges/bulk, PATCH
// /edges/:id, POST /batch — so one edit covers every write path, and this file
// exercises all four rather than trusting that.
//
// src/db.js is imported inside beforeAll, never at module scope.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
// Pure module: reaches no database.
import { MAX_PROPAGATION, MIN_PROPAGATION } from '../src/doubt.js';

let app;
let pool;
let gid;
// src/routes/edges.js reaches src/db.js, so it is imported INSIDE beforeAll —
// a static import here would connect the pool before DATABASE_URL is set and
// every route call would 500. (House rule; it cost this file six red tests.)
let normalizeMeta;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  normalizeMeta = (await import('../src/routes/edges.js')).normalizeMeta;
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-doubt-weight') RETURNING id");
  gid = g.rows[0].id;
});

const node = (meta) =>
  `---\n${Object.entries(meta).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')}\n---\n`;

async function insNode(title) {
  const m = { title, status: 'review' };
  const { rows } = await pool.query(
    'INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING id',
    [gid, node(m), JSON.stringify(m)],
  );
  return Number(rows[0].id);
}

const edgesUrl = () => `/api/graphs/${gid}/edges`;

async function storedMeta(edgeId) {
  const { rows } = await pool.query('SELECT meta FROM edges WHERE id = $1', [edgeId]);
  return rows[0].meta;
}

describe('E18.3 normalizeMeta — the allowlist gains ONE key, and validates it', () => {
  it('accepts the open-closed interval (0, 1] and rejects everything outside it', () => {
    expect(normalizeMeta({ propagation: 1 }).meta).toEqual({ propagation: 1 });
    expect(normalizeMeta({ propagation: 0.0001 }).meta).toEqual({ propagation: 0.0001 });
    for (const bad of [0, -0.5, 1.0001, 2, 'abc', NaN, Infinity]) {
      // A weight > 1 is what would let a `supports` cycle amplify without
      // bound: rejecting it is the termination argument, not tidiness.
      expect(normalizeMeta({ propagation: bad }).error).toMatch(/propagation must be a number/);
    }
  });

  it('is absent unless asked for, and does not disturb the keys already there', () => {
    expect(normalizeMeta({}).meta).toEqual({});
    expect(normalizeMeta({ color: '#ff0000' }).meta).toEqual({ color: '#ff0000' });
    const both = normalizeMeta({ propagation: 0.4, curve: { distance: 10, weight: 0.5 } }).meta;
    expect(both).toEqual({ curve: { distance: 10, weight: 0.5 }, propagation: 0.4 });
  });

  it('`propagation` and `curve.weight` are DIFFERENT KEYS with different ranges', () => {
    // curve.weight is the bezier control-point position, constrained to
    // [0.10, 0.90]. propagation is doubt attenuation, constrained to (0, 1].
    // 0.95 is legal for one and illegal for the other — which is precisely why
    // the doubt knob is not called `weight`.
    expect(normalizeMeta({ propagation: 0.95 }).meta).toEqual({ propagation: 0.95 });
    expect(normalizeMeta({ curve: { distance: 0, weight: 0.95 } }).error).toMatch(/curve\.weight/);
    expect(MIN_PROPAGATION).toBe(0);
    expect(MAX_PROPAGATION).toBe(1);
  });

  it('still drops an unknown key — the allowlist is intact, it just knows one more name', () => {
    expect(normalizeMeta({ propagation: 0.4, nonsense: 1 }).meta).toEqual({ propagation: 0.4 });
  });
});

describe('E18.3 the four write paths all carry meta.propagation', () => {
  it('POST /edges stores it', async () => {
    const a = await insNode('A');
    const b = await insNode('B');
    const res = await request(app).post(edgesUrl())
      .send({ source_id: a, target_id: b, purpose: 'supports', meta: { propagation: 0.4 } });
    expect(res.status).toBe(201);
    expect(res.body.meta).toMatchObject({ propagation: 0.4 });
    expect(await storedMeta(res.body.id)).toMatchObject({ propagation: 0.4 });
  });

  it('POST /edges rejects an out-of-range value with 400 and writes nothing', async () => {
    const a = await insNode('A');
    const b = await insNode('B');
    const res = await request(app).post(edgesUrl())
      .send({ source_id: a, target_id: b, purpose: 'supports', meta: { propagation: 1.5 } });
    expect(res.status).toBe(400);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM edges WHERE graph_id = $1', [gid]);
    expect(rows[0].n).toBe(0);
  });

  it('POST /edges/bulk stores it, and names the failing index on a bad one', async () => {
    const a = await insNode('A');
    const b = await insNode('B');
    const c = await insNode('C');
    const ok = await request(app).post(`${edgesUrl()}/bulk`).send({
      edges: [
        { source_id: a, target_id: b, purpose: 'supports', meta: { propagation: 0.25 } },
        { source_id: b, target_id: c, purpose: 'supports' },
      ],
    });
    expect(ok.status).toBe(201);
    expect(await storedMeta(ok.body.edges[0].id)).toMatchObject({ propagation: 0.25 });
    expect(await storedMeta(ok.body.edges[1].id)).toEqual({});

    const bad = await request(app).post(`${edgesUrl()}/bulk`).send({
      edges: [{ source_id: a, target_id: c, purpose: 'supports', meta: { propagation: 0 } }],
    });
    expect(bad.status).toBe(400);
    expect(bad.body.failedAt).toBe(0);
  });

  it('PATCH /edges/:id sets it, and `propagation: null` clears it', async () => {
    const a = await insNode('A');
    const b = await insNode('B');
    const created = await request(app).post(edgesUrl())
      .send({ source_id: a, target_id: b, purpose: 'supports' });
    const patched = await request(app).patch(`${edgesUrl()}/${created.body.id}`)
      .send({ meta: { propagation: 0.8 } });
    expect(patched.status).toBe(200);
    expect(await storedMeta(created.body.id)).toMatchObject({ propagation: 0.8 });

    const cleared = await request(app).patch(`${edgesUrl()}/${created.body.id}`)
      .send({ meta: { propagation: null } });
    expect(cleared.status).toBe(200);
    expect(await storedMeta(created.body.id)).toEqual({});
  });

  it('POST /batch stores it', async () => {
    const res = await request(app).post(`/api/graphs/${gid}/batch`).send({
      nodes: [
        { external_id: 'a', content: node({ title: 'A' }) },
        { external_id: 'b', content: node({ title: 'B' }) },
      ],
      edges: [{ source: 'a', target: 'b', purpose: 'supports', meta: { propagation: 0.33 } }],
    });
    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT meta FROM edges WHERE graph_id = $1', [gid]);
    expect(rows[0].meta).toMatchObject({ propagation: 0.33 });
  });
});

describe('E18.3 an agent PATCH cannot silently wipe the weight', () => {
  it('a three-way merge from an agent that never mentions propagation keeps it', async () => {
    // The 4283-live-edges rule, applied to the new key: a partial PATCH must
    // never silently change a field it did not mention. `meta.propagation`
    // joins protectedFromAgentRemoval beside meta.color / meta.curve because it
    // is a structural property of the relation, not a rendering hint.
    const a = await insNode('A');
    const b = await insNode('B');
    const created = await request(app).post(edgesUrl())
      .send({ source_id: a, target_id: b, purpose: 'supports', meta: { propagation: 0.4 } });
    const edgeId = created.body.id;
    const baseVersion = created.body.version;

    // Someone else writes first, so the OCC merge path actually engages.
    await request(app).patch(`${edgesUrl()}/${edgeId}`).send({ meta: { color: '#00ff00' } });

    const res = await request(app).patch(`${edgesUrl()}/${edgeId}`)
      .set('X-Writer-Type', 'agent')
      .send({
        purpose: 'required for',
        base_version: baseVersion,
        base_row: { source_id: a, target_id: b, purpose: 'supports', meta: {} },
      });
    expect(res.status).toBe(200);
    const meta = await storedMeta(edgeId);
    expect(meta.propagation).toBe(0.4);
    expect(meta.color).toBe('#00ff00');
  });
});

// The same rule on the OTHER bulk path. /batch is what the skill documents as
// the agent write-back route, and its own worked example writes edges as
// `{source, target, purpose}` with no `meta` at all — so the ordinary
// idempotent re-run reaches the merge with `propagation` absent. It was listed
// as a propagation WRITE path and guarded on only one of the four, so a re-run
// deleted the value: the edge reverted to the `supports` default and a node
// resting on a refuted claim dropped off the doubt front entirely once its
// accumulated weight fell under the floor.
describe('E18.3 an agent /batch re-run cannot silently wipe the weight', () => {
  // The nodes must be created THROUGH /batch so the re-run resolves to the same
  // rows; /batch identifies an edge by its endpoints, so an external_id that
  // does not already exist would simply make a new node and a new edge and the
  // merge would never engage.
  async function batchNodes(names) {
    const res = await request(app).post(`/api/graphs/${gid}/batch`).send({
      nodes: names.map((n) => ({ external_id: n, content: node({ title: n }) })),
    });
    expect(res.status).toBe(200);
    return Object.fromEntries(res.body.nodes.map((r) => [r.external_id, r.id]));
  }

  it('re-asserting an edge without meta keeps propagation, exactly as color is kept', async () => {
    const ids = await batchNodes(['a', 'b']);
    const created = await request(app).post(edgesUrl()).send({
      source_id: ids.a, target_id: ids.b, purpose: 'supports',
      meta: { propagation: 0.25, color: '#ff0000' },
    });
    expect(created.status).toBe(201);

    const res = await request(app).post(`/api/graphs/${gid}/batch`)
      .set('X-Writer-Type', 'agent')
      .send({ edges: [{ source: 'a', target: 'b', purpose: 'supports' }] });
    expect(res.status).toBe(200);
    expect(res.body.edges[0].id).toBe(created.body.id);

    const meta = await storedMeta(created.body.id);
    // color proves the protected-list mechanism is engaged at all; propagation
    // is the key that used to fall out of it.
    expect(meta.color).toBe('#ff0000');
    expect(meta.propagation).toBe(0.25);
  });

  it('a node deep in a chain stays ON the doubt front after an agent /batch re-run', async () => {
    // The observable consequence, not just the stored field: six `supports`
    // hops each declared at full strength keep the tail visible; reverting them
    // to the 0.6 default takes the tail under the 0.05 floor and it vanishes.
    const names = Array.from({ length: 7 }, (_, i) => `n${i}`);
    const ids = await batchNodes(names);
    for (let i = 0; i < 6; i++) {
      const r = await request(app).post(edgesUrl()).send({
        source_id: ids[names[i]], target_id: ids[names[i + 1]],
        purpose: 'supports', meta: { propagation: 1 },
      });
      expect(r.status).toBe(201);
    }
    await request(app).post(`/api/graphs/${gid}/tasks/${ids.n0}/verify`).send({ outcome: 'failed' });

    const before = await request(app).post(`/api/graphs/${gid}/doubt`).send({});
    expect(before.status).toBe(200);
    expect(before.body.doubt.map((x) => x.id)).toContain(ids.n6);

    const re = await request(app).post(`/api/graphs/${gid}/batch`)
      .set('X-Writer-Type', 'agent')
      .send({
        edges: Array.from({ length: 6 }, (_, i) => ({
          source: names[i], target: names[i + 1], purpose: 'supports',
        })),
      });
    expect(re.status).toBe(200);

    const after = await request(app).post(`/api/graphs/${gid}/doubt`).send({});
    expect(after.status).toBe(200);
    expect(after.body.doubt.map((x) => x.id)).toContain(ids.n6);
  });
});
