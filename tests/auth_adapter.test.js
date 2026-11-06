import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import { getAdapter, _resetAdapterCacheForTests } from '../src/auth/index.js';

let app;
let pool;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  // Tests run under AUTH_PROVIDER=none (the default). The clerk adapter has
  // its own test that exercises selection by stashing the env var, importing,
  // and restoring.
  delete process.env.AUTH_PROVIDER;
  _resetAdapterCacheForTests();
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
});

describe('auth adapter (none)', () => {
  it('getAdapter() returns the none adapter when AUTH_PROVIDER is unset', async () => {
    const adapter = await getAdapter();
    expect(adapter.provider).toBe('none');
    expect(adapter.middlewares()).toEqual([]);
    expect(await adapter.verify({})).toBeNull();
    expect(adapter.publishableKey()).toBeUndefined();
  });

  it('GET /api/config reports auth disabled', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      auth_enabled: false,
      provider: 'none',
      publishable_key: null,
      viewer_user_id: null,
    });
  });

  it('verifyAuth leaves req.user null and does not insert into users', async () => {
    // Any unauthenticated request to a real route should round-trip without
    // creating a users row.
    const before = await pool.query('SELECT count(*)::int AS n FROM users');
    await request(app).get('/api/graphs');
    const after = await pool.query('SELECT count(*)::int AS n FROM users');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});

describe('auth adapter (selector)', () => {
  it('throws on an unknown AUTH_PROVIDER value', async () => {
    const prev = process.env.AUTH_PROVIDER;
    process.env.AUTH_PROVIDER = 'nope';
    _resetAdapterCacheForTests();
    try {
      await expect(getAdapter()).rejects.toThrow(/unknown AUTH_PROVIDER/);
    } finally {
      if (prev === undefined) delete process.env.AUTH_PROVIDER;
      else process.env.AUTH_PROVIDER = prev;
      _resetAdapterCacheForTests();
      // Restore the cached `none` adapter so subsequent describe blocks (and
      // other test files in this same vitest run) don't observe the throw.
      await getAdapter();
    }
  });
});

describe('users schema', () => {
  it('users table exists with the expected columns', async () => {
    const res = await pool.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position`,
    );
    const cols = Object.fromEntries(res.rows.map((r) => [r.column_name, r]));
    expect(cols.id.data_type).toBe('uuid');
    expect(cols.provider.is_nullable).toBe('NO');
    expect(cols.provider_user_id.is_nullable).toBe('NO');
    expect(cols.email).toBeDefined();
    expect(cols.display_name).toBeDefined();
    expect(cols.created_at).toBeDefined();
  });

  it('graphs.owner_user_id exists and is nullable', async () => {
    const res = await pool.query(
      `SELECT is_nullable, data_type
         FROM information_schema.columns
        WHERE table_name = 'graphs' AND column_name = 'owner_user_id'`,
    );
    expect(res.rows[0].is_nullable).toBe('YES');
    expect(res.rows[0].data_type).toBe('uuid');
  });

  it('deleting a user nulls owner_user_id (ON DELETE SET NULL)', async () => {
    const u = await pool.query(
      `INSERT INTO users (provider, provider_user_id, email)
       VALUES ('test', 'u1', 'u1@example.com') RETURNING id`,
    );
    const g = await pool.query(
      `INSERT INTO graphs (name, owner_user_id) VALUES ('owned', $1) RETURNING id`,
      [u.rows[0].id],
    );
    await pool.query('DELETE FROM users WHERE id = $1', [u.rows[0].id]);
    const after = await pool.query('SELECT owner_user_id FROM graphs WHERE id = $1', [
      g.rows[0].id,
    ]);
    expect(after.rows[0].owner_user_id).toBeNull();
  });
});
