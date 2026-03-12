import type { Request, Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import { clearAuthSessionCookies, ensureCsrfCookie, setAuthSessionCookies } from '../utils/http-cookies.js';
import {
  googleAuthBodySchema,
  loginBodySchema,
  registerBodySchema,
} from '../validations/auth.schemas.js';
import {
  getAuthenticatedUser,
  login,
  loginWithGoogle,
  register,
} from '../services/auth.service.js';

export const registerController = asyncHandler(async (req: Request, res: Response) => {
  const body = registerBodySchema.parse(req.body);
  const authResponse = await register(body);
  setAuthSessionCookies(res, authResponse.token);
  res.status(201).json({
    user: authResponse.user,
    token: authResponse.token,
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
