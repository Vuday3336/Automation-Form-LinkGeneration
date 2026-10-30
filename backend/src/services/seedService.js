import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import { createHospital, findHospitalByNameOrCode } from '../models/Hospital.js';
import { createUser, findUserWithPasswordByEmail, ROLES } from '../models/User.js';

export const BCRYPT_ROUNDS = 12;

// Fictional hospitals for development. Never replace these with real patient data.
export const DEMO_HOSPITALS = [
  { code: 'DCGH', name: 'Demo City General Hospital' },
  { code: 'SVMC', name: 'Sample Valley Medical Center' },
  { code: 'TRCH', name: 'Test River Children Hospital' },
];

// Idempotent: running it again skips anything that already exists.
export async function seedDatabase({ admin }) {
  const summary = { hospitalsCreated: 0, adminCreated: false };

  for (const hospital of DEMO_HOSPITALS) {
    if (await findHospitalByNameOrCode(hospital.code)) continue;
    await createHospital(hospital);
    summary.hospitalsCreated += 1;
  }

  if (!(await findUserWithPasswordByEmail(admin.email))) {
    await createUser({
      name: admin.name,
      email: admin.email,
      passwordHash: await bcrypt.hash(admin.password, BCRYPT_ROUNDS),
      role: ROLES.SUPER_ADMIN, // super admins see every hospital, so no hospitalAccess needed
    });
    summary.adminCreated = true;
  }

  const { rows } = await query('select count(*)::int as count from hospitals');
  summary.totalHospitals = rows[0].count;
  return summary;
}
