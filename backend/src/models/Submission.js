import { query } from '../config/db.js';
import { encryptText, decryptText, encryptJson, decryptJson } from '../utils/encryption.js';

export const SUBMISSION_STATUSES = Object.freeze(['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed']);

// The internal UUID primary key is never selected: the app identifies submissions only by
// their public submission_id, so internal IDs can't leak through the API.
const COLUMNS = `submission_id, source, source_response_id, hospital_id, hospital_name, department,
  submission_type, submitted_at, patient_name_encrypted, form_data_encrypted, status,
  link_expires_at, link_revoked_at, archived_at, created_at, updated_at`;

// Lighter column list for tables: no form data to decrypt.
const LIST_COLUMNS = `submission_id, hospital_id, hospital_name, department, submission_type,
  submitted_at, patient_name_encrypted, status, created_at`;

// Converts a database row into the app's object, decrypting sensitive fields.
// Note what is deliberately NOT included: secure_token_hash.
export function toSubmission(row) {
  if (!row) return null;
  return {
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

function toSubmissionSummary(row, includePatientName) {
  return {
    submissionId: row.submission_id,
    hospitalId: row.hospital_id,
    hospitalName: row.hospital_name,
    department: row.department,
    submissionType: row.submission_type,
    submittedAt: row.submitted_at,
    status: row.status,
    createdAt: row.created_at,
    ...(includePatientName ? { patientName: decryptText(row.patient_name_encrypted) } : {}),
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

// forUpdate: locks the row until the surrounding transaction ends, so two people changing
// the status at the same moment can't overwrite each other's audit trail.
export async function findSubmissionByPublicId(submissionId, db = { query }, { forUpdate = false } = {}) {
  const { rows } = await db.query(
    `select ${COLUMNS} from submissions where submission_id = $1 ${forUpdate ? 'for update' : ''}`,
    [submissionId]
  );
  return toSubmission(rows[0]);
}

export async function findSubmissionByTokenHash(tokenHash) {
  const { rows } = await query(`select ${COLUMNS} from submissions where secure_token_hash = $1`, [tokenHash]);
  return toSubmission(rows[0]);
}

// Only these fields can ever be changed after creation (whitelist → no SQL injection via keys).
const UPDATABLE = {
  status: 'status',
  department: 'department',
  submissionType: 'submission_type',
  hospitalId: 'hospital_id',
  hospitalName: 'hospital_name',
  archivedAt: 'archived_at',
  secureTokenHash: 'secure_token_hash',
  linkExpiresAt: 'link_expires_at',
  linkRevokedAt: 'link_revoked_at',
};

export async function updateSubmission(submissionId, changes, db = { query }) {
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(changes)) {
    const column = UPDATABLE[key];
    if (!column) throw new Error(`Field is not updatable: ${key}`);
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  params.push(submissionId);
  const { rows } = await db.query(
    `update submissions set ${sets.join(', ')} where submission_id = $${params.length} returning ${COLUMNS}`,
    params
  );
  return toSubmission(rows[0]);
}

const SORT_COLUMNS = {
  submittedAt: 'submitted_at',
  createdAt: 'created_at',
  status: 'status',
  hospitalName: 'hospital_name',
  department: 'department',
};

// Escape % and _ so a search for "50%" matches literally.
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

// Builds the WHERE clause shared by the list and facet queries.
// hospitalIds = null means "all hospitals" (Super Admin); an array limits to those hospitals.
function buildFilters({ hospitalIds = null, search, status, department, hospitalId, submissionType }) {
  const where = ['archived_at is null'];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (hospitalIds) add('hospital_id = any(?::uuid[])', hospitalIds);
  if (status) add('status = ?', status);
  if (department) add('department = ?', department);
  if (hospitalId) add('hospital_id = ?', hospitalId);
  if (submissionType) add('submission_type = ?', submissionType);
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const p = `$${params.length}`;
    where.push(
      `(submission_id ilike ${p} or hospital_name ilike ${p} or department ilike ${p} or submission_type ilike ${p})`
    );
  }
  return { whereSql: where.join(' and '), params };
}

export async function listSubmissions({
  sortBy = 'submittedAt',
  order = 'desc',
  page = 1,
  limit = 20,
  includePatientName = false,
  ...filters
}) {
  const { whereSql, params } = buildFilters(filters);
  const orderSql = `${SORT_COLUMNS[sortBy] ?? 'submitted_at'} ${order === 'asc' ? 'asc' : 'desc'}, created_at desc`;

  const countResult = await query(`select count(*)::int as total from submissions where ${whereSql}`, params);
  const { rows } = await query(
    `select ${LIST_COLUMNS} from submissions where ${whereSql}
     order by ${orderSql} limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );
  return {
    total: countResult.rows[0].total,
    items: rows.map((row) => toSubmissionSummary(row, includePatientName)),
  };
}

// Distinct departments and submission types the user can see, used to fill filter dropdowns.
export async function listSubmissionFacets({ hospitalIds = null }) {
  const { whereSql, params } = buildFilters({ hospitalIds });
  const { rows } = await query(
    `select
       coalesce(array_agg(distinct department) filter (where department is not null), '{}') as departments,
       coalesce(array_agg(distinct submission_type) filter (where submission_type is not null), '{}') as types
     from submissions where ${whereSql}`,
    params
  );
  return { departments: [...rows[0].departments].sort(), submissionTypes: [...rows[0].types].sort() };
}
