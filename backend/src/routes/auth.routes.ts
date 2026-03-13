import { Router } from 'express';
import {
  confirmEmailVerificationController,
  googleAuthController,
  loginController,
  logoutController,
  meController,
  requestEmailVerificationController,
  registerController,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireCsrfForCookieSession } from '../middlewares/csrf.js';
import { createIpRateLimiter } from '../middlewares/rate-limit.js';

const authRouter = Router();
const authMutationRateLimiter = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please try again later.',
});
const emailVerificationRateLimiter = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many email verification attempts. Please try again later.',
});

authRouter.post('/register', authMutationRateLimiter, registerController);
authRouter.post('/login', authMutationRateLimiter, loginController);
authRouter.post('/google', authMutationRateLimiter, googleAuthController);
authRouter.post(
  '/verify-email/request',
  emailVerificationRateLimiter,
  requestEmailVerificationController,
);
authRouter.post(
  '/verify-email/confirm',
  emailVerificationRateLimiter,
  confirmEmailVerificationController,
);
authRouter.get('/me', requireAuth, meController);
authRouter.post('/logout', requireAuth, requireCsrfForCookieSession, logoutController);

export { authRouter };
