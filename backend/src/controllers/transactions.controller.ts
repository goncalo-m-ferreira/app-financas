import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { resolveMonthYearRange } from '../utils/date-range.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  authTransactionIdParamSchema,
  createTransactionBodySchema,
  importTransactionsBodySchema,
  listTransactionsQuerySchema,
  transactionParamSchema,
  updateTransactionBodySchema,
  userParamSchema,
} from '../validations/transactions.schemas.js';
import {
  createTransaction,
  deleteTransaction,
  getTransactionById,
  importTransactionsFromCsv,
  listTransactionsByUser,
  type ListTransactionsFilters,
  updateTransaction,
} from '../services/transactions.service.js';

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

export const listTransactionsController = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = userParamSchema.parse(req.params);
  const query = listTransactionsQuerySchema.parse(req.query);
  const transactions = await listTransactionsByUser(userId, query);
  res.status(200).json(transactions);
});

export const getTransactionByIdController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, transactionId } = transactionParamSchema.parse(req.params);
  const transaction = await getTransactionById(userId, transactionId);
  res.status(200).json(transaction);
});

export const createTransactionController = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = userParamSchema.parse(req.params);
  const body = createTransactionBodySchema.parse(req.body);
  const transaction = await createTransaction(userId, body);
  res.status(201).json(transaction);
});

export const updateTransactionController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, transactionId } = transactionParamSchema.parse(req.params);
  const body = updateTransactionBodySchema.parse(req.body);
  const transaction = await updateTransaction(userId, transactionId, body);
  res.status(200).json(transaction);
});

export const deleteTransactionController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, transactionId } = transactionParamSchema.parse(req.params);
  const transaction = await deleteTransaction(userId, transactionId);
  res.status(200).json(transaction);
});

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

export const importMyTransactionsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getAuthUserIdOrThrow(req);
      const { walletId } = importTransactionsBodySchema.parse(req.body);

      if (!req.file) {
        throw new AppError('Ficheiro CSV em falta. Use o campo "file" no form-data.', 400);
      }

      if (!Buffer.isBuffer(req.file.buffer) || req.file.buffer.length === 0) {
        throw new AppError('Ficheiro CSV vazio ou inválido.', 400);
      }

      const result = await importTransactionsFromCsv(userId, {
        walletId,
        csvBuffer: req.file.buffer,
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('CSV Import Error:', error);

      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message, message: error.message });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({ error: error.message, message: error.message });
        return;
      }

      res.status(400).json({
        error: 'Falha ao importar CSV.',
        message: 'Falha ao importar CSV.',
      });
    }
  },
);

export const updateMyTransactionController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { id } = authTransactionIdParamSchema.parse(req.params);
    const body = updateTransactionBodySchema.parse(req.body);
    const transaction = await updateTransaction(userId, id, body);
    res.status(200).json(transaction);
  },
);

export const deleteMyTransactionController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { id } = authTransactionIdParamSchema.parse(req.params);
    const transaction = await deleteTransaction(userId, id);
    res.status(200).json(transaction);
  },
);
