import { z } from 'zod';
import {
  optionalDateQuerySchema,
  optionalNumberQuerySchema,
  paginationQuerySchema,
  uuidSchema,
} from './common.schemas.js';

export const transactionTypeSchema = z.enum(['INCOME', 'EXPENSE']);

export const userParamSchema = z.object({
  userId: uuidSchema,
});

export const transactionParamSchema = z.object({
  userId: uuidSchema,
  transactionId: uuidSchema,
});

export const listTransactionsQuerySchema = paginationQuerySchema
  .extend({
    type: transactionTypeSchema.optional(),
    categoryId: uuidSchema.optional(),
    from: optionalDateQuerySchema,
    to: optionalDateQuerySchema,
    minAmount: optionalNumberQuerySchema,
    maxAmount: optionalNumberQuerySchema,
  })
  .refine(
    (data) =>
      data.minAmount === undefined ||
      data.maxAmount === undefined ||
      data.minAmount <= data.maxAmount,
    {
      message: 'minAmount não pode ser maior que maxAmount.',
      path: ['minAmount'],
    },
  )
  .refine((data) => data.from === undefined || data.to === undefined || data.from <= data.to, {
    message: 'from não pode ser maior que to.',
    path: ['from'],
  });

export const createTransactionBodySchema = z
  .object({
    type: transactionTypeSchema,
    amount: z.coerce.number().positive('amount deve ser maior que 0.'),
    description: z.string().trim().max(255).optional(),
    transactionDate: z.coerce.date(),
    categoryId: uuidSchema.optional(),
  })
  .refine((data) => data.type !== 'EXPENSE' || Boolean(data.categoryId), {
    message: 'categoryId é obrigatório para transações do tipo EXPENSE.',
    path: ['categoryId'],
  });

export const updateTransactionBodySchema = z
  .object({
    type: transactionTypeSchema.optional(),
    amount: z.coerce.number().positive().optional(),
    description: z.string().trim().max(255).nullable().optional(),
    transactionDate: z.coerce.date().optional(),
    categoryId: uuidSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'É necessário enviar pelo menos um campo para atualização.',
  });
