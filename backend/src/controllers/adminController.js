import { listUsersForActor, updateUserByActor } from '../services/authService.js';
import { listHospitalsForUser, addHospital, editHospital } from '../services/hospitalService.js';
import { listAuditLogs } from '../models/AuditLog.js';
import { hospitalScope } from '../middleware/roleMiddleware.js';
import { sendSuccess } from '../utils/apiResponse.js';

// ─── Hospitals ───
export async function listHospitals(req, res) {
  sendSuccess(res, { data: { items: await listHospitalsForUser(req.user) } });
}

export async function createHospital(req, res) {
  const hospital = await addHospital(req.user, req.validated.body);
  sendSuccess(res, { status: 201, message: 'Hospital created', data: { hospital } });
}

export async function updateHospital(req, res) {
  const hospital = await editHospital(req.user, req.validated.params.id, req.validated.body);
  sendSuccess(res, { message: 'Hospital updated', data: { hospital } });
}

// ─── Users ───
export async function listUsers(req, res) {
  sendSuccess(res, { data: { items: await listUsersForActor(req.user) } });
}

export async function updateUser(req, res) {
  const user = await updateUserByActor(req.user, req.validated.params.id, req.validated.body);
  sendSuccess(res, { message: 'User updated', data: { user } });
}

// ─── Audit logs ───
export async function listAudit(req, res) {
  const { page, limit, action, submissionId } = req.validated.query;
  const { items, total } = await listAuditLogs({ hospitalIds: hospitalScope(req.user), action, submissionId, page, limit });
  sendSuccess(res, {
    data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } },
  });
}
