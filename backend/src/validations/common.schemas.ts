import { z } from 'zod';

export const uuidSchema = z.string().uuid('Deve ser um UUID válido.');

const optionalQueryValue = (value: unknown): unknown =>
  value === '' || value === undefined ? undefined : value;

export const optionalDateQuerySchema = z.preprocess(
  optionalQueryValue,
  z.coerce.date().optional(),
);

export const optionalNumberQuerySchema = z.preprocess(
  optionalQueryValue,
  z.coerce.number().optional(),
);

export const optionalMonthQuerySchema = z.preprocess(
  optionalQueryValue,
  z.coerce.number().int().min(1).max(12).optional(),
);

export const optionalYearQuerySchema = z.preprocess(
  optionalQueryValue,
  z.coerce.number().int().min(1970).max(2100).optional(),
);

export const optionalSearchQuerySchema = z.preprocess(
  optionalQueryValue,
  z.string().trim().min(1).max(120).optional(),
);

export const paginationQuerySchema = z.object({
  take: z.preprocess(
    optionalQueryValue,
    z.coerce.number().int().positive().max(100).optional(),
  ),
  skip: z.preprocess(
    optionalQueryValue,
    z.coerce.number().int().nonnegative().optional(),
  ),
});
