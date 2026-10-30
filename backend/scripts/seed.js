// Usage: npm run seed
// Adds fictional demo hospitals and your first Super Admin (from SEED_ADMIN_* in .env).
import { z } from 'zod';
import { connectDatabase, closeDatabase } from '../src/config/db.js';
import { seedDatabase } from '../src/services/seedService.js';
import { logger } from '../src/utils/logger.js';

const adminSchema = z.object({
  name: z.string().min(2, 'SEED_ADMIN_NAME must be at least 2 characters'),
  email: z.email('SEED_ADMIN_EMAIL must be a valid email'),
  password: z.string().min(12, 'SEED_ADMIN_PASSWORD must be at least 12 characters'),
});

const admin = adminSchema.safeParse({
  name: process.env.SEED_ADMIN_NAME || 'Super Admin',
  email: process.env.SEED_ADMIN_EMAIL,
  password: process.env.SEED_ADMIN_PASSWORD,
});

if (!admin.success) {
  logger.error(`Seed settings invalid: ${admin.error.issues.map((i) => i.message).join('; ')}`);
  process.exit(1);
}

try {
  await connectDatabase();
  const summary = await seedDatabase({ admin: admin.data });
  logger.info(
    `Seed complete: ${summary.hospitalsCreated} hospital(s) added (${summary.totalHospitals} total); ` +
      (summary.adminCreated ? `Super Admin created for ${admin.data.email}` : 'Super Admin already existed')
  );
} catch (err) {
  logger.error('Seeding failed. Did you run "npm run migrate" first?', err);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
