// Adversarial cross-tier no-leak test for the cross-graph report rail
// (GET /api/reports, shipped in E16.5) — E16.13. The rail is scoped to the
// OWNED + MEMBER set — exactly GET /api/graphs and cross-graph search — NOT a
// broader read-based set. So a PUBLIC graph (anon_role=viewer) a viewer can
// read by URL but is NOT a member of must NEVER appear in that viewer's rail,
// and none of its report id / title / graph_name may leak into the payload.
// Anonymous callers get [] with 200 (never 401/500). Mirrors the leak-test
// strength of tests/e15-leak.test.js and the fixture style of
// tests/reports-all.test.js.
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import { _setAdapterForTests } from '../src/auth/index.js';
import { makeHeaderAuthAdapter } from './__support__/test_auth.js';

let app;
let pool;

async function makeUser(suffix) {
  const r = await pool.query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ('test-header', $1, $2, $1) RETURNING *`,
    [suffix, `${suffix}@test.local`],
  );
  return r.rows[0];
}

async function makeGraph(name, ownerId, anonRole = 'none') {
  const r = await pool.query(
    `INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ($1, $2, $3) RETURNING *`,
    [name, ownerId, anonRole],
  );
  return r.rows[0];
}

async function addMember(gid, userId, role) {
  await pool.query(
    `INSERT INTO graph_members (graph_id, user_id, role) VALUES ($1, $2, $3)`,
    [gid, userId, role],
  );
}

async function seedReport(gid, opts = {}) {
  const { title = `Report ${gid}`, description = null, body = 'report body text', updatedAt = null } = opts;
  const r = await pool.query(
    `INSERT INTO reports (graph_id, title, description, body, updated_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW())) RETURNING *`,
    [gid, title, description, body, updatedAt],
  );
  return r.rows[0];
}

function listAs(userProviderId) {
  const req = request(app).get('/api/reports');
  return userProviderId ? req.set('X-Test-User-Id', userProviderId) : req;
}

// Prove a graph's report is genuinely readable BY URL for the given caller —
// so its absence from the rail is a scope decision, not inaccessibility.
function readReportByUrl(gid, userProviderId) {
  const req = request(app).get(`/api/graphs/${gid}/report`);
  return userProviderId ? req.set('X-Test-User-Id', userProviderId) : req;
}

// STRONG no-leak assertion (in the spirit of e15-leak): a forbidden graph's
// report must not surface as a rail row, and NONE of its graph_id, report
// title, graph_name, or report body may appear ANYWHERE in the serialized
// payload — regardless of the row shape the endpoint returns.
function expectNoLeak(res, graph, report) {
  const ids = res.body.map((row) => row.graph_id);
  expect(ids).not.toContain(graph.id);
  const s = JSON.stringify(res.body);
  // Delimited token so a short-id/name substring can't create a false pass/fail.
  expect(s).not.toContain(`"graph_id":${JSON.stringify(graph.id)}`);
  expect(s).not.toContain(graph.id);
  expect(s).not.toContain(report.title);
  expect(s).not.toContain(graph.name);
  if (report.body) expect(s).not.toContain(report.body);
}

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
  _setAdapterForTests(makeHeaderAuthAdapter());
});

describe('GET /api/reports — adversarial cross-tier no-leak (E16.13)', () => {
  let owner, boss, editorUser, viewerUser, nonMember;
  let gPublic, gTeam;
  let rPublic, rTeam;

  beforeEach(async () => {
    // Distinct prefixes so a shared Date.now() can't collide provider ids.
    const t = Date.now();
    owner = await makeUser(`rl-owner-${t}`);
    boss = await makeUser(`rl-boss-${t}`);
    editorUser = await makeUser(`rl-editor-${t}`);
    viewerUser = await makeUser(`rl-viewer-${t}`);
    nonMember = await makeUser(`rl-nonmember-${t}`);

    // A PUBLIC graph (anon_role=viewer): readable by URL by anyone, but only
    // `owner` owns it and NO ONE is a member. It is the adversarial fixture —
    // a graph other tiers can READ yet must never see advertised in their rail.
    gPublic = await makeGraph('pub-rail-graph', owner.id, 'viewer');
    // A private (anon_role=none) graph owned by `boss`, shared with an editor
    // member and a viewer member — the only graph those members may see.
    gTeam = await makeGraph('team-rail-graph', boss.id, 'none');
    await addMember(gTeam.id, editorUser.id, 'editor');
    await addMember(gTeam.id, viewerUser.id, 'viewer');

    rPublic = await seedReport(gPublic.id, {
      title: 'PublicRailSecretReport',
      body: 'public-report-body-must-never-leak',
    });
    rTeam = await seedReport(gTeam.id, {
      title: 'TeamRailSecretReport',
      body: 'team-report-body-must-never-leak',
    });
  });

  it('owner sees ONLY their own graph report; another owner’s report never leaks', async () => {
    const res = await listAs(owner.provider_user_id);
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.graph_id);
    // Owner owns gPublic; owner is NOT a member of boss’s gTeam.
    expect(ids).toEqual([gPublic.id]);
    expectNoLeak(res, gTeam, rTeam);
  });

  it('the other owner sees ONLY their graph; the public graph they don’t own never leaks', async () => {
    // boss owns gTeam and is not a member of gPublic — symmetric owner isolation.
    const res = await listAs(boss.provider_user_id);
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.graph_id);
    expect(ids).toEqual([gTeam.id]);
    expectNoLeak(res, gPublic, rPublic);
  });

  it('an editor member sees the shared report but NOT a public graph they only read', async () => {
    // Prove gPublic’s report IS readable by URL for this editor...
    const readable = await readReportByUrl(gPublic.id, editorUser.provider_user_id);
    expect(readable.status).toBe(200);
    expect(readable.body.title).toBe('PublicRailSecretReport');

    // ...yet the rail is owned+member, not read-based, so it lists only gTeam.
    const res = await listAs(editorUser.provider_user_id);
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.graph_id);
    expect(ids).toEqual([gTeam.id]);
    expectNoLeak(res, gPublic, rPublic);
  });

  it('a viewer member sees the shared report but NOT a public graph they only read', async () => {
    const readable = await readReportByUrl(gPublic.id, viewerUser.provider_user_id);
    expect(readable.status).toBe(200);
    expect(readable.body.title).toBe('PublicRailSecretReport');

    const res = await listAs(viewerUser.provider_user_id);
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.graph_id);
    expect(ids).toEqual([gTeam.id]);
    expectNoLeak(res, gPublic, rPublic);
  });

  it('a signed-in NON-member sees NOTHING — a public graph they can read is still not in their rail', async () => {
    // The non-member can genuinely read the public graph’s report by URL...
    const readable = await readReportByUrl(gPublic.id, nonMember.provider_user_id);
    expect(readable.status).toBe(200);
    expect(readable.body.title).toBe('PublicRailSecretReport');

    // ...but the rail is owned+member, not read-based, so it stays empty and
    // leaks nothing about EITHER the public graph or the private team graph.
    const res = await listAs(nonMember.provider_user_id);
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(500);
    expect(res.body).toEqual([]);
    expectNoLeak(res, gPublic, rPublic);
    expectNoLeak(res, gTeam, rTeam);
  });

  it('an anonymous / no-auth caller gets [] with 200 (never 401/500), even though a public graph exists', async () => {
    // Anonymous can read the public graph’s report by URL...
    const readable = await readReportByUrl(gPublic.id, null);
    expect(readable.status).toBe(200);
    expect(readable.body.title).toBe('PublicRailSecretReport');

    // ...but the rail advertises nothing to a caller who owns/joins nothing.
    const res = await listAs(null);
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(500);
    expect(res.body).toEqual([]);
    expectNoLeak(res, gPublic, rPublic);
    expectNoLeak(res, gTeam, rTeam);
  });

  it('returns metadata only — no row carries a body field, and no report body text leaks', async () => {
    // A member’s rail has a real row for gTeam; assert the shape is metadata.
    const res = await listAs(editorUser.provider_user_id);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const row of res.body) {
      expect(row).toHaveProperty('graph_id');
      expect(row).toHaveProperty('title');
      expect(row).toHaveProperty('graph_name');
      expect(row).not.toHaveProperty('body');
    }
    // Even the ALLOWED report’s body text is absent — the rail is metadata-only.
    expect(JSON.stringify(res.body)).not.toContain('team-report-body-must-never-leak');
  });
});
