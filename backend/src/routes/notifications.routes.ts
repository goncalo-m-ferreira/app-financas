import { Router } from 'express';
import {
  getMyUnreadNotificationsCountController,
  listMyNotificationsController,
  markAllMyNotificationsAsReadController,
  markMyNotificationAsReadController,
} from '../controllers/notifications.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get('/notifications/unread-count', getMyUnreadNotificationsCountController);
notificationsRouter.get('/notifications', listMyNotificationsController);
notificationsRouter.patch('/notifications/read-all', markAllMyNotificationsAsReadController);
notificationsRouter.patch('/notifications/:notificationId/read', markMyNotificationAsReadController);

export { notificationsRouter };
