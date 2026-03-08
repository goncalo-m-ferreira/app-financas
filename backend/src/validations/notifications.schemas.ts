import { z } from 'zod';
import { uuidSchema } from './common.schemas.js';

const optionalQueryValue = (value: unknown): unknown =>
  value === '' || value === undefined ? undefined : value;

const optionalBooleanQuerySchema = z.preprocess(
  (value) => {
    const normalized = optionalQueryValue(value);

    if (normalized === undefined) {
      return undefined;
    }

    if (normalized === true || normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === false || normalized === 'false' || normalized === '0') {
      return false;
    }

    return normalized;
  },
  z.boolean().optional(),
);

export const notificationParamSchema = z.object({
  notificationId: uuidSchema,
});

export const listNotificationsQuerySchema = z.object({
  isRead: optionalBooleanQuerySchema,
  type: z.preprocess(
    optionalQueryValue,
    z.enum(['BUDGET', 'SYSTEM', 'REPORT', 'RECURRING']).optional(),
  ),
  take: z.preprocess(
    optionalQueryValue,
    z.coerce.number().int().positive().max(100).optional(),
  ),
  cursor: z.preprocess(optionalQueryValue, uuidSchema.optional()),
});
