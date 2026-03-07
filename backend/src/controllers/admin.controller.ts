import type { Request, Response } from 'express';
import { getAdminOverview, getAdminRecurringOperations } from '../services/admin.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  adminOverviewQuerySchema,
  adminRecurringOperationsQuerySchema,
} from '../validations/admin.schemas.js';

export const getAdminOverviewController = asyncHandler(async (req: Request, res: Response) => {
  const query = adminOverviewQuerySchema.parse(req.query);
  const overview = await getAdminOverview({
    take: query.take,
  });

  res.status(200).json(overview);
});

export const getAdminRecurringOperationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = adminRecurringOperationsQuerySchema.parse(req.query);
    const operations = await getAdminRecurringOperations({
      take: query.take,
      issueType: query.issueType,
    });

    res.status(200).json(operations);
  },
);
