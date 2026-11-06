// E18.1 fix group 4 — meta fidelity: a reconstruction at the head must equal
// the live graph, KEY FOR KEY, including the two keys the fold used to lose.
//
// Both losses were silent. `as_of.anomalies` stayed empty, `GET /graph?asOf=now`
// deep-equals a plain `GET /graph` is a promise the suite already makes
// (tests/e18-asof.test.js), and the fold quietly broke it:
//
//   4A  A meta key called `__proto__`. The fold wrote replayed keys with
//       `meta[k] = to`, which for `__proto__` reaches Object.prototype's setter
//       instead of creating an own property. A string value vanished; an OBJECT
//       value vanished AND re-parented the folded meta object. Every other path
//       into a meta object in this codebase is an object SPREAD, which defines
//       and therefore keeps the key — so the live row had it and the
//       reconstruction did not.
//
//   4B  A meta key whose value is explicitly JSON null. `gt_diff` built
//       `jsonb_build_object('to', new_j -> k)` and `->` yields JSON null both
//       for "key absent" and for "key present, value null", so the fold could
//       not tell a removal from a clear and guessed "removed". Explicit null is
//       a first-class signal in this app — mergeFields treats a defined null as
//       "clear this protected key" (src/merge.js) and validateMeta lets it
//       through on purpose — and the production database really does hold such
//       keys. The fix is at the source: gt_diff now emits `to_present`
//       alongside `to`, but ONLY on the ambiguous entries.
//
// The last test in the SQL section is the compatibility pin: an event written
// BEFORE the flag existed carries no `to_present`, and must still fold to a
// removal — otherwise every stored snapshot in the production log stops
// re-deriving and FOLD_VERSION would have to be bumped.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';
import { applyEvent, emptyState, canonicalJson } from '../src/events/fold.js';
import { classifyNode, headline } from '../src/events/kinds.js';

let app;
let pool;
let gid;

beforeAll(async () => {
  // MUST precede the import of app.js: src/db.js reads DATABASE_URL once.
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  app = (await import('../src/app.js')).default;
  pool = getTestPool();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-meta-fidelity') RETURNING id");
  gid = g.rows[0].id;
});

// ── fixtures ────────────────────────────────────────────────────────────────

let seq = 0;

function nodeCreated(id, meta) {
  return {
    graph_id: gid,
    seq: String(++seq),
    happened_at: '2026-01-01T10:00:00.000Z',
    learned_at: '2026-01-01T10:00:00.000Z',
    kind: 'node.created',
    subject_kind: 'node',
    subject_id: String(id),
    payload: {
      v: 1,
      op: 'INSERT',
      table: 'tasks',
      kinds: ['node.created'],
      version: 1,
      after: { id, content: '', meta, version: 1, created_at: '2026-01-01T09:00:00+00:00' },
    },
  };
}

function nodeUpdated(id, changes) {
  const kinds = classifyNode(changes);
  return {
    graph_id: gid,
    seq: String(++seq),
    happened_at: '2026-01-01T11:00:00.000Z',
    learned_at: '2026-01-01T11:00:00.000Z',
    kind: headline(kinds),
    subject_kind: 'node',
    subject_id: String(id),
    payload: { v: 1, op: 'UPDATE', table: 'tasks', kinds, version: 2, changes },
  };
}

const metaOf = (state, id) => state.nodes.find((n) => n.id === id).meta;

// ── 4A: `__proto__` is a meta key like any other ────────────────────────────

describe('E18.1 fold — a `__proto__` meta key survives the fold (4A)', () => {
  it('keeps it as an OWN property when a patch introduces it', () => {
    const created = applyEvent(emptyState(), nodeCreated(1, { title: 'A' }));
    const next = applyEvent(
      created,
      nodeUpdated(1, { 'meta.__proto__': { from: null, to: 'polluted' } }),
    );
    const meta = metaOf(next, 1);
    expect(Object.prototype.hasOwnProperty.call(meta, '__proto__')).toBe(true);
    expect(Object.keys(meta)).toContain('__proto__');
    // It reaches the /graph payload and the state digest, not just the object.
    expect(canonicalJson(meta)).toBe('{"__proto__":"polluted","title":"A"}');
  });

  it('does not let an OBJECT value re-parent the folded meta object', () => {
    const created = applyEvent(emptyState(), nodeCreated(1, { title: 'A' }));
    const next = applyEvent(
      created,
      nodeUpdated(1, { 'meta.__proto__': { from: null, to: { polluted: true } } }),
    );
    const meta = metaOf(next, 1);
    expect(Object.getPrototypeOf(meta)).toBe(Object.prototype);
    expect(meta.__proto__).toEqual({ polluted: true });
    expect({}.polluted).toBeUndefined();
  });

  it('still REMOVES it when the key is genuinely gone', () => {
    // JSON.parse, not an object literal: `__proto__:` in a literal sets the
    // PROTOTYPE and creates no key at all. JSON.parse defines an own property,
    // which is exactly what `pg` hands back for a jsonb column holding one.
    const withKey = JSON.parse('{"title":"A","__proto__":"x"}');
    const created = applyEvent(emptyState(), nodeCreated(1, withKey));
    expect(Object.keys(metaOf(created, 1))).toContain('__proto__');
    const next = applyEvent(
      created,
      nodeUpdated(1, { 'meta.__proto__': { from: 'x', to: null, to_present: false } }),
    );
    expect(Object.keys(metaOf(next, 1))).not.toContain('__proto__');
  });
});

// ── 4B: explicit JSON null is a value, not an absence ───────────────────────

describe('E18.1 fold — an explicitly-null meta key survives the fold (4B)', () => {
  it('keeps the key when `to_present` says the key is there', () => {
    const created = applyEvent(emptyState(), nodeCreated(1, { title: 'A', confidence: 0.9 }));
    const next = applyEvent(
      created,
      nodeUpdated(1, { 'meta.confidence': { from: 0.9, to: null, to_present: true } }),
    );
    const meta = metaOf(next, 1);
    expect(Object.prototype.hasOwnProperty.call(meta, 'confidence')).toBe(true);
    expect(meta.confidence).toBeNull();
  });

  it('deletes the key when `to_present` says the key is gone', () => {
    const created = applyEvent(emptyState(), nodeCreated(1, { title: 'A', confidence: 0.9 }));
    const next = applyEvent(
      created,
      nodeUpdated(1, { 'meta.confidence': { from: 0.9, to: null, to_present: false } }),
    );
    expect(metaOf(next, 1)).not.toHaveProperty('confidence');
  });

  it('LEGACY: an entry with no flag at all still folds to a removal', () => {
    // Every event already in the production log looks like this. Changing how
    // it folds would invalidate every stored snapshot without bumping
    // FOLD_VERSION, so this is a compatibility pin, not an aspiration.
    const created = applyEvent(emptyState(), nodeCreated(1, { title: 'A', confidence: 0.9 }));
    const next = applyEvent(created, nodeUpdated(1, { 'meta.confidence': { from: 0.9, to: null } }));
    expect(metaOf(next, 1)).not.toHaveProperty('confidence');
  });

  it('a classifier still reads such an entry the same way', () => {
    // `to_present` must not disturb the kinds. `decision.reopened` is the one
    // that turns on `to` being null, so it is the sharp case.
    expect(classifyNode({ 'meta.decided_at': { from: 'x', to: null, to_present: true } })).toEqual([
      'decision.reopened',
    ]);
    expect(classifyNode({ 'meta.confidence': { from: 1, to: null, to_present: false } })).toEqual([
      'field.set',
    ]);
  });
});

// ── the flag at its source ──────────────────────────────────────────────────

describe('db/schema.sql — gt_diff emits `to_present` only where it disambiguates', () => {
  const diff = async (oldJ, newJ, prefix = 'meta.') => {
    const { rows } = await pool.query('SELECT gt_diff($1::jsonb, $2::jsonb, $3) AS ch', [
      JSON.stringify(oldJ),
      JSON.stringify(newJ),
      prefix,
    ]);
    return rows[0].ch;
  };

  it('true when the key is present with a null value', async () => {
    expect(await diff({ confidence: 0.9 }, { confidence: null })).toEqual({
      'meta.confidence': { from: 0.9, to: null, to_present: true },
    });
  });

  it('false when the key is genuinely absent', async () => {
    expect(await diff({ confidence: 0.9 }, {})).toEqual({
      'meta.confidence': { from: 0.9, to: null, to_present: false },
    });
  });

  it('absent on an ordinary change — the historic {from, to} shape is untouched', async () => {
    // tests/e18-capture.test.js pins this two-key shape on nine assertions; a
    // flag on every changed column would be payload weight with no reader.
    expect(await diff({ status: 'todo' }, { status: 'review' })).toEqual({
      'meta.status': { from: 'todo', to: 'review' },
    });
    expect(await diff({}, { color: '#f00' })).toEqual({
      'meta.color': { from: null, to: '#f00' },
    });
  });

  it('classifies the flagged entry identically in SQL and in JS', async () => {
    const ch = await diff({ decided_at: 'x' }, { decided_at: null });
    const { rows } = await pool.query('SELECT gt_classify_node($1::jsonb) AS ks', [
      JSON.stringify(ch),
    ]);
    expect(rows[0].ks).toEqual(classifyNode(ch));
  });
});

// ── end to end: the trigger, the log, and the reconstruction ────────────────

describe('E18.1 — a reconstruction at the head equals the live graph', () => {
  const node = (meta, body = '') =>
    `---\n${Object.entries(meta)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n')}\n---\n${body}`;

  it('4B: clearing a meta key to null through the real route (asOf=now == GET /graph)', async () => {
    const created = await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .send({ content: node({ title: 'A', status: 'todo', confidence: 0.9 }) });
    expect(created.status).toBe(201);

    const cleared = await request(app)
      .patch(`/api/graphs/${gid}/tasks/${created.body.id}`)
      .send({ content: node({ title: 'A', status: 'todo', confidence: null }) });
    expect(cleared.status).toBe(200);

    // The live row really does hold an explicit null — if it did not, this test
    // would be proving nothing.
    const { rows } = await pool.query('SELECT meta FROM tasks WHERE id = $1', [created.body.id]);
    expect(Object.prototype.hasOwnProperty.call(rows[0].meta, 'confidence')).toBe(true);
    expect(rows[0].meta.confidence).toBeNull();

    const live = await request(app).get(`/api/graphs/${gid}/graph`);
    const asOf = await request(app).get(`/api/graphs/${gid}/graph`).query({ asOf: new Date(Date.now() + 1000).toISOString() });
    expect(asOf.status).toBe(200);
    expect(asOf.body.as_of.anomalies).toEqual([]);
    expect(asOf.body.nodes).toEqual(live.body.nodes);
    expect(asOf.body.nodes[0].meta.confidence).toBeNull();
  });

  it('4A: a `__proto__` meta key written by a direct-SQL writer', async () => {
    // Trigger-first capture exists precisely so a writer that is not an HTTP
    // route is still logged (src/events/snapshot.js header). This is that
    // writer, and it is the shape that reached the fold as a `meta.__proto__`
    // change entry.
    const { rows: t } = await pool.query(
      `INSERT INTO tasks (graph_id, content, meta) VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [gid, node({ title: 'A', status: 'todo' }), '{"title":"A","status":"todo"}'],
    );
    await pool.query(`UPDATE tasks SET meta = $2::jsonb, version = version + 1 WHERE id = $1`, [
      t[0].id,
      '{"title":"A","status":"todo","__proto__":{"polluted":true}}',
    ]);

    const { rows: ev } = await pool.query(
      `SELECT payload -> 'changes' AS ch FROM events
        WHERE graph_id = $1 AND subject_id = $2 AND payload ->> 'op' = 'UPDATE'`,
      [gid, t[0].id],
    );
    expect(ev[0].ch).toHaveProperty('meta.__proto__');

    const live = await request(app).get(`/api/graphs/${gid}/graph`);
    const asOf = await request(app).get(`/api/graphs/${gid}/graph`).query({ asOf: new Date(Date.now() + 1000).toISOString() });
    expect(asOf.status).toBe(200);
    expect(asOf.body.as_of.anomalies).toEqual([]);
    expect(Object.keys(asOf.body.nodes[0].meta)).toContain('__proto__');
    expect(asOf.body.nodes).toEqual(live.body.nodes);
  });
});
