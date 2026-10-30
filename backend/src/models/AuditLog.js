import { query } from '../config/db.js';

// The fixed list of things we audit. Using constants avoids typos like "submision_viewed".
export const AUDIT_ACTIONS = Object.freeze({
  SUBMISSION_RECEIVED: 'submission.received',
  SUBMISSION_DUPLICATE: 'submission.duplicate_ignored',
  SUBMISSION_VIEWED: 'submission.viewed',
  SUBMISSION_UPDATED: 'submission.updated',
  STATUS_CHANGED: 'submission.status_changed',
  SUBMISSION_ARCHIVED: 'submission.archived',
  LINK_REVOKED: 'link.revoked',
  LINK_ACCESS_DENIED: 'link.access_denied',
  USER_LOGIN: 'auth.login',
  USER_LOGIN_FAILED: 'auth.login_failed',
  USER_CREATED: 'user.created',
});

export function toAuditLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    submissionId: row.submission_id,
    metadata: row.metadata ?? {},
    timestamp: row.created_at,
  };
}

// metadata must never contain patient names, medical details, passwords or tokens.
export async function insertAuditLog({ userId = null, action, submissionId = null, metadata = {} }, db = { query }) {
  const { rows } = await db.query(
    `insert into audit_logs (user_id, action, submission_id, metadata)
     values ($1, $2, $3, $4::jsonb)
     returning id, user_id, action, submission_id, metadata, created_at`,
    [userId, action, submissionId, JSON.stringify(metadata)]
  );
  return toAuditLog(rows[0]);
}

export async function listAuditLogsForSubmission(submissionId) {
  const { rows } = await query(
    `select id, user_id, action, submission_id, metadata, created_at
     from audit_logs where submission_id = $1 order by created_at desc`,
    [submissionId]
  );
  return rows.map(toAuditLog);
}
