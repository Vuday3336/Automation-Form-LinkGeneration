import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import * as integration from '../controllers/integrationController.js';
import { requireIntegrationSecret } from '../middleware/integrationAuthMiddleware.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { googleFormPayloadSchema } from '../validators/submissionValidator.js';

const router = Router();

const integrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 1000 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many integration requests' },
});

// Machine endpoint used by Google Apps Script: secret header, no user login.
router.post(
  '/google-form/submissions',
  integrationLimiter,
  requireIntegrationSecret,
  validate({ body: googleFormPayloadSchema }),
  integration.receiveGoogleFormSubmission
);

// Dashboard endpoints for the Integration Settings page (Super Admin only).
router.get('/google-form/info', requireAuth, requirePermission('manageIntegration'), integration.integrationInfo);
router.post('/google-form/test', requireAuth, requirePermission('manageIntegration'), integration.sendTestSubmission);

export default router;
