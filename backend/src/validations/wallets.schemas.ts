import { z } from 'zod';
import { uuidSchema } from './common.schemas.js';

const colorSchema = z
  .string()
  .trim()
  .regex(/^#([A-Fa-f0-9]{6})$/, 'color must be in HEX format (#RRGGBB).');

export const walletParamSchema = z.object({
  walletId: uuidSchema,
});

export const createWalletBodySchema = z.object({
  name: z.string().trim().min(2, 'name must have at least 2 characters.').max(80),
  balance: z.coerce.number().min(0, 'balance must be >= 0.').optional().default(0),
  color: colorSchema.optional(),
});

export const updateWalletBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    balance: z.coerce.number().min(0).optional(),
    color: colorSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update.',
  });
