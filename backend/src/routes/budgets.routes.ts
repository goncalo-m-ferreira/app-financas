import { Router } from 'express';
import {
  createMyBudgetController,
  deleteMyBudgetController,
  listMyBudgetsController,
  updateMyBudgetController,
} from '../controllers/budgets.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const budgetsRouter = Router();

budgetsRouter.use(requireAuth);
budgetsRouter.get('/budgets', listMyBudgetsController);
budgetsRouter.post('/budgets', createMyBudgetController);
budgetsRouter.patch('/budgets/:budgetId', updateMyBudgetController);
budgetsRouter.delete('/budgets/:budgetId', deleteMyBudgetController);

export { budgetsRouter };
