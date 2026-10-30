import { PGlite } from '@electric-sql/pglite';
import { setDatabaseDriver, closeDatabase } from '../../src/config/db.js';
import { runMigrations } from '../../src/config/migrations.js';

// PGlite reports affected rows as "affectedRows"; normalise to pg's { rows, rowCount }.
const normalise = (result) => ({ rows: result.rows, rowCount: result.affectedRows ?? result.rows.length });

// Starts a brand-new, empty Postgres in memory, plugs it in as the app's database,
// and applies the real migrations, so tests run against exactly the production schema.
export async function startTestDatabase() {
  const pglite = new PGlite();
  await pglite.waitReady;

  setDatabaseDriver({
    query: async (text, params) => normalise(await pglite.query(text, params)),
    exec: (text) => pglite.exec(text),
    transaction: (fn) =>
      pglite.transaction((tx) =>
        fn({
          query: async (text, params) => normalise(await tx.query(text, params)),
          exec: (text) => tx.exec(text),
        })
      ),
    close: () => pglite.close(),
  });

  await runMigrations();
  return pglite;
}

export async function stopTestDatabase() {
  await closeDatabase();
}
