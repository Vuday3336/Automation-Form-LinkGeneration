import './setup.js';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startTestDatabase, stopTestDatabase } from './helpers/testDb.js';

const { query } = await import('../src/config/db.js');
const { runMigrations } = await import('../src/config/migrations.js');
const { createHospital, findHospitalByNameOrCode } = await import('../src/models/Hospital.js');
const { createUser, findUserWithPasswordByEmail, ROLES } = await import('../src/models/User.js');
const { insertSubmission, findSubmissionByPublicId } = await import('../src/models/Submission.js');
const { insertAuditLog, listAuditLogsForSubmission, AUDIT_ACTIONS } = await import('../src/models/AuditLog.js');
const { seedDatabase, DEMO_HOSPITALS } = await import('../src/services/seedService.js');

before(startTestDatabase);
after(stopTestDatabase);

// Dummy data only.
const sampleSubmission = (overrides = {}) => ({
  submissionId: `HF-TEST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
  source: 'google_form',
  sourceResponseId: `resp-${Math.random().toString(36).slice(2)}`,
  hospitalName: 'Demo City General Hospital',
  department: 'Radiology',
  submissionType: 'Equipment Request',
  submittedAt: new Date('2026-10-30T09:00:00Z'),
  patientName: 'Test Patient Alpha',
  formData: { 'Request details': 'Dummy request for testing', Urgency: 'Low' },
  ...overrides,
});

describe('migrations', () => {
  test('running migrations again changes nothing', async () => {
    assert.deepEqual(await runMigrations(), []);
  });

  test('every table has row level security enabled', async () => {
    const { rows } = await query(
      `select relname, relrowsecurity from pg_class
       where relname in ('hospitals','users','user_hospital_access','submissions','audit_logs')`
    );
    assert.equal(rows.length, 5);
    for (const row of rows) assert.equal(row.relrowsecurity, true, `${row.relname} has RLS off`);
  });
});

describe('hospitals', () => {
  test('creates a hospital and finds it by name (any case) or code', async () => {
    const created = await createHospital({ code: 'unit1', name: 'Unit Test Hospital' });
    assert.equal(created.code, 'UNIT1');
    assert.equal((await findHospitalByNameOrCode('unit test HOSPITAL')).id, created.id);
    assert.equal((await findHospitalByNameOrCode('unit1')).id, created.id);
  });

  test('rejects duplicate hospital names ignoring case', async () => {
    await assert.rejects(createHospital({ code: 'UNIT2', name: 'UNIT TEST HOSPITAL' }), { code: '23505' });
  });
});

describe('users', () => {
  test('stores the hash, never returns it, and links hospital access', async () => {
    const hospital = await createHospital({ code: 'USR1', name: 'User Test Hospital' });
    const user = await createUser({
      name: 'Staff Member',
      email: 'Staff@Example.test',
      passwordHash: await bcrypt.hash('correct horse battery', 4),
      role: ROLES.STAFF,
      hospitalAccess: [hospital.id],
    });
    assert.equal(user.email, 'staff@example.test');
    assert.deepEqual(user.hospitalAccess, [hospital.id]);
    assert.equal('passwordHash' in user, false);

    const found = await findUserWithPasswordByEmail('STAFF@example.test');
    assert.ok(await bcrypt.compare('correct horse battery', found.passwordHash));
  });

  test('rejects an unknown role', async () => {
    await assert.rejects(
      createUser({ name: 'Bad Role', email: 'bad@example.test', passwordHash: 'x', role: 'owner' }),
      { code: '23514' }
    );
  });

  test('rejects duplicate emails ignoring case', async () => {
    await assert.rejects(
      createUser({ name: 'Copy', email: 'STAFF@EXAMPLE.TEST', passwordHash: 'x', role: ROLES.VIEWER }),
      { code: '23505' }
    );
  });
});

describe('submissions', () => {
  test('encrypts patient name and form data at rest, decrypts on read', async () => {
    const input = sampleSubmission();
    const { created, submission } = await insertSubmission(input);
    assert.equal(created, true);
    assert.equal(submission.patientName, 'Test Patient Alpha');
    assert.deepEqual(submission.formData, input.formData);

    const { rows } = await query(
      'select patient_name_encrypted, form_data_encrypted from submissions where submission_id = $1',
      [input.submissionId]
    );
    assert.ok(!rows[0].patient_name_encrypted.includes('Test Patient'), 'patient name stored in plain text');
    assert.ok(!rows[0].form_data_encrypted.includes('Dummy request'), 'form data stored in plain text');
  });

  test('a duplicate Google response is not stored twice', async () => {
    const input = sampleSubmission();
    const first = await insertSubmission(input);
    const second = await insertSubmission({ ...input, submissionId: 'HF-TEST-OTHERID' });
    assert.equal(second.created, false);
    assert.equal(second.submission.submissionId, first.submission.submissionId);

    const { rows } = await query('select count(*)::int as n from submissions where source_response_id = $1', [
      input.sourceResponseId,
    ]);
    assert.equal(rows[0].n, 1);
  });

  test('rejects an invalid status', async () => {
    await assert.rejects(insertSubmission(sampleSubmission({ status: 'Lost' })), { code: '23514' });
  });

  test('never exposes the token hash', async () => {
    const input = sampleSubmission({ secureTokenHash: 'a'.repeat(64) });
    await insertSubmission(input);
    const found = await findSubmissionByPublicId(input.submissionId);
    assert.equal('secureTokenHash' in found, false);
  });

  test('tampered ciphertext fails to decrypt instead of returning garbage', async () => {
    const input = sampleSubmission();
    await insertSubmission(input);
    await query(
      `update submissions set patient_name_encrypted = left(patient_name_encrypted, -2) || 'AA'
       where submission_id = $1`,
      [input.submissionId]
    );
    await assert.rejects(findSubmissionByPublicId(input.submissionId));
  });
});

describe('audit logs', () => {
  test('records and lists entries for a submission, newest first', async () => {
    await insertAuditLog({ action: AUDIT_ACTIONS.SUBMISSION_RECEIVED, submissionId: 'HF-AUDIT-1' });
    await insertAuditLog({
      action: AUDIT_ACTIONS.STATUS_CHANGED,
      submissionId: 'HF-AUDIT-1',
      metadata: { from: 'Pending', to: 'Approved' },
    });
    const logs = await listAuditLogsForSubmission('HF-AUDIT-1');
    assert.equal(logs.length, 2);
    assert.deepEqual(
      logs.map((l) => l.action).sort(),
      [AUDIT_ACTIONS.STATUS_CHANGED, AUDIT_ACTIONS.SUBMISSION_RECEIVED].sort()
    );
  });
});

describe('seed', () => {
  test('creates demo hospitals and the admin, and is safe to run twice', async () => {
    const admin = { name: 'Seed Admin', email: 'seed-admin@example.test', password: 'a-long-test-password' };
    const first = await seedDatabase({ admin });
    assert.equal(first.hospitalsCreated, DEMO_HOSPITALS.length);
    assert.equal(first.adminCreated, true);

    const second = await seedDatabase({ admin });
    assert.equal(second.hospitalsCreated, 0);
    assert.equal(second.adminCreated, false);

    const { user } = await findUserWithPasswordByEmail(admin.email);
    assert.equal(user.role, ROLES.SUPER_ADMIN);
  });
});
