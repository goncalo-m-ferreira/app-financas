import {
  Prisma,
  RecurringEndMode,
  RecurringExecutionStatus,
  RecurringRuleStatus,
  type RecurringRule,
  type RecurringFrequency,
  type TransactionType,
} from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import {
  deriveAnchorsFromStartAt,
  listUpcomingOccurrences,
  resolveNextRunAt,
  type RecurringScheduleAnchors,
  type RecurringScheduleConfig,
} from '../utils/recurring-schedule.js';

const recurringRuleInclude = {
  wallet: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
    },
  },
} satisfies Prisma.RecurringRuleInclude;

const recurringExecutionInclude = {
  rule: {
    select: {
      id: true,
      description: true,
      type: true,
      amount: true,
      status: true,
      pausedReason: true,
      frequency: true,
      timezone: true,
      wallet: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
        },
      },
    },
  },
  transaction: {
    select: {
      id: true,
      type: true,
      amount: true,
      transactionDate: true,
      wallet: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
        },
      },
    },
  },
} satisfies Prisma.RecurringExecutionInclude;

type RecurringRuleWithRelations = Prisma.RecurringRuleGetPayload<{
  include: typeof recurringRuleInclude;
}>;

type RecurringExecutionWithRelations = Prisma.RecurringExecutionGetPayload<{
  include: typeof recurringExecutionInclude;
}>;

type RuleEndSettings = {
  endMode: RecurringEndMode;
  endAt: Date | null;
  maxOccurrences: number | null;
};

export type CreateRecurringRuleInput = {
  type: TransactionType;
  amount: number;
  description?: string;
  walletId: string;
  categoryId?: string | null;
  isSubscription?: boolean;
  timezone: string;
  frequency: RecurringFrequency;
  startAt: Date;
  endMode?: RecurringEndMode;
  endAt?: Date | null;
  maxOccurrences?: number | null;
};

export type UpdateRecurringRuleInput = {
  amount?: number;
  description?: string | null;
  walletId?: string;
  categoryId?: string | null;
  isSubscription?: boolean;
  timezone?: string;
  frequency?: RecurringFrequency;
  startAt?: Date;
  endMode?: RecurringEndMode;
  endAt?: Date | null;
  maxOccurrences?: number | null;
};

export type ListRecurringRulesFilters = {
  status?: RecurringRuleStatus;
};

export type ListRecurringExecutionsFilters = {
  ruleId?: string;
  status?: RecurringExecutionStatus;
  take?: number;
  cursor?: string;
};

export type RecurringRuleResponse = Omit<RecurringRuleWithRelations, 'amount'> & {
  amount: string;
};

type RecurringExecutionRuleContext = Omit<
  NonNullable<RecurringExecutionWithRelations['rule']>,
  'amount'
> & {
  amount: string;
};

type RecurringExecutionTransactionContext = Omit<
  NonNullable<RecurringExecutionWithRelations['transaction']>,
  'amount'
> & {
  amount: string;
};

export type RecurringExecutionResponse = Omit<
  RecurringExecutionWithRelations,
  'rule' | 'transaction'
> & {
  rule: RecurringExecutionRuleContext | null;
  transaction: RecurringExecutionTransactionContext | null;
};

export type RecurringExecutionsListResponse = {
  items: RecurringExecutionResponse[];
  nextCursor: string | null;
};

export type RecurringPreviewResponse = {
  ruleId: string;
  timezone: string;
  nextRunAt: Date | null;
  occurrences: Date[];
};

function toRecurringRuleResponse(rule: RecurringRuleWithRelations): RecurringRuleResponse {
  return {
    ...rule,
    amount: rule.amount.toString(),
  };
}

function toRecurringExecutionResponse(
  execution: RecurringExecutionWithRelations,
): RecurringExecutionResponse {
  return {
    ...execution,
    rule: execution.rule
      ? {
          ...execution.rule,
          amount: execution.rule.amount.toString(),
        }
      : null,
    transaction: execution.transaction
      ? {
          ...execution.transaction,
          amount: execution.transaction.amount.toString(),
        }
      : null,
  };
}

function parseDecimalToPositiveNumber(value: Prisma.Decimal): number {
  const parsed = Number.parseFloat(value.toString());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError('Valor monetário inválido na regra recorrente.', 400);
  }

  return parsed;
}

async function ensureUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError('Utilizador não encontrado.', 404);
  }
}

async function ensureWalletBelongsToUser(userId: string, walletId: string): Promise<void> {
  const wallet = await prisma.wallet.findUnique({
    where: {
      userId_id: {
        userId,
        id: walletId,
      },
    },
    select: { id: true },
  });

  if (!wallet) {
    throw new AppError('Wallet não encontrada para este utilizador.', 404);
  }
}

async function ensureCategoryBelongsToUser(userId: string, categoryId: string): Promise<void> {
  const category = await prisma.expenseCategory.findUnique({
    where: {
      userId_id: {
        userId,
        id: categoryId,
      },
    },
    select: { id: true },
  });

  if (!category) {
    throw new AppError('Categoria não encontrada para este utilizador.', 404);
  }
}

async function getRecurringRuleOrThrow(userId: string, ruleId: string): Promise<RecurringRuleWithRelations> {
  const rule = await prisma.recurringRule.findUnique({
    where: {
      userId_id: {
        userId,
        id: ruleId,
      },
    },
    include: recurringRuleInclude,
  });

  if (!rule) {
    throw new AppError('Regra recorrente não encontrada.', 404);
  }

  return rule;
}

function normalizeEndSettings(input: RuleEndSettings, startAt: Date): RuleEndSettings {
  if (input.endMode === 'NONE') {
    return {
      endMode: 'NONE',
      endAt: null,
      maxOccurrences: null,
    };
  }

  if (input.endMode === 'UNTIL_DATE') {
    if (!input.endAt) {
      throw new AppError('endAt é obrigatório quando endMode = UNTIL_DATE.', 400);
    }

    if (input.endAt.getTime() < startAt.getTime()) {
      throw new AppError('endAt não pode ser anterior a startAt.', 400);
    }

    return {
      endMode: 'UNTIL_DATE',
      endAt: input.endAt,
      maxOccurrences: null,
    };
  }

  if (!input.maxOccurrences || input.maxOccurrences <= 0) {
    throw new AppError('maxOccurrences é obrigatório quando endMode = MAX_OCCURRENCES.', 400);
  }

  return {
    endMode: 'MAX_OCCURRENCES',
    endAt: null,
    maxOccurrences: input.maxOccurrences,
  };
}

function buildScheduleConfig(params: {
  frequency: RecurringFrequency;
  timezone: string;
  startAt: Date;
  anchors: RecurringScheduleAnchors;
  endMode: RecurringEndMode;
  endAt: Date | null;
  maxOccurrences: number | null;
  occurrencesGenerated: number;
}): RecurringScheduleConfig {
  return {
    frequency: params.frequency,
    timezone: params.timezone,
    startAt: params.startAt,
    anchorDayOfMonth: params.anchors.anchorDayOfMonth,
    anchorWeekday: params.anchors.anchorWeekday,
    anchorMonthOfYear: params.anchors.anchorMonthOfYear,
    anchorMinuteOfDay: params.anchors.anchorMinuteOfDay,
    isLastDayAnchor: params.anchors.isLastDayAnchor,
    endMode: params.endMode,
    endAt: params.endAt,
    maxOccurrences: params.maxOccurrences,
    occurrencesGenerated: params.occurrencesGenerated,
  };
}

function buildScheduleConfigFromRule(rule: RecurringRule): RecurringScheduleConfig {
  return {
    frequency: rule.frequency,
    timezone: rule.timezone,
    startAt: rule.startAt,
    anchorDayOfMonth: rule.anchorDayOfMonth,
    anchorWeekday: rule.anchorWeekday,
    anchorMonthOfYear: rule.anchorMonthOfYear,
    anchorMinuteOfDay: rule.anchorMinuteOfDay,
    isLastDayAnchor: rule.isLastDayAnchor,
    endMode: rule.endMode,
    endAt: rule.endAt,
    maxOccurrences: rule.maxOccurrences,
    occurrencesGenerated: rule.occurrencesGenerated,
  };
}

function ensureCategoryRulesOrThrow(type: TransactionType, categoryId: string | null): string | null {
  if (type === 'INCOME') {
    return null;
  }

  if (!categoryId) {
    throw new AppError('categoryId é obrigatório para regras do tipo EXPENSE.', 400);
  }

  return categoryId;
}

function assertRuleCanBeMutated(rule: RecurringRule): void {
  if (rule.status === 'CANCELLED') {
    throw new AppError('A regra já foi cancelada e não pode ser alterada.', 409);
  }

  if (rule.status === 'COMPLETED') {
    throw new AppError('A regra já foi concluída e não pode ser alterada.', 409);
  }
}

export async function listRecurringRulesByUser(
  userId: string,
  filters: ListRecurringRulesFilters = {},
): Promise<RecurringRuleResponse[]> {
  await ensureUserExists(userId);

  const rules = await prisma.recurringRule.findMany({
    where: {
      userId,
      status: filters.status,
    },
    include: recurringRuleInclude,
    orderBy: [{ createdAt: 'desc' }],
  });

  return rules.map(toRecurringRuleResponse);
}

export async function createRecurringRule(
  userId: string,
  input: CreateRecurringRuleInput,
): Promise<RecurringRuleResponse> {
  await ensureUserExists(userId);
  await ensureWalletBelongsToUser(userId, input.walletId);

  const categoryId = ensureCategoryRulesOrThrow(input.type, input.categoryId ?? null);

  if (categoryId) {
    await ensureCategoryBelongsToUser(userId, categoryId);
  }

  const endSettings = normalizeEndSettings(
    {
      endMode: input.endMode ?? 'NONE',
      endAt: input.endAt ?? null,
      maxOccurrences: input.maxOccurrences ?? null,
    },
    input.startAt,
  );

  const anchors = deriveAnchorsFromStartAt({
    startAt: input.startAt,
    timezone: input.timezone,
    frequency: input.frequency,
  });

  const scheduleConfig = buildScheduleConfig({
    frequency: input.frequency,
    timezone: input.timezone,
    startAt: input.startAt,
    anchors,
    endMode: endSettings.endMode,
    endAt: endSettings.endAt,
    maxOccurrences: endSettings.maxOccurrences,
    occurrencesGenerated: 0,
  });

  const nextRunAt = resolveNextRunAt(scheduleConfig, new Date());
  const status: RecurringRuleStatus = nextRunAt ? 'ACTIVE' : 'COMPLETED';

  const createdRule = await prisma.recurringRule.create({
    data: {
      userId,
      walletId: input.walletId,
      categoryId,
      type: input.type,
      amount: input.amount,
      description: input.description?.trim() || null,
      isSubscription: input.isSubscription ?? false,
      timezone: input.timezone,
      frequency: input.frequency,
      startAt: input.startAt,
      nextRunAt,
      anchorDayOfMonth: anchors.anchorDayOfMonth,
      anchorWeekday: anchors.anchorWeekday,
      anchorMonthOfYear: anchors.anchorMonthOfYear,
      anchorMinuteOfDay: anchors.anchorMinuteOfDay,
      isLastDayAnchor: anchors.isLastDayAnchor,
      endMode: endSettings.endMode,
      endAt: endSettings.endAt,
      maxOccurrences: endSettings.maxOccurrences,
      occurrencesGenerated: 0,
      status,
      pausedReason: null,
      cancelledAt: null,
      lastSuccessfulRunAt: null,
      lastFailureAt: null,
      failureCount: 0,
    },
    include: recurringRuleInclude,
  });

  return toRecurringRuleResponse(createdRule);
}

export async function updateRecurringRule(
  userId: string,
  ruleId: string,
  input: UpdateRecurringRuleInput,
): Promise<RecurringRuleResponse> {
  await ensureUserExists(userId);

  const existingRule = await getRecurringRuleOrThrow(userId, ruleId);
  assertRuleCanBeMutated(existingRule);

  if (existingRule.type === 'INCOME' && input.categoryId !== undefined && input.categoryId !== null) {
    throw new AppError('categoryId não é permitido para regras do tipo INCOME.', 400);
  }

  const nextAmount = input.amount ?? parseDecimalToPositiveNumber(existingRule.amount);
  const nextDescription =
    input.description === undefined ? existingRule.description : input.description?.trim() || null;
  const nextWalletId = input.walletId ?? existingRule.walletId;

  const requestedCategoryId =
    input.categoryId === undefined ? existingRule.categoryId : input.categoryId;
  const nextCategoryId = ensureCategoryRulesOrThrow(existingRule.type, requestedCategoryId);

  await ensureWalletBelongsToUser(userId, nextWalletId);

  if (nextCategoryId) {
    await ensureCategoryBelongsToUser(userId, nextCategoryId);
  }

  const nextFrequency = input.frequency ?? existingRule.frequency;
  const nextTimezone = input.timezone ?? existingRule.timezone;
  const nextStartAt = input.startAt ?? existingRule.startAt;
  const nextIsSubscription = input.isSubscription ?? existingRule.isSubscription;

  const mergedEndMode = input.endMode ?? existingRule.endMode;
  const mergedEndAt = input.endAt === undefined ? existingRule.endAt : input.endAt;
  const mergedMaxOccurrences =
    input.maxOccurrences === undefined ? existingRule.maxOccurrences : input.maxOccurrences;

  const nextEndSettings = normalizeEndSettings(
    {
      endMode: mergedEndMode,
      endAt: mergedEndAt,
      maxOccurrences: mergedMaxOccurrences,
    },
    nextStartAt,
  );

  const schedulingFieldsChanged =
    input.frequency !== undefined ||
    input.timezone !== undefined ||
    input.startAt !== undefined ||
    input.endMode !== undefined ||
    input.endAt !== undefined ||
    input.maxOccurrences !== undefined;

  const anchors = schedulingFieldsChanged
    ? deriveAnchorsFromStartAt({
        startAt: nextStartAt,
        timezone: nextTimezone,
        frequency: nextFrequency,
      })
    : {
        anchorDayOfMonth: existingRule.anchorDayOfMonth,
        anchorWeekday: existingRule.anchorWeekday,
        anchorMonthOfYear: existingRule.anchorMonthOfYear,
        anchorMinuteOfDay: existingRule.anchorMinuteOfDay,
        isLastDayAnchor: existingRule.isLastDayAnchor,
      };

  let nextRunAt: Date | null = existingRule.nextRunAt;
  let nextStatus: RecurringRuleStatus = existingRule.status;

  if (existingRule.status === 'PAUSED') {
    nextRunAt = null;
    nextStatus = 'PAUSED';
  } else {
    const scheduleConfig = buildScheduleConfig({
      frequency: nextFrequency,
      timezone: nextTimezone,
      startAt: nextStartAt,
      anchors,
      endMode: nextEndSettings.endMode,
      endAt: nextEndSettings.endAt,
      maxOccurrences: nextEndSettings.maxOccurrences,
      occurrencesGenerated: existingRule.occurrencesGenerated,
    });

    nextRunAt = resolveNextRunAt(scheduleConfig, new Date());
    nextStatus = nextRunAt ? 'ACTIVE' : 'COMPLETED';
  }

  const updatedRule = await prisma.recurringRule.update({
    where: {
      userId_id: {
        userId,
        id: ruleId,
      },
    },
    data: {
      amount: nextAmount,
      description: nextDescription,
      walletId: nextWalletId,
      categoryId: nextCategoryId,
      isSubscription: nextIsSubscription,
      timezone: nextTimezone,
      frequency: nextFrequency,
      startAt: nextStartAt,
      nextRunAt,
      anchorDayOfMonth: anchors.anchorDayOfMonth,
      anchorWeekday: anchors.anchorWeekday,
      anchorMonthOfYear: anchors.anchorMonthOfYear,
      anchorMinuteOfDay: anchors.anchorMinuteOfDay,
      isLastDayAnchor: anchors.isLastDayAnchor,
      endMode: nextEndSettings.endMode,
      endAt: nextEndSettings.endAt,
      maxOccurrences: nextEndSettings.maxOccurrences,
      status: nextStatus,
      pausedReason: nextStatus === 'PAUSED' ? existingRule.pausedReason : null,
    },
    include: recurringRuleInclude,
  });

  return toRecurringRuleResponse(updatedRule);
}

export async function pauseRecurringRule(
  userId: string,
  ruleId: string,
  reason?: string,
): Promise<RecurringRuleResponse> {
  await ensureUserExists(userId);

  const existingRule = await getRecurringRuleOrThrow(userId, ruleId);

  if (existingRule.status === 'CANCELLED') {
    throw new AppError('A regra já foi cancelada.', 409);
  }

  if (existingRule.status === 'COMPLETED') {
    throw new AppError('A regra já foi concluída e não pode ser pausada.', 409);
  }

  if (existingRule.status === 'PAUSED') {
    if (!existingRule.nextRunAt) {
      return toRecurringRuleResponse(existingRule);
    }

    const normalizedRule = await prisma.recurringRule.update({
      where: {
        userId_id: {
          userId,
          id: ruleId,
        },
      },
      data: {
        nextRunAt: null,
      },
      include: recurringRuleInclude,
    });

    return toRecurringRuleResponse(normalizedRule);
  }

  const updatedRule = await prisma.recurringRule.update({
    where: {
      userId_id: {
        userId,
        id: ruleId,
      },
    },
    data: {
      status: 'PAUSED',
      pausedReason: reason?.trim() || 'Pausada manualmente.',
      nextRunAt: null,
    },
    include: recurringRuleInclude,
  });

  return toRecurringRuleResponse(updatedRule);
}

export async function resumeRecurringRule(
  userId: string,
  ruleId: string,
): Promise<RecurringRuleResponse> {
  await ensureUserExists(userId);

  const existingRule = await getRecurringRuleOrThrow(userId, ruleId);

  if (existingRule.status === 'CANCELLED') {
    throw new AppError('A regra já foi cancelada e não pode ser retomada.', 409);
  }

  if (existingRule.status === 'COMPLETED') {
    throw new AppError('A regra já foi concluída e não pode ser retomada.', 409);
  }

  if (existingRule.status === 'ACTIVE') {
    return toRecurringRuleResponse(existingRule);
  }

  const scheduleConfig = buildScheduleConfigFromRule(existingRule);
  const nextRunAt = resolveNextRunAt(scheduleConfig, new Date());
  const nextStatus: RecurringRuleStatus = nextRunAt ? 'ACTIVE' : 'COMPLETED';

  const updatedRule = await prisma.recurringRule.update({
    where: {
      userId_id: {
        userId,
        id: ruleId,
      },
    },
    data: {
      status: nextStatus,
      pausedReason: null,
      nextRunAt,
    },
    include: recurringRuleInclude,
  });

  return toRecurringRuleResponse(updatedRule);
}

export async function cancelRecurringRule(userId: string, ruleId: string): Promise<RecurringRuleResponse> {
  await ensureUserExists(userId);

  const existingRule = await getRecurringRuleOrThrow(userId, ruleId);

  if (existingRule.status === 'CANCELLED') {
    if (!existingRule.nextRunAt) {
      return toRecurringRuleResponse(existingRule);
    }

    const normalizedRule = await prisma.recurringRule.update({
      where: {
        userId_id: {
          userId,
          id: ruleId,
        },
      },
      data: {
        nextRunAt: null,
      },
      include: recurringRuleInclude,
    });

    return toRecurringRuleResponse(normalizedRule);
  }

  const updatedRule = await prisma.recurringRule.update({
    where: {
      userId_id: {
        userId,
        id: ruleId,
      },
    },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      pausedReason: null,
      nextRunAt: null,
    },
    include: recurringRuleInclude,
  });

  return toRecurringRuleResponse(updatedRule);
}

export async function previewRecurringRule(
  userId: string,
  ruleId: string,
  count: number,
): Promise<RecurringPreviewResponse> {
  await ensureUserExists(userId);

  const rule = await getRecurringRuleOrThrow(userId, ruleId);

  const scheduleConfig = buildScheduleConfigFromRule(rule);
  const fromDate = new Date();
  const occurrences =
    rule.status === 'CANCELLED' || rule.status === 'PAUSED'
      ? []
      : listUpcomingOccurrences(scheduleConfig, {
          count,
          fromDate,
        });

  return {
    ruleId: rule.id,
    timezone: rule.timezone,
    nextRunAt: rule.nextRunAt,
    occurrences,
  };
}

export async function listRecurringExecutionsByUser(
  userId: string,
  filters: ListRecurringExecutionsFilters = {},
): Promise<RecurringExecutionsListResponse> {
  await ensureUserExists(userId);

  if (filters.ruleId) {
    await getRecurringRuleOrThrow(userId, filters.ruleId);
  }

  const take = filters.take ?? 50;
  let cursorCondition: Prisma.RecurringExecutionWhereInput | undefined;

  if (filters.cursor) {
    const cursorRow = await prisma.recurringExecution.findUnique({
      where: {
        userId_id: {
          userId,
          id: filters.cursor,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    if (cursorRow) {
      cursorCondition = {
        OR: [
          {
            createdAt: {
              lt: cursorRow.createdAt,
            },
          },
          {
            createdAt: cursorRow.createdAt,
            id: {
              lt: cursorRow.id,
            },
          },
        ],
      };
    }
  }

  const where: Prisma.RecurringExecutionWhereInput = {
    userId,
    ruleId: filters.ruleId,
    status: filters.status,
    ...(cursorCondition ?? {}),
  };

  const rows = await prisma.recurringExecution.findMany({
    where,
    include: recurringExecutionInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
  });

  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return {
    items: items.map(toRecurringExecutionResponse),
    nextCursor,
  };
}
