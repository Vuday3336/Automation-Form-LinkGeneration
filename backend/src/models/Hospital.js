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
  };
}

export async function createHospital({ code, name, isActive = true }, db = { query }) {
  const { rows } = await db.query(
    `insert into hospitals (code, name, is_active) values ($1, $2, $3) returning ${COLUMNS}`,
    [code.toUpperCase(), name.trim(), isActive]
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

export async function listHospitals({ includeInactive = false } = {}) {
  const { rows } = await query(
    `select ${COLUMNS} from hospitals ${includeInactive ? '' : 'where is_active'} order by name`
  );
  return rows.map(toHospital);
}
