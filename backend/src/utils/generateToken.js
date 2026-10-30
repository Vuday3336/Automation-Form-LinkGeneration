import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// ─── Secure link tokens ──────────────────────────────────────────────────────
// 32 random bytes = 256 bits from the operating system's secure random generator.
// Guessing one is not realistically possible. Encoded as URL-safe text (43 characters).
export const generateSecureToken = () => crypto.randomBytes(32).toString('base64url');

// One-way SHA-256 fingerprint of a token. The database stores only this, so even someone
// with a full copy of the database can't rebuild working links.
export const hashToken = (token) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');

// ─── Public submission IDs ───────────────────────────────────────────────────
// Format: HF-20261030-7K3QX9PA. The date makes IDs readable; 8 random characters make them
// unguessable and non-sequential. The alphabet skips look-alikes (0/O, 1/I).
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters → no modulo bias

export function generateSubmissionId(date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  let suffix = '';
  for (const byte of crypto.randomBytes(8)) suffix += ID_ALPHABET[byte % 32];
  return `HF-${day}-${suffix}`;
}

// ─── Login tokens (JWT) ──────────────────────────────────────────────────────
// A JWT is a signed note saying "this is user X". Only the server knows JWT_SECRET, so only
// the server can create or verify one. We keep it inside an httpOnly cookie.
export function signAuthToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
}

// ─── Constant-time comparison ────────────────────────────────────────────────
// Comparing secrets with === leaks how many leading characters matched through timing.
// Hashing both sides first also makes the lengths equal, which timingSafeEqual requires.
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
