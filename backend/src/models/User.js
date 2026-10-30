import { query, transaction } from '../config/db.js';

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  HOSPITAL_ADMIN: 'hospital_admin',
  STAFF: 'staff',
  VIEWER: 'viewer',
});

// Selects a user plus the list of hospital IDs they may access, as one row.
const SELECT_USER = `
  select u.id, u.name, u.email, u.password_hash, u.role, u.is_active, u.created_at, u.updated_at,
         -- ::text so every driver returns a real JS array (node-postgres doesn't parse uuid[]).
         coalesce(array_agg(a.hospital_id::text) filter (where a.hospital_id is not null), '{}') as hospital_access
  from users u
  left join user_hospital_access a on a.user_id = u.id`;

// The safe shape: everything EXCEPT the password hash. This is what APIs may return.
export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    hospitalAccess: [...(row.hospital_access ?? [])],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function replaceHospitalAccess(tx, userId, hospitalIds) {
  await tx.query('delete from user_hospital_access where user_id = $1', [userId]);
  for (const hospitalId of new Set(hospitalIds)) {
    await tx.query('insert into user_hospital_access (user_id, hospital_id) values ($1, $2)', [userId, hospitalId]);
  }
}

export async function createUser({ name, email, passwordHash, role, hospitalAccess = [], isActive = true }) {
  return transaction(async (tx) => {
    const { rows } = await tx.query(
      `insert into users (name, email, password_hash, role, is_active)
       values ($1, lower($2), $3, $4, $5) returning id`,
      [name.trim(), email.trim(), passwordHash, role, isActive]
    );
    const userId = rows[0].id;
    await replaceHospitalAccess(tx, userId, hospitalAccess);
    const created = await tx.query(`${SELECT_USER} where u.id = $1 group by u.id`, [userId]);
    return toUser(created.rows[0]);
  });
}

// Updates any of name / role / isActive / hospitalAccess in one transaction.
export async function updateUser(userId, { name, role, isActive, hospitalAccess }) {
  return transaction(async (tx) => {
    await tx.query(
      `update users set
         name = coalesce($2, name),
         role = coalesce($3, role),
         is_active = coalesce($4, is_active)
       where id = $1`,
      [userId, name ?? null, role ?? null, isActive ?? null]
    );
    if (hospitalAccess) await replaceHospitalAccess(tx, userId, hospitalAccess);
    const { rows } = await tx.query(`${SELECT_USER} where u.id = $1 group by u.id`, [userId]);
    return toUser(rows[0]);
  });
}

export async function updatePasswordHash(userId, passwordHash) {
  await query('update users set password_hash = $2 where id = $1', [userId, passwordHash]);
}

export async function findUserById(id) {
  const { rows } = await query(`${SELECT_USER} where u.id = $1 group by u.id`, [id]);
  return toUser(rows[0]);
}

export async function findPasswordHashById(id) {
  const { rows } = await query('select password_hash from users where id = $1', [id]);
  return rows[0]?.password_hash ?? null;
}

// Login needs the password hash, so this returns { user, passwordHash } separately to make it
// hard to accidentally send the hash back in a response.
export async function findUserWithPasswordByEmail(email) {
  const { rows } = await query(`${SELECT_USER} where lower(u.email) = lower($1) group by u.id`, [email.trim()]);
  if (!rows[0]) return null;
  return { user: toUser(rows[0]), passwordHash: rows[0].password_hash };
}

// hospitalIds = null → every user; otherwise users with access to at least one of those hospitals.
export async function listUsers({ hospitalIds = null } = {}) {
  const { rows } = await query(
    `${SELECT_USER}
     where $1::uuid[] is null
        or exists (select 1 from user_hospital_access x where x.user_id = u.id and x.hospital_id = any($1::uuid[]))
     group by u.id
     order by u.created_at`,
    [hospitalIds]
  );
  return rows.map(toUser);
}

export async function countUsers() {
  const { rows } = await query('select count(*)::int as count from users');
  return rows[0].count;
}
