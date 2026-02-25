import { z } from 'zod';

export const uuidSchema = z.string().uuid('Deve ser um UUID válido.');

export const optionalDateQuerySchema = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

export const optionalNumberQuerySchema = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.coerce.number().optional(),
);

export const paginationQuerySchema = z.object({
  take: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().int().positive().max(100).optional(),
  ),
  skip: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().int().nonnegative().optional(),
  ),
});
