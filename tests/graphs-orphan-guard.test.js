// Orphan guard on POST /api/graphs (see src/routes/graphs.js + auth-model.md).
//
// On an accounts-enabled instance, an unauthenticated create must NOT silently
// succeed as an owner-less graph — that graph never shows in the user's "My
// graphs" and is easy to lose. The guard forces the caller to either
// authenticate or explicitly opt in with `allow_anonymous: true`.
//
// This lives in its own file (not graphs.test.js) on purpose: it installs the
// header auth adapter for the whole file so authEnabled() is true throughout.
// Mixing that with graphs.test.js's anonymous-create CRUD tests would leak the
// adapter across tests. Vitest isolates module state per file, so this is safe.
import request from 'supertest';
import { TEST_URL, getTestPool } from './setup.js';
import { _setAdapterForTests } from '../src/auth/index.js';
import { makeHeaderAuthAdapter } from './__support__/test_auth.js';

let app;
let pool;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  // Header adapter → provider 'test-header' → authEnabled() === true.
  _setAdapterForTests(makeHeaderAuthAdapter());
});

describe('POST /api/graphs — orphan guard (accounts enabled)', () => {
  it('refuses a silent anonymous create (401 with a teaching hint)', async () => {
    const res = await request(app).post('/api/graphs').send({ name: 'would-be orphan' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no owner/i);
    expect(res.body.hint).toMatch(/allow_anonymous/);
    expect(res.body.hint).toMatch(/Bearer/);
  });

  it('allows an INTENTIONAL anonymous create via allow_anonymous:true (201, owner null)', async () => {
    const res = await request(app)
      .post('/api/graphs')
      .send({ name: 'intentional anon', allow_anonymous: true });
    expect(res.status).toBe(201);
    expect(res.body.owner_user_id).toBeNull();
  });

  it('ignores allow_anonymous when authenticated — still creates an OWNED graph', async () => {
    // Even with the flag present, an authenticated request must land owned.
    const res = await request(app)
      .post('/api/graphs')
      .set('X-Test-User-Id', 'guard-session-user')
      .send({ name: 'owned via session', allow_anonymous: true });
    expect(res.status).toBe(201);
    expect(res.body.owner_user_id).not.toBeNull();
  });

  it('creates an OWNED graph when authenticated via agent token (no flag needed)', async () => {
    const u = await pool.query(
      `INSERT INTO users (provider, provider_user_id, email)
       VALUES ('test-header', 'guard-token-user', 'guard-token-user@test.local')
       RETURNING *`,
    );
    const userId = u.rows[0].id;
    // Dynamic import: agent_tokens.js pulls in db.js, which must not be loaded
    // before beforeAll bound DATABASE_URL. (See access.test.js's warning.)
    const { createToken } = await import('../src/auth/agent_tokens.js');
    const { token } = await createToken(userId, 'guard-test');

    const res = await request(app)
      .post('/api/graphs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'owned via token' });
    expect(res.status).toBe(201);
    expect(res.body.owner_user_id).toBe(userId);
  });
});
