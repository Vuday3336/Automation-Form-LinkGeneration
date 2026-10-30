import { query } from '../config/db.js';

// The fixed list of things we audit. Using constants avoids typos like "submision_viewed".
export const AUDIT_ACTIONS = Object.freeze({
  SUBMISSION_RECEIVED: 'submission.received',
  SUBMISSION_DUPLICATE: 'submission.duplicate_ignored',
  SUBMISSION_VIEWED: 'submission.viewed',
  SUBMISSION_UPDATED: 'submission.updated',
  STATUS_CHANGED: 'submission.status_changed',
  SUBMISSION_ARCHIVED: 'submission.archived',
  LINK_CREATED: 'link.created',
  LINK_REVOKED: 'link.revoked',
  LINK_ACCESS_DENIED: 'link.access_denied',
  SUBMISSION_ACCESS_DENIED: 'submission.access_denied',
  USER_LOGIN: 'auth.login',
  USER_LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_CHANGED: 'auth.password_changed',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  HOSPITAL_CREATED: 'hospital.created',
  HOSPITAL_UPDATED: 'hospital.updated',
  INTEGRATION_REJECTED: 'integration.rejected',
});

const SELECT_LOG = `
  select a.id, a.user_id, a.action, a.submission_id, a.metadata, a.created_at,
         u.name as user_name, u.email as user_email
  from audit_logs a
  left join users u on u.id = a.user_id`;

export function toAuditLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? null,
    userEmail: row.user_email ?? null,
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

export async function listAuditLogsForSubmission(submissionId, { actions = null } = {}) {
  const { rows } = await query(
    `${SELECT_LOG}
     where a.submission_id = $1 and ($2::text[] is null or a.action = any($2::text[]))
     order by a.created_at desc`,
    [submissionId, actions]
  );
  return rows.map(toAuditLog);
}

// hospitalIds = null → everything (Super Admin). Otherwise only entries about submissions that
// belong to those hospitals (so a Hospital Admin never sees another hospital's activity).
export async function listAuditLogs({ hospitalIds = null, action, submissionId, page = 1, limit = 50 }) {
  const params = [hospitalIds, action ?? null, submissionId ?? null];
  const where = `
    ($1::uuid[] is null or exists (
       select 1 from submissions s where s.submission_id = a.submission_id and s.hospital_id = any($1::uuid[])))
    and ($2::text is null or a.action = $2)
    and ($3::text is null or a.submission_id = $3)`;

  const count = await query(`select count(*)::int as total from audit_logs a where ${where}`, params);
  const { rows } = await query(
    `${SELECT_LOG} where ${where} order by a.created_at desc limit $4 offset $5`,
    [...params, limit, (page - 1) * limit]
  );
  return { total: count.rows[0].total, items: rows.map(toAuditLog) };
}
