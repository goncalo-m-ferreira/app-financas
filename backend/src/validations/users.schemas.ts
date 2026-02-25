import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schemas.js';

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'defaultCurrency deve conter 3 letras (ex: EUR).');

export const userIdParamSchema = z.object({
  userId: uuidSchema,
});

export const listUsersQuerySchema = paginationQuerySchema;

export const createUserBodySchema = z.object({
  name: z.string().trim().min(2, 'name deve ter pelo menos 2 caracteres.').max(120),
  email: z.string().trim().email('email inválido.').toLowerCase(),
  passwordHash: z.string().min(10, 'passwordHash deve ter pelo menos 10 caracteres.'),
  defaultCurrency: currencySchema.optional().default('EUR'),
});

export const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    passwordHash: z.string().min(10).optional(),
    defaultCurrency: currencySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'É necessário enviar pelo menos um campo para atualização.',
  });
