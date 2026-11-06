// Scheduled graph refresh (node 3834). Pins: per-graph schedule CRUD +
// derived due-ness, the completion stamp (only an explicit /complete moves
// last_run_at — a died-mid-run refresh stays due), the isolation rule (a
// schedule write never bumps the graph's version/updated_at), and the
// cross-graph /api/refreshes scope (owned + member only — the purpose prompt
// must never leak across owners; anon gets []).
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import { _setAdapterForTests } from '../src/auth/index.js';
import { makeHeaderAuthAdapter } from './__support__/test_auth.js';

let app;
let pool;
let gid;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  _setAdapterForTests(makeHeaderAuthAdapter());
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
});

beforeEach(async () => {
  const r = await pool.query("INSERT INTO graphs (name) VALUES ('refresh-t') RETURNING id");
  gid = r.rows[0].id;
});

const url = () => `/api/graphs/${gid}/refresh`;
const put = (body) => request(app).put(url()).send(body);

async function makeUser(suffix) {
  const r = await pool.query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('test-header', $1, $2, $1) RETURNING *`,
    [suffix, `${suffix}@test.local`],
  );
  return r.rows[0];
}

describe('per-graph refresh config', () => {
  it('PUT creates, GET reads it back with derived due=true (never run)', async () => {
    const r = await put({ interval_days: 30, purpose: 'Re-verify market claims; re-question the target.' });
    expect(r.status).toBe(200);
    expect(r.body.due).toBe(true); // never run → due immediately
    const g = await request(app).get(url());
    expect(g.status).toBe(200);
    expect(g.body.interval_days).toBe(30);
    expect(g.body.enabled).toBe(true);
  });

  it('PUT upserts — second call replaces schedule fields', async () => {
    await put({ interval_days: 30, purpose: 'v1' });
    const r = await put({ interval_days: 7, purpose: 'v2', enabled: false });
    expect(r.status).toBe(200);
    expect(r.body.interval_days).toBe(7);
    expect(r.body.purpose).toBe('v2');
    expect(r.body.enabled).toBe(false);
    expect(r.body.due).toBe(false); // disabled is never due
  });

  it('validates interval and purpose', async () => {
    expect((await put({ interval_days: 0, purpose: 'x' })).status).toBe(400);
    expect((await put({ interval_days: 366, purpose: 'x' })).status).toBe(400);
    expect((await put({ interval_days: 1.5, purpose: 'x' })).status).toBe(400);
    expect((await put({ interval_days: 30 })).status).toBe(400);
    expect((await put({ interval_days: 30, purpose: '   ' })).status).toBe(400);
    expect((await put({ interval_days: 30, purpose: 'y'.repeat(2001) })).status).toBe(400);
  });

  it('GET/DELETE/complete 404 when no schedule exists', async () => {
    expect((await request(app).get(url())).status).toBe(404);
    expect((await request(app).delete(url())).status).toBe(404);
    expect((await request(app).post(`${url()}/complete`).send({})).status).toBe(404);
  });

  it('complete stamps last_run_at + summary and flips due off until the interval lapses', async () => {
    await put({ interval_days: 30, purpose: 'check things' });
    const c = await request(app).post(`${url()}/complete`).send({ summary: 'ran: 3 stale claims re-verified', run_id: 'run-1' });
    expect(c.status).toBe(200);
    expect(c.body.due).toBe(false);
    expect(c.body.last_run_summary).toBe('ran: 3 stale claims re-verified');
    expect(c.body.last_run_id).toBe('run-1');
    // Backdate past the interval → due again, derived, no daemon involved.
    await pool.query(
      "UPDATE graph_refreshes SET last_run_at = NOW() - interval '31 days' WHERE graph_id = $1", [gid]);
    const g = await request(app).get(url());
    expect(g.body.due).toBe(true);
  });

  it('dismiss silences the cycle honestly — clock moves, but the record says no refresh ran', async () => {
    await put({ interval_days: 30, purpose: 'check things' });
    const d = await request(app).post(`${url()}/dismiss`).send({});
    expect(d.status).toBe(200);
    expect(d.body.due).toBe(false);
    expect(d.body.last_run_kind).toBe('dismissed');
    expect(d.body.last_run_summary).toContain('no refresh ran');
    expect(d.body.last_run_id).toBeNull();
    // A real run afterwards overwrites the kind — the two states never blur.
    const c = await request(app).post(`${url()}/complete`).send({ summary: 'actually ran' });
    expect(c.body.last_run_kind).toBe('run');
    // And dismissal honors the same interval: backdate past it → due again.
    await pool.query(
      "UPDATE graph_refreshes SET last_run_at = NOW() - interval '31 days', last_run_kind = 'dismissed' WHERE graph_id = $1", [gid]);
    const g = await request(app).get(url());
    expect(g.body.due).toBe(true);
  });

  it('dismiss 404s when no schedule exists', async () => {
    expect((await request(app).post(`${url()}/dismiss`).send({})).status).toBe(404);
  });

  it('a schedule write never masquerades as a graph edit (no version/updated_at bump)', async () => {
    const before = await pool.query('SELECT version, updated_at FROM graphs WHERE id = $1', [gid]);
    await put({ interval_days: 30, purpose: 'isolation check' });
    await request(app).post(`${url()}/complete`).send({ summary: 's' });
    await request(app).delete(url());
    const after = await pool.query('SELECT version, updated_at FROM graphs WHERE id = $1', [gid]);
    expect(after.rows[0].version).toBe(before.rows[0].version);
    expect(after.rows[0].updated_at).toEqual(before.rows[0].updated_at);
  });

  it('PUT on a missing graph 404s', async () => {
    const r = await request(app).put('/api/graphs/nope1234/refresh').send({ interval_days: 30, purpose: 'x' });
    expect(r.status).toBe(404);
  });
});

describe('cross-graph /api/refreshes scope', () => {
  it('lists owned + member schedules only; /due filters to due; anon gets []', async () => {
    const alice = await makeUser('alice');
    const bob = await makeUser('bob');
    const mkGraph = async (name, owner) => {
      const r = await pool.query(
        'INSERT INTO graphs (name, owner_user_id) VALUES ($1, $2) RETURNING id', [name, owner]);
      return r.rows[0].id;
    };
    const gOwned = await mkGraph('alice-owned', alice.id);
    const gMember = await mkGraph('bob-owned-alice-member', bob.id);
    const gForeign = await mkGraph('bob-private', bob.id);
    await pool.query(
      "INSERT INTO graph_members (graph_id, user_id, role) VALUES ($1, $2, 'editor')", [gMember, alice.id]);
    for (const g of [gOwned, gMember, gForeign]) {
      await pool.query(
        "INSERT INTO graph_refreshes (graph_id, interval_days, purpose) VALUES ($1, 30, 'p')", [g]);
    }
    // gMember ran recently → not due; gOwned never ran → due.
    await pool.query('UPDATE graph_refreshes SET last_run_at = NOW() WHERE graph_id = $1', [gMember]);

    const all = await request(app).get('/api/refreshes').set('X-Test-User-Id', 'alice');
    expect(all.body.map((r) => r.graph_id).sort()).toEqual([gOwned, gMember].sort());

    const due = await request(app).get('/api/refreshes/due').set('X-Test-User-Id', 'alice');
    expect(due.body.map((r) => r.graph_id)).toEqual([gOwned]);

    const anon = await request(app).get('/api/refreshes/due');
    expect(anon.status).toBe(200);
    expect(anon.body).toEqual([]);
  });
});
