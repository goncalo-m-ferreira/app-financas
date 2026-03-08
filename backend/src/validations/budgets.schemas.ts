import { z } from 'zod';
import {
  optionalMonthQuerySchema,
  optionalYearQuerySchema,
  uuidSchema,
} from './common.schemas.js';

export const createBudgetBodySchema = z.object({
  categoryId: uuidSchema,
  amount: z.coerce.number().positive('amount deve ser maior que 0.'),
});

export const budgetParamSchema = z.object({
  budgetId: uuidSchema,
});

export const updateBudgetBodySchema = z.object({
  amount: z.coerce.number().positive('amount deve ser maior que 0.'),
});

export const listBudgetsQuerySchema = z.object({
  month: optionalMonthQuerySchema,
  year: optionalYearQuerySchema,
});
