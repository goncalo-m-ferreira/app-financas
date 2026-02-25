import { Router } from 'express';
import {
  createUserController,
  deleteUserController,
  getUserByIdController,
  listUsersController,
  updateUserController,
} from '../controllers/users.controller.js';
import { expenseCategoriesRouter } from './expense-categories.routes.js';
import { transactionsRouter } from './transactions.routes.js';

const usersRouter = Router();

usersRouter.get('/users', listUsersController);
usersRouter.get('/users/:userId', getUserByIdController);
usersRouter.post('/users', createUserController);
usersRouter.patch('/users/:userId', updateUserController);
usersRouter.delete('/users/:userId', deleteUserController);

usersRouter.use('/users/:userId/expense-categories', expenseCategoriesRouter);
usersRouter.use('/users/:userId/transactions', transactionsRouter);

export { usersRouter };
