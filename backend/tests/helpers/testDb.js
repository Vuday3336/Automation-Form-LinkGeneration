import { setDatabaseDriver, closeDatabase } from '../../src/config/db.js';
import { createPgliteDriver } from '../../src/config/pgliteDriver.js';
import { runMigrations } from '../../src/config/migrations.js';

// Starts a brand-new, empty Postgres in memory, plugs it in as the app's database,
// and applies the real migrations, so tests run against exactly the production schema.
export async function startTestDatabase() {
  setDatabaseDriver(await createPgliteDriver());
  await runMigrations();
}

export async function stopTestDatabase() {
  await closeDatabase();
}
