import { Router } from 'express';
import {
  getAdminOverviewController,
  getAdminRecurringOperationsController,
} from '../controllers/admin.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/require-admin.js';

const adminRouter = Router();

adminRouter.get('/admin/overview', requireAuth, requireAdmin, getAdminOverviewController);
adminRouter.get(
  '/admin/recurring-operations',
  requireAuth,
  requireAdmin,
  getAdminRecurringOperationsController,
);

export { adminRouter };
