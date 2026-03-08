import type { Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  budgetParamSchema,
  createBudgetBodySchema,
  listBudgetsQuerySchema,
  updateBudgetBodySchema,
} from '../validations/budgets.schemas.js';
import {
  createBudget,
  deleteBudget,
  listBudgetsWithMonthlySpending,
  updateBudget,
} from '../services/budgets.service.js';

export const listMyBudgetsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const query = listBudgetsQuerySchema.parse({
      month: req.query.month,
      year: req.query.year,
    });
    const budgetOverview = await listBudgetsWithMonthlySpending(userId, query);
    res.status(200).json(budgetOverview);
  },
);

export const createMyBudgetController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const body = createBudgetBodySchema.parse(req.body);
    const budget = await createBudget(userId, body);
    res.status(201).json(budget);
  },
);

export const updateMyBudgetController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { budgetId } = budgetParamSchema.parse(req.params);
    const body = updateBudgetBodySchema.parse(req.body);
    const budget = await updateBudget(userId, budgetId, body);
    res.status(200).json(budget);
  },
);

export const deleteMyBudgetController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { budgetId } = budgetParamSchema.parse(req.params);
    const budget = await deleteBudget(userId, budgetId);
    res.status(200).json(budget);
  },
);
