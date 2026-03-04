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
  budgetStatus: {
    totalBudgets: number;
    warningCount: number;
    criticalCount: number;
    hasAlerts: boolean;
    items: BudgetInsight[];
  };
};

function resolveAlertLevel(usageRatio: number): BudgetAlertLevel {
  if (usageRatio >= 0.9) {
    return 'CRITICAL';
  }

  if (usageRatio >= 0.8) {
    return 'WARNING';
  }

  return 'SAFE';
}

export async function getHomeInsights(
  userId: string,
  period: InsightsPeriodInput = {},
): Promise<HomeInsightsResponse> {
  const [recentTransactions, budgetsOverview] = await Promise.all([
    listTransactionsByUser(userId, {
      take: 5,
      skip: 0,
    }),
    listBudgetsWithMonthlySpending(userId, period),
  ]);

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

  return {
    period: budgetsOverview.currentMonth,
    recentTransactions,
    budgetStatus: {
      totalBudgets: budgetItems.length,
      warningCount,
      criticalCount,
      hasAlerts: warningCount > 0 || criticalCount > 0,
      items: budgetItems,
    },
  };
}
