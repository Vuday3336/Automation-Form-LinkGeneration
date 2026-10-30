import crypto from 'node:crypto';
import { env } from '../config/env.js';

// AES-256-GCM: a standard, authenticated encryption algorithm. "Authenticated" means that if
// anyone tampers with the stored ciphertext, decryption fails instead of returning garbage.
//
// Stored format (one text column):  v1.<iv>.<authTag>.<ciphertext>  (each part base64url)
// - iv: 12 random bytes, new for every value, so the same name never encrypts the same way twice
// - authTag: proves the data wasn't modified
// - "v1" lets us change the scheme later without breaking old rows.

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

// Turn the configured secret (any long random string) into exactly 32 bytes.
const key = crypto.createHash('sha256').update(env.FIELD_ENCRYPTION_KEY, 'utf8').digest();

export function encryptText(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION, iv, authTag, ciphertext].map((p) => (Buffer.isBuffer(p) ? p.toString('base64url') : p)).join('.');
}

export function decryptText(payload) {
  if (payload === null || payload === undefined) return null;
  const [version, iv, authTag, ciphertext] = String(payload).split('.');
  if (version !== VERSION || !iv || !authTag || ciphertext === undefined) {
    throw new Error('Encrypted value has an unknown format');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

// Convenience helpers for objects (form answers).
export const encryptJson = (value) => encryptText(JSON.stringify(value ?? {}));
export const decryptJson = (payload) => (payload ? JSON.parse(decryptText(payload)) : {});
