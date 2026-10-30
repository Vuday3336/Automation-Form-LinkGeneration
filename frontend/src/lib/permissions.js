// Mirror of the backend's permission table (backend/src/middleware/roleMiddleware.js).
// The frontend uses it ONLY to hide buttons and menu items; the backend still checks every
// request, so changing this file can never grant real access.
const PERMISSIONS = {
  viewPatientName: ['super_admin', 'hospital_admin', 'staff'],
  updateStatus: ['super_admin', 'hospital_admin', 'staff'],
  editSubmission: ['super_admin', 'hospital_admin'],
  manageLinks: ['super_admin', 'hospital_admin'],
  manageUsers: ['super_admin', 'hospital_admin'],
  manageHospitals: ['super_admin'],
  viewAuditLogs: ['super_admin', 'hospital_admin'],
  manageIntegration: ['super_admin'],
};

export const can = (user, permission) => Boolean(user) && PERMISSIONS[permission]?.includes(user.role);
