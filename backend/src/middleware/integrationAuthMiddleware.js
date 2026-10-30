import { env } from '../config/env.js';
import { ApiError } from '../utils/apiResponse.js';
import { safeEqual } from '../utils/generateToken.js';
import { recordAudit } from '../services/auditService.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';

export const INTEGRATION_HEADER = 'x-integration-secret';

// Machine-to-machine authentication for Google Apps Script. Apps Script sends the shared
// secret in a header; we compare it in constant time. No user login is involved.
export async function requireIntegrationSecret(req, res, next) {
  const provided = req.get(INTEGRATION_HEADER) ?? '';
  if (!provided || !safeEqual(provided, env.INTEGRATION_SECRET)) {
    await recordAudit({ action: AUDIT_ACTIONS.INTEGRATION_REJECTED, metadata: { reason: 'invalid_secret', ip: req.ip } });
    throw ApiError.unauthorized('Invalid integration secret');
  }
  next();
}
