import type { Request, Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import { clearAuthSessionCookies, ensureCsrfCookie, setAuthSessionCookies } from '../utils/http-cookies.js';
import {
  googleAuthBodySchema,
  loginBodySchema,
  registerBodySchema,
  verifyEmailConfirmBodySchema,
  verifyEmailRequestBodySchema,
} from '../validations/auth.schemas.js';
import {
  confirmEmailVerificationToken,
  getAuthenticatedUser,
  login,
  loginWithGoogle,
  requestEmailVerificationByEmail,
  register,
} from '../services/auth.service.js';

export const registerController = asyncHandler(async (req: Request, res: Response) => {
  const body = registerBodySchema.parse(req.body);
  const registerResponse = await register(body);
  res.status(201).json({
    user: registerResponse.user,
    requiresEmailVerification: registerResponse.requiresEmailVerification,
    message: registerResponse.message,
  });
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const body = loginBodySchema.parse(req.body);
  const authResponse = await login(body);
  setAuthSessionCookies(res, authResponse.token);
  res.status(200).json({
    user: authResponse.user,
    token: authResponse.token,
  });
});

export const googleAuthController = asyncHandler(async (req: Request, res: Response) => {
  const body = googleAuthBodySchema.parse(req.body);
  const authResponse = await loginWithGoogle(body);
  setAuthSessionCookies(res, authResponse.token);
  res.status(200).json({
    user: authResponse.user,
    token: authResponse.token,
  });
});

export const meController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const user = await getAuthenticatedUser(userId);
  ensureCsrfCookie(req, res);
  res.status(200).json(user);
});

export const logoutController = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  clearAuthSessionCookies(res);
  res.status(200).json({
    success: true,
  });
});

export const requestEmailVerificationController = asyncHandler(async (req: Request, res: Response) => {
  const body = verifyEmailRequestBodySchema.parse(req.body);
  const response = await requestEmailVerificationByEmail(body.email);
  res.status(200).json(response);
});

export const confirmEmailVerificationController = asyncHandler(async (req: Request, res: Response) => {
  const body = verifyEmailConfirmBodySchema.parse(req.body);
  const response = await confirmEmailVerificationToken(body.token);
  res.status(200).json(response);
});
