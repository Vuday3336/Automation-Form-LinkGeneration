import { Router } from 'express';
import * as admin from '../controllers/adminController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { uuidParam } from '../validators/common.js';
import { createHospitalBody, updateHospitalBody, updateUserBody, listAuditLogsQuery } from '../validators/authValidator.js';

// Hospitals, users and audit logs: the admin pages of the dashboard.
export const hospitalRoutes = Router()
  .use(requireAuth)
  .get('/', admin.listHospitals)
  .post('/', requirePermission('manageHospitals'), validate({ body: createHospitalBody }), admin.createHospital)
  .patch('/:id', requirePermission('manageHospitals'), validate({ params: uuidParam, body: updateHospitalBody }), admin.updateHospital);

export const userRoutes = Router()
  .use(requireAuth, requirePermission('manageUsers'))
  .get('/', admin.listUsers)
  .patch('/:id', validate({ params: uuidParam, body: updateUserBody }), admin.updateUser);

export const auditRoutes = Router()
  .use(requireAuth, requirePermission('viewAuditLogs'))
  .get('/', validate({ query: listAuditLogsQuery }), admin.listAudit);
