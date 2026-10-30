// Usage: npm run seed
// Adds fictional demo hospitals and your first Super Admin (SEED_ADMIN_* in .env).
// If SEED_DEMO_PASSWORD is set, also adds one demo user per role and demo submissions.
import { connectDatabase, closeDatabase } from '../src/config/db.js';
import { seedDatabase } from '../src/services/seedService.js';
import { logger } from '../src/utils/logger.js';
import { readSeedConfig, describeSeed } from './seedConfig.js';

try {
  const config = readSeedConfig();
  await connectDatabase();
  const summary = await seedDatabase(config);
  logger.info(`Seed complete: ${describeSeed(summary, config)}`);
} catch (err) {
  logger.error('Seeding failed. Did you run "npm run migrate" first?', err);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
