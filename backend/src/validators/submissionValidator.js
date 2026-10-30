import { z } from 'zod';
import { SUBMISSION_STATUSES } from '../models/Submission.js';
import { optionalQuery, pagination } from './common.js';

// ─── Incoming Google Form payload (from Apps Script) ─────────────────────────
// Answers are a list, not fixed fields, so ANY form layout is accepted.
// Values can be text, numbers, checkbox lists, or grids (lists of lists).
const answerValue = z.union([
  z.string().max(10_000),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(2_000), z.array(z.string().max(2_000)).max(100)])).max(200),
]);

export const googleFormPayloadSchema = z.object({
  source: z.literal('google_form').default('google_form'),
  sourceResponseId: z.string().trim().min(1, 'sourceResponseId is required').max(200),
  formId: z.string().max(200).optional(),
  formTitle: z.string().max(300).optional(),
  submittedAt: z.iso.datetime({ offset: true, message: 'submittedAt must be an ISO date-time' }),
  respondentEmail: z.email().nullable().optional(),
  answers: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(500),
        answer: answerValue,
        type: z.string().max(50).optional(),
      })
    )
    .min(1, 'At least one answer is required')
    .max(200),
});

// ─── Dashboard requests ──────────────────────────────────────────────────────
export const submissionIdParam = z.object({
  submissionId: z.string().regex(/^HF-[0-9]{8}-[A-Z2-9]{8}$/, 'Invalid submission ID'),
});

export const secureTokenParam = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid link'),
});

export const listSubmissionsQuery = z.object({
  ...pagination,
  search: optionalQuery(z.string().trim().max(100)),
  status: optionalQuery(z.enum(SUBMISSION_STATUSES)),
  department: optionalQuery(z.string().trim().max(120)),
  submissionType: optionalQuery(z.string().trim().max(120)),
  hospitalId: optionalQuery(z.uuid()),
  sortBy: optionalQuery(z.enum(['submittedAt', 'createdAt', 'status', 'hospitalName', 'department'])),
  order: optionalQuery(z.enum(['asc', 'desc'])),
});

export const updateStatusBody = z.object({
  status: z.enum(SUBMISSION_STATUSES, { message: `Status must be one of: ${SUBMISSION_STATUSES.join(', ')}` }),
});

export const updateSubmissionBody = z
  .object({
    department: z.string().trim().min(1).max(120).optional(),
    submissionType: z.string().trim().min(1).max(120).optional(),
    hospitalId: z.uuid().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');
