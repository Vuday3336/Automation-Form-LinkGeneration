import * as submissionService from '../services/submissionService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export async function listSubmissions(req, res) {
  const data = await submissionService.listForUser(req.user, req.validated.query);
  sendSuccess(res, { data });
}

export async function getSubmission(req, res) {
  const data = await submissionService.getDetailForUser(req.user, req.validated.params.submissionId);
  sendSuccess(res, { data });
}

export async function getSubmissionBySecureLink(req, res) {
  const data = await submissionService.getDetailBySecureToken(req.user, req.validated.params.token);
  sendSuccess(res, { data });
}

export async function updateStatus(req, res) {
  const data = await submissionService.changeStatus(req.user, req.validated.params.submissionId, req.validated.body.status);
  sendSuccess(res, { message: 'Status updated', data });
}

export async function updateSubmission(req, res) {
  const data = await submissionService.updateDetails(req.user, req.validated.params.submissionId, req.validated.body);
  sendSuccess(res, { message: 'Submission updated', data });
}

export async function archiveSubmission(req, res) {
  await submissionService.archive(req.user, req.validated.params.submissionId);
  sendSuccess(res, { message: 'Submission archived and its link revoked' });
}

export async function regenerateLink(req, res) {
  const data = await submissionService.regenerateLink(req.user, req.validated.params.submissionId);
  sendSuccess(res, { status: 201, message: 'New secure link created. Copy it now: it is shown only once', data });
}

export async function revokeLink(req, res) {
  await submissionService.revokeLink(req.user, req.validated.params.submissionId);
  sendSuccess(res, { message: 'Link revoked' });
}
