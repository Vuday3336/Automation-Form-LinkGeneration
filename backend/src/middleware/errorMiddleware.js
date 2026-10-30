import { ApiError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

// Runs when no route matched the URL.
export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Central error handler: Express calls it when any route or middleware throws or
// calls next(err). It decides the status code and hides internal details from clients.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors;

  // Malformed JSON body sent by a client
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  }

  // PostgreSQL constraint errors (codes from the Postgres documentation, "Error Codes" appendix).
  // We translate them into client errors and never echo the raw database message.
  if (err.code === '23505') {
    status = 409;
    message = 'A record with the same unique value already exists';
    errors = undefined;
  } else if (err.code === '23503' || err.code === '23514' || err.code === '22P02') {
    status = 400; // foreign key / check constraint / malformed value (e.g. bad UUID)
    message = 'The request contains an invalid value';
    errors = undefined;
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed`, err);
    // Never leak stack traces or internal messages for server errors in production.
    if (env.isProduction) {
      message = 'Internal server error';
      errors = undefined;
    }
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;
  res.status(status).json(body);
}
