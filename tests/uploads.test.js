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
  const r = await pool.query("INSERT INTO graphs (name) VALUES ('t') RETURNING id");
  gid = r.rows[0].id;
});

// 1x1 transparent PNG. Smallest valid PNG that exercises the bytes path
// without bringing in a fixtures file or generating one at test time.
const ONE_PX_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000119d3a7800000000049454e44ae426082',
  'hex',
);

describe('uploads', () => {
  test('POST stores image bytes and returns a URL the GET path resolves', async () => {
    const post = await request(app)
      .post(`/api/graphs/${gid}/uploads`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    expect(post.status).toBe(201);
    expect(post.body.id).toBeTruthy();
    expect(post.body.url).toBe(`/api/graphs/${gid}/uploads/${post.body.id}`);
    expect(post.body.content_type).toBe('image/png');
    expect(post.body.byte_size).toBe(ONE_PX_PNG.length);

    const get = await request(app).get(post.body.url);
    expect(get.status).toBe(200);
    expect(get.headers['content-type']).toBe('image/png');
    expect(get.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(get.body, ONE_PX_PNG)).toBe(0);
  });

  test('rejects non-image content types with 415', async () => {
    const post = await request(app)
      .post(`/api/graphs/${gid}/uploads`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from([1, 2, 3]));
    expect(post.status).toBe(415);
  });

  test('cascades when the parent graph is deleted', async () => {
    const post = await request(app)
      .post(`/api/graphs/${gid}/uploads`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    expect(post.status).toBe(201);
    await pool.query('DELETE FROM graphs WHERE id = $1', [gid]);
    const orphan = await pool.query('SELECT 1 FROM uploads WHERE id = $1', [post.body.id]);
    expect(orphan.rowCount).toBe(0);
  });

  test('GET returns 404 for an upload that does not exist in this graph', async () => {
    // Drop a real upload in another graph, then ask for it under our gid.
    const other = await pool.query("INSERT INTO graphs (name) VALUES ('o') RETURNING id");
    const otherGid = other.rows[0].id;
    const post = await request(app)
      .post(`/api/graphs/${otherGid}/uploads`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    expect(post.status).toBe(201);
    const get = await request(app).get(`/api/graphs/${gid}/uploads/${post.body.id}`);
    expect(get.status).toBe(404);
  });
});
