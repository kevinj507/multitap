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
  const r = await pool.query("INSERT INTO graphs (name) VALUES ('search-test') RETURNING id");
  gid = r.rows[0].id;
});

function md(title, opts = {}) {
  const lines = [`title: ${title}`];
  if (opts.description) lines.push(`description: ${opts.description}`);
  lines.push(`status: ${opts.status || 'todo'}`);
  return `---\n${lines.join('\n')}\n---\n${opts.body || ''}`;
}

const searchUrl = () => `/api/graphs/${gid}/search`;
const tasksUrl = () => `/api/graphs/${gid}/tasks`;

async function seed() {
  await request(app).post(tasksUrl()).send({ content: md('auth tokens', { description: 'x', body: 'y' }) });
  await request(app).post(tasksUrl()).send({ content: md('rate limiting', { description: 'session token bucket', body: 'z' }) });
  await request(app).post(tasksUrl()).send({ content: md('kanban', { description: 'columns', body: 'a token appears here once' }) });
}

describe('POST /api/graphs/:gid/search', () => {
  it('ranks live PG nodes by the tiered lexical contract (title > desc > body)', async () => {
    await seed();
    // The default ranker is now bm25 (word-equality, so "token" wouldn't match
    // the "tokens" title); request the tiered substring ranker explicitly to
    // exercise its title>desc>body contract through the route.
    const res = await request(app).post(searchUrl()).send({ query: 'token', config: { lexical: { ranker: 'tiered' } } });
    expect(res.status).toBe(200);
    expect(res.body.query).toBe('token');
    const titles = res.body.results.map((r) => r.meta.field);
    expect(titles).toEqual(['title', 'description', 'body']);
    // every result carries a snippet + the timings envelope is present
    expect(res.body.results[0]).toHaveProperty('snippet');
    expect(res.body.timings).toHaveProperty('total');
    expect(res.body.timings.retrievers).toHaveProperty('lexical');
  });

  it('uses bm25 (word-equality) by default — "token" matches desc/body, not the "tokens" title', async () => {
    await seed();
    const res = await request(app).post(searchUrl()).send({ query: 'token' });
    expect(res.status).toBe(200);
    const fields = res.body.results.map((r) => r.meta.field);
    expect(fields).toEqual(['description', 'body']);
  });

  it('returns 400 on a missing/empty query', async () => {
    expect((await request(app).post(searchUrl()).send({})).status).toBe(400);
    expect((await request(app).post(searchUrl()).send({ query: '   ' })).status).toBe(400);
  });

  it('returns 400 on an invalid config override', async () => {
    const res = await request(app).post(searchUrl()).send({ query: 'token', config: { topK: 0 } });
    expect(res.status).toBe(400);
    expect(res.body.errors.join()).toMatch(/topK/);
  });

  it('honors a valid config override (topK)', async () => {
    await seed();
    const res = await request(app).post(searchUrl()).send({ query: 'token', config: { topK: 1 } });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
  });

  it('returns an empty result set (never errors) when nothing matches', async () => {
    await seed();
    const res = await request(app).post(searchUrl()).send({ query: 'zzzznomatch' });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('404s for an unknown graph id', async () => {
    const res = await request(app).post('/api/graphs/doesnotexist/search').send({ query: 'token' });
    expect(res.status).toBe(404);
  });

  // OOM guard (#436): ad-hoc configs must never load a second ONNX model copy
  // in the serving process. The test env's deployed backends are 'none', so any
  // local-onnx override has no pooled instance to reuse → 400, not a model load.
  it('400s an ad-hoc local-onnx override that does not match the deployed model', async () => {
    await seed();
    for (const kind of ['rerank', 'embedding']) {
      const res = await request(app)
        .post(searchUrl())
        .send({ query: 'token', config: { providers: { [kind]: { backend: 'local-onnx' } } } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/pooled|deployed model/);
    }
  });
});

describe('pooledAdHocDeps (OOM guard unit)', () => {
  const FAKE_EMB = { modelId: 'deployed-emb', embed: async () => [] };
  const fakeDefault = {
    config: { providers: { embedding: { backend: 'local-onnx' }, rerank: { backend: 'none' } } },
    providers: { embedding: FAKE_EMB, rerank: null },
  };
  let pooledAdHocDeps;
  beforeAll(async () => {
    ({ pooledAdHocDeps } = await import('../src/routes/search.js'));
  });

  it('reuses the deployed provider instance when the identity matches', () => {
    const deps = pooledAdHocDeps(
      { providers: { embedding: { backend: 'local-onnx' } } },
      fakeDefault,
    );
    expect(deps.embeddingProvider).toBe(FAKE_EMB);
  });

  it('throws 400 when the override names a different model or dtype', () => {
    for (const override of [{ model: 'some-other-model' }, { dtype: 'fp32' }]) {
      expect(() => pooledAdHocDeps(
        { providers: { embedding: { backend: 'local-onnx', ...override } } },
        fakeDefault,
      )).toThrow(/deployed model/);
    }
  });

  it('throws 400 for local-onnx kinds the deployment does not run at all', () => {
    expect(() => pooledAdHocDeps(
      { providers: { rerank: { backend: 'local-onnx' } } },
      fakeDefault,
    )).toThrow(/deployed model/);
  });

  it('passes non-onnx overrides through untouched (no pooling, no rejection)', () => {
    const deps = pooledAdHocDeps(
      { providers: { rerank: { backend: 'http', url: 'http://x' } }, topK: 5 },
      fakeDefault,
    );
    expect(deps).toEqual({});
  });

  // The `static` backend is in-process too: its weights are a quantized table
  // read from disk (~31MB + tokenizer). Before this was pooled, a merged
  // config inheriting the deployed static backend built a FRESH provider per
  // request — paying that read every time and destroying the instant-start
  // property the backend exists for.
  describe('static backend pooling', () => {
    const STATIC_EMB = { modelId: 'deployed-static', embed: async () => [] };
    const staticDefault = {
      config: {
        providers: {
          embedding: { backend: 'static', model: 'static-retrieval-mrl-en-v1-int8-d1024' },
          rerank: { backend: 'none' },
        },
      },
      providers: { embedding: STATIC_EMB, rerank: null },
    };

    it('reuses the deployed static table instead of loading a second copy', () => {
      const deps = pooledAdHocDeps(
        { providers: { embedding: { backend: 'static', model: 'static-retrieval-mrl-en-v1-int8-d1024' } } },
        staticDefault,
      );
      expect(deps.embeddingProvider).toBe(STATIC_EMB);
    });

    it('rejects a static override naming a different artifact or directory', () => {
      for (const override of [{ model: 'static-retrieval-mrl-en-v1-int8-d256' }, { staticDir: '/elsewhere' }]) {
        expect(() => pooledAdHocDeps(
          {
            providers: {
              embedding: {
                backend: 'static',
                model: 'static-retrieval-mrl-en-v1-int8-d1024',
                ...override,
              },
            },
          },
          staticDefault,
        )).toThrow(/deployed model/);
      }
    });
  });
});
