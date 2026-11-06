// E18.1 — the append primitive (src/events/context.js) and the pure event
// vocabulary (src/events/kinds.js).
//
// Capture lives in the database; what this layer owns is IDENTITY and INTENT —
// the facts a row trigger cannot see. The tests below pin the three properties
// the rest of E18 leans on:
//
//   * `eventQuery` is a DROP-IN for `pool.query`: same signature, same resolved
//     Result, and the SAME ERROR OBJECT, rethrown only AFTER the ROLLBACK, so
//     the existing `e.code === '23503'` handling at src/routes/tasks.js:49 keeps
//     working when STEP 2 swaps the call sites over;
//   * the actor never leaks. Every set_config is `is_local = true`, so a
//     recycled pooled connection cannot stamp the previous request's writer
//     onto the next one's rows — and the write still succeeds, attributed to
//     'system', rather than failing;
//   * the JS classifiers mirror `gt_classify_node` / `gt_classify_edge` exactly.
//     (STEP 4 proves the mirror against the database; these are the unit cases
//     that say what the mirror is supposed to reflect.)
import pg from 'pg';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import {
  EVENT_KINDS,
  classifyEdge,
  classifyNode,
  headline,
  isDecayEligible,
} from '../src/events/kinds.js';

let pool;
let ctxmod;
let gid;

// A pool of exactly one connection: the only way to make "the second request
// on the SAME pooled connection" deterministic rather than a 1-in-max coin flip.
let solo;

beforeAll(async () => {
  // MUST precede the import: src/db.js reads DATABASE_URL once, at first import.
  process.env.DATABASE_URL = TEST_URL;
  ctxmod = await import('../src/events/context.js');
  pool = getTestPool();
  solo = new pg.Pool({ connectionString: TEST_URL, max: 1 });
});

afterAll(async () => {
  if (solo) await solo.end();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18') RETURNING id");
  gid = g.rows[0].id;
});

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const INSERT_TASK = `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3) RETURNING *`;
const taskArgs = (title, graphId = gid) => {
  const m = { title, status: 'todo' };
  return [graphId, node(m), JSON.stringify(m)];
};

// A request shaped the way the middleware chain leaves it (src/writerType.js,
// src/auth/middleware.js). No express, no supertest — this layer is a pure
// function of `req`.
const makeReq = (o = {}) => ({
  headers: o.headers ?? {},
  body: o.body,
  writerType: o.writerType ?? 'human',
  writer: o.writer ?? { id: null, name: null, type: o.writerType ?? 'human' },
  user: o.user ?? null,
  viaAgentToken: o.viaAgentToken ?? false,
});

const eventsOf = async () =>
  (
    await pool.query(
      'SELECT seq, kind, actor, subject_kind, subject_id, cause_id, request_id, happened_at,'
        + ' learned_at, payload FROM events WHERE graph_id = $1 ORDER BY seq',
      [gid],
    )
  ).rows;

// ── validators ──────────────────────────────────────────────────────────────

describe('E18.1 parseHappenedAt', () => {
  it('accepts an ISO-8601 datetime in the past and normalises it', () => {
    expect(ctxmod.parseHappenedAt('2020-05-05T01:02:03Z')).toEqual({
      value: '2020-05-05T01:02:03.000Z',
    });
    expect(ctxmod.parseHappenedAt('2020-05-05')).toEqual({
      value: '2020-05-05T00:00:00.000Z',
    });
  });

  it('treats absent/empty as "no opinion", not as an error', () => {
    for (const v of [undefined, null, '']) {
      expect(ctxmod.parseHappenedAt(v)).toEqual({ value: null });
    }
  });

  it('rejects free text, bare numbers and the far future with one fixed message', () => {
    const far = new Date(Date.now() + 40 * 60 * 60 * 1000).toISOString();
    for (const v of ['tomorrow', 'not-a-date', '1717000000', '2026-13-45', far, 42, {}]) {
      expect(ctxmod.parseHappenedAt(v)).toEqual({ error: ctxmod.HAPPENED_AT_ERROR });
    }
  });

  it('floors at the epoch, matching the events_happened_at_sane CHECK', () => {
    // Anything this accepts must be insertable: a value that passed here and
    // then tripped a CHECK would abort the user's write mid-transaction.
    expect(ctxmod.parseHappenedAt('1969-07-20T20:17:00Z')).toEqual({
      error: ctxmod.HAPPENED_AT_ERROR,
    });
    expect(ctxmod.parseHappenedAt('1970-01-02T00:00:00Z').value).toBe('1970-01-02T00:00:00.000Z');
  });
});

describe('E18.1 parseCauseId', () => {
  it('accepts a positive integer from a string or a number', () => {
    expect(ctxmod.parseCauseId('8')).toEqual({ value: 8 });
    expect(ctxmod.parseCauseId(8)).toEqual({ value: 8 });
  });

  it('treats absent/empty as null', () => {
    for (const v of [undefined, null, '']) expect(ctxmod.parseCauseId(v)).toEqual({ value: null });
  });

  it('rejects zero, negatives, fractions and junk', () => {
    for (const v of [0, -1, 1.5, 'eight', true, {}]) {
      expect(ctxmod.parseCauseId(v)).toEqual({ error: ctxmod.CAUSE_ID_ERROR });
    }
  });
});

// ── context derivation ──────────────────────────────────────────────────────

describe('E18.1 eventContextFromRequest', () => {
  it('names an agent from the token owner, not the client-sent header', () => {
    const req = makeReq({
      writerType: 'agent',
      writer: { id: 'w1', name: "Someone Else's Codex", type: 'agent' },
      user: { id: 'u-1', display_name: 'Kevin', email: 'kevin@example.com' },
      viaAgentToken: true,
    });
    const ctx = ctxmod.eventContextFromRequest(req);
    expect(ctx.actor_type).toBe('agent');
    expect(ctx.actor_via).toBe('agent_token');
    expect(ctx.actor_id).toBe('w1');
    expect(ctx.actor_user_id).toBe('u-1');
    expect(ctx.actor_name).toBe("Kevin's Codex");
  });

  it('treats a bearer agent token as an agent even without X-Writer-Type', () => {
    const ctx = ctxmod.eventContextFromRequest(
      makeReq({ user: { id: 'u-1', email: 'k@x.test' }, viaAgentToken: true }),
    );
    expect(ctx.actor_type).toBe('agent');
  });

  it('records an anonymous caller as a human with no user_id and no via', () => {
    const ctx = ctxmod.eventContextFromRequest(makeReq());
    expect(ctx.actor_type).toBe('human');
    expect(ctx.actor_user_id).toBeNull();
    expect(ctx.actor_via).toBeNull();
    expect(ctx.actor_name).toBeNull();
  });

  it('gives one HTTP request exactly one request_id, memoised on req', () => {
    const req = makeReq();
    const a = ctxmod.eventContextFromRequest(req).request_id;
    const b = ctxmod.eventContextFromRequest(req).request_id;
    expect(a).toBe(b);
    expect(a).toBeTruthy();
    expect(ctxmod.eventContextFromRequest(makeReq()).request_id).not.toBe(a);
  });

  it('reads happened_at from the body or the X-Happened-At header', () => {
    expect(
      ctxmod.eventContextFromRequest(makeReq({ body: { happened_at: '2020-05-05T00:00:00Z' } }))
        .happened_at,
    ).toBe('2020-05-05T00:00:00.000Z');
    expect(
      ctxmod.eventContextFromRequest(
        makeReq({ headers: { [ctxmod.HAPPENED_AT_HEADER]: '2021-06-06T00:00:00Z' } }),
      ).happened_at,
    ).toBe('2021-06-06T00:00:00.000Z');
  });

  it('reports a malformed happened_at instead of throwing (a throw would be a 500)', () => {
    // The app has no custom express error handler, so routes must 400 on
    // ctx.error / parseHappenedAt themselves before writing anything.
    const ctx = ctxmod.eventContextFromRequest(makeReq({ body: { happened_at: 'yesterday' } }));
    expect(ctx.error).toBe(ctxmod.HAPPENED_AT_ERROR);
    expect(ctx.happened_at).toBeNull();
  });

  it('lets overrides win on every key', () => {
    const ctx = ctxmod.eventContextFromRequest(makeReq({ writerType: 'agent' }), {
      actor_type: 'system',
      actor_name: 'snapshotter',
      reason: 'claim',
      intent: 'claim.verified',
      request_id: 'req-fixed',
      happened_at: '2020-01-01T00:00:00Z',
      cause_id: 8,
    });
    expect(ctx).toMatchObject({
      actor_type: 'system',
      actor_name: 'snapshotter',
      reason: 'claim',
      intent: 'claim.verified',
      request_id: 'req-fixed',
      happened_at: '2020-01-01T00:00:00.000Z',
      cause_id: 8,
    });
  });
});

// ── the primitives against a live database ──────────────────────────────────

describe('E18.1 eventQuery', () => {
  it('is a drop-in for pool.query: same shape in, same Result out', async () => {
    const req = makeReq({
      writerType: 'agent',
      writer: { id: 'w1', name: 'Claude', type: 'agent' },
      user: { id: null, display_name: null, email: null },
    });
    const res = await ctxmod.eventQuery(req, INSERT_TASK, taskArgs('A'));
    expect(res.rowCount).toBe(1);
    expect(res.command).toBe('INSERT');
    expect(res.rows[0].meta.title).toBe('A');

    const direct = await pool.query('SELECT * FROM tasks WHERE id = $1', [res.rows[0].id]);
    expect(direct.rows[0].content).toBe(res.rows[0].content);
  });

  it('stamps the actor onto the event the trigger writes', async () => {
    const req = makeReq({
      writerType: 'agent',
      writer: { id: 'w1', name: 'Claude', type: 'agent' },
      user: { id: null, display_name: 'Kevin', email: 'kevin@example.com' },
      viaAgentToken: true,
    });
    await ctxmod.eventQuery(req, INSERT_TASK, taskArgs('A'));
    const rows = await eventsOf();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('node.created');
    expect(rows[0].actor).toEqual({
      type: 'agent',
      id: 'w1',
      name: "Kevin's Claude",
      via: 'agent_token',
    });
    expect(rows[0].request_id).toBeTruthy();
    expect(rows[0].payload.node_kind).toBeNull();
  });

  it('carries a backdated happened_at down to the event and flags it', async () => {
    const req = makeReq({ body: { happened_at: '2020-05-05T00:00:00Z' } });
    await ctxmod.eventQuery(req, INSERT_TASK, taskArgs('A'));
    const [e] = await eventsOf();
    expect(new Date(e.happened_at).toISOString()).toBe('2020-05-05T00:00:00.000Z');
    expect(new Date(e.learned_at).getTime()).toBeGreaterThan(new Date(e.happened_at).getTime());
    expect(e.payload.backdated).toBe(true);
  });

  it('propagates the original error AFTER rolling back (23503 still reaches the route)', async () => {
    // This is the contract src/routes/tasks.js:49 relies on:
    //   catch (e) { if (e.code === '23503') return res.status(404)... }
    const err = await ctxmod
      .eventQuery(makeReq(), INSERT_TASK, taskArgs('orphan', 'nosuchgraphid00'))
      .then(
        () => null,
        (e) => e,
      );
    expect(err).toBeTruthy();
    expect(err.code).toBe('23503');

    // Rolled back: no row, and — because the event is written by a trigger
    // inside the same transaction — no event either.
    expect((await pool.query('SELECT 1 FROM tasks')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM events')).rowCount).toBe(0);

    // The connection is not poisoned; the very next call works.
    await expect(ctxmod.eventQuery(makeReq(), INSERT_TASK, taskArgs('ok'))).resolves.toBeTruthy();
  });

  it('never leaks the actor onto a recycled pooled connection', async () => {
    // Deterministic: `solo` hands out the SAME physical connection every time.
    const ctx = ctxmod.eventContextFromRequest(
      makeReq({ writerType: 'agent', writer: { id: 'w1', name: 'Claude', type: 'agent' } }),
    );
    const c = await solo.connect();
    await c.query('BEGIN');
    await ctxmod.applyEventContext(c, ctx);
    await c.query(INSERT_TASK, taskArgs('attributed'));
    await c.query('COMMIT');
    c.release();

    // Second "request" on the same physical connection, with no context at all.
    const c2 = await solo.connect();
    expect(c2).toBe(c); // max: 1 — same connection, by construction
    await c2.query(INSERT_TASK, taskArgs('bare'));
    c2.release();

    const rows = await eventsOf();
    expect(rows).toHaveLength(2);
    expect(rows[0].actor).toEqual({ type: 'agent', id: 'w1', name: 'Claude' });
    // Fails OPEN: still a complete event, just an unattributed one.
    expect(rows[1].actor).toEqual({ type: 'system' });
    expect(rows[1].kind).toBe('node.created');
  });
});

describe('E18.1 withEventTx', () => {
  it('stamps every write in the transaction and commits them atomically', async () => {
    const req = makeReq({ writer: { id: 'h1', name: 'Kevin', type: 'human' } });
    const ids = await ctxmod.withEventTx(req, async (client) => {
      const a = await client.query(INSERT_TASK, taskArgs('A'));
      const b = await client.query(INSERT_TASK, taskArgs('B'));
      await client.query(
        `INSERT INTO edges (graph_id, source_id, target_id, type, purpose)
         VALUES ($1, $2, $3, 'dependency'::edge_type, 'required for')`,
        [gid, a.rows[0].id, b.rows[0].id],
      );
      return [a.rows[0].id, b.rows[0].id];
    });
    expect(ids).toHaveLength(2);

    const rows = await eventsOf();
    expect(rows.map((r) => r.kind)).toEqual(['node.created', 'node.created', 'edge.added']);
    // One user action, one request_id across all three rows.
    expect(new Set(rows.map((r) => r.request_id)).size).toBe(1);
    for (const r of rows) {
      expect(r.actor).toEqual({ type: 'human', id: 'h1', name: 'Kevin' });
    }
  });

  it('rolls the events back with the rows when the body throws', async () => {
    const boom = new Error('boom');
    await expect(
      ctxmod.withEventTx(makeReq(), async (client) => {
        await client.query(INSERT_TASK, taskArgs('A'));
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect((await pool.query('SELECT 1 FROM tasks')).rowCount).toBe(0);
    expect(await eventsOf()).toHaveLength(0);
  });

  it('passes a route-supplied reason through to the event payload', async () => {
    const req = makeReq();
    const id = (await ctxmod.eventQuery(req, INSERT_TASK, taskArgs('A'))).rows[0].id;
    await ctxmod.withEventTx(
      req,
      async (client) => {
        await client.query(
          `UPDATE tasks SET meta = meta || '{"status":"in_progress"}'::jsonb,
                            version = version + 1 WHERE id = $1`,
          [id],
        );
      },
      { reason: 'claim' },
    );
    const last = (await eventsOf()).at(-1);
    expect(last.kind).toBe('status.changed');
    expect(last.payload.reason).toBe('claim');
  });

  it('lets gt.intent PROMOTE a derived kind but never invent one', async () => {
    const req = makeReq();
    const id = (await ctxmod.eventQuery(req, INSERT_TASK, taskArgs('A'))).rows[0].id;

    // 'field.set' IS derived from this change, so it may take the headline.
    await ctxmod.withEventTx(
      req,
      (client) =>
        client.query(
          `UPDATE tasks SET meta = meta || '{"status":"review","confidence":0.4}'::jsonb,
                            version = version + 1 WHERE id = $1`,
          [id],
        ),
      { intent: 'field.set' },
    );
    let last = (await eventsOf()).at(-1);
    expect(last.kind).toBe('field.set');
    expect(last.payload.kinds).toEqual(['status.changed', 'field.set']);

    // 'decision.made' is NOT derived from a status-only change, so it is ignored.
    await ctxmod.withEventTx(
      req,
      (client) =>
        client.query(
          `UPDATE tasks SET meta = meta || '{"status":"done"}'::jsonb,
                            version = version + 1 WHERE id = $1`,
          [id],
        ),
      { intent: 'decision.made' },
    );
    last = (await eventsOf()).at(-1);
    expect(last.kind).toBe('status.changed');
    expect(last.payload.kinds).toEqual(['status.changed']);
  });
});

describe('E18.1 withoutCapture', () => {
  it('suppresses events inside the block and restores capture after it', async () => {
    await ctxmod.withEventTx(makeReq(), async (client) => {
      await ctxmod.withoutCapture(client, async (c) => {
        await c.query(INSERT_TASK, taskArgs('silent'));
      });
      await client.query(INSERT_TASK, taskArgs('loud'));
    });

    const rows = await eventsOf();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.after.meta.title).toBe('loud');
    // Both rows were still written — suppression is about the LOG, not the data.
    expect((await pool.query('SELECT 1 FROM tasks')).rowCount).toBe(2);
  });

  it('restores capture even when the block throws', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(
        ctxmod.withoutCapture(client, async () => {
          throw new Error('nope');
        }),
      ).rejects.toThrow('nope');
      const { rows } = await client.query('SELECT gt_capture_enabled() AS on');
      expect(rows[0].on).toBe(true);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});

// ── the pure vocabulary ─────────────────────────────────────────────────────

describe('E18.1 kinds.js', () => {
  const ch = (o) => o;

  it('exports the full vocabulary, frozen', () => {
    expect(EVENT_KINDS).toContain('node.removed');
    expect(EVENT_KINDS).toContain('edge.rewired');
    expect(Object.isFrozen(EVENT_KINDS)).toBe(true);
  });

  it('classifies node changes in the SQL function’s order', () => {
    expect(classifyNode(ch({ 'meta.status': { from: 'todo', to: 'review' } }))).toEqual([
      'status.changed',
    ]);
    expect(classifyNode(ch({ 'meta.confidence': { from: null, to: 0.9 } }))).toEqual(['field.set']);
    expect(classifyNode(ch({ 'meta.significance': { from: null, to: 3 } }))).toEqual(['field.set']);
    expect(
      classifyNode(
        ch({
          'meta.status': { from: 'todo', to: 'done' },
          'meta.confidence': { from: null, to: 0.9 },
        }),
      ),
    ).toEqual(['status.changed', 'field.set']);
  });

  it('reads decided_at/verified_at by "is the new value set", not truthiness', () => {
    expect(classifyNode(ch({ 'meta.decided_at': { from: null, to: '2026-01-01' } }))).toEqual([
      'decision.made',
    ]);
    // Cleared → reopened. The key is PRESENT, the new value is null.
    expect(classifyNode(ch({ 'meta.decided_at': { from: '2026-01-01', to: null } }))).toEqual([
      'decision.reopened',
    ]);
    expect(classifyNode(ch({ 'meta.verified_at': { from: null, to: '2026-01-01' } }))).toEqual([
      'claim.verified',
    ]);
    // Clearing verified_at is NOT a verification; nothing else changed, so the
    // fallback fires.
    expect(classifyNode(ch({ 'meta.verified_at': { from: '2026-01-01', to: null } }))).toEqual([
      'node.patched',
    ]);
  });

  it('adds node.patched whenever anything outside the named keys moved', () => {
    expect(classifyNode(ch({ content: { from_sha: 'a', to: 'b' } }))).toEqual(['node.patched']);
    expect(
      classifyNode(ch({ 'meta.status': { from: 'todo', to: 'done' }, external_id: { from: null, to: 'x' } })),
    ).toEqual(['status.changed', 'node.patched']);
    expect(classifyNode(ch({}))).toEqual(['node.patched']);
  });

  it('classifies edge changes, keeping rewire separate from retype', () => {
    expect(classifyEdge(ch({ source_id: { from: 1, to: 2 } }))).toEqual(['edge.rewired']);
    expect(classifyEdge(ch({ purpose: { from: 'supports', to: 'contradicts' } }))).toEqual([
      'edge.retyped',
    ]);
    expect(
      classifyEdge(ch({ target_id: { from: 1, to: 2 }, type: { from: 'related', to: 'dependency' } })),
    ).toEqual(['edge.rewired', 'edge.retyped']);
    expect(classifyEdge(ch({ 'meta.color': { from: null, to: 'red' } }))).toEqual(['edge.patched']);
  });

  it('lets headline promote a derived kind and ignores an underived one', () => {
    expect(headline(['status.changed', 'field.set'])).toBe('status.changed');
    expect(headline(['status.changed', 'field.set'], 'field.set')).toBe('field.set');
    expect(headline(['status.changed'], 'decision.made')).toBe('status.changed');
    expect(headline(['status.changed'], null)).toBe('status.changed');
    expect(headline([])).toBeNull();
  });

  it('answers decay eligibility, and still says "no position" when it has none', () => {
    // E18.1 shipped this as an inert stub returning null; E18.2 fills it in.
    // The TRI-STATE contract is the part that had to survive: given a node's
    // meta the answer is a boolean, and given only an event it may still be
    // null — "E18 takes no position", which a caller can tell from "no".
    // (Full cases live in tests/e18-stability.test.js.)
    expect(isDecayEligible({ payload: { node_kind: 'claim' } }, {})).toBe(false);
    expect(isDecayEligible({ payload: { node_kind: 'claim' } })).toBeNull();
    expect(isDecayEligible({ payload: { node_kind: 'reference' } })).toBe(true);
    expect(isDecayEligible(null, { confidence: 0.8 })).toBe(true);
    expect(isDecayEligible(null, { confidence: 0.8, decay: false })).toBe(false);
  });
});
