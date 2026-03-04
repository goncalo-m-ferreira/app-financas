import { type Notification, type NotificationType } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
};

async function ensureUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError('Utilizador não encontrado.', 404);
  }
}

export async function listNotificationsByUser(userId: string): Promise<Notification[]> {
  await ensureUserExists(userId);

  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<Notification> {
  await ensureUserExists(userId);

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new AppError('Notification not found.', 404);
  }

  if (notification.isRead) {
    return notification;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
    },
  });
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  await ensureUserExists(input.userId);

  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type,
      isRead: false,
    },
  });
}
