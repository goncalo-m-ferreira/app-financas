import type { Response } from 'express';
import { getAuthUserIdOrThrow } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../types/http.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  listNotificationsQuerySchema,
  notificationParamSchema,
} from '../validations/notifications.schemas.js';
import {
  getUnreadNotificationsCount,
  listNotificationsByUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/notifications.service.js';

export const listMyNotificationsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const query = listNotificationsQuerySchema.parse({
      isRead: req.query.isRead,
      type: req.query.type,
      take: req.query.take,
      cursor: req.query.cursor,
    });
    const notifications = await listNotificationsByUser(userId, query);
    res.status(200).json(notifications);
  },
);

export const getMyUnreadNotificationsCountController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const result = await getUnreadNotificationsCount(userId);
    res.status(200).json(result);
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

export const markAllMyNotificationsAsReadController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = getAuthUserIdOrThrow(req);
    const result = await markAllNotificationsAsRead(userId);
    res.status(200).json(result);
  },
);
