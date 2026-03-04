import { Router } from 'express';
import {
  createMyBudgetController,
  listMyBudgetsController,
} from '../controllers/budgets.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const budgetsRouter = Router();

budgetsRouter.use(requireAuth);
budgetsRouter.get('/budgets', listMyBudgetsController);
budgetsRouter.post('/budgets', createMyBudgetController);

export { budgetsRouter };
