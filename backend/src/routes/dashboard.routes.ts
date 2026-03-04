import { Router } from 'express';
import {
  createMyExpenseCategoryController,
  deleteMyExpenseCategoryController,
  getDashboardController,
  listMyExpenseCategoriesController,
} from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/dashboard', getDashboardController);
dashboardRouter.get('/expense-categories', listMyExpenseCategoriesController);
dashboardRouter.post('/expense-categories', createMyExpenseCategoryController);
dashboardRouter.delete('/expense-categories/:categoryId', deleteMyExpenseCategoryController);

export { dashboardRouter };
