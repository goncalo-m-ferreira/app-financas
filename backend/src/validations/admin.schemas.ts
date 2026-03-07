import { z } from 'zod';

const optionalQueryValue = (value: unknown): unknown =>
  value === '' || value === undefined ? undefined : value;

export const adminOverviewQuerySchema = z.object({
  take: z.preprocess(
    optionalQueryValue,
    z.coerce.number().int().positive().max(100).default(20),
  ),
});

export const adminRecurringOperationIssueTypeSchema = z.enum([
  'FAILED_EXECUTION',
  'PAUSED_RULE',
]);

export const adminRecurringOperationsQuerySchema = z.object({
  take: z.preprocess(
    optionalQueryValue,
    z.coerce.number().int().positive().max(100).default(50),
  ),
  issueType: z.preprocess(optionalQueryValue, adminRecurringOperationIssueTypeSchema.optional()),
});
