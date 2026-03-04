import type { Response } from 'express';
import { getHomeInsights } from '../services/home.service.js';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import { listHomeInsightsQuerySchema } from '../validations/home.schemas.js';

export const getHomeInsightsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const query = listHomeInsightsQuerySchema.parse({
      month: req.query.month,
      year: req.query.year,
    });

    const insights = await getHomeInsights(userId, query);
    res.status(200).json(insights);
  },
);
