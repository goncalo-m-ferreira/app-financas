import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { prismaMock, createNotificationMock } = vi.hoisted(() => ({
  prismaMock: {
    report: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
  },
  createNotificationMock: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/services/notifications.service.js', () => ({
  createNotification: createNotificationMock,
}));

import { processReportJob } from '../src/services/reports.service.js';

describe('reports service notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createNotificationMock.mockResolvedValue(undefined);

    prismaMock.report.findFirst.mockResolvedValue({
      id: 'report-1',
      userId: 'user-1',
      name: 'March 2026 Report',
    });
    prismaMock.transaction.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('creates a REPORT notification when report generation fails', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const promise = processReportJob({
      reportId: 'report-1',
      userId: 'user-1',
      month: 3,
      year: 2026,
    });
    const rejection = expect(promise).rejects.toMatchObject({
      message: 'User for report generation was not found.',
      statusCode: 404,
    });

    await vi.advanceTimersByTimeAsync(3000);
    await rejection;

    expect(prismaMock.report.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: {
        status: 'FAILED',
      },
    });

    expect(createNotificationMock).toHaveBeenCalledWith({
      userId: 'user-1',
      title: 'Report Failed',
      message: 'We could not generate your monthly statement. Please try again in Reports.',
      type: 'REPORT',
      targetPath: '/reports',
    });
  });
});
