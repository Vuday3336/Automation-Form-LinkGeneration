import { query } from '../config/db.js';
import { encryptText, decryptText, encryptJson, decryptJson } from '../utils/encryption.js';

export const SUBMISSION_STATUSES = Object.freeze(['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed']);

const COLUMNS = `id, submission_id, source, source_response_id, hospital_id, hospital_name, department,
  submission_type, submitted_at, patient_name_encrypted, form_data_encrypted, status,
  link_expires_at, link_revoked_at, archived_at, created_at, updated_at`;

// Converts a database row into the app's object, decrypting sensitive fields.
// Note what is deliberately NOT included: secure_token_hash.
export function toSubmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    submissionId: row.submission_id,
    source: row.source,
    sourceResponseId: row.source_response_id,
    hospitalId: row.hospital_id,
    hospitalName: row.hospital_name,
    department: row.department,
    submissionType: row.submission_type,
    submittedAt: row.submitted_at,
    patientName: decryptText(row.patient_name_encrypted),
    formData: decryptJson(row.form_data_encrypted),
    status: row.status,
    linkExpiresAt: row.link_expires_at,
    linkRevokedAt: row.link_revoked_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Inserts a submission. If the same (source, sourceResponseId) already exists, nothing is
// inserted and { created: false } is returned with the existing record: duplicate protection
// that holds even if two identical requests arrive at the same moment.
export async function insertSubmission(data, db = { query }) {
  const { rows } = await db.query(
    `insert into submissions (submission_id, source, source_response_id, hospital_id, hospital_name,
       department, submission_type, submitted_at, patient_name_encrypted, form_data_encrypted,
       status, secure_token_hash, link_expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict on constraint submissions_source_response_key do nothing
     returning ${COLUMNS}`,
    [
      data.submissionId,
      data.source,
      data.sourceResponseId,
      data.hospitalId ?? null,
      data.hospitalName,
      data.department ?? null,
      data.submissionType ?? null,
      data.submittedAt,
      encryptText(data.patientName ?? null),
      encryptJson(data.formData),
      data.status ?? 'Pending',
      data.secureTokenHash ?? null,
      data.linkExpiresAt ?? null,
    ]
  );
  if (rows[0]) return { created: true, submission: toSubmission(rows[0]) };

  const existing = await findSubmissionBySource(data.source, data.sourceResponseId, db);
  return { created: false, submission: existing };
}

export async function findSubmissionBySource(source, sourceResponseId, db = { query }) {
  const { rows } = await db.query(
    `select ${COLUMNS} from submissions where source = $1 and source_response_id = $2`,
    [source, sourceResponseId]
  );
  return toSubmission(rows[0]);
}

export async function findSubmissionByPublicId(submissionId) {
  const { rows } = await query(`select ${COLUMNS} from submissions where submission_id = $1`, [submissionId]);
  return toSubmission(rows[0]);
}

export async function findSubmissionByTokenHash(tokenHash) {
  const { rows } = await query(`select ${COLUMNS} from submissions where secure_token_hash = $1`, [tokenHash]);
  return toSubmission(rows[0]);
}
