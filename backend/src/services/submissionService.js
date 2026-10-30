import { transaction } from '../config/db.js';
import { findHospitalByNameOrCode, findHospitalById } from '../models/Hospital.js';
import {
  insertSubmission,
  findSubmissionByPublicId,
  findSubmissionByTokenHash,
  updateSubmission,
  listSubmissions,
  listSubmissionFacets,
} from '../models/Submission.js';
import { insertAuditLog, listAuditLogsForSubmission, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { can, canAccessHospital, hospitalScope } from '../middleware/roleMiddleware.js';
import { ApiError } from '../utils/apiResponse.js';
import { generateSubmissionId } from '../utils/generateToken.js';
import { normalizeGoogleFormPayload } from './googleFormService.js';
import { createLink, getLinkState, hashToken } from './linkService.js';
import { recordAudit } from './auditService.js';

// ─── Ingestion (Google Form → database) ──────────────────────────────────────

export async function ingestGoogleFormSubmission(payload) {
  const normalized = normalizeGoogleFormPayload(payload);
  const hospital = await findHospitalByNameOrCode(normalized.hospitalName);
  const link = createLink();

  // The insert and its audit entry are one transaction: both are saved or neither is.
  const { created, submission } = await transaction(async (tx) => {
    const result = await insertSubmission(
      {
        ...normalized,
        submissionId: generateSubmissionId(normalized.submittedAt),
        hospitalId: hospital?.isActive ? hospital.id : null,
        hospitalName: hospital?.isActive ? hospital.name : normalized.hospitalName,
        secureTokenHash: link.tokenHash,
        linkExpiresAt: link.expiresAt,
      },
      tx
    );
    await insertAuditLog(
      {
        action: result.created ? AUDIT_ACTIONS.SUBMISSION_RECEIVED : AUDIT_ACTIONS.SUBMISSION_DUPLICATE,
        submissionId: result.submission.submissionId,
        metadata: { source: normalized.source, hospitalMatched: Boolean(hospital?.isActive) },
      },
      tx
    );
    return result;
  });

  return {
    duplicate: !created,
    submissionId: submission.submissionId,
    status: submission.status,
    hospitalMatched: Boolean(submission.hospitalId),
    // The raw token exists only now. For a duplicate we never had it again (only its hash
    // is stored), so no URL is returned; the first response already delivered it.
    secureUrl: created ? link.url : null,
    linkExpiresAt: submission.linkExpiresAt,
  };
}

// ─── Shaping data for a specific user ────────────────────────────────────────

function serializeSubmission(submission, user) {
  const showPatient = can(user, 'viewPatientName');
  return {
    submissionId: submission.submissionId,
    source: submission.source,
    hospitalId: submission.hospitalId,
    hospitalName: submission.hospitalName,
    department: submission.department,
    submissionType: submission.submissionType,
    submittedAt: submission.submittedAt,
    status: submission.status,
    patientName: showPatient ? submission.patientName : null,
    patientNameRestricted: !showPatient && Boolean(submission.patientName),
    formTitle: submission.formData.formTitle ?? null,
    respondentEmail: showPatient ? (submission.formData.respondentEmail ?? null) : null,
    answers: submission.formData.answers ?? [],
    archivedAt: submission.archivedAt,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    link: {
      state: getLinkState(submission),
      expiresAt: submission.linkExpiresAt,
      revokedAt: submission.linkRevokedAt,
    },
  };
}

async function buildDetail(submission, user) {
  const logs = await listAuditLogsForSubmission(submission.submissionId, {
    actions: [AUDIT_ACTIONS.SUBMISSION_RECEIVED, AUDIT_ACTIONS.STATUS_CHANGED],
  });
  const statusHistory = logs
    .map((log) => {
      const received = log.action === AUDIT_ACTIONS.SUBMISSION_RECEIVED;
      return {
        status: received ? 'Pending' : log.metadata.to,
        from: log.metadata.from ?? null,
        changedBy: log.userName ?? (received ? 'Google Form' : 'System'),
        at: log.timestamp,
      };
    })
    .reverse(); // oldest first, like a timeline

  return {
    submission: serializeSubmission(submission, user),
    statusHistory,
    permissions: {
      canUpdateStatus: can(user, 'updateStatus') && !submission.archivedAt,
      canEdit: can(user, 'editSubmission') && !submission.archivedAt,
      canManageLinks: can(user, 'manageLinks') && !submission.archivedAt,
      canArchive: can(user, 'archiveSubmission') && !submission.archivedAt,
    },
  };
}

const isHiddenFrom = (user, submission) => !submission || (submission.archivedAt && !can(user, 'archiveSubmission'));

// Loads a submission and enforces hospital isolation. Archived records are visible to admins only.
// Runs OUTSIDE transactions because a denial is audited (that entry must survive the error).
async function loadForUser(user, submissionId) {
  const submission = await findSubmissionByPublicId(submissionId);
  if (isHiddenFrom(user, submission)) throw ApiError.notFound('Submission not found');
  if (!canAccessHospital(user, submission.hospitalId)) {
    await recordAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.SUBMISSION_ACCESS_DENIED,
      submissionId,
      metadata: { reason: 'hospital_access' },
    });
    throw ApiError.forbidden("You don't have access to this hospital's submissions");
  }
  return submission;
}

// Inside a change transaction: re-read the row with a lock so we act on its latest state.
// (Access was already checked and audited by loadForUser; this re-check guards against races.)
async function lockForChange(tx, user, submissionId) {
  const submission = await findSubmissionByPublicId(submissionId, tx, { forUpdate: true });
  if (isHiddenFrom(user, submission)) throw ApiError.notFound('Submission not found');
  if (!canAccessHospital(user, submission.hospitalId)) throw ApiError.forbidden("You don't have access to this hospital's submissions");
  return submission;
}

// Runs a change: access check (audited) first, then the locked transaction.
async function withLockedSubmission(user, submissionId, fn) {
  await loadForUser(user, submissionId);
  return transaction(async (tx) => fn(tx, await lockForChange(tx, user, submissionId)));
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export async function listForUser(user, filters) {
  const scope = hospitalScope(user);
  const [{ items, total }, facets] = await Promise.all([
    listSubmissions({ ...filters, hospitalIds: scope, includePatientName: can(user, 'viewPatientName') }),
    listSubmissionFacets({ hospitalIds: scope }),
  ]);
  return {
    items,
    facets,
    pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
  };
}

export async function getDetailForUser(user, submissionId) {
  const submission = await loadForUser(user, submissionId);
  await recordAudit({ userId: user.id, action: AUDIT_ACTIONS.SUBMISSION_VIEWED, submissionId, metadata: { via: 'dashboard' } });
  return buildDetail(submission, user);
}

// Opening a secure link: valid token + not revoked + not expired + logged in + hospital access.
export async function getDetailBySecureToken(user, token) {
  const submission = await findSubmissionByTokenHash(hashToken(token));
  const deny = async (reason, error) => {
    await recordAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.LINK_ACCESS_DENIED,
      submissionId: submission?.submissionId ?? null,
      metadata: { reason },
    });
    throw error;
  };

  if (!submission) return deny('not_found', ApiError.notFound('This link is not valid'));
  const state = getLinkState(submission);
  if (state === 'revoked') return deny('revoked', ApiError.gone('This link has been revoked by an administrator'));
  if (state === 'expired') {
    return deny('expired', ApiError.gone('This link has expired. Find the submission in the dashboard or ask an admin for a new link'));
  }
  if (!canAccessHospital(user, submission.hospitalId)) {
    return deny('hospital_access', ApiError.forbidden("You don't have access to this hospital's submissions"));
  }

  await recordAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.SUBMISSION_VIEWED,
    submissionId: submission.submissionId,
    metadata: { via: 'secure_link' },
  });
  return buildDetail(submission, user);
}

// ─── Changing ────────────────────────────────────────────────────────────────

export async function changeStatus(user, submissionId, newStatus) {
  const updated = await withLockedSubmission(user, submissionId, async (tx, submission) => {
    if (submission.archivedAt) throw ApiError.conflict('Archived submissions cannot be changed');
    if (submission.status === newStatus) throw ApiError.badRequest(`Status is already "${newStatus}"`);

    const result = await updateSubmission(submissionId, { status: newStatus }, tx);
    await insertAuditLog(
      { userId: user.id, action: AUDIT_ACTIONS.STATUS_CHANGED, submissionId, metadata: { from: submission.status, to: newStatus } },
      tx
    );
    return result;
  });
  return buildDetail(updated, user);
}

export async function updateDetails(user, submissionId, changes) {
  let newHospital = null;
  if (changes.hospitalId) {
    newHospital = await findHospitalById(changes.hospitalId);
    if (!newHospital || !newHospital.isActive) throw ApiError.badRequest('Hospital not found or inactive');
    if (!canAccessHospital(user, newHospital.id)) throw ApiError.forbidden("You can't assign submissions to that hospital");
  }

  const updated = await withLockedSubmission(user, submissionId, async (tx, submission) => {
    if (submission.archivedAt) throw ApiError.conflict('Archived submissions cannot be changed');

    const fields = {};
    const audit = {};
    for (const key of ['department', 'submissionType']) {
      if (changes[key] !== undefined && changes[key] !== submission[key]) {
        fields[key] = changes[key];
        audit[key] = { from: submission[key], to: changes[key] };
      }
    }
    if (newHospital && newHospital.id !== submission.hospitalId) {
      fields.hospitalId = newHospital.id;
      fields.hospitalName = newHospital.name;
      audit.hospital = { from: submission.hospitalName, to: newHospital.name };
    }
    if (Object.keys(fields).length === 0) throw ApiError.badRequest('Nothing changed');

    const result = await updateSubmission(submissionId, fields, tx);
    await insertAuditLog({ userId: user.id, action: AUDIT_ACTIONS.SUBMISSION_UPDATED, submissionId, metadata: { changes: audit } }, tx);
    return result;
  });
  return buildDetail(updated, user);
}

// "Delete" = archive. Hospital records are never destroyed; they're hidden and the link revoked.
export async function archive(user, submissionId) {
  await withLockedSubmission(user, submissionId, async (tx, submission) => {
    if (submission.archivedAt) throw ApiError.conflict('Submission is already archived');
    const now = new Date();
    await updateSubmission(submissionId, { archivedAt: now, linkRevokedAt: now }, tx);
    await insertAuditLog({ userId: user.id, action: AUDIT_ACTIONS.SUBMISSION_ARCHIVED, submissionId }, tx);
  });
}

// Issues a fresh link (the old one stops working because its hash is replaced).
export async function regenerateLink(user, submissionId) {
  return withLockedSubmission(user, submissionId, async (tx, submission) => {
    if (submission.archivedAt) throw ApiError.conflict('Archived submissions cannot get new links');
    const link = createLink();
    await updateSubmission(
      submissionId,
      { secureTokenHash: link.tokenHash, linkExpiresAt: link.expiresAt, linkRevokedAt: null },
      tx
    );
    await insertAuditLog({ userId: user.id, action: AUDIT_ACTIONS.LINK_CREATED, submissionId }, tx);
    return { secureUrl: link.url, expiresAt: link.expiresAt };
  });
}

export async function revokeLink(user, submissionId) {
  await withLockedSubmission(user, submissionId, async (tx, submission) => {
    if (submission.linkRevokedAt) throw ApiError.conflict('Link is already revoked');
    await updateSubmission(submissionId, { linkRevokedAt: new Date() }, tx);
    await insertAuditLog({ userId: user.id, action: AUDIT_ACTIONS.LINK_REVOKED, submissionId }, tx);
  });
}
