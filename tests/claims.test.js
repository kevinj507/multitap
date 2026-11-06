// Claim/lease on tasks (node 3829 — fleet coordination). Pins the contract
// that lets N agents pull from /ready without double-grabbing: atomic acquire
// (todo → in_progress + holder + expiry in one row-locked txn), renewal by
// the holder, 409-with-holder for everyone else, derived revival of expired
// leases in /ready (no sweeper), and release semantics for abandonment and
// human override.
import request from 'supertest';
import { getTestPool, TEST_URL } from './setup.js';

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
  const r = await pool.query("INSERT INTO graphs (name) VALUES ('claims-t') RETURNING id");
  gid = r.rows[0].id;
});

const url = () => `/api/graphs/${gid}/tasks`;
const md = (title, status = 'todo', extra = '') =>
  `---\ntitle: ${title}\nstatus: ${status}\n${extra}---\nbody of ${title}`;

async function createTask(content) {
  const r = await request(app).post(url()).send({ content });
  expect(r.status).toBe(201);
  return r.body.id;
}

const asWriter = (req, id, name = null) => {
  req.set('X-Writer-Type', 'agent').set('X-Writer-Id', id);
  if (name) req.set('X-Writer-Name', name);
  return req;
};

describe('POST /tasks/:id/claim', () => {
  it('acquires: flips todo → in_progress, records holder + future expiry, keeps content in sync', async () => {
    const id = await createTask(md('claim me'));
    const r = await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1', 'Fleet One').send({});
    expect(r.status).toBe(200);
    expect(r.body.claimed).toBe(true);
    expect(r.body.renewed).toBe(false);
    const t = r.body.task;
    expect(t.meta.status).toBe('in_progress');
    expect(t.claimed_by).toBe('agent-1');
    expect(t.claimed_by_name).toBe('Fleet One');
    expect(new Date(t.claim_expires_at).getTime()).toBeGreaterThan(Date.now());
    // meta and content must never drift — the claim rewrote the frontmatter too.
    expect(t.content).toContain('status: in_progress');
    expect(t.version).toBe(1);
  });

  it('a second claimant gets 409 naming the holder — the double-grab is dead', async () => {
    const id = await createTask(md('contested'));
    await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1', 'Fleet One').send({});
    const r = await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-2').send({});
    expect(r.status).toBe(409);
    expect(r.body.claimed_by).toBe('agent-1');
    expect(r.body.claimed_by_name).toBe('Fleet One');
    expect(r.body.claim_expires_at).toBeTruthy();
  });

  it('the holder renews instead of re-acquiring, and the lease extends', async () => {
    const id = await createTask(md('renewable'));
    await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1').send({ ttl_seconds: 60 });
    const before = await pool.query('SELECT claim_expires_at FROM tasks WHERE id = $1', [id]);
    const r = await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1').send({ ttl_seconds: 3600 });
    expect(r.status).toBe(200);
    expect(r.body.renewed).toBe(true);
    expect(new Date(r.body.task.claim_expires_at).getTime())
      .toBeGreaterThan(new Date(before.rows[0].claim_expires_at).getTime());
    // Renewal is not a content write — no version churn, no status change.
    expect(r.body.task.version).toBe(1);
  });

  it('an expired lease is claimable by someone else — dead agents self-release', async () => {
    const id = await createTask(md('abandoned'));
    await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1').send({});
    await pool.query("UPDATE tasks SET claim_expires_at = NOW() - interval '1 minute' WHERE id = $1", [id]);
    const r = await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-2', 'Fleet Two').send({});
    expect(r.status).toBe(200);
    expect(r.body.task.claimed_by).toBe('agent-2');
    expect(r.body.task.meta.status).toBe('in_progress');
  });

  it('refuses non-work: confidence-bearing todo (a finding), review, done', async () => {
    const finding = await createTask(md('a finding', 'todo', 'confidence: 0.8\n'));
    const inReview = await createTask(md('in review', 'review'));
    const finished = await createTask(md('finished', 'done'));
    for (const id of [finding, inReview, finished]) {
      const r = await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1').send({});
      expect(r.status).toBe(409);
    }
  });

  it('requires X-Writer-Id — an anonymous lease could never be renewed or attributed', async () => {
    const id = await createTask(md('needs identity'));
    const r = await request(app).post(`${url()}/${id}/claim`).send({});
    expect(r.status).toBe(400);
  });

  it('404s on a task that does not exist in this graph', async () => {
    const r = await asWriter(request(app).post(`${url()}/999999/claim`), 'agent-1').send({});
    expect(r.status).toBe(404);
  });
});

describe('DELETE /tasks/:id/claim (release)', () => {
  it('releases mid-lease work back to todo with the claim cleared', async () => {
    const id = await createTask(md('give it back'));
    await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1').send({});
    const r = await request(app).delete(`${url()}/${id}/claim`);
    expect(r.status).toBe(200);
    expect(r.body.released).toBe(true);
    expect(r.body.task.meta.status).toBe('todo');
    expect(r.body.task.claimed_by).toBeNull();
    expect(r.body.task.claim_expires_at).toBeNull();
    expect(r.body.task.content).toContain('status: todo');
  });

  it('a task that moved on (review) just sheds the stale lease, status untouched', async () => {
    const id = await createTask(md('moved on'));
    await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1').send({});
    // The holder finished and PATCHed to review; the lease fields linger.
    const cur = await pool.query('SELECT content FROM tasks WHERE id = $1', [id]);
    await request(app).patch(`${url()}/${id}`)
      .send({ content: cur.rows[0].content.replace('status: in_progress', 'status: review') });
    const r = await request(app).delete(`${url()}/${id}/claim`);
    expect(r.status).toBe(200);
    expect(r.body.task.meta.status).toBe('review');
    expect(r.body.task.claimed_by).toBeNull();
  });

  it('404s when there is no active claim', async () => {
    const id = await createTask(md('never claimed'));
    const r = await request(app).delete(`${url()}/${id}/claim`);
    expect(r.status).toBe(404);
  });
});

describe('/tasks/ready under claims', () => {
  it('a claimed task leaves /ready; release brings it back', async () => {
    const id = await createTask(md('queue item'));
    let ready = await request(app).get(`${url()}/ready`);
    expect(ready.body.map((t) => t.id)).toContain(id);

    await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1').send({});
    ready = await request(app).get(`${url()}/ready`);
    expect(ready.body.map((t) => t.id)).not.toContain(id);

    await request(app).delete(`${url()}/${id}/claim`);
    ready = await request(app).get(`${url()}/ready`);
    expect(ready.body.map((t) => t.id)).toContain(id);
  });

  it('an EXPIRED lease revives the task in /ready — abandoned work resurfaces with no sweeper', async () => {
    const id = await createTask(md('left behind'));
    await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1').send({});
    await pool.query("UPDATE tasks SET claim_expires_at = NOW() - interval '1 minute' WHERE id = $1", [id]);
    const ready = await request(app).get(`${url()}/ready`);
    const row = ready.body.find((t) => t.id === id);
    expect(row).toBeTruthy();
    // Marked, not laundered: the caller sees it's an expired claim, not fresh todo.
    expect(row.meta.status).toBe('in_progress');
    expect(row.claimed_by).toBe('agent-1');
  });

  it('a human-set in_progress (no claim) stays OUT of /ready — that is someone\'s active work', async () => {
    const id = await createTask(md('manual work', 'in_progress'));
    const ready = await request(app).get(`${url()}/ready`);
    expect(ready.body.map((t) => t.id)).not.toContain(id);
  });

  it('a human dragging a claimed card back to todo overrides the lease', async () => {
    const id = await createTask(md('overridden'));
    await asWriter(request(app).post(`${url()}/${id}/claim`), 'agent-1').send({});
    const cur = await pool.query('SELECT content FROM tasks WHERE id = $1', [id]);
    await request(app).patch(`${url()}/${id}`)
      .send({ content: cur.rows[0].content.replace('status: in_progress', 'status: todo') });
    const ready = await request(app).get(`${url()}/ready`);
    expect(ready.body.map((t) => t.id)).toContain(id);
  });
});

describe('claim atomicity', () => {
  it('two racing claimants: exactly one wins', async () => {
    const id = await createTask(md('the race'));
    const [a, b] = await Promise.all([
      asWriter(request(app).post(`${url()}/${id}/claim`), 'racer-a').send({}),
      asWriter(request(app).post(`${url()}/${id}/claim`), 'racer-b').send({}),
    ]);
    const codes = [a.status, b.status].sort();
    expect(codes).toEqual([200, 409]);
    const winner = a.status === 200 ? a : b;
    const t = await pool.query('SELECT claimed_by FROM tasks WHERE id = $1', [id]);
    expect(t.rows[0].claimed_by).toBe(winner.body.task.claimed_by);
  });
});
