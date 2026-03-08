import { beforeEach, describe, expect, test, vi } from 'vitest';

type MutableRule = {
  id: string;
  userId: string;
  walletId: string;
  categoryId: string | null;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string | null;
  isSubscription: boolean;
  timezone: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startAt: Date;
  nextRunAt: Date | null;
  anchorDayOfMonth: number | null;
  anchorWeekday: number | null;
  anchorMonthOfYear: number | null;
  anchorMinuteOfDay: number;
  isLastDayAnchor: boolean;
  endMode: 'NONE' | 'UNTIL_DATE' | 'MAX_OCCURRENCES';
  endAt: Date | null;
  maxOccurrences: number | null;
  occurrencesGenerated: number;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
  pausedReason: string | null;
  cancelledAt: Date | null;
  lastSuccessfulRunAt: Date | null;
  lastFailureAt: Date | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type MutableExecution = {
  id: string;
  userId: string;
  ruleId: string;
  scheduledFor: Date;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  attemptCount: number;
  attemptedAt: Date | null;
  errorType: 'STRUCTURAL' | 'TRANSIENT' | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MutableTransaction = {
  id: string;
  userId: string;
  recurringExecutionId: string | null;
};

type InMemoryState = {
  rules: Map<string, MutableRule>;
  executionsByKey: Map<string, MutableExecution>;
  transactionsByExecutionId: Map<string, MutableTransaction>;
  validWallets: Set<string>;
  validCategories: Set<string>;
  nextExecutionSeq: number;
  nextTransactionSeq: number;
};

const {
  prismaMock,
  createTransactionInTxMock,
  createBudgetAlertForTransactionMock,
  createNotificationMock,
} = vi.hoisted(() => ({
  prismaMock: {
    recurringRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    recurringExecution: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      findUnique: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
    },
    expenseCategory: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createTransactionInTxMock: vi.fn(),
  createBudgetAlertForTransactionMock: vi.fn(),
  createNotificationMock: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/services/transactions.service.js', () => ({
  createTransactionInTx: createTransactionInTxMock,
  createBudgetAlertForTransaction: createBudgetAlertForTransactionMock,
}));

vi.mock('../src/services/notifications.service.js', () => ({
  createNotification: createNotificationMock,
}));

import { runRecurringMaterializationCycle } from '../src/services/recurring-execution.service.js';

function toExecutionKey(ruleId: string, scheduledFor: Date): string {
  return `${ruleId}::${scheduledFor.toISOString()}`;
}

function buildRule(overrides: Partial<MutableRule> = {}): MutableRule {
  return {
    id: 'rule-1',
    userId: 'user-1',
    walletId: 'wallet-1',
    categoryId: 'category-1',
    type: 'EXPENSE',
    amount: 25,
    description: 'Spotify',
    isSubscription: true,
    timezone: 'UTC',
    frequency: 'DAILY',
    startAt: new Date('2026-01-01T10:00:00.000Z'),
    nextRunAt: new Date('2026-01-03T10:00:00.000Z'),
    anchorDayOfMonth: null,
    anchorWeekday: null,
    anchorMonthOfYear: null,
    anchorMinuteOfDay: 10 * 60,
    isLastDayAnchor: false,
    endMode: 'NONE',
    endAt: null,
    maxOccurrences: null,
    occurrencesGenerated: 2,
    status: 'ACTIVE',
    pausedReason: null,
    cancelledAt: null,
    lastSuccessfulRunAt: null,
    lastFailureAt: null,
    failureCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function setupInMemoryPrisma(state: InMemoryState): void {
  prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(prismaMock),
  );

  prismaMock.recurringRule.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    const where = args.where;
    const status = where.status as MutableRule['status'] | undefined;
    const nextRunAtFilter = where.nextRunAt as { lte?: Date } | null | undefined;
    const retryGate = where.OR as Array<Record<string, unknown>> | undefined;

    const rows = [...state.rules.values()].filter((rule) => {
      if (status && rule.status !== status) {
        return false;
      }

      if (nextRunAtFilter === null && rule.nextRunAt !== null) {
        return false;
      }

      if (nextRunAtFilter && nextRunAtFilter !== null && 'lte' in nextRunAtFilter) {
        if (!rule.nextRunAt) {
          return false;
        }

        if (rule.nextRunAt.getTime() > (nextRunAtFilter.lte as Date).getTime()) {
          return false;
        }
      }

      if (retryGate && retryGate.length > 0) {
        const passRetryGate = retryGate.some((clause) => {
          if (Reflect.get(clause, 'lastFailureAt') === null) {
            return rule.lastFailureAt === null;
          }

          const failurePredicate = Reflect.get(clause, 'lastFailureAt') as { lte?: Date } | undefined;
          if (failurePredicate?.lte) {
            return rule.lastFailureAt !== null && rule.lastFailureAt.getTime() <= failurePredicate.lte.getTime();
          }

          return false;
        });

        if (!passRetryGate) {
          return false;
        }
      }

      return true;
    });

    return rows.map((rule) => ({ id: rule.id }));
  });

  prismaMock.recurringRule.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
    const rule = state.rules.get(args.where.id);
    return rule ? { ...rule } : null;
  });

  prismaMock.recurringRule.update.mockImplementation(
    async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const current = state.rules.get(args.where.id);
      if (!current) {
        throw new Error('rule not found');
      }

      const updated: MutableRule = {
        ...current,
        ...args.data,
        updatedAt: new Date(),
      };

      state.rules.set(updated.id, updated);
      return { ...updated };
    },
  );

  prismaMock.recurringExecution.findUnique.mockImplementation(
    async (args: { where: { ruleId_scheduledFor: { ruleId: string; scheduledFor: Date } } }) => {
      const where = args.where.ruleId_scheduledFor;
      const execution = state.executionsByKey.get(toExecutionKey(where.ruleId, where.scheduledFor));
      return execution ? { ...execution } : null;
    },
  );

  prismaMock.recurringExecution.create.mockImplementation(
    async (args: { data: Omit<MutableExecution, 'id' | 'createdAt' | 'updatedAt'> }) => {
      const execution: MutableExecution = {
        id: `exec-${state.nextExecutionSeq}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      state.nextExecutionSeq += 1;
      state.executionsByKey.set(toExecutionKey(execution.ruleId, execution.scheduledFor), execution);
      return { ...execution };
    },
  );

  prismaMock.recurringExecution.update.mockImplementation(
    async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const existing = [...state.executionsByKey.values()].find((row) => row.id === args.where.id);
      if (!existing) {
        throw new Error('execution not found');
      }

      const updated: MutableExecution = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };

      state.executionsByKey.set(toExecutionKey(updated.ruleId, updated.scheduledFor), updated);
      return { ...updated };
    },
  );

  prismaMock.transaction.findUnique.mockImplementation(
    async (args: { where: { userId_recurringExecutionId: { userId: string; recurringExecutionId: string } } }) => {
      const recurringExecutionId = args.where.userId_recurringExecutionId.recurringExecutionId;
      const transaction = state.transactionsByExecutionId.get(recurringExecutionId);
      if (!transaction) {
        return null;
      }

      if (transaction.userId !== args.where.userId_recurringExecutionId.userId) {
        return null;
      }

      return { ...transaction };
    },
  );

  prismaMock.wallet.findUnique.mockImplementation(
    async (args: { where: { userId_id: { id: string } } }) => {
      const walletId = args.where.userId_id.id;
      return state.validWallets.has(walletId) ? { id: walletId } : null;
    },
  );

  prismaMock.expenseCategory.findUnique.mockImplementation(
    async (args: { where: { userId_id: { id: string } } }) => {
      const categoryId = args.where.userId_id.id;
      return state.validCategories.has(categoryId) ? { id: categoryId } : null;
    },
  );
}

describe('recurring execution materialization cycle', () => {
  let state: InMemoryState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T12:00:00.000Z'));

    state = {
      rules: new Map<string, MutableRule>(),
      executionsByKey: new Map<string, MutableExecution>(),
      transactionsByExecutionId: new Map<string, MutableTransaction>(),
      validWallets: new Set<string>(['wallet-1', 'wallet-2', 'wallet-3']),
      validCategories: new Set<string>(['category-1', 'category-2', 'category-3']),
      nextExecutionSeq: 1,
      nextTransactionSeq: 1,
    };

    setupInMemoryPrisma(state);

    createTransactionInTxMock.mockImplementation(async (_tx: unknown, input: Record<string, unknown>) => {
      const recurringExecutionId = input.recurringExecutionId as string | null | undefined;
      const userId = input.userId as string;

      if (recurringExecutionId && state.transactionsByExecutionId.has(recurringExecutionId)) {
        throw {
          code: 'P2002',
          meta: { target: 'transactions_user_id_recurring_execution_id_key' },
        };
      }

      if (recurringExecutionId) {
        state.transactionsByExecutionId.set(recurringExecutionId, {
          id: `tx-${state.nextTransactionSeq}`,
          userId,
          recurringExecutionId,
        });
      }

      state.nextTransactionSeq += 1;

      return {
        id: `tx-${state.nextTransactionSeq}`,
        userId,
      };
    });

    createBudgetAlertForTransactionMock.mockResolvedValue(undefined);
    createNotificationMock.mockResolvedValue(undefined);
  });

  test('duplicate attempt for same occurrence is idempotent and creates no duplicate transaction', async () => {
    const scheduledFor = new Date('2026-01-05T10:00:00.000Z');
    const rule = buildRule({
      id: 'rule-a',
      nextRunAt: scheduledFor,
      occurrencesGenerated: 4,
    });
    state.rules.set(rule.id, rule);

    const execution: MutableExecution = {
      id: 'exec-existing',
      userId: rule.userId,
      ruleId: rule.id,
      scheduledFor,
      status: 'SUCCESS',
      attemptCount: 1,
      attemptedAt: new Date('2026-01-05T10:00:05.000Z'),
      errorType: null,
      errorMessage: null,
      createdAt: new Date('2026-01-05T10:00:05.000Z'),
      updatedAt: new Date('2026-01-05T10:00:05.000Z'),
    };
    state.executionsByKey.set(toExecutionKey(rule.id, scheduledFor), execution);
    state.transactionsByExecutionId.set(execution.id, {
      id: 'tx-existing',
      userId: rule.userId,
      recurringExecutionId: execution.id,
    });

    const result = await runRecurringMaterializationCycle();

    expect(createTransactionInTxMock).not.toHaveBeenCalled();
    expect(result.idempotentReplays).toBeGreaterThanOrEqual(1);
    expect(state.transactionsByExecutionId.size).toBe(1);
  });

  test('existing SUCCESS execution without linked transaction is treated as transient inconsistency', async () => {
    const scheduledFor = new Date('2026-01-05T10:00:00.000Z');
    const rule = buildRule({
      id: 'rule-success-missing-tx',
      nextRunAt: scheduledFor,
      occurrencesGenerated: 4,
    });
    state.rules.set(rule.id, rule);

    const execution: MutableExecution = {
      id: 'exec-success-missing-tx',
      userId: rule.userId,
      ruleId: rule.id,
      scheduledFor,
      status: 'SUCCESS',
      attemptCount: 1,
      attemptedAt: new Date('2026-01-05T10:00:05.000Z'),
      errorType: null,
      errorMessage: null,
      createdAt: new Date('2026-01-05T10:00:05.000Z'),
      updatedAt: new Date('2026-01-05T10:00:05.000Z'),
    };

    state.executionsByKey.set(toExecutionKey(rule.id, scheduledFor), execution);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await runRecurringMaterializationCycle({
      maxExecutionsPerRulePerCycle: 1,
      maxExecutionsPerCycle: 1,
    });
    const updatedRule = state.rules.get(rule.id)!;
    const updatedExecution = state.executionsByKey.get(toExecutionKey(rule.id, scheduledFor))!;

    expect(result.transientFailures).toBe(1);
    expect(updatedRule.status).toBe('ACTIVE');
    expect(updatedRule.nextRunAt?.toISOString()).toBe(scheduledFor.toISOString());
    expect(updatedRule.failureCount).toBe(1);
    expect(updatedRule.lastFailureAt).not.toBeNull();
    expect(updatedExecution.status).toBe('SUCCESS');
    expect(createTransactionInTxMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  test('failed materialization does not increment occurrencesGenerated and keeps nextRunAt for transient retry', async () => {
    const scheduledFor = new Date('2026-01-05T09:00:00.000Z');
    const rule = buildRule({
      id: 'rule-b',
      nextRunAt: scheduledFor,
      occurrencesGenerated: 10,
    });
    state.rules.set(rule.id, rule);

    createTransactionInTxMock.mockRejectedValueOnce(new Error('temporary outage'));

    const result = await runRecurringMaterializationCycle();
    const updatedRule = state.rules.get(rule.id)!;
    const execution = state.executionsByKey.get(toExecutionKey(rule.id, scheduledFor))!;

    expect(result.transientFailures).toBe(1);
    expect(updatedRule.occurrencesGenerated).toBe(10);
    expect(updatedRule.status).toBe('ACTIVE');
    expect(updatedRule.nextRunAt?.toISOString()).toBe(scheduledFor.toISOString());
    expect(execution.status).toBe('FAILED');
    expect(execution.errorType).toBe('TRANSIENT');
  });

  test('transient recurring failures notify once per unresolved failure streak', async () => {
    const scheduledFor = new Date('2026-01-05T10:00:00.000Z');
    state.rules.set(
      'rule-transient-dedup',
      buildRule({
        id: 'rule-transient-dedup',
        nextRunAt: scheduledFor,
      }),
    );

    createTransactionInTxMock.mockRejectedValue(new Error('temporary outage'));

    const firstCycle = await runRecurringMaterializationCycle({
      maxExecutionsPerRulePerCycle: 1,
      maxExecutionsPerCycle: 1,
    });

    expect(firstCycle.transientFailures).toBe(1);
    expect(createNotificationMock).toHaveBeenCalledTimes(1);
    expect(createNotificationMock).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      title: 'Recurring Rule Failed',
      message: expect.stringContaining('will be retried automatically'),
      type: 'RECURRING',
      targetPath: '/recurring-rules',
    });

    vi.setSystemTime(new Date('2026-01-05T12:06:00.000Z'));

    const secondCycle = await runRecurringMaterializationCycle({
      maxExecutionsPerRulePerCycle: 1,
      maxExecutionsPerCycle: 1,
      retryBackoffMs: 5 * 60 * 1000,
    });

    expect(secondCycle.transientFailures).toBe(1);
    expect(createNotificationMock).toHaveBeenCalledTimes(1);
  });

  test('paused/cancelled/completed rules are ignored', async () => {
    state.rules.set(
      'rule-active',
      buildRule({
        id: 'rule-active',
        nextRunAt: new Date('2026-01-05T10:00:00.000Z'),
      }),
    );
    state.rules.set(
      'rule-paused',
      buildRule({
        id: 'rule-paused',
        status: 'PAUSED',
        nextRunAt: new Date('2026-01-05T10:00:00.000Z'),
      }),
    );
    state.rules.set(
      'rule-cancelled',
      buildRule({
        id: 'rule-cancelled',
        status: 'CANCELLED',
        nextRunAt: new Date('2026-01-05T10:00:00.000Z'),
      }),
    );
    state.rules.set(
      'rule-completed',
      buildRule({
        id: 'rule-completed',
        status: 'COMPLETED',
        nextRunAt: new Date('2026-01-05T10:00:00.000Z'),
      }),
    );

    await runRecurringMaterializationCycle();

    expect(createTransactionInTxMock).toHaveBeenCalledTimes(1);
  });

  test('expired active rule is completed during rehydration when no next occurrence exists', async () => {
    const rule = buildRule({
      id: 'rule-expired',
      nextRunAt: null,
      frequency: 'MONTHLY',
      startAt: new Date('2025-01-01T10:00:00.000Z'),
      anchorDayOfMonth: 1,
      endMode: 'UNTIL_DATE',
      endAt: new Date('2025-02-01T10:00:00.000Z'),
      occurrencesGenerated: 2,
    });
    state.rules.set(rule.id, rule);

    const result = await runRecurringMaterializationCycle();

    expect(result.completedRules).toBe(1);
    expect(state.rules.get(rule.id)?.status).toBe('COMPLETED');
    expect(state.rules.get(rule.id)?.nextRunAt).toBeNull();
  });

  test('FAILED + TRANSIENT stops processing that rule in the current cycle', async () => {
    const rule = buildRule({
      id: 'rule-transient-stop',
      nextRunAt: new Date('2026-01-03T10:00:00.000Z'),
      occurrencesGenerated: 0,
    });
    state.rules.set(rule.id, rule);

    createTransactionInTxMock.mockRejectedValueOnce(new Error('db timeout'));

    const result = await runRecurringMaterializationCycle({
      maxExecutionsPerRulePerCycle: 5,
    });

    expect(result.attempts).toBe(1);
    expect(createTransactionInTxMock).toHaveBeenCalledTimes(1);
  });

  test('STRUCTURAL failure auto-pauses rule and clears nextRunAt', async () => {
    const scheduledFor = new Date('2026-01-05T08:00:00.000Z');
    state.rules.set(
      'rule-structural',
      buildRule({
        id: 'rule-structural',
        walletId: 'wallet-missing',
        nextRunAt: scheduledFor,
      }),
    );

    const result = await runRecurringMaterializationCycle();
    const updatedRule = state.rules.get('rule-structural')!;
    const execution = state.executionsByKey.get(toExecutionKey('rule-structural', scheduledFor))!;

    expect(result.structuralFailures).toBe(1);
    expect(updatedRule.status).toBe('PAUSED');
    expect(updatedRule.nextRunAt).toBeNull();
    expect(execution.status).toBe('FAILED');
    expect(execution.errorType).toBe('STRUCTURAL');
    expect(createTransactionInTxMock).not.toHaveBeenCalled();
    expect(createNotificationMock).toHaveBeenCalledWith({
      userId: 'user-1',
      title: 'Recurring Rule Paused',
      message: expect.stringContaining('auto-paused'),
      type: 'RECURRING',
      targetPath: '/recurring-rules',
    });
  });

  test('retry gate blocks immediate retry and allows retry after backoff', async () => {
    const scheduledFor = new Date('2026-01-05T09:00:00.000Z');
    state.rules.set(
      'rule-retry-gate',
      buildRule({
        id: 'rule-retry-gate',
        nextRunAt: scheduledFor,
        lastFailureAt: new Date('2026-01-05T11:58:00.000Z'),
      }),
    );

    const firstCycle = await runRecurringMaterializationCycle({
      retryBackoffMs: 5 * 60 * 1000,
    });
    expect(firstCycle.attempts).toBe(0);

    vi.setSystemTime(new Date('2026-01-05T12:06:00.000Z'));
    const secondCycle = await runRecurringMaterializationCycle({
      retryBackoffMs: 5 * 60 * 1000,
      maxExecutionsPerRulePerCycle: 1,
      maxExecutionsPerCycle: 1,
    });

    expect(secondCycle.attempts).toBe(1);
  });

  test('per-rule and global caps are enforced', async () => {
    state.rules.set(
      'rule-cap-a',
      buildRule({
        id: 'rule-cap-a',
        nextRunAt: new Date('2026-01-01T10:00:00.000Z'),
        occurrencesGenerated: 0,
      }),
    );
    state.rules.set(
      'rule-cap-b',
      buildRule({
        id: 'rule-cap-b',
        nextRunAt: new Date('2026-01-01T10:00:00.000Z'),
        walletId: 'wallet-2',
        categoryId: 'category-2',
        occurrencesGenerated: 0,
      }),
    );

    const result = await runRecurringMaterializationCycle({
      maxExecutionsPerRulePerCycle: 3,
      maxExecutionsPerCycle: 4,
    });

    expect(result.attempts).toBe(4);
  });

  test('isolated failure in one rule does not break processing of other rules', async () => {
    state.rules.set(
      'rule-fail',
      buildRule({
        id: 'rule-fail',
        nextRunAt: new Date('2026-01-05T08:00:00.000Z'),
      }),
    );
    state.rules.set(
      'rule-ok',
      buildRule({
        id: 'rule-ok',
        nextRunAt: new Date('2026-01-05T08:30:00.000Z'),
        walletId: 'wallet-2',
        categoryId: 'category-2',
      }),
    );

    createTransactionInTxMock.mockRejectedValueOnce(new Error('temporary db issue'));

    const result = await runRecurringMaterializationCycle();

    expect(result.transientFailures).toBe(1);
    expect(result.successes).toBeGreaterThanOrEqual(1);
  });

  test('created transaction uses rule user and recurring links', async () => {
    state.rules.set(
      'rule-links',
      buildRule({
        id: 'rule-links',
        userId: 'user-links',
        walletId: 'wallet-3',
        categoryId: 'category-3',
        nextRunAt: new Date('2026-01-05T07:00:00.000Z'),
      }),
    );

    await runRecurringMaterializationCycle({
      maxExecutionsPerRulePerCycle: 1,
      maxExecutionsPerCycle: 1,
    });

    const call = createTransactionInTxMock.mock.calls[0];
    const input = call[1] as Record<string, unknown>;
    const updatedRule = state.rules.get('rule-links')!;

    expect(input.userId).toBe('user-links');
    expect(input.recurringRuleId).toBe('rule-links');
    expect(typeof input.recurringExecutionId).toBe('string');
    expect(updatedRule.nextRunAt).not.toBeNull();
    expect(updatedRule.nextRunAt!.getTime()).toBeGreaterThan(
      new Date('2026-01-05T07:00:00.000Z').getTime(),
    );
  });
});
