import type { Response } from 'express';
import { getAuthenticatedUser } from '../services/auth.service.js';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategoriesByUser,
} from '../services/expense-categories.service.js';
import { listWalletsByUser } from '../services/wallets.service.js';
import {
  listTransactionsByUser,
  type ListTransactionsFilters,
} from '../services/transactions.service.js';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import { resolveMonthYearRange } from '../utils/date-range.js';
import {
  authCategoryParamSchema,
  createExpenseCategoryBodySchema,
} from '../validations/expense-categories.schemas.js';
import {
  listTransactionsQuerySchema,
} from '../validations/transactions.schemas.js';

function calculateBalance(transactions: Array<{ type: 'INCOME' | 'EXPENSE'; amount: string }>): string {
  const total = transactions.reduce((accumulator, transaction) => {
    const amount = Number.parseFloat(transaction.amount);

    if (!Number.isFinite(amount)) {
      return accumulator;
    }

    return transaction.type === 'EXPENSE' ? accumulator - amount : accumulator + amount;
  }, 0);

  return total.toFixed(2);
}

function parseTransactionsFilters(req: AuthenticatedRequest): ListTransactionsFilters {
  const query = listTransactionsQuerySchema.parse({
    month: req.query.month,
    year: req.query.year,
    take: req.query.take ?? 80,
    skip: req.query.skip,
    type: req.query.type,
    categoryId: req.query.categoryId,
    from: req.query.from,
    to: req.query.to,
    minAmount: req.query.minAmount,
    maxAmount: req.query.maxAmount,
    search: req.query.search,
  });

  const hasExplicitRange = query.from !== undefined || query.to !== undefined;

  if (hasExplicitRange && query.month === undefined && query.year === undefined) {
    return query;
  }

  const { start, endExclusive } = resolveMonthYearRange({
    month: query.month,
    year: query.year,
  });

  return {
    ...query,
    from: start,
    to: undefined,
    toExclusive: endExclusive,
  };
}

export const getDashboardController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const filters = parseTransactionsFilters(req);

    const [user, categories, wallets, transactions] = await Promise.all([
      getAuthenticatedUser(userId),
      listExpenseCategoriesByUser(userId),
      listWalletsByUser(userId),
      listTransactionsByUser(userId, filters),
    ]);

    res.status(200).json({
      user,
      categories,
      wallets,
      transactions,
      balance: calculateBalance(transactions),
    });
  },
);

export const listMyExpenseCategoriesController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const categories = await listExpenseCategoriesByUser(userId);
    res.status(200).json(categories);
  },
);

export const listMyTransactionsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const filters = parseTransactionsFilters(req);
    const transactions = await listTransactionsByUser(userId, filters);
    res.status(200).json(transactions);
  },
);

export const createMyExpenseCategoryController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const body = createExpenseCategoryBodySchema.parse(req.body);
    const category = await createExpenseCategory(userId, body);
    res.status(201).json(category);
  },
);

export const deleteMyExpenseCategoryController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { categoryId } = authCategoryParamSchema.parse(req.params);
    const category = await deleteExpenseCategory(userId, categoryId);
    res.status(200).json(category);
  },
);
