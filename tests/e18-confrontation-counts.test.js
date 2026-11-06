// E18.5 — THE SUMMARY DESCRIBES THE DECISION, NOT THE PAGE.
//
// `confronted` reads as the answer to "how much of this decision was actually
// confronted". Computed off the RETURNED PAGE it answers a different question
// while wearing the first one's name: a decision with five grounds, two of them
// contradicted since, came back `{grounds: 2, with_outcomes: 0, unconfronted: 2}`
// when `maxResults: 2` — a summary in which nothing had been confronted at all.
// `truncated: true` does not repair that, because it says the GROUNDS LIST was
// cut, not that the SUMMARY was.
//
// So: every count in `confronted` is over the whole grounds array, and
// `returned` states the page size instead of leaving it implied.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;
let resetDerivedCache;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  resetDerivedCache = (await import('../src/derivedCache.js'))._resetDerivedCacheForTests;
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-confront-counts') RETURNING id");
  gid = g.rows[0].id;
  resetDerivedCache();
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

async function mkEdge(source, target, purpose) {
  const res = await request(app).post(`/api/graphs/${gid}/edges`)
    .send({ source_id: source, target_id: target, purpose });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

const confront = (id, body = {}) =>
  request(app).post(`/api/graphs/${gid}/decisions/${id}/confrontation`).send(body);

// five confidence-bearing grounds, committed, then the LAST TWO — the two that
// fall off a two-row page — are refuted.
async function wideDecision() {
  const d = await mkNode('storage engine', { type: 'decision' }, 'because compression');
  const grounds = [];
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const g = await mkNode(`ground ${i}`, { confidence: 0.8 });
    // eslint-disable-next-line no-await-in-loop
    await mkEdge(g, d, 'supports');
    grounds.push(g);
  }
  const patched = await request(app).patch(`/api/graphs/${gid}/tasks/${d}`)
    .send({ content: node({ title: 'storage engine', type: 'decision', status: 'todo',
      decided_at: '2026-03-01T00:00:00.000Z' }, 'because compression') });
  expect(patched.status).toBe(200);
  for (const g of grounds.slice(3)) {
    // eslint-disable-next-line no-await-in-loop
    const v = await request(app).post(`/api/graphs/${gid}/tasks/${g}/verify`)
      .send({ outcome: 'failed', happened_at: '2026-06-01T00:00:00.000Z' });
    expect(v.status).toBe(200);
  }
  return { d, grounds };
}

describe('E18.5 `confronted` summarises the DECISION, not the returned page', () => {
  it('counts every ground, including the ones the page cut off', async () => {
    const { d, grounds } = await wideDecision();

    const full = await confront(d);
    expect(full.status).toBe(200);
    expect(full.body.grounds.map((g) => g.id)).toEqual(grounds);
    expect(full.body.confronted).toEqual({
      grounds: 5, returned: 5, predictions: 5, with_outcomes: 2, unconfronted: 3,
    });
    expect(full.body.truncated).toBe(false);

    // The SAME decision, read two rows at a time. The page shrinks; what was
    // confronted does not.
    const paged = await confront(d, { maxResults: 2 });
    expect(paged.status).toBe(200);
    expect(paged.body.grounds.map((g) => g.id)).toEqual(grounds.slice(0, 2));
    expect(paged.body.truncated).toBe(true);
    expect(paged.body.truncation.grounds).toBe(true);
    expect(paged.body.confronted).toEqual({
      grounds: 5, returned: 2, predictions: 5, with_outcomes: 2, unconfronted: 3,
    });
    // The four decision-scoped counts are identical to the unpaged read; only
    // `returned` moved.
    expect(paged.body.confronted.grounds).toBe(full.body.confronted.grounds);
    expect(paged.body.confronted.with_outcomes).toBe(full.body.confronted.with_outcomes);
    expect(paged.body.confronted.unconfronted).toBe(full.body.confronted.unconfronted);
    expect(paged.body.confronted.predictions).toBe(full.body.confronted.predictions);
  });

  it('`returned` states the page size rather than leaving it implied', async () => {
    const { d } = await wideDecision();
    for (const maxResults of [1, 3, 5, 50]) {
      // eslint-disable-next-line no-await-in-loop
      const res = await confront(d, { maxResults });
      expect(res.body.confronted.returned).toBe(res.body.grounds.length);
      expect(res.body.confronted.returned).toBe(Math.min(maxResults, 5));
      expect(res.body.confronted.grounds).toBe(5);
      expect(res.body.truncated).toBe(maxResults < 5);
    }
  });

  it('a ground capped by the per-ground outcome cap is named even off-page', async () => {
    // `truncation.ground_outcomes` is part of the same summary: read off the
    // page it goes silent about a cap that bit a ground the page did not carry,
    // while `confronted` still counts that ground.
    const { d, grounds } = await wideDecision();
    const last = grounds[grounds.length - 1];
    // one refutation already; add a second outcome so a cap of 1 has a tail to
    // cut on a ground that sits outside a 2-row page.
    const rival = await mkNode('measured 3x in practice', { confidence: 0.7 });
    await mkEdge(rival, last, 'contradicts');

    const res = await confront(d, { maxResults: 2, maxOutcomes: 1 });
    expect(res.body.grounds.map((g) => g.id)).toEqual(grounds.slice(0, 2));
    expect(res.body.confronted.grounds).toBe(5);
    expect(res.body.truncation.ground_outcomes).toBe(true);
    expect(res.body.truncation.reasons).toContain('ground_outcomes_capped');
  });
});
