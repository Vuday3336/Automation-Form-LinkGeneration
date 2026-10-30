import { env } from '../config/env.js';
import { findUserById } from '../models/User.js';
import { ApiError } from '../utils/apiResponse.js';
import { verifyAuthToken } from '../utils/generateToken.js';

export const AUTH_COOKIE = 'hf_session';

// httpOnly: browser JavaScript can't read it (protects against XSS token theft).
// sameSite strict: the browser won't send it on requests started by other websites (CSRF).
// secure: only sent over HTTPS in production.
export const authCookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: env.isProduction,
  path: '/',
};

// Authentication: "who are you?" Reads the session cookie, verifies its signature and expiry,
// then reloads the user from the database so deactivated accounts and role changes apply
// immediately, not just when the token expires.
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please log in again');
  }

  const user = await findUserById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('This account is not active');

  req.user = user;
  next();
}
