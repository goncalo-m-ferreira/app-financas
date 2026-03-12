import { Router } from 'express';
import {
  createMyReportController,
  downloadMyReportController,
  listMyReportsController,
  regenerateMyReportController,
} from '../controllers/reports.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { createIpRateLimiter } from '../middlewares/rate-limit.js';

const reportsRouter = Router();
const reportsMutationRateLimiter = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many report requests. Please try again later.',
});

reportsRouter.use(requireAuth);
reportsRouter.get('/reports', listMyReportsController);
reportsRouter.post('/reports', reportsMutationRateLimiter, createMyReportController);
reportsRouter.get('/reports/:reportId/download', downloadMyReportController);
reportsRouter.post(
  '/reports/:reportId/regenerate',
  reportsMutationRateLimiter,
  regenerateMyReportController,
);

export { reportsRouter };
