import { env } from '../config/env.js';
import { generateSecureToken, hashToken } from '../utils/generateToken.js';

// How secure links work:
// 1. Create a random token (only ever shown once, in the URL).
// 2. Store only its SHA-256 hash plus an expiry date in the submission row.
// 3. When someone opens the link, hash the token from the URL and look the hash up.
// 4. The person must ALSO be logged in and have access to that hospital (checked by the caller).

export const buildSecureUrl = (token) => `${env.LINK_BASE_URL.replace(/\/+$/, '')}/submissions/secure/${token}`;

export function createLink(now = new Date()) {
  const token = generateSecureToken();
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + env.LINK_TTL_HOURS * 60 * 60 * 1000),
    url: buildSecureUrl(token),
  };
}

// 'valid' | 'expired' | 'revoked' | 'none'
export function getLinkState(submission, now = new Date()) {
  if (submission.linkRevokedAt) return 'revoked';
  if (!submission.linkExpiresAt) return 'none';
  return new Date(submission.linkExpiresAt) <= now ? 'expired' : 'valid';
}

export { hashToken };
