import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
  listTransactionsByUserMock,
  listBudgetsWithMonthlySpendingMock,
  prismaMock,
} = vi.hoisted(() => ({
  listTransactionsByUserMock: vi.fn(),
  listBudgetsWithMonthlySpendingMock: vi.fn(),
  prismaMock: {
    transaction: {
      groupBy: vi.fn(),
    },
    recurringRule: {
      count: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/services/transactions.service.js', () => ({
  listTransactionsByUser: listTransactionsByUserMock,
}));

vi.mock('../src/services/budgets.service.js', () => ({
  listBudgetsWithMonthlySpending: listBudgetsWithMonthlySpendingMock,
}));

import { getHomeInsights } from '../src/services/home.service.js';

describe('home insights service', () => {
  beforeEach(() => {
    listTransactionsByUserMock.mockResolvedValue([]);
    listBudgetsWithMonthlySpendingMock.mockResolvedValue({
      currentMonth: {
        month: 3,
        year: 2026,
        start: '2026-03-01T00:00:00.000Z',
        endExclusive: '2026-04-01T00:00:00.000Z',
      },
      budgets: [],
    });
    prismaMock.transaction.groupBy.mockResolvedValue([]);
    prismaMock.recurringRule.count.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('scopes recent transactions to selected month and year period', async () => {
    await getHomeInsights('user-1', {
      month: 2,
      year: 2026,
    });

    expect(listTransactionsByUserMock).toHaveBeenCalledTimes(1);

    const [, filters] = listTransactionsByUserMock.mock.calls[0] as [
      string,
      {
        from: Date;
        toExclusive: Date;
        take: number;
        skip: number;
      },
    ];

    expect(filters.take).toBe(5);
    expect(filters.skip).toBe(0);
    expect(filters.from.getTime()).toBe(new Date(2026, 1, 1, 0, 0, 0, 0).getTime());
    expect(filters.toExclusive.getTime()).toBe(new Date(2026, 2, 1, 0, 0, 0, 0).getTime());
  });

  test('returns monthly summary and budget warning/exceeded counts with explicit thresholds', async () => {
    prismaMock.transaction.groupBy.mockResolvedValueOnce([
      {
        type: 'EXPENSE',
        _sum: {
          amount: 120.55,
        },
        _count: {
          _all: 3,
        },
      },
      {
        type: 'INCOME',
        _sum: {
          amount: 300.1,
        },
        _count: {
          _all: 2,
        },
      },
    ]);

    listBudgetsWithMonthlySpendingMock.mockResolvedValueOnce({
      currentMonth: {
        month: 3,
        year: 2026,
        start: '2026-03-01T00:00:00.000Z',
        endExclusive: '2026-04-01T00:00:00.000Z',
      },
      budgets: [
        {
          id: 'budget-safe',
          categoryId: 'cat-safe',
          category: {
            id: 'cat-safe',
            name: 'Safe',
            color: '#111111',
            icon: null,
          },
          amount: '200.00',
          spentThisMonth: '100.00',
          remaining: '100.00',
          usageRatio: 0.5,
        },
        {
          id: 'budget-warning',
          categoryId: 'cat-warning',
          category: {
            id: 'cat-warning',
            name: 'Warning',
            color: '#222222',
            icon: null,
          },
          amount: '100.00',
          spentThisMonth: '80.00',
          remaining: '20.00',
          usageRatio: 0.8,
        },
        {
          id: 'budget-exceeded',
          categoryId: 'cat-exceeded',
          category: {
            id: 'cat-exceeded',
            name: 'Exceeded',
            color: '#333333',
            icon: null,
          },
          amount: '100.00',
          spentThisMonth: '130.00',
          remaining: '-30.00',
          usageRatio: 1.3,
        },
      ],
    });

    const result = await getHomeInsights('user-1', {
      month: 3,
      year: 2026,
    });

    expect(result.monthlySummary).toEqual({
      incomeThisMonth: '300.10',
      spentThisMonth: '120.55',
      netThisMonth: '179.55',
      transactionCount: 5,
    });

    expect(result.budgetStatus.warningCount).toBe(1);
    expect(result.budgetStatus.criticalCount).toBe(1);
    expect(result.budgetStatus.exceededCount).toBe(1);

    const safe = result.budgetStatus.items.find((item) => item.budgetId === 'budget-safe');
    const warning = result.budgetStatus.items.find((item) => item.budgetId === 'budget-warning');
    const exceeded = result.budgetStatus.items.find((item) => item.budgetId === 'budget-exceeded');

    expect(safe?.alertLevel).toBe('SAFE');
    expect(warning?.alertLevel).toBe('WARNING');
    expect(exceeded?.alertLevel).toBe('CRITICAL');
  });

  test('computes recurring status with fixed 30-day failure window and 7-day due-soon window', async () => {
    vi.useFakeTimers();

    const now = new Date('2026-03-08T12:00:00.000Z');
    vi.setSystemTime(now);

    prismaMock.recurringRule.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);

    const result = await getHomeInsights('user-1', {
      month: 3,
      year: 2026,
    });

    expect(result.recurringStatus).toEqual({
      pausedCount: 2,
      dueSoonCount: 3,
      failedRecentCount: 4,
      needsAttentionCount: 5,
      hasIssues: true,
    });

    expect(prismaMock.recurringRule.count).toHaveBeenCalledTimes(4);

    const dueSoonWhere = prismaMock.recurringRule.count.mock.calls[1][0].where;
    const failedWhere = prismaMock.recurringRule.count.mock.calls[2][0].where;
    const needsAttentionWhere = prismaMock.recurringRule.count.mock.calls[3][0].where;

    expect(dueSoonWhere.nextRunAt.gte.getTime()).toBe(now.getTime());
    expect(dueSoonWhere.nextRunAt.lte.getTime()).toBe(
      new Date('2026-03-15T12:00:00.000Z').getTime(),
    );

    expect(failedWhere.lastFailureAt.gte.getTime()).toBe(
      new Date('2026-02-06T12:00:00.000Z').getTime(),
    );

    expect(needsAttentionWhere.OR).toHaveLength(2);
    expect(needsAttentionWhere.OR[0]).toEqual({ status: 'PAUSED' });
    expect(needsAttentionWhere.OR[1].lastFailureAt.gte.getTime()).toBe(
      new Date('2026-02-06T12:00:00.000Z').getTime(),
    );
  });
});
