import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { isDatabaseHealthy } from './config/db.js';
import { sendSuccess } from './utils/apiResponse.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Builds and returns the Express app WITHOUT starting a network listener.
// Keeping this separate from server.js lets tests import the app directly.
export function createApp() {
  const app = express();

  // If deployed behind a proxy (Render, Railway, Nginx), trust it so rate limiting sees real client IPs.
  if (env.isProduction) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // 1. Security headers (Content-Security-Policy, X-Frame-Options, HSTS, ...).
  app.use(helmet());

  // 2. CORS: only our own frontend may call the API from a browser, with cookies.
  //    Requests without an Origin header (Apps Script, Postman, curl) aren't browser cross-origin
  //    calls; they're protected by the integration secret / login instead.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    })
  );

  // 3. Global rate limit: at most 300 requests per IP per 15 minutes.
  //    Login and integration routes will get their own stricter limits later.
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, message: 'Too many requests, please try again later' },
    })
  );

  // 4. Parse JSON bodies (size-capped) and cookies.
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  // Health check: lets you, uptime monitors and the frontend confirm the API and database are alive.
  // Returns 503 (Service Unavailable) when the database can't be reached.
  app.get('/api/health', async (req, res) => {
    const databaseUp = await isDatabaseHealthy();
    sendSuccess(res, {
      status: databaseUp ? 200 : 503,
      message: databaseUp ? 'HospitalForm AI API is running' : 'API is running but the database is unreachable',
      data: {
        status: databaseUp ? 'ok' : 'degraded',
        database: databaseUp ? 'up' : 'down',
        environment: env.NODE_ENV,
        time: new Date().toISOString(),
      },
    });
  });

  // Feature routes (auth, submissions, dashboard, integrations) are mounted here in later phases.

  // 5. Anything that didn't match a route → 404, then the central error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
