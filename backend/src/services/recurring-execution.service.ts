import {
  Prisma,
  RecurringErrorType,
  type RecurringExecution,
  type RecurringRule,
} from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import {
  listUpcomingOccurrences,
  resolveNextRunAt,
  type RecurringScheduleConfig,
} from '../utils/recurring-schedule.js';
import { createNotification } from './notifications.service.js';
import { createBudgetAlertForTransaction, createTransactionInTx } from './transactions.service.js';

export const DEFAULT_MAX_EXECUTIONS_PER_RULE_PER_CYCLE = 24;
export const DEFAULT_MAX_EXECUTIONS_PER_CYCLE = 200;
export const DEFAULT_RETRY_BACKOFF_MS = 5 * 60 * 1000;

type CycleCounters = {
  rulesVisited: number;
  attempts: number;
  successes: number;
  idempotentReplays: number;
  transientFailures: number;
  structuralFailures: number;
  completedRules: number;
};

export type RecurringMaterializationCycleResult = CycleCounters;

export type RunRecurringMaterializationCycleOptions = {
  now?: Date;
  maxExecutionsPerRulePerCycle?: number;
  maxExecutionsPerCycle?: number;
  retryBackoffMs?: number;
};

type MaterializationOutcome =
  | {
      kind: 'SUCCESS';
      countsAsAttempt: true;
      stopRuleLoop: false;
      transaction: {
        userId: string;
        categoryId: string | null;
        transactionDate: Date;
        transactionType: 'INCOME' | 'EXPENSE';
      };
    }
  | {
      kind: 'IDEMPOTENT_REPLAY';
      countsAsAttempt: true;
      stopRuleLoop: false;
    }
  | {
      kind: 'FAILED_TRANSIENT';
      countsAsAttempt: true;
      stopRuleLoop: true;
    }
  | {
      kind: 'FAILED_STRUCTURAL';
      countsAsAttempt: true;
      stopRuleLoop: true;
    }
  | {
      kind: 'SKIPPED';
      countsAsAttempt: false;
      stopRuleLoop: true;
    };

type ErrorClassification = 'TRANSIENT' | 'STRUCTURAL' | 'IDEMPOTENT_DUPLICATE';

type RecurringFailureNotificationContext = {
  userId: string;
  ruleDescription: string | null;
  errorType: RecurringErrorType;
  reason: string;
  shouldNotify: boolean;
};

function toRecurringScheduleConfig(rule: RecurringRule): RecurringScheduleConfig {
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

function buildPausedReason(prefix: string): string {
  const normalizedPrefix = prefix.trim();
  if (normalizedPrefix.length === 0) {
    return 'Regra pausada automaticamente por falha estrutural.';
  }
  return `Pausada automaticamente: ${normalizedPrefix}`.slice(0, 255);
}

function equalsInstant(left: Date | null, right: Date | null): boolean {
  if (!left || !right) {
    return left === right;
  }
  return left.getTime() === right.getTime();
}

function isRetryWindowOpen(rule: RecurringRule, now: Date, retryBackoffMs: number): boolean {
  if (!rule.lastFailureAt) {
    return true;
  }

  return now.getTime() - rule.lastFailureAt.getTime() >= retryBackoffMs;
}

function resolveNextRunAfterMaterializedOccurrence(params: {
  rule: RecurringRule;
  nextOccurrencesGenerated: number;
  materializedScheduledFor: Date;
}): Date | null {
  const scheduleConfig: RecurringScheduleConfig = {
    ...toRecurringScheduleConfig(params.rule),
    occurrencesGenerated: params.nextOccurrencesGenerated,
  };

  const nextCandidate = listUpcomingOccurrences(scheduleConfig, {
    count: 1,
    fromDate: new Date(params.materializedScheduledFor.getTime() + 1),
  })[0];

  return nextCandidate ?? null;
}

function normalizeErrorTarget(target: unknown): string {
  if (Array.isArray(target)) {
    return target.join(',');
  }

  if (typeof target === 'string') {
    return target;
  }

  return '';
}

function getPrismaErrorCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }

  if (typeof error === 'object' && error !== null) {
    const value = Reflect.get(error, 'code');
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function getPrismaErrorTarget(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return normalizeErrorTarget(error.meta?.target);
  }

  if (typeof error === 'object' && error !== null) {
    const meta = Reflect.get(error, 'meta');
    if (typeof meta === 'object' && meta !== null) {
      return normalizeErrorTarget(Reflect.get(meta, 'target'));
    }
  }

  return '';
}

function classifyMaterializationError(error: unknown): ErrorClassification {
  const code = getPrismaErrorCode(error);
  const target = getPrismaErrorTarget(error);

  if (code === 'P2002') {
    if (
      target.includes('recurring_executions_rule_id_scheduled_for_key') ||
      target.includes('transactions_user_id_recurring_execution_id_key')
    ) {
      return 'IDEMPOTENT_DUPLICATE';
    }
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return 'STRUCTURAL';
    }

    return 'TRANSIENT';
  }

  if (code === 'P2003' || code === 'P2025') {
    return 'STRUCTURAL';
  }

  return 'TRANSIENT';
}

function buildExecutionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 500);
  }

  return 'Falha durante materialização recorrente.';
}

function buildRecurringNotificationMessage(context: RecurringFailureNotificationContext): string {
  const label = context.ruleDescription?.trim() || 'A recurring rule';
  const reason = context.reason.trim().length > 0 ? context.reason.trim() : 'Unknown reason';

  if (context.errorType === 'STRUCTURAL') {
    return `${label} was auto-paused due to a structural failure: ${reason}`;
  }

  return `${label} failed to execute and will be retried automatically: ${reason}`;
}

async function createRecurringFailureNotification(
  context: RecurringFailureNotificationContext,
): Promise<void> {
  await createNotification({
    userId: context.userId,
    title: context.errorType === 'STRUCTURAL' ? 'Recurring Rule Paused' : 'Recurring Rule Failed',
    message: buildRecurringNotificationMessage(context),
    type: 'RECURRING',
    targetPath: '/recurring-rules',
  });
}

async function sendRecurringFailureNotificationBestEffort(
  context: RecurringFailureNotificationContext,
): Promise<void> {
  if (!context.shouldNotify) {
    return;
  }

  try {
    await createRecurringFailureNotification(context);
  } catch (notificationError) {
    console.error('[recurring-worker] recurring failure notification side-effect failed', notificationError);
  }
}

async function listRulesReadyForCycle(
  now: Date,
  retryBackoffMs: number,
): Promise<Array<{ id: string }>> {
  const retryThreshold = new Date(now.getTime() - retryBackoffMs);
  const retryGateWhere: Prisma.RecurringRuleWhereInput = {
    OR: [
      { lastFailureAt: null },
      {
        lastFailureAt: {
          lte: retryThreshold,
        },
      },
    ],
  };

  const dueRules = await prisma.recurringRule.findMany({
    where: {
      status: 'ACTIVE',
      nextRunAt: {
        lte: now,
      },
      ...retryGateWhere,
    },
    select: { id: true },
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }],
    take: DEFAULT_MAX_EXECUTIONS_PER_CYCLE,
  });

  const rehydrateRules = await prisma.recurringRule.findMany({
    where: {
      status: 'ACTIVE',
      nextRunAt: null,
      ...retryGateWhere,
    },
    select: { id: true },
    orderBy: [{ createdAt: 'asc' }],
    take: DEFAULT_MAX_EXECUTIONS_PER_CYCLE,
  });

  const seen = new Set<string>();
  const ordered: Array<{ id: string }> = [];

  for (const row of [...dueRules, ...rehydrateRules]) {
    if (seen.has(row.id)) {
      continue;
    }

    seen.add(row.id);
    ordered.push(row);
  }

  return ordered;
}

async function rehydrateRuleIfNeeded(rule: RecurringRule, now: Date): Promise<RecurringRule> {
  if (rule.nextRunAt) {
    return rule;
  }

  const previousNextRunAt = rule.nextRunAt;
  const nextRunAt = resolveNextRunAt(toRecurringScheduleConfig(rule), now);

  if (!nextRunAt) {
    console.warn(
      `[recurring-worker] rehydrated active rule with null nextRunAt ruleId=${rule.id} previousNextRunAt=${String(previousNextRunAt)} nextRunAt=null`,
    );

    await prisma.recurringRule.update({
      where: { id: rule.id },
      data: {
        status: 'COMPLETED',
        nextRunAt: null,
      },
    });

    return {
      ...rule,
      status: 'COMPLETED',
      nextRunAt: null,
    };
  }

  console.warn(
    `[recurring-worker] rehydrated active rule with null nextRunAt ruleId=${rule.id} previousNextRunAt=${String(previousNextRunAt)} nextRunAt=${nextRunAt.toISOString()}`,
  );

  const updated = await prisma.recurringRule.update({
    where: { id: rule.id },
    data: {
      nextRunAt,
    },
  });

  return updated;
}

async function upsertFailedAttemptState(params: {
  ruleId: string;
  scheduledFor: Date;
  now: Date;
  errorType: RecurringErrorType;
  reason: string;
}): Promise<RecurringFailureNotificationContext | null> {
  return prisma.$transaction(async (tx) => {
    const currentRule = await tx.recurringRule.findUnique({
      where: { id: params.ruleId },
    });

    if (!currentRule || currentRule.status !== 'ACTIVE') {
      return null;
    }

    const executionKey = {
      ruleId_scheduledFor: {
        ruleId: params.ruleId,
        scheduledFor: params.scheduledFor,
      },
    } satisfies Prisma.RecurringExecutionWhereUniqueInput;

    const existingExecution = await tx.recurringExecution.findUnique({
      where: executionKey,
    });

    if (existingExecution) {
      await tx.recurringExecution.update({
        where: { id: existingExecution.id },
        data: {
          status: 'FAILED',
          attemptCount: existingExecution.attemptCount + 1,
          attemptedAt: params.now,
          errorType: params.errorType,
          errorMessage: params.reason,
        },
      });
    } else {
      await tx.recurringExecution.create({
        data: {
          userId: currentRule.userId,
          ruleId: currentRule.id,
          scheduledFor: params.scheduledFor,
          status: 'FAILED',
          attemptCount: 1,
          attemptedAt: params.now,
          errorType: params.errorType,
          errorMessage: params.reason,
        },
      });
    }

    if (params.errorType === 'STRUCTURAL') {
      await tx.recurringRule.update({
        where: { id: currentRule.id },
        data: {
          status: 'PAUSED',
          pausedReason: buildPausedReason(params.reason),
          nextRunAt: null,
          lastFailureAt: params.now,
          failureCount: currentRule.failureCount + 1,
        },
      });

      return {
        userId: currentRule.userId,
        ruleDescription: currentRule.description,
        errorType: params.errorType,
        reason: params.reason,
        shouldNotify: true,
      };
    }

    await tx.recurringRule.update({
      where: { id: currentRule.id },
      data: {
        status: 'ACTIVE',
        nextRunAt: currentRule.nextRunAt ?? params.scheduledFor,
        lastFailureAt: params.now,
        failureCount: currentRule.failureCount + 1,
      },
    });

    return {
      userId: currentRule.userId,
      ruleDescription: currentRule.description,
      errorType: params.errorType,
      reason: params.reason,
      shouldNotify: currentRule.failureCount === 0,
    };
  });
}

async function reconcileIdempotentReplay(params: {
  ruleId: string;
  scheduledFor: Date;
  now: Date;
}): Promise<MaterializationOutcome> {
  const rule = await prisma.recurringRule.findUnique({
    where: { id: params.ruleId },
  });

  if (!rule || rule.status !== 'ACTIVE' || !rule.nextRunAt) {
    return {
      kind: 'SKIPPED',
      countsAsAttempt: false,
      stopRuleLoop: true,
    };
  }

  if (!equalsInstant(rule.nextRunAt, params.scheduledFor)) {
    return {
      kind: 'SKIPPED',
      countsAsAttempt: false,
      stopRuleLoop: true,
    };
  }

  const execution = await prisma.recurringExecution.findUnique({
    where: {
      ruleId_scheduledFor: {
        ruleId: params.ruleId,
        scheduledFor: params.scheduledFor,
      },
    },
  });

  if (!execution) {
    return {
      kind: 'FAILED_TRANSIENT',
      countsAsAttempt: true,
      stopRuleLoop: true,
    };
  }

  const existingTransaction = await prisma.transaction.findUnique({
    where: {
      userId_recurringExecutionId: {
        userId: rule.userId,
        recurringExecutionId: execution.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existingTransaction) {
    return {
      kind: 'FAILED_TRANSIENT',
      countsAsAttempt: true,
      stopRuleLoop: true,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.recurringExecution.update({
      where: { id: execution.id },
      data: {
        status: 'SUCCESS',
        errorType: null,
        errorMessage: null,
        attemptedAt: params.now,
      },
    });

    const nextOccurrencesGenerated = rule.occurrencesGenerated + 1;
    const nextRunAt = resolveNextRunAfterMaterializedOccurrence({
      rule,
      nextOccurrencesGenerated,
      materializedScheduledFor: params.scheduledFor,
    });

    await tx.recurringRule.update({
      where: { id: rule.id },
      data: {
        occurrencesGenerated: nextOccurrencesGenerated,
        lastSuccessfulRunAt: params.now,
        lastFailureAt: null,
        failureCount: 0,
        status: nextRunAt ? 'ACTIVE' : 'COMPLETED',
        pausedReason: null,
        nextRunAt,
      },
    });
  });

  return {
    kind: 'IDEMPOTENT_REPLAY',
    countsAsAttempt: true,
    stopRuleLoop: false,
  };
}

async function materializeSingleOccurrence(params: {
  ruleId: string;
  scheduledFor: Date;
  now: Date;
}): Promise<MaterializationOutcome> {
  try {
    let pendingFailureNotification: RecurringFailureNotificationContext | null = null;

    const outcome = await prisma.$transaction(async (tx): Promise<MaterializationOutcome> => {
      const rule = await tx.recurringRule.findUnique({
        where: { id: params.ruleId },
      });

      if (!rule || rule.status !== 'ACTIVE' || !rule.nextRunAt) {
        return {
          kind: 'SKIPPED',
          countsAsAttempt: false,
          stopRuleLoop: true,
        };
      }

      if (!equalsInstant(rule.nextRunAt, params.scheduledFor)) {
        return {
          kind: 'SKIPPED',
          countsAsAttempt: false,
          stopRuleLoop: true,
        };
      }

      if (rule.nextRunAt.getTime() > params.now.getTime()) {
        return {
          kind: 'SKIPPED',
          countsAsAttempt: false,
          stopRuleLoop: true,
        };
      }

      const executionKey = {
        ruleId_scheduledFor: {
          ruleId: rule.id,
          scheduledFor: params.scheduledFor,
        },
      } satisfies Prisma.RecurringExecutionWhereUniqueInput;

      const existingExecution = await tx.recurringExecution.findUnique({
        where: executionKey,
      });

      if (existingExecution?.status === 'SUCCESS') {
        const linkedTransaction = await tx.transaction.findUnique({
          where: {
            userId_recurringExecutionId: {
              userId: rule.userId,
              recurringExecutionId: existingExecution.id,
            },
          },
          select: { id: true },
        });

        if (!linkedTransaction) {
          console.error(
            `[recurring-worker] inconsistent SUCCESS execution without linked transaction ruleId=${rule.id} executionId=${existingExecution.id} scheduledFor=${params.scheduledFor.toISOString()}`,
          );

          await tx.recurringRule.update({
            where: { id: rule.id },
            data: {
              status: 'ACTIVE',
              nextRunAt: rule.nextRunAt ?? params.scheduledFor,
              lastFailureAt: params.now,
              failureCount: rule.failureCount + 1,
            },
          });

          return {
            kind: 'FAILED_TRANSIENT',
            countsAsAttempt: true,
            stopRuleLoop: true,
          };
        }

        const nextOccurrencesGenerated = rule.occurrencesGenerated + 1;
        const nextRunAt = resolveNextRunAfterMaterializedOccurrence({
          rule,
          nextOccurrencesGenerated,
          materializedScheduledFor: params.scheduledFor,
        });

        await tx.recurringRule.update({
          where: { id: rule.id },
          data: {
            occurrencesGenerated: nextOccurrencesGenerated,
            lastSuccessfulRunAt: params.now,
            lastFailureAt: null,
            failureCount: 0,
            status: nextRunAt ? 'ACTIVE' : 'COMPLETED',
            pausedReason: null,
            nextRunAt,
          },
        });

        return {
          kind: 'IDEMPOTENT_REPLAY',
          countsAsAttempt: true,
          stopRuleLoop: false,
        };
      }

      let execution: RecurringExecution;
      if (existingExecution) {
        execution = await tx.recurringExecution.update({
          where: { id: existingExecution.id },
          data: {
            status: 'SKIPPED',
            attemptCount: existingExecution.attemptCount + 1,
            attemptedAt: params.now,
            errorType: null,
            errorMessage: null,
          },
        });
      } else {
        execution = await tx.recurringExecution.create({
          data: {
            userId: rule.userId,
            ruleId: rule.id,
            scheduledFor: params.scheduledFor,
            status: 'SKIPPED',
            attemptCount: 1,
            attemptedAt: params.now,
          },
        });
      }

      if (rule.type === 'EXPENSE' && !rule.categoryId) {
        const reason = 'Regra de despesa sem categoria válida.';

        await tx.recurringExecution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            errorType: 'STRUCTURAL',
            errorMessage: reason,
            attemptedAt: params.now,
          },
        });

        await tx.recurringRule.update({
          where: { id: rule.id },
          data: {
            status: 'PAUSED',
            pausedReason: buildPausedReason(reason),
            nextRunAt: null,
            lastFailureAt: params.now,
            failureCount: rule.failureCount + 1,
          },
        });

        pendingFailureNotification = {
          userId: rule.userId,
          ruleDescription: rule.description,
          errorType: RecurringErrorType.STRUCTURAL,
          reason,
          shouldNotify: true,
        };

        return {
          kind: 'FAILED_STRUCTURAL',
          countsAsAttempt: true,
          stopRuleLoop: true,
        };
      }

      const wallet = await tx.wallet.findUnique({
        where: {
          userId_id: {
            userId: rule.userId,
            id: rule.walletId,
          },
        },
        select: { id: true },
      });

      if (!wallet) {
        const reason = 'Wallet inválida para regra recorrente.';

        await tx.recurringExecution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            errorType: 'STRUCTURAL',
            errorMessage: reason,
            attemptedAt: params.now,
          },
        });

        await tx.recurringRule.update({
          where: { id: rule.id },
          data: {
            status: 'PAUSED',
            pausedReason: buildPausedReason(reason),
            nextRunAt: null,
            lastFailureAt: params.now,
            failureCount: rule.failureCount + 1,
          },
        });

        pendingFailureNotification = {
          userId: rule.userId,
          ruleDescription: rule.description,
          errorType: RecurringErrorType.STRUCTURAL,
          reason,
          shouldNotify: true,
        };

        return {
          kind: 'FAILED_STRUCTURAL',
          countsAsAttempt: true,
          stopRuleLoop: true,
        };
      }

      if (rule.type === 'EXPENSE' && rule.categoryId) {
        const category = await tx.expenseCategory.findUnique({
          where: {
            userId_id: {
              userId: rule.userId,
              id: rule.categoryId,
            },
          },
          select: { id: true },
        });

        if (!category) {
          const reason = 'Categoria inválida para regra recorrente.';

          await tx.recurringExecution.update({
            where: { id: execution.id },
            data: {
              status: 'FAILED',
              errorType: 'STRUCTURAL',
              errorMessage: reason,
              attemptedAt: params.now,
            },
          });

          await tx.recurringRule.update({
            where: { id: rule.id },
            data: {
              status: 'PAUSED',
              pausedReason: buildPausedReason(reason),
              nextRunAt: null,
              lastFailureAt: params.now,
              failureCount: rule.failureCount + 1,
            },
          });

          pendingFailureNotification = {
            userId: rule.userId,
            ruleDescription: rule.description,
            errorType: RecurringErrorType.STRUCTURAL,
            reason,
            shouldNotify: true,
          };

          return {
            kind: 'FAILED_STRUCTURAL',
            countsAsAttempt: true,
            stopRuleLoop: true,
          };
        }
      }

      const existingTransaction = await tx.transaction.findUnique({
        where: {
          userId_recurringExecutionId: {
            userId: rule.userId,
            recurringExecutionId: execution.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (!existingTransaction) {
        await createTransactionInTx(tx, {
          userId: rule.userId,
          type: rule.type,
          amount: Number.parseFloat(rule.amount.toString()),
          description: rule.description,
          transactionDate: params.scheduledFor,
          categoryId: rule.categoryId,
          walletId: rule.walletId,
          recurringRuleId: rule.id,
          recurringExecutionId: execution.id,
        });
      }

      await tx.recurringExecution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS',
          errorType: null,
          errorMessage: null,
          attemptedAt: params.now,
        },
      });

      const nextOccurrencesGenerated = rule.occurrencesGenerated + 1;
      const nextRunAt = resolveNextRunAfterMaterializedOccurrence({
        rule,
        nextOccurrencesGenerated,
        materializedScheduledFor: params.scheduledFor,
      });

      await tx.recurringRule.update({
        where: { id: rule.id },
        data: {
          occurrencesGenerated: nextOccurrencesGenerated,
          lastSuccessfulRunAt: params.now,
          lastFailureAt: null,
          failureCount: 0,
          status: nextRunAt ? 'ACTIVE' : 'COMPLETED',
          pausedReason: null,
          nextRunAt,
        },
      });

      if (existingTransaction) {
        return {
          kind: 'IDEMPOTENT_REPLAY',
          countsAsAttempt: true,
          stopRuleLoop: false,
        };
      }

      return {
        kind: 'SUCCESS',
        countsAsAttempt: true,
        stopRuleLoop: false,
        transaction: {
          userId: rule.userId,
          categoryId: rule.categoryId,
          transactionDate: params.scheduledFor,
          transactionType: rule.type,
        },
      };
    });

    if (pendingFailureNotification) {
      await sendRecurringFailureNotificationBestEffort(pendingFailureNotification);
    }

    return outcome;
  } catch (error) {
    const classification = classifyMaterializationError(error);

    if (classification === 'IDEMPOTENT_DUPLICATE') {
      return reconcileIdempotentReplay(params);
    }

    const errorType = classification === 'STRUCTURAL' ? RecurringErrorType.STRUCTURAL : RecurringErrorType.TRANSIENT;
    const reason = buildExecutionErrorMessage(error);

    const failureContext = await upsertFailedAttemptState({
      ruleId: params.ruleId,
      scheduledFor: params.scheduledFor,
      now: params.now,
      errorType,
      reason,
    });

    if (failureContext) {
      await sendRecurringFailureNotificationBestEffort(failureContext);
    }

    return classification === 'STRUCTURAL'
      ? {
          kind: 'FAILED_STRUCTURAL',
          countsAsAttempt: true,
          stopRuleLoop: true,
        }
      : {
          kind: 'FAILED_TRANSIENT',
          countsAsAttempt: true,
          stopRuleLoop: true,
        };
  }
}

async function processRule(params: {
  ruleId: string;
  now: Date;
  maxExecutionsForRule: number;
  retryBackoffMs: number;
}): Promise<CycleCounters> {
  const counters: CycleCounters = {
    rulesVisited: 1,
    attempts: 0,
    successes: 0,
    idempotentReplays: 0,
    transientFailures: 0,
    structuralFailures: 0,
    completedRules: 0,
  };

  let consumedForRule = 0;

  while (consumedForRule < params.maxExecutionsForRule) {
    const currentRule = await prisma.recurringRule.findUnique({
      where: { id: params.ruleId },
    });

    if (!currentRule || currentRule.status !== 'ACTIVE') {
      break;
    }

    if (!isRetryWindowOpen(currentRule, params.now, params.retryBackoffMs)) {
      break;
    }

    const coherentRule = await rehydrateRuleIfNeeded(currentRule, params.now);

    if (coherentRule.status === 'COMPLETED') {
      counters.completedRules += 1;
      break;
    }

    if (!coherentRule.nextRunAt || coherentRule.nextRunAt.getTime() > params.now.getTime()) {
      break;
    }

    const outcome = await materializeSingleOccurrence({
      ruleId: coherentRule.id,
      scheduledFor: coherentRule.nextRunAt,
      now: params.now,
    });

    if (outcome.countsAsAttempt) {
      counters.attempts += 1;
      consumedForRule += 1;
    }

    if (outcome.kind === 'SUCCESS') {
      counters.successes += 1;

      try {
        await createBudgetAlertForTransaction({
          userId: outcome.transaction.userId,
          categoryId: outcome.transaction.categoryId,
          transactionDate: outcome.transaction.transactionDate,
          transactionType: outcome.transaction.transactionType,
        });
      } catch (budgetAlertError) {
        console.error('[recurring-worker] budget alert side-effect failed', budgetAlertError);
      }
    } else if (outcome.kind === 'IDEMPOTENT_REPLAY') {
      counters.idempotentReplays += 1;
    } else if (outcome.kind === 'FAILED_STRUCTURAL') {
      counters.structuralFailures += 1;
    } else if (outcome.kind === 'FAILED_TRANSIENT') {
      counters.transientFailures += 1;
    }

    if (outcome.stopRuleLoop) {
      break;
    }
  }

  return counters;
}

export async function runRecurringMaterializationCycle(
  options: RunRecurringMaterializationCycleOptions = {},
): Promise<RecurringMaterializationCycleResult> {
  const now = options.now ?? new Date();
  const maxExecutionsPerRule =
    options.maxExecutionsPerRulePerCycle ?? DEFAULT_MAX_EXECUTIONS_PER_RULE_PER_CYCLE;
  const maxExecutionsPerCycle = options.maxExecutionsPerCycle ?? DEFAULT_MAX_EXECUTIONS_PER_CYCLE;
  const retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;

  const counters: CycleCounters = {
    rulesVisited: 0,
    attempts: 0,
    successes: 0,
    idempotentReplays: 0,
    transientFailures: 0,
    structuralFailures: 0,
    completedRules: 0,
  };

  const rules = await listRulesReadyForCycle(now, retryBackoffMs);

  for (const rule of rules) {
    if (counters.attempts >= maxExecutionsPerCycle) {
      break;
    }

    const remainingExecutions = maxExecutionsPerCycle - counters.attempts;

    const perRuleCounters = await processRule({
      ruleId: rule.id,
      now,
      maxExecutionsForRule: Math.min(maxExecutionsPerRule, remainingExecutions),
      retryBackoffMs,
    });

    counters.rulesVisited += perRuleCounters.rulesVisited;
    counters.attempts += perRuleCounters.attempts;
    counters.successes += perRuleCounters.successes;
    counters.idempotentReplays += perRuleCounters.idempotentReplays;
    counters.transientFailures += perRuleCounters.transientFailures;
    counters.structuralFailures += perRuleCounters.structuralFailures;
    counters.completedRules += perRuleCounters.completedRules;
  }

  return counters;
}
