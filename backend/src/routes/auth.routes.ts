import { Router } from 'express';
import { loginController, meController, registerController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/login', loginController);
authRouter.get('/me', requireAuth, meController);

export { authRouter };
