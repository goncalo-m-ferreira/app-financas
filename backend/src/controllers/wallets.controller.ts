import type { Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createWalletBodySchema,
  updateWalletBodySchema,
  walletParamSchema,
} from '../validations/wallets.schemas.js';
import {
  createWallet,
  deleteWallet,
  listWalletsByUser,
  updateWallet,
} from '../services/wallets.service.js';

export const listMyWalletsController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const wallets = await listWalletsByUser(userId);
  res.status(200).json(wallets);
});

export const createMyWalletController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const body = createWalletBodySchema.parse(req.body);
  const wallet = await createWallet(userId, body);
  res.status(201).json(wallet);
});

export const updateMyWalletController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const { walletId } = walletParamSchema.parse(req.params);
  const body = updateWalletBodySchema.parse(req.body);
  const wallet = await updateWallet(userId, walletId, body);
  res.status(200).json(wallet);
});

export const deleteMyWalletController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const { walletId } = walletParamSchema.parse(req.params);
  const wallet = await deleteWallet(userId, walletId);
  res.status(200).json(wallet);
});
