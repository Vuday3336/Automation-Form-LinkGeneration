import fs from 'node:fs';
import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// The rest of the app talks to the database ONLY through the functions exported here:
//   query(sql, params)  → { rows, rowCount }
//   transaction(fn)     → runs fn({ query }) inside BEGIN/COMMIT, ROLLBACK on error
//
// Behind them sits a "driver". In real use it's a pg connection pool pointed at Supabase.
// In tests it's PGlite (Postgres compiled to WebAssembly, running in memory), so tests
// need no internet, no Supabase project and never touch real data.

let driver = null;

function createPgDriver(pool) {
  return {
    query: (text, params) => pool.query(text, params),
    exec: (text) => pool.query(text),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = {
          query: (text, params) => client.query(text, params),
          exec: (text) => client.query(text),
        };
        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

// Supabase requires encrypted (TLS) connections. If you downloaded Supabase's CA certificate
// (Dashboard → Project Settings → Database → SSL Configuration), point DATABASE_SSL_CA_PATH to it
// so the server's identity is verified too.
function sslOptions() {
  if (env.DATABASE_SSL === 'disable') return false;
  if (env.DATABASE_SSL_CA_PATH) {
    return { ca: fs.readFileSync(env.DATABASE_SSL_CA_PATH, 'utf8'), rejectUnauthorized: true };
  }
  if (env.isProduction) {
    logger.warn('DATABASE_SSL_CA_PATH is not set: the connection is encrypted but the server certificate is not verified.');
  }
  return { rejectUnauthorized: false };
}

export async function connectDatabase() {
  if (driver) return driver;
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add your Supabase connection string to backend/.env');
  }

  // "pglite:<folder>" = local Postgres stored in a folder (npm run dev:local). Development only.
  if (env.DATABASE_URL.startsWith('pglite:')) {
    if (env.isProduction) throw new Error('The local PGlite database cannot be used in production');
    const { createPgliteDriver } = await import('./pgliteDriver.js');
    driver = await createPgliteDriver(env.DATABASE_URL.slice('pglite:'.length));
    logger.info('Connected to LOCAL PGlite database (not Supabase)');
    return driver;
  }

  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl: sslOptions(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // An idle client losing its connection must not crash the whole server.
  pool.on('error', (err) => logger.error('Idle database client error', err));

  await pool.query('select 1'); // fail fast with a clear error if the URL/password is wrong
  driver = createPgDriver(pool);
  logger.info('Connected to PostgreSQL (Supabase)');
  return driver;
}

// Tests (and only tests) swap in their own driver.
export function setDatabaseDriver(customDriver) {
  driver = customDriver;
}

function requireDriver() {
  if (!driver) throw new Error('Database is not connected. Call connectDatabase() first.');
  return driver;
}

export function query(text, params) {
  return requireDriver().query(text, params);
}

export function transaction(fn) {
  return requireDriver().transaction(fn);
}

// Runs a multi-statement SQL script (used by migrations).
export function exec(text) {
  return requireDriver().exec(text);
}

// Used by the health check: true if the database answers right now.
export async function isDatabaseHealthy() {
  if (!driver) return false;
  try {
    await driver.query('select 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase() {
  if (!driver) return;
  const current = driver;
  driver = null;
  await current.close();
}
