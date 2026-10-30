import { query } from '../config/db.js';
import { createHospital, findHospitalByNameOrCode } from '../models/Hospital.js';
import { createUser, findUserWithPasswordByEmail, ROLES } from '../models/User.js';
import { findSubmissionBySource, updateSubmission } from '../models/Submission.js';
import { insertAuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { hashPassword } from './authService.js';
import { ingestGoogleFormSubmission } from './submissionService.js';
import { DEMO_SUBMISSIONS } from './sampleData.js';

// Fictional hospitals for development. Never replace these with real patient data.
export const DEMO_HOSPITALS = [
  { code: 'DCGH', name: 'Demo City General Hospital' },
  { code: 'SVMC', name: 'Sample Valley Medical Center' },
  { code: 'TRCH', name: 'Test River Children Hospital' },
];

// One account per role, to try out permissions and hospital isolation.
export const DEMO_USERS = [
  { name: 'Dana Admin (DCGH)', email: 'dcgh.admin@hospitalform.test', role: ROLES.HOSPITAL_ADMIN, hospitals: ['DCGH'] },
  { name: 'Sam Staff (DCGH)', email: 'dcgh.staff@hospitalform.test', role: ROLES.STAFF, hospitals: ['DCGH'] },
  { name: 'Vic Viewer (SVMC)', email: 'svmc.viewer@hospitalform.test', role: ROLES.VIEWER, hospitals: ['SVMC'] },
];

async function ensureUser({ name, email, password, role, hospitalAccess = [] }) {
  if (await findUserWithPasswordByEmail(email)) return false;
  await createUser({ name, email, passwordHash: await hashPassword(password), role, hospitalAccess });
  return true;
}

// Idempotent: running it again skips anything that already exists.
// demoPassword: if given, also creates the demo users and demo submissions.
export async function seedDatabase({ admin, demoPassword = null }) {
  const summary = { hospitalsCreated: 0, adminCreated: false, demoUsersCreated: 0, demoSubmissionsCreated: 0 };

  const hospitalIds = {};
  for (const hospital of DEMO_HOSPITALS) {
    const existing = await findHospitalByNameOrCode(hospital.code);
    if (existing) hospitalIds[hospital.code] = existing.id;
    else {
      hospitalIds[hospital.code] = (await createHospital(hospital)).id;
      summary.hospitalsCreated += 1;
    }
  }

  summary.adminCreated = await ensureUser({ ...admin, role: ROLES.SUPER_ADMIN });

  if (demoPassword) {
    for (const demo of DEMO_USERS) {
      const created = await ensureUser({
        ...demo,
        password: demoPassword,
        hospitalAccess: demo.hospitals.map((code) => hospitalIds[code]),
      });
      if (created) summary.demoUsersCreated += 1;
    }

    for (const demo of DEMO_SUBMISSIONS) {
      if (await findSubmissionBySource('google_form', demo.id)) continue;
      const result = await ingestGoogleFormSubmission(demo.payload);
      if (demo.status !== 'Pending') {
        await updateSubmission(result.submissionId, { status: demo.status });
        await insertAuditLog({
          action: AUDIT_ACTIONS.STATUS_CHANGED,
          submissionId: result.submissionId,
          metadata: { from: 'Pending', to: demo.status, seeded: true },
        });
      }
      summary.demoSubmissionsCreated += 1;
    }
  }

  const { rows } = await query('select count(*)::int as count from hospitals');
  summary.totalHospitals = rows[0].count;
  return summary;
}
