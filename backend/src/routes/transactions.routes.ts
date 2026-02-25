import { Router } from 'express';
import {
  createTransactionController,
  deleteTransactionController,
  getTransactionByIdController,
  listTransactionsController,
  updateTransactionController,
} from '../controllers/transactions.controller.js';

const transactionsRouter = Router({ mergeParams: true });

transactionsRouter.get('/', listTransactionsController);
transactionsRouter.get('/:transactionId', getTransactionByIdController);
transactionsRouter.post('/', createTransactionController);
transactionsRouter.patch('/:transactionId', updateTransactionController);
transactionsRouter.delete('/:transactionId', deleteTransactionController);

export { transactionsRouter };
