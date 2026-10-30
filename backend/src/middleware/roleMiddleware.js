import { ROLES } from '../models/User.js';
import { ApiError } from '../utils/apiResponse.js';

const { SUPER_ADMIN, HOSPITAL_ADMIN, STAFF } = ROLES;

// Authorization: "what are you allowed to do?" One table answers it for the whole app.
// (The frontend has a copy only to hide buttons; the backend's check is the one that counts.)
export const PERMISSIONS = Object.freeze({
  viewPatientName: [SUPER_ADMIN, HOSPITAL_ADMIN, STAFF],
  updateStatus: [SUPER_ADMIN, HOSPITAL_ADMIN, STAFF],
  editSubmission: [SUPER_ADMIN, HOSPITAL_ADMIN],
  archiveSubmission: [SUPER_ADMIN, HOSPITAL_ADMIN],
  manageLinks: [SUPER_ADMIN, HOSPITAL_ADMIN],
  manageUsers: [SUPER_ADMIN, HOSPITAL_ADMIN],
  manageHospitals: [SUPER_ADMIN],
  viewAuditLogs: [SUPER_ADMIN, HOSPITAL_ADMIN],
  manageIntegration: [SUPER_ADMIN],
});

export const can = (user, permission) => Boolean(user) && PERMISSIONS[permission].includes(user.role);

export const requirePermission = (permission) => (req, res, next) => {
  if (!can(req.user, permission)) throw ApiError.forbidden();
  next();
};

// Hospital-level isolation. Super Admins see everything; everyone else only the hospitals
// in their hospitalAccess list. Submissions not yet matched to a hospital (hospitalId null)
// are visible to Super Admins only.
export function canAccessHospital(user, hospitalId) {
  if (user.role === SUPER_ADMIN) return true;
  return hospitalId != null && user.hospitalAccess.includes(hospitalId);
}

// Value passed to database queries: null = no restriction, array = only these hospitals.
export const hospitalScope = (user) => (user.role === SUPER_ADMIN ? null : user.hospitalAccess);
