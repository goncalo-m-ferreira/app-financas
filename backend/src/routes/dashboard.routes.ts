import { Router } from 'express';
import {
  createMyTransactionController,
  getDashboardController,
  listMyExpenseCategoriesController,
  listMyTransactionsController,
} from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/dashboard', getDashboardController);
dashboardRouter.get('/expense-categories', listMyExpenseCategoriesController);
dashboardRouter.get('/transactions', listMyTransactionsController);
dashboardRouter.post('/transactions', createMyTransactionController);

export { dashboardRouter };
