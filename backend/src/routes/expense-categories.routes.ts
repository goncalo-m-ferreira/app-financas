import { Router } from 'express';
import {
  createExpenseCategoryController,
  deleteExpenseCategoryController,
  getExpenseCategoryByIdController,
  listExpenseCategoriesController,
  updateExpenseCategoryController,
} from '../controllers/expense-categories.controller.js';

const expenseCategoriesRouter = Router({ mergeParams: true });

expenseCategoriesRouter.get('/', listExpenseCategoriesController);
expenseCategoriesRouter.get('/:categoryId', getExpenseCategoryByIdController);
expenseCategoriesRouter.post('/', createExpenseCategoryController);
expenseCategoriesRouter.patch('/:categoryId', updateExpenseCategoryController);
expenseCategoriesRouter.delete('/:categoryId', deleteExpenseCategoryController);

export { expenseCategoriesRouter };
