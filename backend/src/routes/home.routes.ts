import { Router } from 'express';
import { getHomeInsightsController } from '../controllers/home.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const homeRouter = Router();

homeRouter.use(requireAuth);
homeRouter.get('/home/insights', getHomeInsightsController);

export { homeRouter };
