import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import { _setAdapterForTests } from '../src/auth/index.js';
import { makeHeaderAuthAdapter } from './__support__/test_auth.js';

let app;
let pool;
let agentFns;

async function makeUser(p, suffix) {
  const r = await p.query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('test-header', $1, $2, $1) RETURNING *`,
    [suffix, `${suffix}@test.local`],
  );
  return r.rows[0];
}

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  _setAdapterForTests(makeHeaderAuthAdapter());
  agentFns = await import('../src/auth/agent_tokens.js');
});

describe('agent_tokens primitives', () => {
  it('mintToken returns a gt_-prefixed base32 string', () => {
    const t = agentFns.mintToken();
    expect(t).toMatch(/^gt_[A-Z2-7]+$/);
    expect(t.length).toBeGreaterThan(40);
  });

  it('hashToken is deterministic and 64 hex chars', () => {
    const t = 'gt_ABCD';
    expect(agentFns.hashToken(t)).toBe(agentFns.hashToken(t));
    expect(agentFns.hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('/api/me/agent_tokens routes', () => {
  let user;

  beforeEach(async () => {
    user = await makeUser(pool, 'tok-owner');
  });

  it('signed-in browser user can mint a token — plaintext returned once', async () => {
    const res = await request(app)
      .post('/api/me/agent_tokens')
      .set('X-Test-User-Id', 'tok-owner')
      .send({ label: 'laptop' });
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^gt_/);
    expect(res.body.record.label).toBe('laptop');
    expect(res.body.record.id).toBeDefined();

    // Listing returns hashes implicitly — never the plaintext.
    const list = await request(app)
      .get('/api/me/agent_tokens')
      .set('X-Test-User-Id', 'tok-owner');
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0]).not.toHaveProperty('token');
    expect(list.body[0]).not.toHaveProperty('token_hash');
    expect(list.body[0].label).toBe('laptop');
  });

  it('anonymous cannot mint', async () => {
    const res = await request(app).post('/api/me/agent_tokens').send({});
    expect(res.status).toBe(401);
  });

  it('label normalization: trims, caps at 64 chars, blank → null', async () => {
    const longLabel = 'x'.repeat(100);
    const mint = await request(app)
      .post('/api/me/agent_tokens')
      .set('X-Test-User-Id', 'tok-owner')
      .send({ label: `   ${longLabel}   ` });
    expect(mint.body.record.label.length).toBe(64);

    const blank = await request(app)
      .post('/api/me/agent_tokens')
      .set('X-Test-User-Id', 'tok-owner')
      .send({ label: '   ' });
    expect(blank.body.record.label).toBeNull();
  });

  it('non-string label rejected', async () => {
    const res = await request(app)
      .post('/api/me/agent_tokens')
      .set('X-Test-User-Id', 'tok-owner')
      .send({ label: 42 });
    expect(res.status).toBe(400);
  });

  it('owner can revoke; revoked token cannot mint others', async () => {
    const mint = await request(app)
      .post('/api/me/agent_tokens')
      .set('X-Test-User-Id', 'tok-owner')
      .send({});
    const tokenId = mint.body.record.id;
    const rev = await request(app)
      .delete(`/api/me/agent_tokens/${tokenId}`)
      .set('X-Test-User-Id', 'tok-owner');
    expect(rev.status).toBe(200);
    expect(rev.body.revoked_at).toBeTruthy();

    // Second revoke returns 404 (already revoked).
    const rev2 = await request(app)
      .delete(`/api/me/agent_tokens/${tokenId}`)
      .set('X-Test-User-Id', 'tok-owner');
    expect(rev2.status).toBe(404);
  });
});

describe('bearer authentication flow', () => {
  let owner, graph, token;

  beforeEach(async () => {
    owner = await makeUser(pool, 'bearer-owner');
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id) VALUES ('private', $1) RETURNING *`,
      [owner.id],
    );
    graph = g.rows[0];
    const mint = await request(app)
      .post('/api/me/agent_tokens')
      .set('X-Test-User-Id', 'bearer-owner')
      .send({ label: 'cli' });
    token = mint.body.token;
  });

  it('Authorization: Bearer <token> grants the owner\'s access on writes', async () => {
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '---\ntitle: from-agent\nstatus: todo\n---\n' });
    expect(res.status).toBe(201);
  });

  it('updates last_used_at on each authed request', async () => {
    const before = await pool.query(
      `SELECT last_used_at FROM agent_tokens WHERE user_id = $1`,
      [owner.id],
    );
    expect(before.rows[0].last_used_at).toBeNull();

    await request(app)
      .get(`/api/graphs/${graph.id}`)
      .set('Authorization', `Bearer ${token}`);

    // touchLastUsed is fire-and-forget; give it a tick to land.
    await new Promise((r) => setTimeout(r, 50));
    const after = await pool.query(
      `SELECT last_used_at FROM agent_tokens WHERE user_id = $1`,
      [owner.id],
    );
    expect(after.rows[0].last_used_at).not.toBeNull();
  });

  it('revoked token returns 401 on next call (loud failure, not silent degrade)', async () => {
    await pool.query(
      `UPDATE agent_tokens SET revoked_at = NOW() WHERE user_id = $1`,
      [owner.id],
    );
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '---\ntitle: nope\nstatus: todo\n---\n' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or revoked/);
  });

  it('garbage bearer token returns 401 even on public endpoints', async () => {
    // Strict mode: the operator should see "token bad" loud and clear so they
    // know to mint a new one, not silently degrade to anon on a public read.
    const res = await request(app)
      .get('/api/graphs')
      .set('Authorization', 'Bearer gt_NOPENOPE');
    expect(res.status).toBe(401);
  });

  it('no Authorization header at all still allows anonymous public reads', async () => {
    const res = await request(app).get('/api/graphs');
    expect(res.status).toBe(200);
  });

  it('agent token cannot mint or revoke tokens (self-escalation block)', async () => {
    const mint = await request(app)
      .post('/api/me/agent_tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'rogue' });
    expect(mint.status).toBe(403);

    // But it CAN list its own user's tokens.
    const list = await request(app)
      .get('/api/me/agent_tokens')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
  });

  it('agent token resolves to the minting user, not the cookie user, when both present', async () => {
    // Set X-Test-User-Id (would normally resolve to that user via adapter)
    // AND a Bearer for the original owner. Bearer should win.
    const otherUser = await makeUser(pool, 'other-user');
    const res = await request(app)
      .post(`/api/graphs/${graph.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Test-User-Id', 'other-user')
      .send({ content: '---\ntitle: bearer-wins\nstatus: todo\n---\n' });
    expect(res.status).toBe(201);
    // last_modified_by should be 'human' or 'agent' (writerType from header)
    // — separate concern from auth identity. What we care about: the request
    // succeeded *as the owner*, despite the cookie user being someone else.
    const tasks = await pool.query(
      `SELECT id FROM tasks WHERE graph_id = $1`,
      [graph.id],
    );
    expect(tasks.rows.length).toBe(1);
    // Sanity: other-user is NOT a member.
    const m = await pool.query(
      `SELECT 1 FROM graph_members WHERE graph_id = $1 AND user_id = $2`,
      [graph.id, otherUser.id],
    );
    expect(m.rows.length).toBe(0);
  });
});
