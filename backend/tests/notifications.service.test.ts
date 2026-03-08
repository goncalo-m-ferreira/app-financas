import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import {
  getUnreadNotificationsCount,
  listNotificationsByUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../src/services/notifications.service.js';

function buildNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notification-1',
    userId: 'user-1',
    title: 'Report Ready',
    message: 'Your report is ready',
    targetPath: '/reports',
    type: 'REPORT',
    isRead: false,
    createdAt: new Date('2026-03-08T10:00:00.000Z'),
    ...overrides,
  };
}

describe('notifications service', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('lists notifications with read/type filters and cursor pagination', async () => {
    const cursorCreatedAt = new Date('2026-03-08T12:00:00.000Z');
    prismaMock.notification.findFirst.mockResolvedValueOnce({
      id: 'cursor-id',
      createdAt: cursorCreatedAt,
    });

    const first = buildNotification({
      id: 'n-1',
      createdAt: new Date('2026-03-08T11:00:00.000Z'),
      isRead: false,
      type: 'REPORT',
    });
    const second = buildNotification({
      id: 'n-2',
      createdAt: new Date('2026-03-08T10:00:00.000Z'),
      isRead: false,
      type: 'REPORT',
    });
    const third = buildNotification({
      id: 'n-3',
      createdAt: new Date('2026-03-08T09:00:00.000Z'),
      isRead: false,
      type: 'REPORT',
    });

    prismaMock.notification.findMany.mockResolvedValueOnce([first, second, third]);

    const result = await listNotificationsByUser('user-1', {
      isRead: false,
      type: 'REPORT',
      take: 2,
      cursor: 'cursor-id',
    });

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isRead: false,
        type: 'REPORT',
        OR: [
          {
            createdAt: {
              lt: cursorCreatedAt,
            },
          },
          {
            createdAt: cursorCreatedAt,
            id: {
              lt: 'cursor-id',
            },
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });

    expect(result.items).toEqual([first, second]);
    expect(result.nextCursor).toBe('n-2');
  });

  test('returns unread notifications count scoped to user', async () => {
    prismaMock.notification.count.mockResolvedValueOnce(4);

    const result = await getUnreadNotificationsCount('user-1');

    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isRead: false,
      },
    });
    expect(result).toEqual({ unreadCount: 4 });
  });

  test('marks all notifications as read and returns updated count', async () => {
    prismaMock.notification.updateMany.mockResolvedValueOnce({ count: 3 });

    const result = await markAllNotificationsAsRead('user-1');

    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
    expect(result).toEqual({ updatedCount: 3 });
  });

  test('enforces user scoping when marking single notification as read', async () => {
    prismaMock.notification.findFirst.mockResolvedValueOnce(null);

    await expect(markNotificationAsRead('user-1', 'notification-other-user')).rejects.toMatchObject({
      message: 'Notification not found.',
      statusCode: 404,
    });

    expect(prismaMock.notification.update).not.toHaveBeenCalled();
  });
});
