import { Router } from 'express';
import * as submissions from '../controllers/submissionController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  submissionIdParam,
  secureTokenParam,
  listSubmissionsQuery,
  updateStatusBody,
  updateSubmissionBody,
} from '../validators/submissionValidator.js';

const router = Router();

// Every submission route requires login. Hospital-level checks happen in the service.
router.use(requireAuth);

router.get('/', validate({ query: listSubmissionsQuery }), submissions.listSubmissions);
// Must come before "/:submissionId" so "secure" isn't treated as an ID.
router.get('/secure/:token', validate({ params: secureTokenParam }), submissions.getSubmissionBySecureLink);
router.get('/:submissionId', validate({ params: submissionIdParam }), submissions.getSubmission);

router.patch(
  '/:submissionId/status',
  requirePermission('updateStatus'),
  validate({ params: submissionIdParam, body: updateStatusBody }),
  submissions.updateStatus
);
router.patch(
  '/:submissionId',
  requirePermission('editSubmission'),
  validate({ params: submissionIdParam, body: updateSubmissionBody }),
  submissions.updateSubmission
);
router.delete('/:submissionId', requirePermission('archiveSubmission'), validate({ params: submissionIdParam }), submissions.archiveSubmission);

router.post('/:submissionId/link', requirePermission('manageLinks'), validate({ params: submissionIdParam }), submissions.regenerateLink);
router.delete('/:submissionId/link', requirePermission('manageLinks'), validate({ params: submissionIdParam }), submissions.revokeLink);

export default router;
