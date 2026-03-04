import type { Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import { notificationParamSchema } from '../validations/notifications.schemas.js';
import {
  listNotificationsByUser,
  markNotificationAsRead,
} from '../services/notifications.service.js';

export const listMyNotificationsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const notifications = await listNotificationsByUser(userId);
    res.status(200).json(notifications);
  },
);

export const markMyNotificationAsReadController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const { notificationId } = notificationParamSchema.parse(req.params);
    const notification = await markNotificationAsRead(userId, notificationId);
    res.status(200).json(notification);
  },
);
