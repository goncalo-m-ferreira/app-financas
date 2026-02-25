import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createTransactionBodySchema,
  listTransactionsQuerySchema,
  transactionParamSchema,
  updateTransactionBodySchema,
  userParamSchema,
} from '../validations/transactions.schemas.js';
import {
  createTransaction,
  deleteTransaction,
  getTransactionById,
  listTransactionsByUser,
  updateTransaction,
} from '../services/transactions.service.js';

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
