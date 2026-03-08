import { Prisma, type Notification, type NotificationType } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

const DEFAULT_NOTIFICATIONS_TAKE = 25;

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  targetPath?: string | null;
};

export type ListNotificationsInput = {
  isRead?: boolean;
  type?: NotificationType;
  take?: number;
  cursor?: string;
};

export type ListNotificationsResponse = {
  items: Notification[];
  nextCursor: string | null;
};

export type UnreadNotificationsCountResponse = {
  unreadCount: number;
};

export type MarkAllNotificationsAsReadResponse = {
  updatedCount: number;
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

export async function listNotificationsByUser(
  userId: string,
  input: ListNotificationsInput = {},
): Promise<ListNotificationsResponse> {
  await ensureUserExists(userId);

  const take = input.take ?? DEFAULT_NOTIFICATIONS_TAKE;
  const where: Prisma.NotificationWhereInput = {
    userId,
  };

  if (input.isRead !== undefined) {
    where.isRead = input.isRead;
  }

  if (input.type !== undefined) {
    where.type = input.type;
  }

  if (input.cursor) {
    const cursorNotification = await prisma.notification.findFirst({
      where: {
        id: input.cursor,
        userId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    if (!cursorNotification) {
      throw new AppError('Notification cursor not found.', 404);
    }

    where.OR = [
      {
        createdAt: {
          lt: cursorNotification.createdAt,
        },
      },
      {
        createdAt: cursorNotification.createdAt,
        id: {
          lt: cursorNotification.id,
        },
      },
    ];
  }

  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
  });

  const hasNextPage = rows.length > take;
  const items = hasNextPage ? rows.slice(0, take) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    nextCursor,
  };
}

export async function getUnreadNotificationsCount(
  userId: string,
): Promise<UnreadNotificationsCountResponse> {
  await ensureUserExists(userId);

  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return {
    unreadCount,
  };
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
      targetPath: input.targetPath ?? null,
      type: input.type,
      isRead: false,
    },
  });
}

export async function markAllNotificationsAsRead(
  userId: string,
): Promise<MarkAllNotificationsAsReadResponse> {
  await ensureUserExists(userId);

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return {
    updatedCount: result.count,
  };
}
