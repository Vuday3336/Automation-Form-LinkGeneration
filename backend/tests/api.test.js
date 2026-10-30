import './setup.js';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startTestDatabase, stopTestDatabase } from './helpers/testDb.js';

const { createApp } = await import('../src/app.js');
const { query } = await import('../src/config/db.js');
const { seedDatabase } = await import('../src/services/seedService.js');
const { buildSamplePayload } = await import('../src/services/sampleData.js');

const app = createApp();
const SECRET = process.env.INTEGRATION_SECRET;
const ADMIN = { name: 'Test Super', email: 'super@hospitalform.test', password: 'super-admin-password' };
const DEMO_PASSWORD = 'demo-user-password';

// supertest "agents" keep cookies between requests, like a logged-in browser.
async function loginAs(email, password = DEMO_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, `login failed for ${email}: ${res.body.message}`);
  return agent;
}

const ingest = (payload, secret = SECRET) =>
  request(app).post('/api/integrations/google-form/submissions').set('X-Integration-Secret', secret).send(payload);

let superAdmin, dcghAdmin, dcghStaff, svmcViewer;

before(async () => {
  await startTestDatabase();
  await seedDatabase({ admin: ADMIN, demoPassword: DEMO_PASSWORD });
  superAdmin = await loginAs(ADMIN.email, ADMIN.password);
  dcghAdmin = await loginAs('dcgh.admin@hospitalform.test');
  dcghStaff = await loginAs('dcgh.staff@hospitalform.test');
  svmcViewer = await loginAs('svmc.viewer@hospitalform.test');
});
after(stopTestDatabase);

describe('authentication', () => {
  test('login sets an httpOnly cookie and never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'][0], /hf_session=.+HttpOnly/i);
    assert.match(res.headers['set-cookie'][0], /SameSite=Strict/i);
    assert.equal(JSON.stringify(res.body).includes('password'), false);
  });

  test('wrong password and unknown email give the same 401 message', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: 'wrong-password-123' });
    const b = await request(app).post('/api/auth/login').send({ email: 'nobody@hospitalform.test', password: 'x' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });

  test('/me requires login', async () => {
    assert.equal((await request(app).get('/api/auth/me')).status, 401);
    const res = await dcghStaff.get('/api/auth/me');
    assert.equal(res.body.data.user.role, 'staff');
  });

  test('a forged cookie is rejected', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'hf_session=not.a.real.token');
    assert.equal(res.status, 401);
  });

  test('logout clears the cookie', async () => {
    const agent = await loginAs('dcgh.staff@hospitalform.test');
    await agent.post('/api/auth/logout');
    assert.equal((await agent.get('/api/auth/me')).status, 401);
  });
});

describe('Google Form integration endpoint', () => {
  test('1. stores a submission and returns a secure link', async () => {
    const res = await ingest(buildSamplePayload({ sourceResponseId: 'it-success-1' }));
    assert.equal(res.status, 201);
    assert.match(res.body.data.submissionId, /^HF-\d{8}-[A-Z2-9]{8}$/);
    assert.match(res.body.data.secureUrl, /\/submissions\/secure\/[A-Za-z0-9_-]{43}$/);
    assert.equal(res.body.data.hospitalMatched, true);
  });

  test('2. rejects a wrong or missing integration secret', async () => {
    const payload = buildSamplePayload({ sourceResponseId: 'it-bad-secret' });
    assert.equal((await ingest(payload, 'wrong-secret')).status, 401);
    assert.equal((await request(app).post('/api/integrations/google-form/submissions').send(payload)).status, 401);
  });

  test('3. a duplicate response is stored once and reported as duplicate', async () => {
    const payload = buildSamplePayload({ sourceResponseId: 'it-duplicate' });
    const first = await ingest(payload);
    const second = await ingest(payload);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.duplicate, true);
    assert.equal(second.body.data.submissionId, first.body.data.submissionId);
    assert.equal(second.body.data.secureUrl, null);
  });

  test('4. missing required fields are rejected with field messages', async () => {
    const noAnswers = await ingest({ sourceResponseId: 'x', submittedAt: new Date().toISOString(), answers: [] });
    assert.equal(noAnswers.status, 400);
    assert.ok(noAnswers.body.errors.some((e) => e.field === 'answers'));

    const noHospital = await ingest({
      sourceResponseId: 'it-no-hospital',
      submittedAt: new Date().toISOString(),
      answers: [{ question: 'Department', answer: 'Radiology' }],
    });
    assert.equal(noHospital.status, 400);
    assert.match(noHospital.body.errors[0].message, /No hospital answer/);
  });

  test('unknown hospital names are stored as unassigned (Super Admin only)', async () => {
    const res = await ingest(buildSamplePayload({ sourceResponseId: 'it-unknown-hospital', hospital: 'Nowhere Clinic' }));
    assert.equal(res.body.data.hospitalMatched, false);
    assert.equal((await superAdmin.get(`/api/submissions/${res.body.data.submissionId}`)).status, 200);
    assert.equal((await dcghAdmin.get(`/api/submissions/${res.body.data.submissionId}`)).status, 403);
  });
});

describe('secure links', () => {
  let submissionId, secureUrl, token;
  before(async () => {
    const res = await ingest(buildSamplePayload({ sourceResponseId: 'it-links', hospital: 'Demo City General Hospital' }));
    ({ submissionId, secureUrl } = res.body.data);
    token = secureUrl.split('/').pop();
  });

  test('6. only the hash of the token is stored', async () => {
    const { rows } = await query('select secure_token_hash from submissions where submission_id = $1', [submissionId]);
    assert.notEqual(rows[0].secure_token_hash, token);
    assert.match(rows[0].secure_token_hash, /^[a-f0-9]{64}$/);
  });

  test('a valid link needs login, then opens the submission', async () => {
    assert.equal((await request(app).get(`/api/submissions/secure/${token}`)).status, 401);
    const res = await dcghStaff.get(`/api/submissions/secure/${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.submission.submissionId, submissionId);
    assert.equal(res.body.data.submission.link.state, 'valid');
  });

  test('10. a user from another hospital cannot open it, and the denial is audited', async () => {
    const res = await svmcViewer.get(`/api/submissions/secure/${token}`);
    assert.equal(res.status, 403);
    const { rows } = await query(
      `select metadata from audit_logs where action = 'link.access_denied' and submission_id = $1`,
      [submissionId]
    );
    assert.equal(rows.at(-1).metadata.reason, 'hospital_access');
  });

  test('an unknown token returns 404', async () => {
    const res = await dcghStaff.get(`/api/submissions/secure/${'A'.repeat(43)}`);
    assert.equal(res.status, 404);
  });

  test('7. an expired link returns 410', async () => {
    await query(`update submissions set link_expires_at = now() - interval '1 hour' where submission_id = $1`, [submissionId]);
    const res = await dcghStaff.get(`/api/submissions/secure/${token}`);
    assert.equal(res.status, 410);
    assert.match(res.body.message, /expired/);
    // The submission itself stays reachable from the dashboard.
    assert.equal((await dcghStaff.get(`/api/submissions/${submissionId}`)).status, 200);
  });

  test('admins can issue a new link; the old one stops working', async () => {
    const res = await dcghAdmin.post(`/api/submissions/${submissionId}/link`);
    assert.equal(res.status, 201);
    const newToken = res.body.data.secureUrl.split('/').pop();
    assert.equal((await dcghStaff.get(`/api/submissions/secure/${token}`)).status, 404);
    assert.equal((await dcghStaff.get(`/api/submissions/secure/${newToken}`)).status, 200);
    token = newToken;
  });

  test('8. a revoked link returns 410', async () => {
    assert.equal((await dcghStaff.delete(`/api/submissions/${submissionId}/link`)).status, 403); // staff can't revoke
    assert.equal((await dcghAdmin.delete(`/api/submissions/${submissionId}/link`)).status, 200);
    const res = await dcghStaff.get(`/api/submissions/secure/${token}`);
    assert.equal(res.status, 410);
    assert.match(res.body.message, /revoked/);
  });
});

describe('submissions & authorization', () => {
  test('9/10. hospital isolation in lists: each user sees only their hospitals', async () => {
    const dcgh = await dcghStaff.get('/api/submissions?limit=100');
    const svmc = await svmcViewer.get('/api/submissions?limit=100');
    const all = await superAdmin.get('/api/submissions?limit=100');
    assert.ok(dcgh.body.data.items.every((s) => s.hospitalName === 'Demo City General Hospital'));
    assert.ok(svmc.body.data.items.every((s) => s.hospitalName === 'Sample Valley Medical Center'));
    assert.ok(all.body.data.pagination.total > dcgh.body.data.pagination.total + svmc.body.data.pagination.total);
  });

  test('viewers never receive patient names; staff do', async () => {
    const viewerList = await svmcViewer.get('/api/submissions');
    assert.ok(viewerList.body.data.items.length > 0);
    assert.ok(viewerList.body.data.items.every((s) => !('patientName' in s)));

    const id = viewerList.body.data.items[0].submissionId;
    const detail = await svmcViewer.get(`/api/submissions/${id}`);
    assert.equal(detail.body.data.submission.patientName, null);
    assert.equal(detail.body.data.submission.patientNameRestricted, true);

    const staffList = await dcghStaff.get('/api/submissions');
    assert.ok(staffList.body.data.items.some((s) => s.patientName?.startsWith('Test Patient')));
  });

  test('search, filters, sorting and pagination', async () => {
    const page = await superAdmin.get('/api/submissions?limit=3&page=2&sortBy=submittedAt&order=asc');
    assert.equal(page.body.data.items.length, 3);
    assert.equal(page.body.data.pagination.page, 2);
    const dates = page.body.data.items.map((s) => new Date(s.submittedAt).getTime());
    assert.deepEqual(dates, [...dates].sort((a, b) => a - b));

    const filtered = await superAdmin.get('/api/submissions?status=Approved&department=Pharmacy');
    assert.ok(filtered.body.data.items.every((s) => s.status === 'Approved' && s.department === 'Pharmacy'));

    const search = await superAdmin.get('/api/submissions?search=valley');
    assert.ok(search.body.data.items.every((s) => /valley/i.test(s.hospitalName)));

    assert.equal((await superAdmin.get('/api/submissions?status=Lost')).status, 400);
  });

  test('12. status updates are saved and appear in the history', async () => {
    const { body } = await dcghStaff.get('/api/submissions?status=Pending');
    const id = body.data.items[0].submissionId;

    assert.equal((await svmcViewer.patch(`/api/submissions/${id}/status`).send({ status: 'Approved' })).status, 403);

    const res = await dcghStaff.patch(`/api/submissions/${id}/status`).send({ status: 'Under Review' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.submission.status, 'Under Review');
    const last = res.body.data.statusHistory.at(-1);
    assert.equal(last.status, 'Under Review');
    assert.equal(last.from, 'Pending');
    assert.equal(last.changedBy, 'Sam Staff (DCGH)');

    assert.equal((await dcghStaff.patch(`/api/submissions/${id}/status`).send({ status: 'Under Review' })).status, 400);
  });

  test('archiving hides a submission from lists and revokes its link', async () => {
    const created = await ingest(buildSamplePayload({ sourceResponseId: 'it-archive' }));
    const id = created.body.data.submissionId;
    assert.equal((await dcghStaff.delete(`/api/submissions/${id}`)).status, 403);
    assert.equal((await dcghAdmin.delete(`/api/submissions/${id}`)).status, 200);

    const list = await dcghAdmin.get('/api/submissions?limit=100');
    assert.ok(!list.body.data.items.some((s) => s.submissionId === id));
    assert.equal((await dcghStaff.get(`/api/submissions/${id}`)).status, 404);
    const token = created.body.data.secureUrl.split('/').pop();
    assert.equal((await dcghAdmin.get(`/api/submissions/secure/${token}`)).status, 410);
  });

  test('a Super Admin can assign an unassigned submission to a hospital', async () => {
    const created = await ingest(buildSamplePayload({ sourceResponseId: 'it-assign', hospital: 'Mystery Ward' }));
    const id = created.body.data.submissionId;
    const hospitals = await superAdmin.get('/api/hospitals');
    const dcgh = hospitals.body.data.items.find((h) => h.code === 'DCGH');

    const res = await superAdmin.patch(`/api/submissions/${id}`).send({ hospitalId: dcgh.id });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.submission.hospitalName, 'Demo City General Hospital');
    assert.equal((await dcghStaff.get(`/api/submissions/${id}`)).status, 200);
  });
});

describe('dashboard', () => {
  test('11. stats are scoped to the user and add up', async () => {
    const all = (await superAdmin.get('/api/dashboard/stats')).body.data;
    const dcgh = (await dcghStaff.get('/api/dashboard/stats')).body.data;
    const sum = Object.values(all.byStatus).reduce((a, b) => a + b, 0);
    assert.equal(sum, all.total);
    assert.ok(dcgh.total < all.total);
    assert.equal(dcgh.unassigned, 0);
    assert.equal(all.activity.length, 14);
  });

  test('department stats and recent submissions', async () => {
    const departments = (await superAdmin.get('/api/dashboard/department-stats')).body.data.items;
    assert.ok(departments.length > 0 && departments.every((d) => d.count > 0));
    const recent = (await svmcViewer.get('/api/dashboard/recent-submissions')).body.data.items;
    assert.ok(recent.every((s) => s.hospitalName === 'Sample Valley Medical Center' && !('patientName' in s)));
  });
});

describe('user, hospital and audit administration', () => {
  test('only admins can register users; hospital admins only within their hospitals', async () => {
    const hospitals = (await superAdmin.get('/api/hospitals')).body.data.items;
    const dcgh = hospitals.find((h) => h.code === 'DCGH');
    const svmc = hospitals.find((h) => h.code === 'SVMC');
    const newUser = (overrides) => ({ name: 'New Person', email: `new-${Math.random()}@hospitalform.test`, password: 'a-good-long-password', role: 'staff', hospitalAccess: [dcgh.id], ...overrides });

    assert.equal((await request(app).post('/api/auth/register').send(newUser())).status, 401);
    assert.equal((await dcghStaff.post('/api/auth/register').send(newUser())).status, 403);
    assert.equal((await dcghAdmin.post('/api/auth/register').send(newUser())).status, 201);
    assert.equal((await dcghAdmin.post('/api/auth/register').send(newUser({ hospitalAccess: [svmc.id] }))).status, 403);
    assert.equal((await dcghAdmin.post('/api/auth/register').send(newUser({ role: 'super_admin' }))).status, 403);
    assert.equal((await dcghAdmin.post('/api/auth/register').send(newUser({ password: 'short' }))).status, 400);
    assert.equal((await superAdmin.post('/api/auth/register').send(newUser({ role: 'hospital_admin', hospitalAccess: [svmc.id] }))).status, 201);
  });

  test('deactivated users are locked out immediately', async () => {
    const agent = await loginAs('svmc.viewer@hospitalform.test');
    const users = (await superAdmin.get('/api/users')).body.data.items;
    const viewer = users.find((u) => u.email === 'svmc.viewer@hospitalform.test');
    await superAdmin.patch(`/api/users/${viewer.id}`).send({ isActive: false });
    assert.equal((await agent.get('/api/auth/me')).status, 401);
    await superAdmin.patch(`/api/users/${viewer.id}`).send({ isActive: true });
  });

  test('hospitals can only be managed by Super Admins', async () => {
    assert.equal((await dcghAdmin.post('/api/hospitals').send({ code: 'NEWH', name: 'New Demo Hospital' })).status, 403);
    assert.equal((await superAdmin.post('/api/hospitals').send({ code: 'NEWH', name: 'New Demo Hospital' })).status, 201);
    assert.equal((await superAdmin.post('/api/hospitals').send({ code: 'NEWH', name: 'Other Name' })).status, 409);
  });

  test('audit logs are admin-only, scoped, and contain no patient data', async () => {
    assert.equal((await dcghStaff.get('/api/audit-logs')).status, 403);
    const all = await superAdmin.get('/api/audit-logs?limit=100');
    assert.equal(all.status, 200);
    assert.equal(JSON.stringify(all.body).includes('Test Patient'), false);

    const scoped = await dcghAdmin.get('/api/audit-logs?limit=100');
    assert.ok(scoped.body.data.items.every((log) => log.submissionId));
  });

  test('integration settings never expose the secret', async () => {
    const res = await superAdmin.get('/api/integrations/google-form/info');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.secretConfigured, true);
    assert.equal(JSON.stringify(res.body).includes(SECRET), false);
    assert.equal((await dcghAdmin.get('/api/integrations/google-form/info')).status, 403);
  });
});
