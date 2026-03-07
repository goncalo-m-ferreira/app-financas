import type { Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createRecurringRuleBodySchema,
  listRecurringExecutionsQuerySchema,
  listRecurringRulesQuerySchema,
  pauseRecurringRuleBodySchema,
  recurringRuleParamSchema,
  recurringRulePreviewQuerySchema,
  updateRecurringRuleBodySchema,
} from '../validations/recurring-rules.schemas.js';
import {
  cancelRecurringRule,
  createRecurringRule,
  listRecurringExecutionsByUser,
  listRecurringRulesByUser,
  pauseRecurringRule,
  previewRecurringRule,
  resumeRecurringRule,
  updateRecurringRule,
} from '../services/recurring-rules.service.js';

export const listMyRecurringRulesController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const query = listRecurringRulesQuerySchema.parse(req.query);
    const rules = await listRecurringRulesByUser(userId, query);
    res.status(200).json(rules);
  },
);

export const createMyRecurringRuleController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const body = createRecurringRuleBodySchema.parse(req.body);
    const rule = await createRecurringRule(userId, body);
    res.status(201).json(rule);
  },
);

export const updateMyRecurringRuleController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { ruleId } = recurringRuleParamSchema.parse(req.params);
    const body = updateRecurringRuleBodySchema.parse(req.body);
    const rule = await updateRecurringRule(userId, ruleId, body);
    res.status(200).json(rule);
  },
);

export const pauseMyRecurringRuleController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { ruleId } = recurringRuleParamSchema.parse(req.params);
    const body = pauseRecurringRuleBodySchema.parse(req.body ?? {});
    const rule = await pauseRecurringRule(userId, ruleId, body.reason);
    res.status(200).json(rule);
  },
);

export const resumeMyRecurringRuleController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { ruleId } = recurringRuleParamSchema.parse(req.params);
    const rule = await resumeRecurringRule(userId, ruleId);
    res.status(200).json(rule);
  },
);

export const cancelMyRecurringRuleController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { ruleId } = recurringRuleParamSchema.parse(req.params);
    const rule = await cancelRecurringRule(userId, ruleId);
    res.status(200).json(rule);
  },
);

export const previewMyRecurringRuleController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { ruleId } = recurringRuleParamSchema.parse(req.params);
    const query = recurringRulePreviewQuerySchema.parse(req.query);
    const preview = await previewRecurringRule(userId, ruleId, query.count);
    res.status(200).json(preview);
  },
);

export const listMyRecurringExecutionsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const query = listRecurringExecutionsQuerySchema.parse(req.query);
    const result = await listRecurringExecutionsByUser(userId, query);
    res.status(200).json(result);
  },
);
