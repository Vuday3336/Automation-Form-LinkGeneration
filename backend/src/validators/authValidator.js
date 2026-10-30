import { z } from 'zod';
import { ROLES } from '../models/User.js';
import { optionalQuery, pagination, passwordRule } from './common.js';

const roleEnum = z.enum(Object.values(ROLES));

export const loginBody = z.object({
  email: z.email('Enter a valid email').max(254),
  password: z.string().min(1, 'Password is required').max(200),
});

export const registerBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email('Enter a valid email').max(254),
  password: passwordRule,
  role: roleEnum,
  hospitalAccess: z.array(z.uuid()).max(100).default([]),
});

export const updateUserBody = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: roleEnum.optional(),
    isActive: z.boolean().optional(),
    hospitalAccess: z.array(z.uuid()).max(100).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordRule,
});

export const createHospitalBody = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'Code: 2–20 letters, numbers or dashes'),
  name: z.string().trim().min(2).max(200),
});

export const updateHospitalBody = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const listAuditLogsQuery = z.object({
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: optionalQuery(z.string().max(60)),
  submissionId: optionalQuery(z.string().max(40)),
});
