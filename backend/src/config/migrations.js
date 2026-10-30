import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, transaction } from './db.js';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

// Applies every .sql file in db/migrations that hasn't run yet, in filename order.
// Each file runs inside a transaction: it either applies completely or not at all.
// Applied file names are recorded in schema_migrations, so running this twice is safe.
export async function runMigrations() {
  await query(`
    create table if not exists schema_migrations (
      name        text primary key,
      applied_at  timestamptz not null default now()
    )`);
  // The bookkeeping table is internal; keep it out of Supabase's public REST API as well.
  await query('alter table schema_migrations enable row level security');

  const { rows } = await query('select name from schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const newlyApplied = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('insert into schema_migrations (name) values ($1)', [file]);
    });
    newlyApplied.push(file);
  }
  return newlyApplied;
}
