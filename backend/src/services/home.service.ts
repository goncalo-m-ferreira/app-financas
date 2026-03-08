import { prisma } from '../lib/prisma.js';
import { resolveMonthYearRange } from '../utils/date-range.js';
import { listBudgetsWithMonthlySpending } from './budgets.service.js';
import { listTransactionsByUser } from './transactions.service.js';

type InsightsPeriodInput = {
  month?: number;
  year?: number;
};

type BudgetAlertLevel = 'SAFE' | 'WARNING' | 'CRITICAL';

type BudgetInsight = {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  limit: string;
  spentThisMonth: string;
  remaining: string;
  usageRatio: number;
  alertLevel: BudgetAlertLevel;
};

type HomeInsightsResponse = {
  period: {
    month: number;
    year: number;
    start: string;
    endExclusive: string;
  };
  recentTransactions: Awaited<ReturnType<typeof listTransactionsByUser>>;
  monthlySummary: {
    incomeThisMonth: string;
    spentThisMonth: string;
    netThisMonth: string;
    transactionCount: number;
  };
  budgetStatus: {
    totalBudgets: number;
    warningCount: number;
    criticalCount: number;
    exceededCount: number;
    hasAlerts: boolean;
    items: BudgetInsight[];
  };
  recurringStatus: {
    pausedCount: number;
    dueSoonCount: number;
    failedRecentCount: number;
    needsAttentionCount: number;
    hasIssues: boolean;
  };
};

function resolveAlertLevel(usageRatio: number): BudgetAlertLevel {
  if (usageRatio >= 1) {
    return 'CRITICAL';
  }

  if (usageRatio >= 0.8) {
    return 'WARNING';
  }

  return 'SAFE';
}

function parseAmount(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getHomeInsights(
  userId: string,
  period: InsightsPeriodInput = {},
): Promise<HomeInsightsResponse> {
  const { month, year, start, endExclusive } = resolveMonthYearRange(period);
  const now = new Date();
  const dueSoonHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const failedRecentWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    recentTransactions,
    budgetsOverview,
    monthlyTransactionsByType,
    pausedCount,
    dueSoonCount,
    failedRecentCount,
    needsAttentionCount,
  ] = await Promise.all([
    listTransactionsByUser(userId, {
      from: start,
      toExclusive: endExclusive,
      take: 5,
      skip: 0,
    }),
    listBudgetsWithMonthlySpending(userId, { month, year }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        transactionDate: {
          gte: start,
          lt: endExclusive,
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.recurringRule.count({
      where: {
        userId,
        status: 'PAUSED',
      },
    }),
    prisma.recurringRule.count({
      where: {
        userId,
        status: 'ACTIVE',
        nextRunAt: {
          gte: now,
          lte: dueSoonHorizon,
        },
      },
    }),
    prisma.recurringRule.count({
      where: {
        userId,
        lastFailureAt: {
          gte: failedRecentWindowStart,
        },
      },
    }),
    prisma.recurringRule.count({
      where: {
        userId,
        OR: [
          {
            status: 'PAUSED',
          },
          {
            lastFailureAt: {
              gte: failedRecentWindowStart,
            },
          },
        ],
      },
    }),
  ]);

  let incomeThisMonth = 0;
  let spentThisMonth = 0;
  let transactionCount = 0;

  for (const row of monthlyTransactionsByType) {
    const amount = parseAmount(row._sum.amount);
    const count = row._count._all ?? 0;
    transactionCount += count;

    if (row.type === 'INCOME') {
      incomeThisMonth += amount;
      continue;
    }

    if (row.type === 'EXPENSE') {
      spentThisMonth += amount;
    }
  }

  const netThisMonth = incomeThisMonth - spentThisMonth;

  const budgetItems = budgetsOverview.budgets.map<BudgetInsight>((budget) => ({
    budgetId: budget.id,
    categoryId: budget.categoryId,
    categoryName: budget.category.name,
    limit: budget.amount,
    spentThisMonth: budget.spentThisMonth,
    remaining: budget.remaining,
    usageRatio: budget.usageRatio,
    alertLevel: resolveAlertLevel(budget.usageRatio),
  }));

  const warningCount = budgetItems.filter((budget) => budget.alertLevel === 'WARNING').length;
  const criticalCount = budgetItems.filter((budget) => budget.alertLevel === 'CRITICAL').length;
  const exceededCount = budgetItems.filter((budget) => budget.usageRatio >= 1).length;

  return {
    period: {
      month,
      year,
      start: start.toISOString(),
      endExclusive: endExclusive.toISOString(),
    },
    recentTransactions,
    monthlySummary: {
      incomeThisMonth: incomeThisMonth.toFixed(2),
      spentThisMonth: spentThisMonth.toFixed(2),
      netThisMonth: netThisMonth.toFixed(2),
      transactionCount,
    },
    budgetStatus: {
      totalBudgets: budgetItems.length,
      warningCount,
      criticalCount,
      exceededCount,
      hasAlerts: warningCount > 0 || criticalCount > 0,
      items: budgetItems,
    },
    recurringStatus: {
      pausedCount,
      dueSoonCount,
      failedRecentCount,
      needsAttentionCount,
      hasIssues: needsAttentionCount > 0,
    },
  };
}
