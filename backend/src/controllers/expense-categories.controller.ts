import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import {
  categoryParamSchema,
  createExpenseCategoryBodySchema,
  updateExpenseCategoryBodySchema,
  userParamSchema,
} from '../validations/expense-categories.schemas.js';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  getExpenseCategoryById,
  listExpenseCategoriesByUser,
  updateExpenseCategory,
} from '../services/expense-categories.service.js';

export const listExpenseCategoriesController = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = userParamSchema.parse(req.params);
    const categories = await listExpenseCategoriesByUser(userId);
    res.status(200).json(categories);
  },
);

export const getExpenseCategoryByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId, categoryId } = categoryParamSchema.parse(req.params);
    const category = await getExpenseCategoryById(userId, categoryId);
    res.status(200).json(category);
  },
);

export const createExpenseCategoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = userParamSchema.parse(req.params);
    const body = createExpenseCategoryBodySchema.parse(req.body);
    const category = await createExpenseCategory(userId, body);
    res.status(201).json(category);
  },
);

export const updateExpenseCategoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId, categoryId } = categoryParamSchema.parse(req.params);
    const body = updateExpenseCategoryBodySchema.parse(req.body);
    const category = await updateExpenseCategory(userId, categoryId, body);
    res.status(200).json(category);
  },
);

export const deleteExpenseCategoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId, categoryId } = categoryParamSchema.parse(req.params);
    const category = await deleteExpenseCategory(userId, categoryId);
    res.status(200).json(category);
  },
);
