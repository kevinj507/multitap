import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('t') RETURNING id");
  gid = g.rows[0].id;
});

const batchUrl = () => `/api/graphs/${gid}/batch`;
const nodeContent = (title, extra = '') => `---\ntitle: ${title}\nstatus: todo\n${extra}---\n${title} body\n`;
const taskCount = async () =>
  Number((await pool.query('SELECT count(*) FROM tasks WHERE graph_id = $1', [gid])).rows[0].count);

describe('POST /api/graphs/:gid/batch', () => {
  it('creates nodes and edges (edges wired by in-batch external_id) in one call', async () => {
    const res = await request(app)
      .post(batchUrl())
      .send({
        nodes: [
          { external_id: 'n1', content: nodeContent('Node One') },
          { external_id: 'n2', content: nodeContent('Node Two') },
        ],
        edges: [{ source: 'n1', target: 'n2', purpose: 'required for' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.created).toEqual({ nodes: 2, edges: 1 });
    expect(res.body.updated).toEqual({ nodes: 0, edges: 0 });
    expect(res.body.nodes).toHaveLength(2);
    expect(res.body.nodes[0]).toMatchObject({ external_id: 'n1', _op: 'created' });
    expect(res.body.nodes[0].meta.title).toBe('Node One');
    // edge resolved both endpoints to the new task ids
    const n1 = res.body.nodes.find((n) => n.external_id === 'n1').id;
    const n2 = res.body.nodes.find((n) => n.external_id === 'n2').id;
    expect(res.body.edges[0]).toMatchObject({ source_id: n1, target_id: n2, type: 'dependency', _op: 'created' });
    expect(await taskCount()).toBe(2);
  });

  it('is idempotent: re-running the same batch upserts instead of duplicating', async () => {
    const payload = {
      nodes: [
        { external_id: 'n1', content: nodeContent('One') },
        { external_id: 'n2', content: nodeContent('Two') },
      ],
      edges: [{ source: 'n1', target: 'n2', purpose: 'required for' }],
    };
    const first = await request(app).post(batchUrl()).send(payload);
    expect(first.status).toBe(200);
    expect(first.body.created).toEqual({ nodes: 2, edges: 1 });

    const second = await request(app).post(batchUrl()).send(payload);
    expect(second.status).toBe(200);
    expect(second.body.created).toEqual({ nodes: 0, edges: 0 });
    // Identical re-run is a true no-op: nothing rewritten (no version bump / SSE
    // churn), so it reports unchanged, not updated.
    expect(second.body.updated).toEqual({ nodes: 0, edges: 0 });
    expect(second.body.unchanged).toEqual({ nodes: 2, edges: 1 });

    expect(await taskCount()).toBe(2); // no duplicates
    const edges = await request(app).get(`/api/graphs/${gid}/edges`);
    expect(edges.body).toHaveLength(1);
  });

  it('updates node content + bumps version on re-upsert', async () => {
    await request(app).post(batchUrl()).send({ nodes: [{ external_id: 'n1', content: nodeContent('Before') }] });
    const res = await request(app)
      .post(batchUrl())
      .send({ nodes: [{ external_id: 'n1', content: nodeContent('After') }] });
    expect(res.status).toBe(200);
    expect(res.body.nodes[0].meta.title).toBe('After');
    expect(res.body.nodes[0].version).toBe(1); // 0 on insert, +1 on update
  });

  it("preserves a human's task status when an agent re-upserts content that omits it", async () => {
    const create = await request(app)
      .post(batchUrl())
      .set('x-writer-type', 'agent')
      .send({ nodes: [{ external_id: 'n1', content: nodeContent('Task') }] });
    const id = create.body.nodes[0].id;

    // Human marks it done on the canvas (full-frontmatter round-trip).
    const done = await request(app)
      .patch(`/api/graphs/${gid}/tasks/${id}`)
      .send({ content: '---\ntitle: Task\nstatus: done\n---\nTask body\n' });
    expect(done.body.meta.status).toBe('done');

    // Agent re-runs the round with content that OMITS status entirely.
    const reupsert = await request(app)
      .post(batchUrl())
      .set('x-writer-type', 'agent')
      .send({ nodes: [{ external_id: 'n1', content: '---\ntitle: Task retitled\n---\nnew body\n' }] });
    expect(reupsert.status).toBe(200);
    expect(reupsert.body.nodes[0].meta.status).toBe('done'); // human progress survived
    expect(reupsert.body.nodes[0].meta.title).toBe('Task retitled'); // agent content still applied

    // ...but an agent that EXPLICITLY sets status can still change it.
    const explicit = await request(app)
      .post(batchUrl())
      .set('x-writer-type', 'agent')
      .send({ nodes: [{ external_id: 'n1', content: '---\ntitle: Task retitled\nstatus: review\n---\nnew body\n' }] });
    expect(explicit.body.nodes[0].meta.status).toBe('review');
  });

  it('trims external_id so whitespace variants are the same node (no duplicate)', async () => {
    const a = await request(app)
      .post(batchUrl())
      .send({ nodes: [{ external_id: 'node-x', content: nodeContent('X') }] });
    expect(a.body.created.nodes).toBe(1);
    const b = await request(app)
      .post(batchUrl())
      .send({ nodes: [{ external_id: '  node-x  ', content: nodeContent('X2') }] });
    expect(b.body.created.nodes).toBe(0); // trimmed -> resolves to the same node
    expect(await taskCount()).toBe(1);
  });

  it("preserves a human's UI-managed keys (x/y) when an agent re-upserts without them", async () => {
    // Agent creates the node.
    const create = await request(app)
      .post(batchUrl())
      .set('x-writer-type', 'agent')
      .send({ nodes: [{ external_id: 'n1', content: nodeContent('Card') }] });
    const id = create.body.nodes[0].id;

    // Human drags it on the canvas -> position lands in the content frontmatter.
    const dragged = await request(app)
      .patch(`/api/graphs/${gid}/tasks/${id}`)
      .send({ content: nodeContent('Card', 'x: 420\ny: 99\n') });
    expect(dragged.status).toBe(200);
    expect(dragged.body.meta.x).toBe(420);

    // Agent re-runs the workflow with content that has no x/y.
    const reupsert = await request(app)
      .post(batchUrl())
      .set('x-writer-type', 'agent')
      .send({ nodes: [{ external_id: 'n1', content: nodeContent('Card retitled') }] });
    expect(reupsert.status).toBe(200);
    expect(reupsert.body.nodes[0].meta.x).toBe(420); // drag survived
    expect(reupsert.body.nodes[0].meta.y).toBe(99);
    expect(reupsert.body.nodes[0].meta.title).toBe('Card retitled'); // content still applied
  });

  it('stamps a provided run_id on every row, and generates one when omitted', async () => {
    const withRun = await request(app)
      .post(batchUrl())
      .send({ run_id: 'run-abc', nodes: [{ external_id: 'n1', content: nodeContent('R') }] });
    expect(withRun.status).toBe(200);
    expect(withRun.body.run_id).toBe('run-abc');
    expect(withRun.body.nodes[0].run_id).toBe('run-abc');

    const noRun = await request(app)
      .post(batchUrl())
      .send({ nodes: [{ external_id: 'n2', content: nodeContent('R2') }] });
    expect(noRun.status).toBe(200);
    expect(typeof noRun.body.run_id).toBe('string');
    expect(noRun.body.run_id.length).toBeGreaterThan(0);
    expect(noRun.body.nodes[0].run_id).toBe(noRun.body.run_id);
  });

  it('detects a dependency cycle across the batch and rolls everything back', async () => {
    const res = await request(app)
      .post(batchUrl())
      .send({
        nodes: [
          { external_id: 'a', content: nodeContent('A') },
          { external_id: 'b', content: nodeContent('B') },
        ],
        edges: [
          { source: 'a', target: 'b', purpose: 'required for' },
          { source: 'b', target: 'a', purpose: 'required for' },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cycle/i);
    // Both edges are inserted before the cycle pass runs (matching /edges/bulk),
    // so the first dependency edge in iteration order is flagged.
    expect(res.body.failedAt).toEqual({ kind: 'edge', index: 0 });
    expect(await taskCount()).toBe(0); // nodes rolled back too — atomic
  });

  it('wires an edge to a pre-existing node referenced by numeric id', async () => {
    const seed = await request(app).post(batchUrl()).send({ nodes: [{ external_id: 'seed', content: nodeContent('Seed') }] });
    const seedId = seed.body.nodes[0].id;
    const res = await request(app)
      .post(batchUrl())
      .send({
        nodes: [{ external_id: 'n2', content: nodeContent('New') }],
        edges: [{ source: seedId, target: 'n2', purpose: 'related to' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.edges[0].source_id).toBe(seedId);
  });

  it('rejects an edge referencing an unknown external_id (and rolls back nodes)', async () => {
    const res = await request(app)
      .post(batchUrl())
      .send({
        nodes: [{ external_id: 'n1', content: nodeContent('One') }],
        edges: [{ source: 'n1', target: 'ghost', purpose: 'related to' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.failedAt).toEqual({ kind: 'edge', index: 0 });
    expect(await taskCount()).toBe(0);
  });

  it('rejects a node without an external_id', async () => {
    const res = await request(app)
      .post(batchUrl())
      .send({ nodes: [{ content: nodeContent('No key') }] });
    expect(res.status).toBe(400);
    expect(res.body.failedAt).toEqual({ kind: 'node', index: 0 });
  });

  it('rejects a node whose YAML title has an unquoted colon, with a clear error', async () => {
    const res = await request(app)
      .post(batchUrl())
      .send({ nodes: [{ external_id: 'n1', content: '---\ntitle: Signal: ARR is up\nstatus: review\n---\nbody\n' }] });
    expect(res.status).toBe(400);
    expect(res.body.failedAt).toEqual({ kind: 'node', index: 0 });
    expect(res.body.error).toMatch(/yaml|colon|quote/i); // not the misleading "title is required"
  });

  it('rejects an empty batch', async () => {
    const res = await request(app).post(batchUrl()).send({ nodes: [], edges: [] });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate external_id within the same batch', async () => {
    const res = await request(app)
      .post(batchUrl())
      .send({
        nodes: [
          { external_id: 'dup', content: nodeContent('A') },
          { external_id: 'dup', content: nodeContent('B') },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.failedAt).toEqual({ kind: 'node', index: 1 });
  });
});
