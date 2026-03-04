import { z } from 'zod';
import { optionalMonthQuerySchema, optionalYearQuerySchema } from './common.schemas.js';

export const createReportBodySchema = z.object({
  name: z.string().trim().min(3, 'name must have at least 3 characters.').max(120).optional(),
  month: optionalMonthQuerySchema,
  year: optionalYearQuerySchema,
});
