import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_URL = 'postgresql://postgres@localhost/postgres';
const TEST_DB = 'multitap_test';
export const TEST_URL = `postgresql://postgres@localhost/${TEST_DB}`;

let pool;

export function getTestPool() {
  return pool;
}

beforeAll(async () => {
  // Ensure test DB exists
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  // Connect to test DB and load schema
  pool = new pg.Pool({ connectionString: TEST_URL });
  const schema = fs.readFileSync(
    path.join(__dirname, '..', 'db', 'schema.sql'),
    'utf-8'
  );
  await pool.query(schema);
});

beforeEach(async () => {
  // `events` and `graph_snapshots` are listed EXPLICITLY because they carry no
  // foreign key to graphs(id) — deliberately, so a graph's history outlives the
  // graph (E18.1). That is exactly why the CASCADE above cannot reach them:
  // without naming them here the log accumulates across tests and the suite
  // becomes order-dependent. VERIFIED: 1000 rows survived the CASCADE.
  await pool.query(
    'TRUNCATE graphs, tasks, edges, users, graph_members, invite_tokens, agent_tokens, pending_members, events, graph_snapshots RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  if (pool) await pool.end();
});
