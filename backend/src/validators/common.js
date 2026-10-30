import { z } from 'zod';

// Query strings arrive as text, and empty filters arrive as "". Treat "" as "not provided".
export const optionalQuery = (schema) =>
  z.preprocess((value) => (value === '' || value === undefined ? undefined : value), schema.optional());

export const pagination = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const uuidParam = z.object({ id: z.uuid('Invalid ID') });

export const passwordRule = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(200, 'Password is too long');
