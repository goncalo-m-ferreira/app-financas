import { IANAZone } from 'luxon';
import { z } from 'zod';
import { uuidSchema } from './common.schemas.js';

export const recurringRuleStatusSchema = z.enum([
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
  'COMPLETED',
]);
export const recurringFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
export const recurringEndModeSchema = z.enum(['NONE', 'UNTIL_DATE', 'MAX_OCCURRENCES']);
export const recurringExecutionStatusSchema = z.enum(['SUCCESS', 'FAILED', 'SKIPPED']);

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => IANAZone.isValidZone(value), {
    message: 'Timezone inválido. Use uma timezone IANA válida.',
  });

const optionalDateSchema = z.coerce.date().optional().nullable();
const optionalOccurrencesSchema = z.coerce.number().int().positive().optional().nullable();

export const recurringRuleParamSchema = z.object({
  ruleId: uuidSchema,
});

export const listRecurringRulesQuerySchema = z.object({
  status: recurringRuleStatusSchema.optional(),
});

export const createRecurringRuleBodySchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE']),
    amount: z.coerce.number().positive('amount deve ser maior que 0.'),
    description: z.string().trim().max(255).optional(),
    walletId: uuidSchema,
    categoryId: uuidSchema.optional().nullable(),
    isSubscription: z.boolean().optional().default(false),
    timezone: timezoneSchema,
    frequency: recurringFrequencySchema,
    startAt: z.coerce.date(),
    endMode: recurringEndModeSchema.optional().default('NONE'),
    endAt: optionalDateSchema,
    maxOccurrences: optionalOccurrencesSchema,
  })
  .strict()
  .superRefine((data, context) => {
    if (data.type === 'EXPENSE' && !data.categoryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'categoryId é obrigatório para regras do tipo EXPENSE.',
        path: ['categoryId'],
      });
    }

    if (data.type === 'INCOME' && data.categoryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'categoryId não é permitido para regras do tipo INCOME.',
        path: ['categoryId'],
      });
    }

    if (data.endMode === 'NONE') {
      if (data.endAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endAt deve ser omitido quando endMode = NONE.',
          path: ['endAt'],
        });
      }

      if (data.maxOccurrences !== null && data.maxOccurrences !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'maxOccurrences deve ser omitido quando endMode = NONE.',
          path: ['maxOccurrences'],
        });
      }
    }

    if (data.endMode === 'UNTIL_DATE') {
      if (!data.endAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endAt é obrigatório quando endMode = UNTIL_DATE.',
          path: ['endAt'],
        });
      }

      if (data.maxOccurrences !== null && data.maxOccurrences !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'maxOccurrences deve ser omitido quando endMode = UNTIL_DATE.',
          path: ['maxOccurrences'],
        });
      }

      if (data.endAt && data.endAt.getTime() < data.startAt.getTime()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endAt não pode ser anterior a startAt.',
          path: ['endAt'],
        });
      }
    }

    if (data.endMode === 'MAX_OCCURRENCES') {
      if (!data.maxOccurrences) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'maxOccurrences é obrigatório quando endMode = MAX_OCCURRENCES.',
          path: ['maxOccurrences'],
        });
      }

      if (data.endAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endAt deve ser omitido quando endMode = MAX_OCCURRENCES.',
          path: ['endAt'],
        });
      }
    }
  });

export const updateRecurringRuleBodySchema = z
  .object({
    amount: z.coerce.number().positive().optional(),
    description: z.string().trim().max(255).nullable().optional(),
    walletId: uuidSchema.optional(),
    categoryId: uuidSchema.nullable().optional(),
    isSubscription: z.boolean().optional(),
    timezone: timezoneSchema.optional(),
    frequency: recurringFrequencySchema.optional(),
    startAt: z.coerce.date().optional(),
    endMode: recurringEndModeSchema.optional(),
    endAt: optionalDateSchema,
    maxOccurrences: optionalOccurrencesSchema,
  })
  .strict()
  .superRefine((data, context) => {
    if (data.endMode === 'MAX_OCCURRENCES' && data.endAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endAt não pode ser enviado com endMode = MAX_OCCURRENCES.',
        path: ['endAt'],
      });
    }

    if (data.endMode === 'UNTIL_DATE' && data.maxOccurrences) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maxOccurrences não pode ser enviado com endMode = UNTIL_DATE.',
        path: ['maxOccurrences'],
      });
    }
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'É necessário enviar pelo menos um campo para atualização.',
  });

export const pauseRecurringRuleBodySchema = z.object({
  reason: z.string().trim().min(1).max(255).optional(),
});

export const recurringRulePreviewQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(100).optional().default(12),
});

export const listRecurringExecutionsQuerySchema = z.object({
  ruleId: uuidSchema.optional(),
  status: recurringExecutionStatusSchema.optional(),
  take: z.coerce.number().int().positive().max(100).optional().default(50),
  cursor: uuidSchema.optional(),
});
