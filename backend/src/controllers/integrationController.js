import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { listAuditLogs } from '../models/AuditLog.js';
import { ingestGoogleFormSubmission } from '../services/submissionService.js';
import { buildSamplePayload } from '../services/sampleData.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

// Called by Google Apps Script for every new form response.
export async function receiveGoogleFormSubmission(req, res) {
  const result = await ingestGoogleFormSubmission(req.validated.body);
  logger.info(`Google Form submission ${result.duplicate ? 'duplicate ignored' : 'stored'}: ${result.submissionId}`);
  sendSuccess(res, {
    status: result.duplicate ? 200 : 201,
    message: result.duplicate ? 'Duplicate submission: already stored' : 'Submission stored',
    data: result,
  });
}

// Integration Settings page: shows how Apps Script should be configured. Never returns the secret.
export async function integrationInfo(req, res) {
  const recent = await listAuditLogs({ action: 'submission.received', page: 1, limit: 5 });
  const rejected = await listAuditLogs({ action: 'integration.rejected', page: 1, limit: 5 });
  const apiBase = env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  sendSuccess(res, {
    data: {
      endpoint: `${apiBase.replace(/\/+$/, '')}/api/integrations/google-form/submissions`,
      publicApiUrlConfigured: Boolean(env.PUBLIC_API_URL),
      secretHeader: 'X-Integration-Secret',
      secretConfigured: env.INTEGRATION_SECRET.length >= 32,
      linkBaseUrl: env.LINK_BASE_URL,
      linkTtlHours: env.LINK_TTL_HOURS,
      recentDeliveries: recent.items,
      recentRejections: rejected.items,
    },
  });
}

// "Send test submission" button: runs the exact same pipeline as a real Google Form,
// with generated dummy data. Lets you verify everything before Google is connected.
export async function sendTestSubmission(req, res) {
  const payload = buildSamplePayload({ sourceResponseId: `test-${crypto.randomUUID()}` });
  const result = await ingestGoogleFormSubmission(payload);
  sendSuccess(res, { status: 201, message: 'Test submission created', data: result });
}
