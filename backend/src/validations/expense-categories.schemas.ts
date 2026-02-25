import { z } from 'zod';
import { uuidSchema } from './common.schemas.js';

const colorSchema = z
  .string()
  .trim()
  .regex(/^#([A-Fa-f0-9]{6})$/, 'color deve estar em formato hexadecimal #RRGGBB.');

export const userParamSchema = z.object({
  userId: uuidSchema,
});

export const categoryParamSchema = z.object({
  userId: uuidSchema,
  categoryId: uuidSchema,
});

export const createExpenseCategoryBodySchema = z.object({
  name: z.string().trim().min(2, 'name deve ter pelo menos 2 caracteres.').max(80),
  color: colorSchema.optional(),
  icon: z.string().trim().min(1).max(80).optional(),
});

export const updateExpenseCategoryBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    color: colorSchema.optional(),
    icon: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'É necessário enviar pelo menos um campo para atualização.',
  });
