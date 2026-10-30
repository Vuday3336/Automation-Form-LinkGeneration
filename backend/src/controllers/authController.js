import * as authService from '../services/authService.js';
import { AUTH_COOKIE, authCookieOptions } from '../middleware/authMiddleware.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { signAuthToken, verifyAuthToken } from '../utils/generateToken.js';

export async function login(req, res) {
  const { email, password } = req.validated.body;
  const user = await authService.login(email, password, { ip: req.ip });

  const token = signAuthToken(user);
  const { exp } = verifyAuthToken(token);
  res.cookie(AUTH_COOKIE, token, { ...authCookieOptions, maxAge: exp * 1000 - Date.now() });
  sendSuccess(res, { message: 'Logged in', data: { user } });
}

export function logout(req, res) {
  res.clearCookie(AUTH_COOKIE, authCookieOptions);
  sendSuccess(res, { message: 'Logged out' });
}

export function me(req, res) {
  sendSuccess(res, { data: { user: req.user } });
}

// Registration is admin-only (see authRoutes). The first Super Admin comes from `npm run seed`.
export async function register(req, res) {
  const user = await authService.registerUser(req.user, req.validated.body);
  sendSuccess(res, { status: 201, message: 'User created', data: { user } });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated.body;
  await authService.changePassword(req.user, currentPassword, newPassword);
  sendSuccess(res, { message: 'Password changed' });
}
