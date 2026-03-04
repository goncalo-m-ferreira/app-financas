import { Router } from 'express';
import { createMyReportController, listMyReportsController } from '../controllers/reports.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const reportsRouter = Router();

reportsRouter.use(requireAuth);
reportsRouter.get('/reports', listMyReportsController);
reportsRouter.post('/reports', createMyReportController);

export { reportsRouter };
