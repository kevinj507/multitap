// Route tests for POST /api/graphs/:gid/context — the context-pack endpoint
// (E13 / #461). Mirrors search-route.test.js: live PG, anonymous (auth off in
// test env), one graph per test.
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;
let ids; // { power, dist, energy, kanban, utils }

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
});

function md(title, opts = {}) {
  const lines = [`title: ${title}`];
  if (opts.description) lines.push(`description: ${opts.description}`);
  lines.push(`status: ${opts.status || 'todo'}`);
  return `---\n${lines.join('\n')}\n---\n${opts.body || ''}`;
}

const ctxUrl = () => `/api/graphs/${gid}/context`;
const tasksUrl = () => `/api/graphs/${gid}/tasks`;
const edgesUrl = () => `/api/graphs/${gid}/edges`;

async function mkTask(title, opts) {
  const r = await request(app).post(tasksUrl()).send({ content: md(title, opts) });
  expect(r.status).toBe(201);
  return r.body.id;
}
async function mkEdge(source_id, target_id, type) {
  const purpose = type === 'dependency' ? 'required for' : 'related to';
  const r = await request(app).post(edgesUrl()).send({ source_id, target_id, purpose });
  expect(r.status).toBe(201);
}

// Graph:  power —rel— dist —rel— energy ;  power —rel— utils ;  power —dep— kanban
async function seed() {
  ids = {};
  ids.power = await mkTask('GPU power chips', { body: 'power management for GPUs and accelerators' });
  ids.dist = await mkTask('power distribution', { body: 'distributes electricity across racks' });
  ids.energy = await mkTask('energy overview', { body: 'the energy and electricity grid context' });
  ids.kanban = await mkTask('kanban board', { body: 'columns and cards, unrelated to hardware' });
  ids.utils = await mkTask('utilities', { body: 'power utilities and generation companies' });
  await mkEdge(ids.power, ids.dist, 'related');
  await mkEdge(ids.dist, ids.energy, 'related');
  await mkEdge(ids.power, ids.utils, 'related');
  await mkEdge(ids.power, ids.kanban, 'dependency');
}

beforeEach(async () => {
  const r = await pool.query("INSERT INTO graphs (name) VALUES ('context-test') RETURNING id");
  gid = r.rows[0].id;
  await seed();
});

describe('POST /api/graphs/:gid/context — node-seeded', () => {
  it('returns the 1-hop related neighborhood with bodies, dist, and induced edges', async () => {
    const res = await request(app).post(ctxUrl()).send({ seeds: [ids.power], hops: 1 });
    expect(res.status).toBe(200);
    const got = res.body.nodes.map((n) => n.id).sort((a, b) => a - b);
    expect(got).toEqual([ids.power, ids.dist, ids.utils].sort((a, b) => a - b));
    const seedNode = res.body.nodes.find((n) => n.id === ids.power);
    expect(seedNode.dist).toBe(0);
    expect(seedNode.body).toMatch(/power management/);
    expect(seedNode.status).toBe('todo');
    expect(res.body.nodes.find((n) => n.id === ids.dist).dist).toBe(1);
    // induced edges: power-dist and power-utils, all related, shape {source,target,type}
    expect(res.body.edges.every((e) => e.type === 'related')).toBe(true);
    const pairs = res.body.edges.map((e) => [e.source, e.target].sort((a, b) => a - b).join('-')).sort();
    expect(pairs).toEqual([`${ids.power}-${ids.dist}`, `${ids.power}-${ids.utils}`].sort());
    // node-seeded path runs no search
    expect(res.body.timings.search).toBeUndefined();
    expect(res.body.timings).toHaveProperty('total');
    expect(res.body.truncated).toBe(false);
  });

  it('hops=2 reaches the bridge node (energy) at dist 2', async () => {
    const res = await request(app).post(ctxUrl()).send({ seeds: [ids.power], hops: 2 });
    expect(res.body.nodes.find((n) => n.id === ids.energy).dist).toBe(2);
  });

  it('edgeTypes=null includes the dependency neighbour; default ["related"] excludes it', async () => {
    const dflt = await request(app).post(ctxUrl()).send({ seeds: [ids.power], hops: 1 });
    expect(dflt.body.nodes.map((n) => n.id)).not.toContain(ids.kanban);
    const all = await request(app).post(ctxUrl()).send({ seeds: [ids.power], hops: 1, edgeTypes: null });
    expect(all.body.nodes.map((n) => n.id)).toContain(ids.kanban);
  });

  it('honors the node budget and flags truncated', async () => {
    const res = await request(app).post(ctxUrl()).send({ seeds: [ids.power], hops: 2, maxNodes: 1 });
    expect(res.body.nodes).toHaveLength(1);
    expect(res.body.nodes[0].id).toBe(ids.power);
    expect(res.body.truncated).toBe(true);
  });

  it('clips bodies to maxBodyChars and flags bodyTruncated', async () => {
    const res = await request(app).post(ctxUrl()).send({ seeds: [ids.power], hops: 1, maxBodyChars: 5 });
    const seedNode = res.body.nodes.find((n) => n.id === ids.power);
    expect(seedNode.body.length).toBe(5);
    expect(seedNode.bodyTruncated).toBe(true);
  });
});

describe('POST /api/graphs/:gid/context — query-seeded', () => {
  it('seeds from search hits and returns a body-hydrated neighborhood', async () => {
    const res = await request(app).post(ctxUrl()).send({ query: 'power', hops: 1, seedTopK: 2 });
    expect(res.status).toBe(200);
    expect(res.body.seeds.length).toBeGreaterThan(0);
    expect(res.body.seeds.length).toBeLessThanOrEqual(2);
    expect(res.body.nodes.length).toBeGreaterThan(0);
    expect(res.body.timings).toHaveProperty('search'); // query path runs search
    expect(res.body.nodes.every((n) => typeof n.body === 'string')).toBe(true);
  });

  it('returns an empty pack (never errors) when the query matches nothing', async () => {
    const res = await request(app).post(ctxUrl()).send({ query: 'zzzznomatchatall' });
    expect(res.status).toBe(200);
    expect(res.body.seeds).toEqual([]);
    expect(res.body.nodes).toEqual([]);
  });
});

describe('POST /api/graphs/:gid/context — validation + access', () => {
  it('400 when neither query nor seeds is given', async () => {
    const res = await request(app).post(ctxUrl()).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/query or seeds/);
  });

  it('400 on a seed id that is not a node in this graph', async () => {
    const res = await request(app).post(ctxUrl()).send({ seeds: [999999] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found in graph/);
  });

  it('400 on a non-integer seed', async () => {
    const res = await request(app).post(ctxUrl()).send({ seeds: ['x'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive integer/);
  });

  it('400 on out-of-range hops / maxNodes / edgeTypes', async () => {
    expect((await request(app).post(ctxUrl()).send({ seeds: [ids.power], hops: 9 })).status).toBe(400);
    expect((await request(app).post(ctxUrl()).send({ seeds: [ids.power], maxNodes: 0 })).status).toBe(400);
    const bad = await request(app).post(ctxUrl()).send({ seeds: [ids.power], edgeTypes: ['bogus'] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/edgeTypes/);
  });

  it('404 for an unknown graph id (read-gated like /search)', async () => {
    const res = await request(app).post('/api/graphs/doesnotexist/context').send({ query: 'power' });
    expect(res.status).toBe(404);
  });
});
