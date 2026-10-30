// Usage: npm run migrate
// Creates/updates the database tables in your Supabase project from db/migrations/*.sql.
import { connectDatabase, closeDatabase } from '../src/config/db.js';
import { runMigrations } from '../src/config/migrations.js';
import { logger } from '../src/utils/logger.js';

try {
  await connectDatabase();
  const applied = await runMigrations();
  if (applied.length) logger.info(`Applied migrations: ${applied.join(', ')}`);
  else logger.info('Database is already up to date');
} catch (err) {
  logger.error('Migration failed: nothing from the failing file was applied', err);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
