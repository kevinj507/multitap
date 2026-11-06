// E18.1 STEP 6 — GET /api/graphs/:gid/events?since= — the log read API.
//
// Three things are pinned here, and the third is the one that would break
// silently:
//
//   1. THE CURSOR CONTRACT. `?since=N` returns the strict suffix seq > N, in
//      seq order, and `next_since` is a cursor a poller can feed straight back
//      without ever skipping an event. `seq` is gapless and commit-ordered
//      (gt_next_seq allocates under the graphs-row lock, held to commit), which
//      is the ONLY reason resuming from the head is safe — with a global
//      BIGSERIAL assigned at INSERT time rather than at commit, seq N could
//      become visible while N-1 was still in flight and a head-resume would
//      lose it forever.
//
//   2. THE READ GATE. The path is `requireGraph('read')`-gated by the line it
//      shares with SSE, so the matrix must match /graph and /export exactly:
//      owner and viewer-member in, stranger and anon out, anon in when the
//      graph says `anon_role: 'viewer'`, everyone in on a legacy owner-less
//      URL-bearer graph.
//
//   3. THE SSE REGRESSION. `/api/graphs/:gid/events` was the EventSource stream
//      before it was a log API, and it still is when opened bare. The branch to
//      the log handler sits on the handler's first line — before a connection
//      slot is reserved and before any `text/event-stream` header is flushed —
//      so the two cannot interfere. If someone ever moves that branch below
//      `res.flushHeaders()`, or mounts a router at this prefix, the live graph
//      view in every open browser tab goes dark with nothing else failing. The
//      last test in this file is the tripwire.
//
// Events are produced through the REAL routes throughout, so every middleware
// and every row trigger fires exactly as it does in production.
import http from 'node:http';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPool, TEST_URL } from './setup.js';

let app;
let pool;
let gid;

beforeAll(async () => {
  // MUST precede the import of app.js: src/db.js reads DATABASE_URL once, at
  // first import, so a static import would bind the wrong database.
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.AUTH_PROVIDER;
  const mod = await import('../src/app.js');
  app = mod.default;
  pool = getTestPool();
  const authIdx = await import('../src/auth/index.js');
  const { makeHeaderAuthAdapter } = await import('./__support__/test_auth.js');
  authIdx._setAdapterForTests(makeHeaderAuthAdapter());
});

afterAll(async () => {
  const authIdx = await import('../src/auth/index.js');
  authIdx._resetAdapterCacheForTests();
});

beforeEach(async () => {
  const g = await pool.query("INSERT INTO graphs (name) VALUES ('e18-events-api') RETURNING id");
  gid = g.rows[0].id;
});

// ── fixtures ────────────────────────────────────────────────────────────────

const node = (meta, body = '') =>
  `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`;

const logUrl = (g = gid) => `/api/graphs/${g}/events`;
const tasksUrl = (g = gid) => `/api/graphs/${g}/tasks`;
const edgesUrl = (g = gid) => `/api/graphs/${g}/edges`;

async function mkNode(title, extra = {}, g = gid) {
  const res = await request(app)
    .post(tasksUrl(g))
    .send({ content: node({ title, status: 'todo', ...extra }) });
  expect(res.status).toBe(201);
  return res.body;
}

async function mkEdge(source, target, purpose = 'required for', g = gid) {
  const res = await request(app).post(edgesUrl(g)).send({ source_id: source, target_id: target, purpose });
  expect(res.status).toBe(201);
  return res.body;
}

// Everything the log holds for this graph, straight from the table — the
// independent oracle the API answers are checked against.
async function rawSeqs(g = gid) {
  const { rows } = await pool.query('SELECT seq FROM events WHERE graph_id = $1 ORDER BY seq', [g]);
  return rows.map((r) => Number(r.seq));
}

async function makeUser(pid) {
  return (
    await pool.query(
      `INSERT INTO users (provider, provider_user_id, email, display_name)
       VALUES ('test-header', $1, $2, $1) RETURNING *`,
      [pid, `${pid}@test.local`],
    )
  ).rows[0];
}
async function makeOwnedGraph(ownerId, anonRole = 'none') {
  return (
    await pool.query(`INSERT INTO graphs (name, owner_user_id, anon_role) VALUES ('owned', $1, $2) RETURNING id`, [
      ownerId,
      anonRole,
    ])
  ).rows[0].id;
}
async function addMember(graphId, userId, role) {
  await pool.query(`INSERT INTO graph_members (graph_id, user_id, role) VALUES ($1, $2, $3)`, [graphId, userId, role]);
}

// ── the cursor contract ─────────────────────────────────────────────────────

describe('GET /events?since= — the log read API', () => {
  it('?since=0 returns the whole log, in seq order, matching the table', async () => {
    const a = await mkNode('A');
    const b = await mkNode('B');
    await mkEdge(a.id, b.id);

    const res = await request(app).get(`${logUrl()}?since=0`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');

    const seqs = res.body.events.map((e) => e.seq);
    expect(seqs).toEqual(await rawSeqs());
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    expect(res.body.events.map((e) => e.kind)).toEqual(['node.created', 'node.created', 'edge.added']);
    expect(res.body.head_seq).toBe(seqs[seqs.length - 1]);
    expect(res.body.next_since).toBe(res.body.head_seq);
    expect(res.body.truncated).toBe(false);
  });

  it('shapes each event with the columns a client can act on', async () => {
    const a = await mkNode('A', { type: 'claim' });

    const res = await request(app).get(`${logUrl()}?since=0`);
    const ev = res.body.events[0];
    expect(ev.graph_id).toBe(gid);
    expect(typeof ev.seq).toBe('number'); // a BIGINT, but usable as ?since= verbatim
    expect(ev.kind).toBe('node.created');
    expect(ev.subject_kind).toBe('node');
    expect(ev.subject_id).toBe(a.id);
    expect(ev.cause_id).toBeNull();
    expect(new Date(ev.happened_at).getTime()).not.toBeNaN();
    expect(new Date(ev.learned_at).getTime()).not.toBeNaN();
    expect(ev.actor).toMatchObject({ type: expect.any(String) });
    expect(ev.payload.kinds).toEqual(['node.created']);
    // Provenance the fold has no use for but a reader does.
    expect(Object.keys(ev)).toContain('request_id');
    // `txid` is a Postgres internal, deliberately not part of the contract.
    expect(Object.keys(ev)).not.toContain('txid');
  });

  it('?since=<mid> returns the strict suffix and nothing at the head', async () => {
    const a = await mkNode('A');
    const first = await request(app).get(`${logUrl()}?since=0`);
    const mid = first.body.head_seq;

    // At the head: empty, and the cursor does not move backwards.
    const empty = await request(app).get(`${logUrl()}?since=${mid}`);
    expect(empty.status).toBe(200);
    expect(empty.body.events).toEqual([]);
    expect(empty.body.head_seq).toBe(mid);
    expect(empty.body.next_since).toBe(mid);
    expect(empty.body.truncated).toBe(false);

    // Then two more writes produce exactly two more events.
    const b = await mkNode('B');
    await mkEdge(a.id, b.id);

    const delta = await request(app).get(`${logUrl()}?since=${mid}`);
    expect(delta.body.events.map((e) => e.seq)).toEqual([mid + 1, mid + 2]);
    expect(delta.body.events.every((e) => e.seq > mid)).toBe(true);
    expect(delta.body.next_since).toBe(mid + 2);

    // A `since` past the head is honoured rather than clamped, and the cursor
    // it hands back never regresses.
    const ahead = await request(app).get(`${logUrl()}?since=${mid + 999}`);
    expect(ahead.status).toBe(200);
    expect(ahead.body.events).toEqual([]);
    expect(ahead.body.next_since).toBe(mid + 999);
  });

  it('polling from next_since delivers every event exactly once', async () => {
    // The DONE-WHEN for the cursor: drain the log in pages of 2 and assert the
    // concatenation is the log, with no gap and no repeat.
    for (let i = 0; i < 5; i += 1) await mkNode(`n${i}`);
    const all = await rawSeqs();
    expect(all.length).toBeGreaterThanOrEqual(5);

    const seen = [];
    let cursor = 0;
    for (let guard = 0; guard < 20; guard += 1) {
      const res = await request(app).get(`${logUrl()}?since=${cursor}&limit=2`);
      expect(res.status).toBe(200);
      seen.push(...res.body.events.map((e) => e.seq));
      cursor = res.body.next_since;
      if (!res.body.truncated) break;
    }
    expect(seen).toEqual(all);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('truncates at the limit and hands back a usable next_since', async () => {
    for (let i = 0; i < 4; i += 1) await mkNode(`t${i}`);
    const all = await rawSeqs();

    const page = await request(app).get(`${logUrl()}?since=0&limit=2`);
    expect(page.status).toBe(200);
    expect(page.body.truncated).toBe(true);
    expect(page.body.events.map((e) => e.seq)).toEqual(all.slice(0, 2));
    // A truncated page resumes from its OWN last row, never from the head —
    // resuming from the head here would drop everything in between.
    expect(page.body.next_since).toBe(all[1]);
    expect(page.body.head_seq).toBe(all[all.length - 1]);

    const rest = await request(app).get(`${logUrl()}?since=${page.body.next_since}&limit=100`);
    expect(rest.body.truncated).toBe(false);
    expect(rest.body.events.map((e) => e.seq)).toEqual(all.slice(2));
  });

  it('defaults to the whole log and caps the page at 1000', async () => {
    await mkNode('A');
    const dflt = await request(app).get(`${logUrl()}?since=0`);
    expect(dflt.body.truncated).toBe(false);

    expect((await request(app).get(`${logUrl()}?since=0&limit=1000`)).status).toBe(200);
    const over = await request(app).get(`${logUrl()}?since=0&limit=1001`);
    expect(over.status).toBe(400);
    expect(over.body.error).toMatch(/limit/);
  });

  it('?format=json reads the head of the log without a since', async () => {
    await mkNode('A');
    const res = await request(app).get(`${logUrl()}?format=json`);
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBe(1);
    expect(res.body.next_since).toBe(res.body.head_seq);
  });

  it('filters by kind, subject_kind and subject_id', async () => {
    const a = await mkNode('A');
    const b = await mkNode('B');
    await mkEdge(a.id, b.id);
    const patched = await request(app)
      .patch(`${tasksUrl()}/${a.id}`)
      .send({ content: node({ title: 'A', status: 'review' }), base_version: a.version, base_content: a.content });
    expect(patched.status).toBe(200);

    const created = await request(app).get(`${logUrl()}?since=0&kind=node.created`);
    expect(created.body.events.map((e) => e.subject_id)).toEqual([a.id, b.id]);
    expect(created.body.events.every((e) => e.kind === 'node.created')).toBe(true);
    // head_seq is still the head of the WHOLE log, not of the filtered page —
    // that is what makes next_since a correct resume point under a filter.
    expect(created.body.head_seq).toBe((await rawSeqs()).at(-1));
    expect(created.body.next_since).toBe(created.body.head_seq);

    const edges = await request(app).get(`${logUrl()}?since=0&subject_kind=edge`);
    expect(edges.body.events.map((e) => e.kind)).toEqual(['edge.added']);

    const aOnly = await request(app).get(`${logUrl()}?since=0&subject_kind=node&subject_id=${a.id}`);
    expect(aOnly.body.events.map((e) => e.kind)).toEqual(['node.created', 'status.changed']);
    expect(aOnly.body.events.every((e) => e.subject_id === a.id)).toBe(true);
  });

  it('scopes strictly to its own graph', async () => {
    const other = (await pool.query("INSERT INTO graphs (name) VALUES ('other') RETURNING id")).rows[0].id;
    await mkNode('elsewhere', {}, other);
    await mkNode('mine');

    const res = await request(app).get(`${logUrl()}?since=0`);
    expect(res.body.events.length).toBe(1);
    expect(res.body.events.every((e) => e.graph_id === gid)).toBe(true);
    expect(res.body.events[0].payload.after.meta.title).toBe('mine');
  });

  it('is 200 with an empty page on a graph that has never been written to', async () => {
    const res = await request(app).get(`${logUrl()}?since=0`);
    expect(res.status).toBe(200);
    // The seq-0 genesis row is a SNAPSHOT, not an event: it lives in
    // graph_snapshots and must never appear in the log.
    expect(res.body).toEqual({ events: [], head_seq: 0, next_since: 0, truncated: false });
  });

  it('rejects malformed parameters with 400 and the house error shape', async () => {
    for (const [qs, pattern] of [
      ['since=banana', /since/],
      ['since=-1', /since/],
      ['since=1.5', /since/],
      ['since=0&limit=0', /limit/],
      ['since=0&limit=abc', /limit/],
      ['since=0&kind=node.exploded', /kind/],
      ['since=0&subject_kind=planet', /subject_kind/],
      ['since=0&subject_id=0', /subject_id/],
      ['since=0&subject_id=-2', /subject_id/],
    ]) {
      const res = await request(app).get(`${logUrl()}?${qs}`);
      expect(res.status, qs).toBe(400);
      expect(res.body.error, qs).toMatch(pattern);
    }
    // A repeated parameter arrives as an array, which is not an integer.
    const repeated = await request(app).get(`${logUrl()}?since=1&since=2`);
    expect(repeated.status).toBe(400);
  });

  // ── the read gate ─────────────────────────────────────────────────────────

  it('is read-gated exactly like the graph view', async () => {
    const owner = await makeUser('owner');
    const viewer = await makeUser('viewer');
    await makeUser('stranger');
    const restricted = await makeOwnedGraph(owner.id, 'none');
    await addMember(restricted, viewer.id, 'viewer');
    const url = (g) => `${logUrl(g)}?since=0`;

    expect((await request(app).get(url(restricted)).set('X-Test-User-Id', 'owner')).status).toBe(200);
    expect((await request(app).get(url(restricted)).set('X-Test-User-Id', 'viewer')).status).toBe(200);
    expect((await request(app).get(url(restricted)).set('X-Test-User-Id', 'stranger')).status).toBe(403);
    expect((await request(app).get(url(restricted))).status).toBe(403); // anon

    const open = await makeOwnedGraph(owner.id, 'viewer');
    expect((await request(app).get(url(open))).status).toBe(200); // anon on anon_role:viewer

    expect((await request(app).get(url(gid))).status).toBe(200); // legacy owner-less
    expect((await request(app).get(url('nosuchgraphid'))).status).toBe(404);
  });

  it('refuses a stranger BEFORE validating the query, so the gate cannot be probed', async () => {
    const owner = await makeUser('owner');
    await makeUser('stranger');
    const restricted = await makeOwnedGraph(owner.id, 'none');
    const res = await request(app).get(`${logUrl(restricted)}?since=banana`).set('X-Test-User-Id', 'stranger');
    expect(res.status).toBe(403);
  });

  // ── the SSE regression ────────────────────────────────────────────────────

  it('still streams SSE when the path is opened bare', async () => {
    // supertest buffers until the response ends and an SSE response never
    // does, so this one goes through a real socket. The assertion is the whole
    // point of the test: the same URL, with no query, must still negotiate
    // text/event-stream and deliver the `: connected` frame the browser's
    // EventSource waits for before it reports `onopen`.
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();

    try {
      const frame = await new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path: logUrl() }, (res) => {
          let buf = '';
          res.on('data', (chunk) => {
            buf += chunk;
            if (buf.includes('\n\n')) {
              req.destroy();
              resolve({ status: res.statusCode, headers: res.headers, body: buf });
            }
          });
          res.on('error', () => {});
        });
        req.on('error', (err) => {
          if (err.code !== 'ECONNRESET') reject(err);
        });
        setTimeout(() => {
          req.destroy();
          reject(new Error('no SSE frame within 5s'));
        }, 5000).unref?.();
      });

      expect(frame.status).toBe(200);
      expect(frame.headers['content-type']).toBe('text/event-stream');
      expect(frame.headers['cache-control']).toBe('no-cache, no-transform');
      expect(frame.headers['x-accel-buffering']).toBe('no');
      expect(frame.body).toContain(': connected');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('takes the JSON branch — never the stream — whenever since or format=json is present', async () => {
    await mkNode('A');
    for (const qs of ['since=0', 'format=json', 'since=0&format=json', 'since=0&kind=node.created']) {
      const res = await request(app).get(`${logUrl()}?${qs}`);
      expect(res.status, qs).toBe(200);
      expect(res.headers['content-type'], qs).toMatch(/application\/json/);
      expect(res.headers['content-type'], qs).not.toMatch(/event-stream/);
      expect(Array.isArray(res.body.events), qs).toBe(true);
    }
  });
});
