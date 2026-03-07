import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
    },
    expenseCategory: {
      findUnique: vi.fn(),
    },
    recurringRule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    recurringExecution: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import {
  cancelRecurringRule,
  listRecurringExecutionsByUser,
  pauseRecurringRule,
  previewRecurringRule,
  resumeRecurringRule,
  updateRecurringRule,
} from '../src/services/recurring-rules.service.js';

function buildRule(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> & {
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
  wallet: {
    id: string;
    name: string;
    color: string | null;
  };
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
} {
  return {
    id: 'rule-1',
    userId: 'user-1',
    walletId: 'wallet-1',
    categoryId: 'category-1',
    type: 'EXPENSE',
    amount: 100,
    description: 'Netflix',
    isSubscription: true,
    timezone: 'UTC',
    frequency: 'MONTHLY',
    startAt: new Date('2025-01-31T10:00:00.000Z'),
    nextRunAt: new Date('2025-02-28T10:00:00.000Z'),
    anchorDayOfMonth: 31,
    anchorWeekday: null,
    anchorMonthOfYear: null,
    anchorMinuteOfDay: 10 * 60,
    isLastDayAnchor: false,
    endMode: 'NONE',
    endAt: null,
    maxOccurrences: null,
    occurrencesGenerated: 0,
    status: 'ACTIVE',
    pausedReason: null,
    cancelledAt: null,
    lastSuccessfulRunAt: null,
    lastFailureAt: null,
    failureCount: 0,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    wallet: {
      id: 'wallet-1',
      name: 'Main',
      color: '#000000',
    },
    category: {
      id: 'category-1',
      name: 'Bills',
      color: '#111111',
      icon: 'wallet',
    },
    ...overrides,
  };
}

describe('recurring-rules service semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));

    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.wallet.findUnique.mockResolvedValue({ id: 'wallet-1' });
    prismaMock.expenseCategory.findUnique.mockResolvedValue({ id: 'category-1' });

    prismaMock.recurringRule.update.mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as { userId_id: { id: string; userId: string } };
      const data = args.data as Record<string, unknown>;
      const existing = buildRule({
        id: where.userId_id.id,
        userId: where.userId_id.userId,
      });

      return {
        ...existing,
        ...data,
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('pause clears nextRunAt and keeps logical pause state', async () => {
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      buildRule({
        status: 'ACTIVE',
        nextRunAt: new Date('2026-05-31T10:00:00.000Z'),
      }),
    );

    const result = await pauseRecurringRule('user-1', 'rule-1', 'manual');

    expect(prismaMock.recurringRule.update).toHaveBeenCalled();
    expect(result.status).toBe('PAUSED');
    expect(result.nextRunAt).toBeNull();
  });

  test('resume recalculates from now and does not create backlog', async () => {
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      buildRule({
        status: 'PAUSED',
        nextRunAt: new Date('2025-02-28T10:00:00.000Z'),
        pausedReason: 'manual',
      }),
    );

    const result = await resumeRecurringRule('user-1', 'rule-1');

    expect(result.status).toBe('ACTIVE');
    expect(result.nextRunAt).not.toBeNull();
    expect(result.nextRunAt!.getTime()).toBeGreaterThanOrEqual(Date.now());
  });

  test('resume does not reactivate expired rule under UNTIL_DATE', async () => {
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      buildRule({
        status: 'PAUSED',
        nextRunAt: null,
        pausedReason: 'manual',
        endMode: 'UNTIL_DATE',
        endAt: new Date('2025-02-01T00:00:00.000Z'),
      }),
    );

    const result = await resumeRecurringRule('user-1', 'rule-1');

    expect(result.status).toBe('COMPLETED');
    expect(result.nextRunAt).toBeNull();
  });

  test('preview on paused rule has zero side effects and empty occurrences', async () => {
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      buildRule({
        status: 'PAUSED',
        nextRunAt: null,
      }),
    );

    const result = await previewRecurringRule('user-1', 'rule-1', 12);

    expect(result.occurrences).toEqual([]);
    expect(prismaMock.recurringRule.update).not.toHaveBeenCalled();
  });

  test('update keeps nextRunAt coherent for active rules', async () => {
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      buildRule({
        status: 'ACTIVE',
        nextRunAt: new Date('2026-01-31T10:00:00.000Z'),
      }),
    );

    const result = await updateRecurringRule('user-1', 'rule-1', {
      amount: 111.5,
      description: 'Netflix Updated',
    });

    expect(result.status).toBe('ACTIVE');
    expect(result.nextRunAt).not.toBeNull();
    expect(result.nextRunAt!.getTime()).toBeGreaterThanOrEqual(Date.now());
  });

  test('cancel keeps logical delete and clears nextRunAt', async () => {
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      buildRule({
        status: 'ACTIVE',
        nextRunAt: new Date('2026-06-30T10:00:00.000Z'),
      }),
    );

    const result = await cancelRecurringRule('user-1', 'rule-1');

    expect(result.status).toBe('CANCELLED');
    expect(result.nextRunAt).toBeNull();
  });

  test('multi-tenant safety: cannot update a rule from another user', async () => {
    prismaMock.recurringRule.findUnique.mockResolvedValue(null);

    await expect(
      updateRecurringRule('user-1', 'rule-from-other-user', {
        amount: 50,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('listRecurringExecutionsByUser returns enriched contexts and cursor pagination', async () => {
    prismaMock.recurringExecution.findMany.mockResolvedValue([
      {
        id: 'exec-2',
        userId: 'user-1',
        ruleId: 'rule-1',
        scheduledFor: new Date('2026-05-09T10:00:00.000Z'),
        status: 'SUCCESS',
        attemptCount: 1,
        attemptedAt: new Date('2026-05-09T10:00:01.000Z'),
        errorType: null,
        errorMessage: null,
        createdAt: new Date('2026-05-09T10:00:02.000Z'),
        updatedAt: new Date('2026-05-09T10:00:03.000Z'),
        rule: {
          id: 'rule-1',
          description: 'Netflix',
          type: 'EXPENSE',
          amount: 29.9,
          status: 'ACTIVE',
          pausedReason: null,
          frequency: 'MONTHLY',
          timezone: 'Europe/Lisbon',
          wallet: {
            id: 'wallet-1',
            name: 'Main',
            color: '#000000',
          },
          category: {
            id: 'category-1',
            name: 'Bills',
            color: '#111111',
            icon: null,
          },
        },
        transaction: {
          id: 'tx-1',
          type: 'EXPENSE',
          amount: 29.9,
          transactionDate: new Date('2026-05-09T10:00:00.000Z'),
          wallet: {
            id: 'wallet-1',
            name: 'Main',
            color: '#000000',
          },
          category: {
            id: 'category-1',
            name: 'Bills',
            color: '#111111',
            icon: null,
          },
        },
      },
      {
        id: 'exec-1',
        userId: 'user-1',
        ruleId: 'rule-1',
        scheduledFor: new Date('2026-05-08T10:00:00.000Z'),
        status: 'FAILED',
        attemptCount: 2,
        attemptedAt: new Date('2026-05-08T10:00:01.000Z'),
        errorType: 'TRANSIENT',
        errorMessage: 'Timeout',
        createdAt: new Date('2026-05-08T10:00:02.000Z'),
        updatedAt: new Date('2026-05-08T10:00:03.000Z'),
        rule: {
          id: 'rule-1',
          description: 'Netflix',
          type: 'EXPENSE',
          amount: 29.9,
          status: 'ACTIVE',
          pausedReason: null,
          frequency: 'MONTHLY',
          timezone: 'Europe/Lisbon',
          wallet: {
            id: 'wallet-1',
            name: 'Main',
            color: '#000000',
          },
          category: {
            id: 'category-1',
            name: 'Bills',
            color: '#111111',
            icon: null,
          },
        },
        transaction: null,
      },
    ]);

    const result = await listRecurringExecutionsByUser('user-1', {
      take: 1,
    });

    expect(prismaMock.recurringExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.any(Object),
        take: 2,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].rule?.amount).toBe('29.9');
    expect(result.items[0].transaction?.amount).toBe('29.9');
    expect(result.nextCursor).toBe('exec-2');
  });
});
