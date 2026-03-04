import { z } from 'zod';
import { optionalMonthQuerySchema, optionalYearQuerySchema } from './common.schemas.js';

export const listHomeInsightsQuerySchema = z.object({
  month: optionalMonthQuerySchema,
  year: optionalYearQuerySchema,
});
