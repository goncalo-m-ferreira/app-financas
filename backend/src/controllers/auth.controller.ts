import type { Request, Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import { loginBodySchema, registerBodySchema } from '../validations/auth.schemas.js';
import { getAuthenticatedUser, login, register } from '../services/auth.service.js';

export const registerController = asyncHandler(async (req: Request, res: Response) => {
  const body = registerBodySchema.parse(req.body);
  const authResponse = await register(body);
  res.status(201).json(authResponse);
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const body = loginBodySchema.parse(req.body);
  const authResponse = await login(body);
  res.status(200).json(authResponse);
});

export const meController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const user = await getAuthenticatedUser(userId);
  res.status(200).json(user);
});
