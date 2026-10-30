import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import {
  ROLES,
  createUser,
  updateUser,
  findUserById,
  findUserWithPasswordByEmail,
  findPasswordHashById,
  updatePasswordHash,
  listUsers,
} from '../models/User.js';
import { findHospitalsByIds } from '../models/Hospital.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { hospitalScope } from '../middleware/roleMiddleware.js';
import { ApiError } from '../utils/apiResponse.js';
import { recordAudit } from './auditService.js';

// bcrypt "cost": each +1 doubles the work. 12 takes ~250ms, slow for attackers guessing
// millions of passwords, fine for one login. Tests use 4 to stay fast.
export const BCRYPT_ROUNDS = env.isTest ? 4 : 12;

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

// A real hash to compare against when the email doesn't exist, so "unknown email" and
// "wrong password" take the same time and attackers can't discover which emails exist.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await hashPassword('dummy-password-for-timing'));

export async function login(email, password, { ip } = {}) {
  const found = await findUserWithPasswordByEmail(email);
  const passwordOk = await bcrypt.compare(password, found?.passwordHash ?? (await getDummyHash()));

  if (!found || !passwordOk || !found.user.isActive) {
    await recordAudit({
      userId: found?.user.id ?? null,
      action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
      metadata: { reason: !found || !passwordOk ? 'bad_credentials' : 'inactive', ip },
    });
    // Same message for every failure: don't reveal whether the email exists.
    throw ApiError.unauthorized('Invalid email or password');
  }

  await recordAudit({ userId: found.user.id, action: AUDIT_ACTIONS.USER_LOGIN, metadata: { ip } });
  return found.user;
}

export async function changePassword(user, currentPassword, newPassword) {
  const hash = await findPasswordHashById(user.id);
  if (!(await bcrypt.compare(currentPassword, hash))) throw ApiError.badRequest('Current password is incorrect');
  await updatePasswordHash(user.id, await hashPassword(newPassword));
  await recordAudit({ userId: user.id, action: AUDIT_ACTIONS.PASSWORD_CHANGED });
}

// ─── User management rules ───────────────────────────────────────────────────
// Super Admin: may create/edit anyone.
// Hospital Admin: may create/edit only Staff and Viewers, only within their own hospitals.

const ASSIGNABLE_BY_HOSPITAL_ADMIN = [ROLES.STAFF, ROLES.VIEWER];

async function checkHospitalAccessList(actor, role, hospitalAccess) {
  if (role === ROLES.SUPER_ADMIN) return []; // sees everything; a list would be meaningless
  if (hospitalAccess.length === 0) throw ApiError.badRequest('Assign at least one hospital to this user');

  const hospitals = await findHospitalsByIds(hospitalAccess);
  if (hospitals.length !== new Set(hospitalAccess).size) throw ApiError.badRequest('One or more hospitals do not exist');

  const scope = hospitalScope(actor);
  if (scope && !hospitalAccess.every((id) => scope.includes(id))) {
    throw ApiError.forbidden('You can only grant access to your own hospitals');
  }
  return hospitalAccess;
}

export async function registerUser(actor, { name, email, password, role, hospitalAccess }) {
  if (actor.role !== ROLES.SUPER_ADMIN && !ASSIGNABLE_BY_HOSPITAL_ADMIN.includes(role)) {
    throw ApiError.forbidden('Hospital Admins can only create Staff and Viewer accounts');
  }
  const access = await checkHospitalAccessList(actor, role, hospitalAccess);

  try {
    const user = await createUser({ name, email, passwordHash: await hashPassword(password), role, hospitalAccess: access });
    await recordAudit({ userId: actor.id, action: AUDIT_ACTIONS.USER_CREATED, metadata: { createdUserId: user.id, role } });
    return user;
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('A user with this email already exists');
    throw err;
  }
}

export async function updateUserByActor(actor, userId, changes) {
  const target = await findUserById(userId);
  const scope = hospitalScope(actor);
  const visible = target && (!scope || target.hospitalAccess.some((id) => scope.includes(id)));
  if (!visible) throw ApiError.notFound('User not found');

  if (target.id === actor.id && (changes.role !== undefined || changes.isActive !== undefined)) {
    throw ApiError.badRequest("You can't change your own role or deactivate yourself");
  }
  if (actor.role !== ROLES.SUPER_ADMIN) {
    if (!ASSIGNABLE_BY_HOSPITAL_ADMIN.includes(target.role)) throw ApiError.forbidden('Hospital Admins can only edit Staff and Viewers');
    if (changes.role && !ASSIGNABLE_BY_HOSPITAL_ADMIN.includes(changes.role)) {
      throw ApiError.forbidden('Hospital Admins can only assign the Staff or Viewer role');
    }
  }

  const role = changes.role ?? target.role;
  let hospitalAccess;
  if (changes.hospitalAccess || changes.role) {
    const requested = changes.hospitalAccess ?? target.hospitalAccess;
    // A Hospital Admin can't see or remove access to hospitals outside their own scope: keep those.
    const outsideScope = scope ? target.hospitalAccess.filter((id) => !scope.includes(id)) : [];
    const managed = await checkHospitalAccessList(actor, role, scope ? requested.filter((id) => scope.includes(id)) : requested);
    hospitalAccess = role === ROLES.SUPER_ADMIN ? [] : [...new Set([...managed, ...outsideScope])];
  }

  const user = await updateUser(userId, { ...changes, hospitalAccess });
  await recordAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.USER_UPDATED,
    metadata: { updatedUserId: userId, fields: Object.keys(changes) },
  });
  return user;
}

export const listUsersForActor = (actor) => listUsers({ hospitalIds: hospitalScope(actor) });
