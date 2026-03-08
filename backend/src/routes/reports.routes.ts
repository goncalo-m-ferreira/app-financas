import { Router } from 'express';
import {
  createMyReportController,
  downloadMyReportController,
  listMyReportsController,
  regenerateMyReportController,
} from '../controllers/reports.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const reportsRouter = Router();

reportsRouter.use(requireAuth);
reportsRouter.get('/reports', listMyReportsController);
reportsRouter.post('/reports', createMyReportController);
reportsRouter.get('/reports/:reportId/download', downloadMyReportController);
reportsRouter.post('/reports/:reportId/regenerate', regenerateMyReportController);

export { reportsRouter };
