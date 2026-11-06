import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';
import * as presence from '../src/presence.js';

let app;
let pool;
let gid;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_URL;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
});

beforeEach(async () => {
  presence._resetForTest();
  const r = await pool.query("INSERT INTO graphs (name) VALUES ('t') RETURNING id");
  gid = r.rows[0].id;
});

afterAll(() => {
  presence._resetForTest();
});

describe('presence module (unit)', () => {
  it('announce inserts a writer and emits announce op', () => {
    const events = [];
    presence.onChange((g, op, w) => events.push({ g, op, name: w.name }));
    presence.announce('g1', { id: 'w1', name: 'Alice', type: 'human' });
    expect(presence.getSnapshot('g1')).toHaveLength(1);
    expect(presence.getSnapshot('g1')[0]).toMatchObject({
      id: 'w1',
      name: 'Alice',
      type: 'human',
      active: true,
    });
    expect(events).toEqual([{ g: 'g1', op: 'announce', name: 'Alice' }]);
  });

  it('announce with new name emits rename, not announce', () => {
    const events = [];
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    presence.onChange((g, op, w) => events.push({ op, name: w.name }));
    presence.announce('g1', { id: 'w1', name: 'Alicia' });
    expect(events).toEqual([{ op: 'rename', name: 'Alicia' }]);
  });

  it('announce with same name is a silent refresh', () => {
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    const before = presence.getSnapshot('g1')[0].lastSeen;
    const events = [];
    presence.onChange((g, op) => events.push(op));
    // Force a measurable gap so lastSeen actually advances
    const orig = Date.now;
    Date.now = () => orig() + 5;
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    Date.now = orig;
    const after = presence.getSnapshot('g1')[0].lastSeen;
    expect(after).toBeGreaterThan(before);
    expect(events).toEqual([]); // silent
  });

  it('touch on unknown writer synthesizes an announce', () => {
    const events = [];
    presence.onChange((g, op, w) => events.push({ op, name: w.name }));
    presence.touch('g1', 'w1', 'Bob', 'agent');
    expect(events).toEqual([{ op: 'announce', name: 'Bob' }]);
    expect(presence.getSnapshot('g1')[0].type).toBe('agent');
  });

  it('touch on known writer updates lastSeen silently', () => {
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    const events = [];
    presence.onChange((g, op) => events.push(op));
    const before = presence.getSnapshot('g1')[0].lastSeen;
    const orig = Date.now;
    Date.now = () => orig() + 5;
    presence.touch('g1', 'w1', 'Alice', 'human');
    Date.now = orig;
    expect(presence.getSnapshot('g1')[0].lastSeen).toBeGreaterThan(before);
    expect(events).toEqual([]);
  });

  it('depart removes writer and emits depart op', () => {
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    const events = [];
    presence.onChange((g, op, w) => events.push({ op, name: w.name }));
    expect(presence.depart('g1', 'w1')).toBe(true);
    expect(presence.getSnapshot('g1')).toEqual([]);
    expect(events).toEqual([{ op: 'depart', name: 'Alice' }]);
  });

  it('depart for unknown writer is a no-op', () => {
    const events = [];
    presence.onChange((g, op) => events.push(op));
    expect(presence.depart('g1', 'ghost')).toBe(false);
    expect(events).toEqual([]);
  });

  it('reapStale prunes writers older than ttl and emits depart for each', () => {
    presence.announce('g1', { id: 'old', name: 'O' });
    const orig = Date.now;
    Date.now = () => orig() + 1000;
    presence.announce('g1', { id: 'fresh', name: 'F' });
    Date.now = orig;

    const events = [];
    presence.onChange((g, op, w) => events.push({ op, id: w.id }));
    // ttl = 500ms — "old" is 1000ms behind "fresh"'s now-reference. Use Date.now
    // again at this point to compare. Old should be reaped, fresh should not.
    // Move time forward so "fresh" is also stale-checked
    Date.now = () => orig() + 1100;
    presence.reapStale(500);
    Date.now = orig;
    expect(presence.getSnapshot('g1').map((w) => w.id)).toEqual(['fresh']);
    expect(events).toEqual([{ op: 'depart', id: 'old' }]);
  });

  it('name is trimmed and length-clamped', () => {
    const long = 'x'.repeat(200);
    const w = presence.announce('g1', { id: 'w1', name: `  ${long}  ` });
    expect(w.name.length).toBe(64);
    expect(w.name).toBe('x'.repeat(64));
  });

  it('announce returns null for missing or oversize id', () => {
    expect(presence.announce('g1', { name: 'no id' })).toBeNull();
    expect(presence.announce('g1', { id: 'x'.repeat(200) })).toBeNull();
  });

  it('sweepActive flips stale writers to inactive and emits idle', () => {
    const orig = Date.now;
    Date.now = () => orig();
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    const events = [];
    presence.onChange((g, op, w) => events.push({ op, id: w.id, active: w.active }));
    // Advance time past the active window and sweep.
    Date.now = () => orig() + presence.ACTIVE_WINDOW_MS + 1000;
    presence.sweepActive();
    Date.now = orig;
    expect(presence.getSnapshot('g1')[0].active).toBe(false);
    expect(events).toEqual([{ op: 'idle', id: 'w1', active: false }]);
  });

  it('sweepActive skips writers still within the active window', () => {
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    const events = [];
    presence.onChange((g, op) => events.push(op));
    presence.sweepActive();
    expect(presence.getSnapshot('g1')[0].active).toBe(true);
    expect(events).toEqual([]);
  });

  it('sweepActive does not re-emit idle for already-inactive writers', () => {
    const orig = Date.now;
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    Date.now = () => orig() + presence.ACTIVE_WINDOW_MS + 1000;
    presence.sweepActive();
    const events = [];
    presence.onChange((g, op) => events.push(op));
    presence.sweepActive();
    Date.now = orig;
    expect(events).toEqual([]);
  });

  it('announce on an idle writer emits active', () => {
    const orig = Date.now;
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    Date.now = () => orig() + presence.ACTIVE_WINDOW_MS + 1000;
    presence.sweepActive();
    const events = [];
    presence.onChange((g, op, w) => events.push({ op, active: w.active }));
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    Date.now = orig;
    expect(presence.getSnapshot('g1')[0].active).toBe(true);
    expect(events).toEqual([{ op: 'active', active: true }]);
  });

  it('touch on an idle writer emits active', () => {
    const orig = Date.now;
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    Date.now = () => orig() + presence.ACTIVE_WINDOW_MS + 1000;
    presence.sweepActive();
    const events = [];
    presence.onChange((g, op, w) => events.push({ op, active: w.active }));
    presence.touch('g1', 'w1', 'Alice', 'human');
    Date.now = orig;
    expect(presence.getSnapshot('g1')[0].active).toBe(true);
    expect(events).toEqual([{ op: 'active', active: true }]);
  });

  it('rename on an idle writer emits both rename and active', () => {
    const orig = Date.now;
    presence.announce('g1', { id: 'w1', name: 'Alice' });
    Date.now = () => orig() + presence.ACTIVE_WINDOW_MS + 1000;
    presence.sweepActive();
    const events = [];
    presence.onChange((g, op, w) => events.push({ op, name: w.name, active: w.active }));
    presence.announce('g1', { id: 'w1', name: 'Alicia' });
    Date.now = orig;
    expect(events).toEqual([
      { op: 'rename', name: 'Alicia', active: true },
      { op: 'active', name: 'Alicia', active: true },
    ]);
  });

  it('announce stores owner_user_id verbatim (and snapshot exposes it)', () => {
    const ownerId = '11111111-1111-1111-1111-111111111111';
    presence.announce('g1', { id: 'w1', name: 'A', type: 'agent', owner_user_id: ownerId });
    const snap = presence.getSnapshot('g1');
    expect(snap[0]).toMatchObject({ id: 'w1', type: 'agent', owner_user_id: ownerId });
  });

  it('owner_user_id defaults to null when not provided', () => {
    presence.announce('g1', { id: 'w1', name: 'A', type: 'human' });
    expect(presence.getSnapshot('g1')[0].owner_user_id).toBeNull();
  });

  it('touch backfills owner_user_id when previously null', () => {
    const ownerId = '22222222-2222-2222-2222-222222222222';
    presence.announce('g1', { id: 'w1', name: 'A', type: 'human' });
    expect(presence.getSnapshot('g1')[0].owner_user_id).toBeNull();
    presence.touch('g1', 'w1', 'A', 'human', ownerId);
    expect(presence.getSnapshot('g1')[0].owner_user_id).toBe(ownerId);
  });
});

describe('presence routes (HTTP)', () => {
  it('POST /presence then GET shows the writer', async () => {
    const post = await request(app)
      .post(`/api/graphs/${gid}/presence`)
      .send({ id: 'w1', name: 'Alice', type: 'human' });
    expect(post.status).toBe(204);

    const get = await request(app).get(`/api/graphs/${gid}/presence`);
    expect(get.status).toBe(200);
    expect(get.body).toHaveLength(1);
    expect(get.body[0]).toMatchObject({ id: 'w1', name: 'Alice', type: 'human' });
  });

  it('POST without id returns 400', async () => {
    const r = await request(app)
      .post(`/api/graphs/${gid}/presence`)
      .send({ name: 'nobody' });
    expect(r.status).toBe(400);
  });

  it('DELETE depart is idempotent', async () => {
    await request(app).post(`/api/graphs/${gid}/presence`).send({ id: 'w1', name: 'Alice' });
    const d1 = await request(app).delete(`/api/graphs/${gid}/presence/w1`);
    expect(d1.status).toBe(204);
    const d2 = await request(app).delete(`/api/graphs/${gid}/presence/w1`);
    expect(d2.status).toBe(204);
    const get = await request(app).get(`/api/graphs/${gid}/presence`);
    expect(get.body).toEqual([]);
  });

  it('writing a task with X-Writer-Id implicitly touches presence', async () => {
    const r = await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .set('X-Writer-Id', 'w1')
      .set('X-Writer-Name', 'Bob')
      .set('X-Writer-Type', 'agent')
      .send({ content: '---\ntitle: hello\n---\n' });
    expect(r.status).toBe(201);

    const snap = await request(app).get(`/api/graphs/${gid}/presence`);
    expect(snap.body).toHaveLength(1);
    expect(snap.body[0]).toMatchObject({ id: 'w1', name: 'Bob', type: 'agent' });
  });

  it('renaming via re-POST announce updates the name', async () => {
    await request(app).post(`/api/graphs/${gid}/presence`).send({ id: 'w1', name: 'Alice' });
    await request(app).post(`/api/graphs/${gid}/presence`).send({ id: 'w1', name: 'Alicia' });
    const snap = await request(app).get(`/api/graphs/${gid}/presence`);
    expect(snap.body[0].name).toBe('Alicia');
  });
});

describe('presence SSE broadcast', () => {
  it('subscribed clients receive presence frames for announce, rename, depart', async () => {
    const { subscribe, unsubscribe } = await import('../src/sse.js');
    const frames = [];
    // Minimal Response-like object that the broadcast helper writes SSE frames to.
    const fakeRes = { write: (chunk) => frames.push(String(chunk)) };
    subscribe(gid, fakeRes);

    // POST through the HTTP layer so the full presence -> onChange -> broadcast
    // pipeline runs. Frames land in `frames` as 'data: <json>\n\n' strings.
    await request(app).post(`/api/graphs/${gid}/presence`).send({ id: 'w1', name: 'Alice' });
    await request(app).post(`/api/graphs/${gid}/presence`).send({ id: 'w1', name: 'Alicia' });
    await request(app).delete(`/api/graphs/${gid}/presence/w1`);

    unsubscribe(gid, fakeRes);

    const events = frames
      .map((f) => f.match(/^data: (.+)\n\n$/))
      .filter(Boolean)
      .map((m) => JSON.parse(m[1]))
      .filter((e) => e.kind === 'presence');
    expect(events.map((e) => e.op)).toEqual(['announce', 'rename', 'depart']);
    expect(events[0].writer).toMatchObject({ id: 'w1', name: 'Alice' });
    expect(events[1].writer).toMatchObject({ id: 'w1', name: 'Alicia' });
    expect(events[2].writer).toMatchObject({ id: 'w1', name: 'Alicia' });
  });

  it('subscribed clients receive a presence frame from implicit touch (write)', async () => {
    const { subscribe, unsubscribe } = await import('../src/sse.js');
    const frames = [];
    const fakeRes = { write: (chunk) => frames.push(String(chunk)) };
    subscribe(gid, fakeRes);

    await request(app)
      .post(`/api/graphs/${gid}/tasks`)
      .set('X-Writer-Id', 'w-impl')
      .set('X-Writer-Name', 'Carol')
      .send({ content: '---\ntitle: t\n---\n' });

    unsubscribe(gid, fakeRes);

    const presenceFrames = frames
      .map((f) => f.match(/^data: (.+)\n\n$/))
      .filter(Boolean)
      .map((m) => JSON.parse(m[1]))
      .filter((e) => e.kind === 'presence');
    expect(presenceFrames).toHaveLength(1);
    expect(presenceFrames[0]).toMatchObject({ op: 'announce', writer: { id: 'w-impl', name: 'Carol' } });
  });
});
