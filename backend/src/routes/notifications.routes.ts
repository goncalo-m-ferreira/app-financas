import { Router } from 'express';
import {
  listMyNotificationsController,
  markMyNotificationAsReadController,
} from '../controllers/notifications.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get('/notifications', listMyNotificationsController);
notificationsRouter.patch('/notifications/:notificationId/read', markMyNotificationAsReadController);

export { notificationsRouter };
