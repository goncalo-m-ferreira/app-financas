import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import { resolveMonthYearRange } from '../utils/date-range.js';

export type CreateBudgetInput = {
  categoryId: string;
  amount: number;
};

export type UpdateBudgetInput = {
  amount: number;
};

type BudgetWithCategory = Prisma.BudgetGetPayload<{
  include: {
    category: {
      select: {
        id: true;
        name: true;
        color: true;
        icon: true;
      };
    };
  };
}>;

const BUDGET_CATEGORY_INCLUDE = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
    },
  },
} as const;

export type BudgetOverviewItem = Omit<BudgetWithCategory, 'amount'> & {
  amount: string;
  spentThisMonth: string;
  remaining: string;
  usageRatio: number;
};

export type BudgetOverview = {
  currentMonth: {
    month: number;
    year: number;
    start: string;
    endExclusive: string;
  };
  budgets: BudgetOverviewItem[];
};

async function ensureUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError('Utilizador não encontrado.', 404);
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
    throw new AppError('Categoria de despesa não encontrada para este utilizador.', 404);
  }
}

async function getBudgetOrThrow(userId: string, budgetId: string): Promise<BudgetWithCategory> {
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    include: BUDGET_CATEGORY_INCLUDE,
  });

  if (!budget || budget.userId !== userId) {
    throw new AppError('Orçamento não encontrado.', 404);
  }

  return budget;
}

async function getCurrentMonthSpentForCategory(
  userId: string,
  categoryId: string,
): Promise<Prisma.Decimal | null> {
  const { start, endExclusive } = resolveMonthYearRange({});
  const spending = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'EXPENSE',
      categoryId,
      transactionDate: {
        gte: start,
        lt: endExclusive,
      },
    },
    _sum: {
      amount: true,
    },
  });

  return spending._sum.amount ?? null;
}

function toBudgetOverviewItem(
  budget: BudgetWithCategory,
  spentAmount: Prisma.Decimal | null,
): BudgetOverviewItem {
  const spentDecimal = spentAmount ?? new Prisma.Decimal(0);
  const remainingDecimal = budget.amount.minus(spentDecimal);
  const budgetAmountNumber = Number.parseFloat(budget.amount.toString());
  const spentAmountNumber = Number.parseFloat(spentDecimal.toString());
  const rawRatio = budgetAmountNumber > 0 ? spentAmountNumber / budgetAmountNumber : 0;
  const usageRatio = Number.isFinite(rawRatio) ? Number(rawRatio.toFixed(4)) : 0;

  return {
    ...budget,
    amount: budget.amount.toFixed(2),
    spentThisMonth: spentDecimal.toFixed(2),
    remaining: remainingDecimal.toFixed(2),
    usageRatio,
  };
}

type BudgetPeriodInput = {
  month?: number;
  year?: number;
};

export async function listBudgetsWithMonthlySpending(
  userId: string,
  period: BudgetPeriodInput = {},
): Promise<BudgetOverview> {
  await ensureUserExists(userId);

  const { month, year, start, endExclusive } = resolveMonthYearRange(period);
  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: BUDGET_CATEGORY_INCLUDE,
    orderBy: [{ createdAt: 'desc' }],
  });

  const categoryIds = budgets.map((budget) => budget.categoryId);
  const spendingRows =
    categoryIds.length > 0
      ? await prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
            userId,
            type: 'EXPENSE',
            categoryId: { in: categoryIds },
            transactionDate: {
              gte: start,
              lt: endExclusive,
            },
          },
          _sum: {
            amount: true,
          },
        })
      : [];

  const spentByCategoryId = new Map<string, Prisma.Decimal>();

  for (const row of spendingRows) {
    if (!row.categoryId) {
      continue;
    }

    spentByCategoryId.set(row.categoryId, row._sum.amount ?? new Prisma.Decimal(0));
  }

  return {
    currentMonth: {
      month,
      year,
      start: start.toISOString(),
      endExclusive: endExclusive.toISOString(),
    },
    budgets: budgets.map((budget) =>
      toBudgetOverviewItem(budget, spentByCategoryId.get(budget.categoryId) ?? null),
    ),
  };
}

export async function createBudget(
  userId: string,
  input: CreateBudgetInput,
): Promise<BudgetOverviewItem> {
  await ensureUserExists(userId);
  await ensureCategoryBelongsToUser(userId, input.categoryId);

  let createdBudget: BudgetWithCategory;

  try {
    createdBudget = await prisma.budget.create({
      data: {
        userId,
        categoryId: input.categoryId,
        amount: input.amount,
      },
      include: BUDGET_CATEGORY_INCLUDE,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Já existe um orçamento para esta categoria.', 409);
    }

    throw error;
  }

  const spentAmount = await getCurrentMonthSpentForCategory(userId, createdBudget.categoryId);

  return toBudgetOverviewItem(createdBudget, spentAmount);
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  input: UpdateBudgetInput,
): Promise<BudgetOverviewItem> {
  await ensureUserExists(userId);
  await getBudgetOrThrow(userId, budgetId);

  let updatedBudget: BudgetWithCategory;

  try {
    updatedBudget = await prisma.budget.update({
      where: { id: budgetId },
      data: {
        amount: input.amount,
      },
      include: BUDGET_CATEGORY_INCLUDE,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new AppError('Orçamento não encontrado.', 404);
    }

    throw error;
  }

  const spentAmount = await getCurrentMonthSpentForCategory(userId, updatedBudget.categoryId);
  return toBudgetOverviewItem(updatedBudget, spentAmount);
}

export async function deleteBudget(userId: string, budgetId: string): Promise<BudgetOverviewItem> {
  await ensureUserExists(userId);
  await getBudgetOrThrow(userId, budgetId);

  let deletedBudget: BudgetWithCategory;

  try {
    deletedBudget = await prisma.budget.delete({
      where: { id: budgetId },
      include: BUDGET_CATEGORY_INCLUDE,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new AppError('Orçamento não encontrado.', 404);
    }

    throw error;
  }

  const spentAmount = await getCurrentMonthSpentForCategory(userId, deletedBudget.categoryId);
  return toBudgetOverviewItem(deletedBudget, spentAmount);
}
