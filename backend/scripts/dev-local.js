// Usage: npm run dev:local
// Runs the full API WITHOUT Supabase, on a local PostgreSQL (PGlite) saved in backend/.local-db.
// Tables are created and demo data is added automatically. Useful offline or for experiments:
// nothing here touches your Supabase project. Delete the .local-db folder to start fresh.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local-db');
process.env.DATABASE_URL = `pglite:${dataDir}`; // must be set before the config is loaded

const { connectDatabase } = await import('../src/config/db.js');
const { runMigrations } = await import('../src/config/migrations.js');
const { seedDatabase } = await import('../src/services/seedService.js');
const { logger } = await import('../src/utils/logger.js');
const { readSeedConfig, describeSeed } = await import('./seedConfig.js');

const config = readSeedConfig();
await connectDatabase();
await runMigrations();
logger.info(`Local seed: ${describeSeed(await seedDatabase(config), config)}`);

await import('../src/server.js');
