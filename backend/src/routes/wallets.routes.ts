import { Router } from 'express';
import {
  createMyWalletController,
  deleteMyWalletController,
  listMyWalletsController,
  updateMyWalletController,
} from '../controllers/wallets.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const walletsRouter = Router();

walletsRouter.use(requireAuth);
walletsRouter.get('/wallets', listMyWalletsController);
walletsRouter.post('/wallets', createMyWalletController);
walletsRouter.patch('/wallets/:walletId', updateMyWalletController);
walletsRouter.delete('/wallets/:walletId', deleteMyWalletController);

export { walletsRouter };
