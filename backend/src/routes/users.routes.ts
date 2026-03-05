import { Router } from 'express';
import {
  deleteMyAccountController,
  updateMyProfileController,
} from '../controllers/users.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.put('/users/me', updateMyProfileController);
usersRouter.delete('/users/me', deleteMyAccountController);

export { usersRouter };
