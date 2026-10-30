import { z } from 'zod';

// Reads and checks the SEED_* settings from .env (shared by seed.js and dev-local.js).
const seedSchema = z.object({
  admin: z.object({
    name: z.string().min(2, 'SEED_ADMIN_NAME must be at least 2 characters'),
    email: z.email('SEED_ADMIN_EMAIL must be a valid email'),
    password: z.string().min(12, 'SEED_ADMIN_PASSWORD must be at least 12 characters'),
  }),
  demoPassword: z.string().min(12, 'SEED_DEMO_PASSWORD must be at least 12 characters').nullable(),
});

export function readSeedConfig() {
  const result = seedSchema.safeParse({
    admin: {
      name: process.env.SEED_ADMIN_NAME || 'Super Admin',
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    },
    demoPassword: process.env.SEED_DEMO_PASSWORD || null,
  });
  if (!result.success) {
    throw new Error(`Seed settings invalid: ${result.error.issues.map((i) => i.message).join('; ')}`);
  }
  return result.data;
}

export function describeSeed(summary, config) {
  return [
    `${summary.hospitalsCreated} hospital(s) added (${summary.totalHospitals} total)`,
    summary.adminCreated ? `Super Admin created for ${config.admin.email}` : 'Super Admin already existed',
    config.demoPassword
      ? `${summary.demoUsersCreated} demo user(s), ${summary.demoSubmissionsCreated} demo submission(s) added`
      : 'demo data skipped (SEED_DEMO_PASSWORD not set)',
  ].join('; ');
}
