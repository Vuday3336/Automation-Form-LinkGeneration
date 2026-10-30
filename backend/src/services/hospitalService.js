import { createHospital, updateHospital, listHospitals, findHospitalById } from '../models/Hospital.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { hospitalScope } from '../middleware/roleMiddleware.js';
import { ApiError } from '../utils/apiResponse.js';
import { recordAudit } from './auditService.js';

export const listHospitalsForUser = (user) => listHospitals({ hospitalIds: hospitalScope(user), withCounts: true });

export async function addHospital(actor, data) {
  try {
    const hospital = await createHospital(data);
    await recordAudit({ userId: actor.id, action: AUDIT_ACTIONS.HOSPITAL_CREATED, metadata: { hospitalId: hospital.id, code: hospital.code } });
    return hospital;
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('A hospital with this code or name already exists');
    throw err;
  }
}

export async function editHospital(actor, id, changes) {
  if (!(await findHospitalById(id))) throw ApiError.notFound('Hospital not found');
  try {
    const hospital = await updateHospital(id, changes);
    await recordAudit({ userId: actor.id, action: AUDIT_ACTIONS.HOSPITAL_UPDATED, metadata: { hospitalId: id, fields: Object.keys(changes) } });
    return hospital;
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('A hospital with this name already exists');
    throw err;
  }
}
