import 'dotenv/config';
import { z } from 'zod';

// Every setting the app needs, with its type and rules, in one place.
// If something is missing or invalid, the server refuses to start and tells
// you exactly which variable is wrong instead of crashing later at random.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  // Supabase Postgres connection string. Not required in tests (they use an in-memory database).
  DATABASE_URL: z.string().default(''),
  // 'require' (default, needed for Supabase) or 'disable' (only for a plain local Postgres).
  DATABASE_SSL: z.enum(['require', 'disable']).default('require'),
  // Optional path to Supabase's CA certificate so the server's identity is verified.
  DATABASE_SSL_CA_PATH: z.string().default(''),
  // Secret used to encrypt patient names and form answers before they're stored.
  FIELD_ENCRYPTION_KEY: z
    .string({ error: 'is missing (generate one with: npm run secret)' })
    .min(32, 'must be at least 32 characters (generate one with: npm run secret)'),
  JWT_SECRET: z
    .string({ error: 'is missing (generate one with: npm run secret)' })
    .min(32, 'must be at least 32 characters (generate one with: npm run secret)'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  INTEGRATION_SECRET: z
    .string({ error: 'is missing (generate one with: npm run secret)' })
    .min(32, 'must be at least 32 characters (generate one with: npm run secret)'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  LINK_BASE_URL: z.string().url().default('http://localhost:5173'),
  LINK_TTL_HOURS: z.coerce.number().positive().default(72),
  // Public HTTPS address of this API (e.g. your tunnel or deployed URL). Shown on the
  // Integration Settings page so you know what to paste into Apps Script.
  PUBLIC_API_URL: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print only variable names and rule messages — never the values themselves.
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(`Invalid environment configuration:\n${problems.join('\n')}`);
  console.error('Copy backend/.env.example to backend/.env and fill it in.');
  process.exit(1);
}

const raw = parsed.data;

export const env = Object.freeze({
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  // "http://a.com, http://b.com" → ['http://a.com', 'http://b.com']
  corsOrigins: raw.FRONTEND_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});
