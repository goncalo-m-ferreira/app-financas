import type { Request, Response } from 'express';
import { getAdminOverview } from '../services/admin.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { adminOverviewQuerySchema } from '../validations/admin.schemas.js';

export const getAdminOverviewController = asyncHandler(async (req: Request, res: Response) => {
  const query = adminOverviewQuerySchema.parse(req.query);
  const overview = await getAdminOverview({
    take: query.take,
  });

  res.status(200).json(overview);
});
