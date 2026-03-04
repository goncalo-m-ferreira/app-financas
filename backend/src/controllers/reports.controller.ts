import type { Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import { createReportBodySchema } from '../validations/reports.schemas.js';
import { createReportAndEnqueue, listReportsByUser } from '../services/reports.service.js';

export const listMyReportsController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const reports = await listReportsByUser(userId);
  res.status(200).json(reports);
});

export const createMyReportController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const body = createReportBodySchema.parse(req.body);
  const report = await createReportAndEnqueue(userId, body);
  res.status(201).json(report);
});
