import type { Request, Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createUserBodySchema,
  listUsersQuerySchema,
  updateMyProfileBodySchema,
  updateUserBodySchema,
  userIdParamSchema,
} from '../validations/users.schemas.js';
import {
  createUser,
  deleteMyAccount,
  deleteUser,
  getUserById,
  listUsers,
  updateMyProfile,
  updateUser,
} from '../services/users.service.js';

export const listUsersController = asyncHandler(async (req: Request, res: Response) => {
  const query = listUsersQuerySchema.parse(req.query);
  const users = await listUsers(query);
  res.status(200).json(users);
});

export const getUserByIdController = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = userIdParamSchema.parse(req.params);
  const user = await getUserById(userId);
  res.status(200).json(user);
});

export const createUserController = asyncHandler(async (req: Request, res: Response) => {
  const body = createUserBodySchema.parse(req.body);
  const user = await createUser(body);
  res.status(201).json(user);
});

export const updateUserController = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = userIdParamSchema.parse(req.params);
  const body = updateUserBodySchema.parse(req.body);
  const user = await updateUser(userId, body);
  res.status(200).json(user);
});

export const deleteUserController = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = userIdParamSchema.parse(req.params);
  const user = await deleteUser(userId);
  res.status(200).json(user);
});

export const updateMyProfileController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const body = updateMyProfileBodySchema.parse(req.body);
    const user = await updateMyProfile(userId, body);
    res.status(200).json(user);
  },
);

export const deleteMyAccountController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    await deleteMyAccount(userId);
    res.status(200).json({ success: true });
  },
);
