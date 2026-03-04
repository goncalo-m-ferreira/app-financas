import { z } from 'zod';

const optionalQueryValue = (value: unknown): unknown =>
  value === '' || value === undefined ? undefined : value;

export const adminOverviewQuerySchema = z.object({
  take: z.preprocess(
    optionalQueryValue,
    z.coerce.number().int().positive().max(100).default(20),
  ),
});
