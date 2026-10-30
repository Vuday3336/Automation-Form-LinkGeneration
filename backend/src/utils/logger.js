import { env } from '../config/env.js';

// Keys whose values must never reach a log line, wherever they appear in an object.
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'securetoken',
  'securetokenhash',
  'authorization',
  'cookie',
  'x-integration-secret',
  'jwt_secret',
  'integration_secret',
  'field_encryption_key',
  'database_url',
  'password_hash',
  'secure_token_hash',
  'patientname',
  'patient_name',
  'patient_name_encrypted',
  'formdata',
  'form_data',
  'form_data_encrypted',
]);

function redact(value, depth = 0) {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, depth + 1);
  }
  return out;
}

function write(level, message, meta) {
  if (env.isTest && level !== 'error') return; // keep test output clean

  const line = { time: new Date().toISOString(), level, message };
  if (meta !== undefined) line.meta = redact(meta);

  const output = env.isProduction ? JSON.stringify(line) : `[${line.time}] ${level.toUpperCase()} ${message}`;
  const extra = !env.isProduction && line.meta ? line.meta : '';

  if (level === 'error') console.error(output, extra);
  else if (level === 'warn') console.warn(output, extra);
  else console.log(output, extra);
}

export const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};
