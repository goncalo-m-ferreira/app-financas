import { z } from 'zod';
import { optionalMonthQuerySchema, optionalYearQuerySchema, uuidSchema } from './common.schemas.js';

export const createReportBodySchema = z.object({
  name: z.string().trim().min(3, 'name must have at least 3 characters.').max(120).optional(),
  month: optionalMonthQuerySchema,
  year: optionalYearQuerySchema,
});

const optionalQueryValue = (value: unknown): unknown =>
  value === '' || value === undefined ? undefined : value;

export const reportParamSchema = z.object({
  reportId: uuidSchema,
});

export const listReportsQuerySchema = z.object({
  status: z.preprocess(
    optionalQueryValue,
    z.enum(['PENDING', 'COMPLETED', 'FAILED']).optional(),
  ),
  month: optionalMonthQuerySchema,
  year: optionalYearQuerySchema,
});
