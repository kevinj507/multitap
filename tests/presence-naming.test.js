// Integration: the agent avatar name is derived server-side from the token
// owner (the operator), not the client-sent X-Writer-Name (which is seeded
// from the repo's git author and is wrong on shared repos). Humans pass
// through unchanged. Runs the real verifyAuth → requireGraph → presence.touch
// chain via the test-header auth adapter.
import request from 'supertest';
import { TEST_URL } from './setup.js';
import { _setAdapterForTests } from '../src/auth/index.js';

let app;

// Local adapter that, like real Clerk dev accounts here, sets an email but
// NO display name — so naming exercises the email-local-part path.
function emailOnlyAdapter() {
  return {
    provider: 'test-header',
    middlewares: () => [],
    verify: async (req) => {
      const pid = req.headers['x-test-user-id'];
      if (!pid) return null;
      return { providerUserId: pid, email: `${pid}@test.local`, displayName: null };
    },
    publishableKey: () => null,
  };
}

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  _setAdapterForTests(emailOnlyAdapter());
});

async function makeGraph(userId, anonRole) {
  const res = await request(app)
    .post('/api/graphs')
    .set('X-Test-User-Id', userId)
    .send({ name: 'naming test' });
  const gid = res.body.id;
  if (anonRole) {
    await request(app).patch(`/api/graphs/${gid}`).set('X-Test-User-Id', userId).send({ anon_role: anonRole });
  }
  return gid;
}

async function presenceFor(gid, writerId) {
  const res = await request(app).get(`/api/graphs/${gid}/presence`);
  return res.body.find((w) => w.id === writerId);
}

describe('agent presence naming from token owner', () => {
  it('overrides a misleading client name with "<operator>\'s Claude"', async () => {
    const gid = await makeGraph('alice');
    await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .set('X-Test-User-Id', 'alice')         // operator = alice@test.local
      .set('X-Writer-Type', 'agent')
      .set('X-Writer-Id', 'agent-alice')
      .set('X-Writer-Name', "Repo Author's Claude") // misleading git-author name
      .send({ content: '---\ntitle: t\nstatus: todo\n---\nbody' })
      .expect(201);

    const w = await presenceFor(gid, 'agent-alice');
    expect(w).toBeTruthy();
    expect(w.type).toBe('agent');
    expect(w.name).toBe("Alice's Claude");
    expect(w.owner_user_id).toBeTruthy();
  });

  it('keeps the client-supplied agent label (harness-agnostic)', async () => {
    const gid = await makeGraph('bob');
    await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .set('X-Test-User-Id', 'bob')
      .set('X-Writer-Type', 'agent')
      .set('X-Writer-Id', 'agent-bob')
      .set('X-Writer-Name', "Whoever's Codex")
      .send({ content: '---\ntitle: t\nstatus: todo\n---\nbody' })
      .expect(201);

    const w = await presenceFor(gid, 'agent-bob');
    expect(w.name).toBe("Bob's Codex");
  });

  it('passes a human writer through unchanged (browser owns its identity)', async () => {
    const gid = await makeGraph('carol');
    await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .set('X-Test-User-Id', 'carol')
      .set('X-Writer-Type', 'human')
      .set('X-Writer-Id', 'human-carol')
      .set('X-Writer-Name', 'My Chosen Name')   // rename-modal / Clerk name
      .send({ content: '---\ntitle: t\nstatus: todo\n---\nbody' })
      .expect(201);

    const w = await presenceFor(gid, 'human-carol');
    expect(w.type).toBe('human');
    expect(w.name).toBe('My Chosen Name');
  });

  it('falls back to the client name for an anonymous agent (no-auth/anon)', async () => {
    const gid = await makeGraph('dave', 'editor'); // allow anon writes
    await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      // no X-Test-User-Id → anonymous
      .set('X-Writer-Type', 'agent')
      .set('X-Writer-Id', 'agent-anon')
      .set('X-Writer-Name', "Quiet Otter's Claude")
      .send({ content: '---\ntitle: t\nstatus: todo\n---\nbody' })
      .expect(201);

    const w = await presenceFor(gid, 'agent-anon');
    expect(w.name).toBe("Quiet Otter's Claude");
  });
});
