import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

// Entry point: connect to the database first, then start accepting HTTP requests.
// If the database is unreachable at startup we stop immediately with a clear message,
// rather than running a server that fails on every request.
async function start() {
  try {
    await connectDatabase();
  } catch (err) {
    logger.error('Could not connect to the database. Check DATABASE_URL in backend/.env and that the Supabase project is not paused.', err);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Graceful shutdown: finish in-flight requests, close DB connections, then exit.
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason instanceof Error ? reason : { reason: String(reason) });
});

start();
