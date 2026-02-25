import type { Response } from 'express';
import { getAuthenticatedUser } from '../services/auth.service.js';
import { listExpenseCategoriesByUser } from '../services/expense-categories.service.js';
import {
  createTransaction,
  listTransactionsByUser,
  type ListTransactionsFilters,
} from '../services/transactions.service.js';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createTransactionBodySchema,
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
    take: req.query.take ?? 80,
    skip: req.query.skip,
    type: req.query.type,
    categoryId: req.query.categoryId,
    from: req.query.from,
    to: req.query.to,
    minAmount: req.query.minAmount,
    maxAmount: req.query.maxAmount,
  });

  return query;
}

export const getDashboardController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const filters = parseTransactionsFilters(req);

    const [user, categories, transactions] = await Promise.all([
      getAuthenticatedUser(userId),
      listExpenseCategoriesByUser(userId),
      listTransactionsByUser(userId, filters),
    ]);

    res.status(200).json({
      user,
      categories,
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

export const createMyTransactionController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const body = createTransactionBodySchema.parse(req.body);
    const transaction = await createTransaction(userId, body);
    res.status(201).json(transaction);
  },
);
