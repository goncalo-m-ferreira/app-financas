import type { Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createReportBodySchema,
  listReportsQuerySchema,
  reportParamSchema,
} from '../validations/reports.schemas.js';
import {
  createReportAndEnqueue,
  getReportDownloadPayload,
  listReportsByUser,
  regenerateFailedReport,
} from '../services/reports.service.js';

export const listMyReportsController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const query = listReportsQuerySchema.parse({
    status: req.query.status,
    month: req.query.month,
    year: req.query.year,
  });
  const reports = await listReportsByUser(userId, query);
  res.status(200).json(reports);
});

export const createMyReportController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const body = createReportBodySchema.parse(req.body);
  const report = await createReportAndEnqueue(userId, body);
  res.status(201).json(report);
});

export const downloadMyReportController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthUserIdOrThrow(req);
  const { reportId } = reportParamSchema.parse(req.params);
  const payload = await getReportDownloadPayload(userId, reportId);
  res.download(payload.filePath, payload.downloadName);
});

export const regenerateMyReportController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { reportId } = reportParamSchema.parse(req.params);
    const report = await regenerateFailedReport(userId, reportId);
    res.status(201).json(report);
  },
);
