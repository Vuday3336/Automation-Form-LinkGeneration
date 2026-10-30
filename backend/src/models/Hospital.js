import { query } from '../config/db.js';

// Data-access for the "hospitals" table. Every SQL query about hospitals lives here, and
// rows are converted to camelCase objects so the rest of the app never sees column names.

const COLUMNS = 'id, code, name, is_active, created_at, updated_at';

export function toHospital(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.submission_count !== undefined && {
      submissionCount: row.submission_count,
      userCount: row.user_count,
    }),
  };
}

export async function createHospital({ code, name, isActive = true }, db = { query }) {
  const { rows } = await db.query(
    `insert into hospitals (code, name, is_active) values ($1, $2, $3) returning ${COLUMNS}`,
    [code.toUpperCase(), name.trim(), isActive]
  );
  return toHospital(rows[0]);
}

export async function updateHospital(id, { name, isActive }) {
  const { rows } = await query(
    `update hospitals set name = coalesce($2, name), is_active = coalesce($3, is_active)
     where id = $1 returning ${COLUMNS}`,
    [id, name?.trim() ?? null, isActive ?? null]
  );
  return toHospital(rows[0]);
}

export async function findHospitalById(id) {
  const { rows } = await query(`select ${COLUMNS} from hospitals where id = $1`, [id]);
  return toHospital(rows[0]);
}

// Used to match the hospital name typed into a Google Form (case-insensitive) or its code.
export async function findHospitalByNameOrCode(value) {
  const { rows } = await query(
    `select ${COLUMNS} from hospitals where lower(name) = lower($1) or code = upper($1) limit 1`,
    [value.trim()]
  );
  return toHospital(rows[0]);
}

export async function findHospitalsByIds(ids) {
  const { rows } = await query(`select ${COLUMNS} from hospitals where id = any($1::uuid[])`, [ids]);
  return rows.map(toHospital);
}

// hospitalIds = null → all hospitals (Super Admin); otherwise only those.
export async function listHospitals({ hospitalIds = null, withCounts = false } = {}) {
  const counts = withCounts
    ? `, (select count(*)::int from submissions s where s.hospital_id = h.id and s.archived_at is null) as submission_count,
         (select count(*)::int from user_hospital_access a where a.hospital_id = h.id) as user_count`
    : '';
  const { rows } = await query(
    `select h.id, h.code, h.name, h.is_active, h.created_at, h.updated_at ${counts}
     from hospitals h
     where $1::uuid[] is null or h.id = any($1::uuid[])
     order by h.name`,
    [hospitalIds]
  );
  return rows.map(toHospital);
}
