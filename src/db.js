import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function createPool(connectionString) {
  const pool = new pg.Pool({ connectionString });
  // An idle connection the server drops (a database re-provisioned at
  // publish, a restart, a network blip) surfaces as an 'error' event on the
  // pool. Unhandled, that event ends the process — which is how the app
  // crash-looped for ten minutes on 2026-11-06 while the platform
  // re-provisioned its database. Handled, the pool discards the dead client
  // and the next query opens a fresh one.
  pool.on('error', (err) => {
    console.error('[db] idle connection dropped:', err.message);
  });
  return pool;
}

// Apply db/schema.sql against the live pool. Schema is idempotent (CREATE
// TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DO $$ ... IF NOT EXISTS
// guards) so this is safe to run on every server start. Without it, fresh
// deploys or schema changes would silently fail at the first query — which
// is exactly the trap that bit Phase B5d's auth-on rollout.
export async function applySchema(targetPool) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(here, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await targetPool.query(sql);
}

// Exported for modules that need their own dedicated connection to the same
// database (the search indexer's LISTEN client; src/sse.js predates the export
// and keeps its local copy).
export function resolveConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const bootstrap = process.env.PG_BOOTSTRAP_URL;
  const dbName = process.env.DATABASE_NAME;
  if (bootstrap && dbName) {
    // Replace the path of PG_BOOTSTRAP_URL with our own DATABASE_NAME.
    const u = new URL(bootstrap);
    u.pathname = `/${dbName}`;
    return u.toString();
  }
  return 'postgresql://postgres@localhost/multitap';
}

const pool = createPool(resolveConnectionString());

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
