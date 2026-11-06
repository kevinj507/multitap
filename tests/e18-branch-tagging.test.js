// E18.5 — how an alternative is TAGGED, and the derivation that reads the tag.
//
// The tag is the only new vocabulary in the rung, and two things about it are
// load-bearing enough to have their own regressions here:
//
//   * edge meta is an ALLOWLIST — normalizeMeta() builds a FRESH object and
//     copies only the keys it knows, so a key it has not learned is dropped
//     SILENTLY with a 200. Ship the reader before the validator and the tagging
//     disappears with no error anywhere.
//   * A PARTIAL WRITE MUST NEVER SILENTLY CHANGE A FIELD IT DID NOT MENTION.
//     `meta.branch` is WHICH ROAD WAS TAKEN; an agent PATCHing an edge to fix a
//     colour must not be able to erase it. Both the /edges path and the /batch
//     path are asserted, because they hold two separate protected-key lists.
//
// src/branches.js is pure, so it is imported at module scope; everything that
// reaches src/db.js is imported inside beforeAll.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import {
  BRANCH_META_KEY,
  BRANCH_PURPOSE,
  ROLES,
  branchRoleOf,
  committedDecisionIds,
  dormantIds,
  normalizeBranch,
  optionsFromLinks,
} from '../src/branches.js';

let app;
let pool;
let gid;
let normalizeMeta;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  ({ normalizeMeta } = await import('../src/routes/edges.js'));
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-branch-tag') RETURNING id");
  gid = g.rows[0].id;
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

async function mkNode(title, extra = {}) {
  const res = await request(app)
    .post(`/api/graphs/${gid}/tasks`)
    .send({ content: node({ title, status: 'todo', ...extra }) });
  expect(res.status).toBe(201);
  return Number(res.body.id);
}

async function mkEdge(source, target, purpose, meta = undefined) {
  const res = await request(app)
    .post(`/api/graphs/${gid}/edges`)
    .send({ source_id: source, target_id: target, purpose, ...(meta ? { meta } : {}) });
  return res;
}

const link = (id, source, target, purpose, meta = {}) => ({ id, source, target, purpose, meta });
const option = (id, decision, node_, role) =>
  link(id, decision, node_, BRANCH_PURPOSE, { [BRANCH_META_KEY]: { role } });
const requires = (id, source, target) => link(id, source, target, 'required for');

// ── the tag, read off an edge set ───────────────────────────────────────────

describe('E18.5 the option tag', () => {
  it('reads a role only off a `related to` edge carrying meta.branch', () => {
    expect(branchRoleOf(option(1, 10, 11, 'chosen'))).toBe('chosen');
    expect(branchRoleOf(option(2, 10, 12, 'alternative'))).toBe('alternative');
    // Every other purpose is not an option edge, whatever meta it carries.
    for (const purpose of ['required for', 'supports', 'contradicts', 'supersedes']) {
      expect(branchRoleOf(link(3, 10, 13, purpose, { branch: { role: 'chosen' } }))).toBe(null);
    }
    expect(branchRoleOf(link(4, 10, 14, BRANCH_PURPOSE, {}))).toBe(null);
    expect(branchRoleOf(link(5, 10, 15, BRANCH_PURPOSE, { branch: 'chosen' }))).toBe(null);
    expect(branchRoleOf(link(6, 10, 16, BRANCH_PURPOSE, { branch: { role: 'maybe' } }))).toBe(null);
  });

  it('optionsFromLinks narrows to one decision and ignores everything else', () => {
    const links = [
      option(1, 10, 11, 'chosen'),
      option(2, 10, 12, 'alternative'),
      option(3, 20, 21, 'chosen'),
      requires(4, 11, 30),
      link(5, 10, 40, BRANCH_PURPOSE, {}),
    ];
    expect(optionsFromLinks(links, 10)).toEqual([
      { edge_id: 1, decision_id: 10, node_id: 11, role: 'chosen' },
      { edge_id: 2, decision_id: 10, node_id: 12, role: 'alternative' },
    ]);
    expect(optionsFromLinks(links).length).toBe(3);
  });

  it('rejects a role outside {chosen, alternative} — 400, never a coercion', () => {
    expect(ROLES).toEqual(['chosen', 'alternative']);
    expect(normalizeBranch({ role: 'chosen' })).toEqual({ value: { role: 'chosen' } });
    expect(normalizeBranch({ role: 'maybe' }).error).toBeTruthy();
    expect(normalizeBranch({ role: 'Chosen' }).error).toBeTruthy();
    expect(normalizeBranch('chosen').error).toBeTruthy();
    expect(normalizeBranch([{ role: 'chosen' }]).error).toBeTruthy();
    expect(normalizeBranch({ role: 'chosen', label: 'x' }).error).toBeTruthy();
  });
});

// ── the validator is the whole feature's front door ─────────────────────────

describe('E18.5 normalizeMeta learns branch', () => {
  it('copies a valid branch tag through and 400s a bad one', () => {
    expect(normalizeMeta({ branch: { role: 'alternative' } }).meta)
      .toEqual({ branch: { role: 'alternative' } });
    expect(normalizeMeta({ branch: { role: 'nope' } }).error).toBeTruthy();
    // The allowlist still holds for everything it has not learned.
    expect(normalizeMeta({ nonsense: 1 }).meta).toEqual({});
  });

  it('persists the tag through POST /edges — the silent-drop regression', async () => {
    const d = await mkNode('storage engine', { type: 'decision' });
    const a = await mkNode('Timescale');
    const res = await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'chosen' } });
    expect(res.status).toBe(201);
    expect(res.body.meta).toEqual({ branch: { role: 'chosen' } });
    const row = await pool.query('SELECT meta FROM edges WHERE id = $1', [res.body.id]);
    expect(row.rows[0].meta).toEqual({ branch: { role: 'chosen' } });
  });

  it('400s a bad role on POST /edges and writes nothing', async () => {
    const d = await mkNode('d', { type: 'decision' });
    const a = await mkNode('a');
    const res = await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'perhaps' } });
    expect(res.status).toBe(400);
    const rows = await pool.query('SELECT count(*)::int AS n FROM edges WHERE graph_id = $1', [gid]);
    expect(rows.rows[0].n).toBe(0);
  });

  it('the edge.added event carries the tag, so capture needs no trigger change', async () => {
    const d = await mkNode('d', { type: 'decision' });
    const a = await mkNode('a');
    const res = await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'alternative' } });
    const ev = await pool.query(
      `SELECT payload FROM events
        WHERE graph_id = $1 AND subject_kind = 'edge' AND subject_id = $2 AND kind = 'edge.added'`,
      [gid, res.body.id],
    );
    expect(ev.rows[0].payload.after.meta).toEqual({ branch: { role: 'alternative' } });
  });

  it('a role FLIP classifies as edge.patched — not a rewire and not a retype', async () => {
    const d = await mkNode('d', { type: 'decision' });
    const a = await mkNode('a');
    const made = await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'alternative' } });
    const patched = await request(app)
      .patch(`/api/graphs/${gid}/edges/${made.body.id}`)
      .send({ meta: { branch: { role: 'chosen' } } });
    expect(patched.status).toBe(200);
    expect(patched.body.meta.branch).toEqual({ role: 'chosen' });
    const ev = await pool.query(
      `SELECT kind, payload FROM events
        WHERE graph_id = $1 AND subject_kind = 'edge' AND subject_id = $2 AND kind <> 'edge.added'
        ORDER BY seq DESC LIMIT 1`,
      [gid, made.body.id],
    );
    expect(ev.rows[0].kind).toBe('edge.patched');
    expect(ev.rows[0].payload.changes['meta.branch'].to).toEqual({ role: 'chosen' });
  });
});

// ── the protected-key regression, both write paths ──────────────────────────

describe('E18.5 meta.branch survives a partial write that does not mention it', () => {
  it('/edges PATCH with only a colour keeps the tag', async () => {
    const d = await mkNode('d', { type: 'decision' });
    const a = await mkNode('a');
    const made = await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'chosen' } });
    const res = await request(app)
      .patch(`/api/graphs/${gid}/edges/${made.body.id}`)
      .send({ meta: { color: '#ff0000' } });
    expect(res.status).toBe(200);
    expect(res.body.meta.branch).toEqual({ role: 'chosen' });
    expect(res.body.meta.color).toBe('#ff0000');
  });

  // NOTE, measured by reverting the list entry: on the /edges path the guard is
  // belt-and-braces rather than the load-bearing rule. `writerMeta` is built as
  // `{...base.meta, ...normalized}`, so the writer's side of the merge ALWAYS
  // carries whatever the base row had and the key can only leave by an explicit
  // null. It is on the list anyway because batch.js's own comment requires the
  // two lists to match — and /batch is where the removal IS reachable (below).
  it('/edges PATCH from a STALE base_row that never saw the tag keeps it', async () => {
    const d = await mkNode('d', { type: 'decision' });
    const a = await mkNode('a');
    const made = await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'chosen' } });
    const base = { ...made.body, meta: {} };
    // Force the three-way merge: a concurrent write bumps the version so
    // base_version no longer matches, which is the branch protectedFromAgentRemoval
    // guards.
    await request(app).patch(`/api/graphs/${gid}/edges/${made.body.id}`)
      .send({ meta: { color: '#00ff00' } });
    const res = await request(app)
      .patch(`/api/graphs/${gid}/edges/${made.body.id}`)
      .set('X-Writer-Type', 'agent')
      .send({ base_row: base, base_version: made.body.version, meta: { curve: 20 } });
    expect(res.status).toBe(200);
    expect(res.body.meta.branch).toEqual({ role: 'chosen' });
  });

  it('/batch re-running an edge with no meta at all keeps the tag', async () => {
    const seed = await request(app).post(`/api/graphs/${gid}/batch`).send({
      nodes: [
        { external_id: 'd', content: node({ title: 'decision', type: 'decision', status: 'todo' }) },
        { external_id: 'a', content: node({ title: 'option a', status: 'todo' }) },
      ],
      edges: [{ source: 'd', target: 'a', purpose: BRANCH_PURPOSE, meta: { branch: { role: 'chosen' } } }],
    });
    expect(seed.status).toBe(200);
    expect(seed.body.edges[0].meta).toEqual({ branch: { role: 'chosen' } });

    // The ordinary agent re-run: {source, target, purpose} and no meta.
    const again = await request(app).post(`/api/graphs/${gid}/batch`)
      .set('X-Writer-Type', 'agent')
      .send({ edges: [{ source: 'd', target: 'a', purpose: BRANCH_PURPOSE }] });
    expect(again.status).toBe(200);
    expect(again.body.edges[0].meta).toEqual({ branch: { role: 'chosen' } });
  });

  it('an explicit null still clears the tag — protection is not a prison', async () => {
    const d = await mkNode('d', { type: 'decision' });
    const a = await mkNode('a');
    const made = await mkEdge(d, a, BRANCH_PURPOSE, { branch: { role: 'chosen' } });
    const res = await request(app)
      .patch(`/api/graphs/${gid}/edges/${made.body.id}`)
      .send({ meta: { branch: null } });
    expect(res.status).toBe(200);
    expect(res.body.meta.branch).toBeUndefined();
  });
});

// ── dormancy, derived ───────────────────────────────────────────────────────

describe('E18.5 dormantIds', () => {
  // D --related to--> A (chosen), D --related to--> B (alternative)
  // shared --required for--> A and B        (upstream: never dormant)
  // A --required for--> workA
  // B --required for--> workB --required for--> deepB
  // B --required for--> both  <-- also fed by A: CONTESTED, stays live
  const D = 1, A = 2, B = 3, SHARED = 4, WORK_A = 5, WORK_B = 6, DEEP_B = 7, BOTH = 8;
  const links = [
    option(101, D, A, 'chosen'),
    option(102, D, B, 'alternative'),
    requires(103, SHARED, A),
    requires(104, SHARED, B),
    requires(105, A, WORK_A),
    requires(106, B, WORK_B),
    requires(107, WORK_B, DEEP_B),
    requires(108, B, BOTH),
    requires(109, A, BOTH),
  ];
  const committed = new Set([D]);

  it('marks the un-chosen option and its exclusive subtree dormant', () => {
    const { dormant } = dormantIds(links, committed);
    expect([...dormant].sort((a, b) => a - b)).toEqual([B, WORK_B, DEEP_B]);
  });

  it('leaves SHARED SUBSTRATE live — it fans IN, so it is in no forward closure', () => {
    const { dormant } = dormantIds(links, committed);
    expect(dormant.has(SHARED)).toBe(false);
    // ...and the whole chosen branch is live too.
    expect(dormant.has(A)).toBe(false);
    expect(dormant.has(WORK_A)).toBe(false);
  });

  it('a CONTESTED node — reachable from both roads — stays live and is named', () => {
    const { dormant, contested } = dormantIds(links, committed);
    expect(dormant.has(BOTH)).toBe(false);
    expect([...contested]).toEqual([BOTH]);
  });

  it('a REOPENED decision makes its whole subtree live again', () => {
    // Same edge set; the decision is simply no longer committed.
    const { dormant, contested } = dormantIds(links, new Set());
    expect(dormant.size).toBe(0);
    expect(contested.size).toBe(0);
  });

  it('committedDecisionIds reads meta.decided_at, the same scalar the classifier does', () => {
    const nodes = [
      { id: D, meta: { decided_at: '2026-03-01T00:00:00Z' } },
      { id: 9, meta: { decided_at: null } },
      { id: 10, meta: {} },
      { id: 11, meta: { decided_at: '' } },
    ];
    expect([...committedDecisionIds(nodes)]).toEqual([D]);
  });

  it('an option under an UNCOMMITTED decision is not dormant', () => {
    const { dormant } = dormantIds(links, new Set([999]));
    expect(dormant.size).toBe(0);
  });
});
