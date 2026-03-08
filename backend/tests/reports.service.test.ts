import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { prismaMock, publishQueueMessageMock, createNotificationMock, accessMock } = vi.hoisted(() => ({
  prismaMock: {
    report: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
  },
  publishQueueMessageMock: vi.fn(),
  createNotificationMock: vi.fn(),
  accessMock: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/lib/rabbitmq.js', () => ({
  publishQueueMessage: publishQueueMessageMock,
}));

vi.mock('../src/services/notifications.service.js', () => ({
  createNotification: createNotificationMock,
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  access: accessMock,
}));

import {
  createReportAndEnqueue,
  getReportDownloadPayload,
  listReportsByUser,
  processReportJob,
  regenerateFailedReport,
} from '../src/services/reports.service.js';

function buildReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-1',
    userId: 'user-1',
    name: 'March 2026 Monthly Report',
    month: 3,
    year: 2026,
    status: 'PENDING',
    fileUrl: null,
    errorMessage: null,
    createdAt: new Date('2026-03-08T10:00:00.000Z'),
    updatedAt: new Date('2026-03-08T10:00:00.000Z'),
    ...overrides,
  };
}

describe('reports service', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    publishQueueMessageMock.mockResolvedValue(undefined);
    createNotificationMock.mockResolvedValue(undefined);
    accessMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('create report persists canonical month/year and queues generation', async () => {
    prismaMock.report.create.mockResolvedValueOnce(
      buildReport({
        id: 'report-created',
        month: 2,
        year: 2026,
        status: 'PENDING',
      }),
    );

    const report = await createReportAndEnqueue('user-1', {
      month: 2,
      year: 2026,
      name: 'February Report',
    });

    expect(prismaMock.report.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'February Report',
        month: 2,
        year: 2026,
        status: 'PENDING',
        fileUrl: null,
        errorMessage: null,
      },
    });
    expect(publishQueueMessageMock).toHaveBeenCalledWith(expect.any(String), {
      reportId: 'report-created',
      userId: 'user-1',
      month: 2,
      year: 2026,
    });
    expect(report.id).toBe('report-created');
  });

  test('list reports supports server-side status/month/year filtering', async () => {
    prismaMock.report.findMany.mockResolvedValueOnce([]);

    await listReportsByUser('user-1', {
      status: 'FAILED',
      month: 3,
      year: 2026,
    });

    expect(prismaMock.report.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'FAILED',
        month: 3,
        year: 2026,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  });

  test('enqueue failure marks report as FAILED with persisted errorMessage', async () => {
    prismaMock.report.create.mockResolvedValueOnce(buildReport({ id: 'report-queue-fail' }));
    publishQueueMessageMock.mockRejectedValueOnce(new Error('rabbit unavailable'));

    await expect(
      createReportAndEnqueue('user-1', {
        month: 3,
        year: 2026,
      }),
    ).rejects.toMatchObject({
      message: 'Failed to enqueue report generation.',
      statusCode: 503,
    });

    expect(prismaMock.report.update).toHaveBeenCalledWith({
      where: { id: 'report-queue-fail' },
      data: {
        status: 'FAILED',
        errorMessage: 'Failed to enqueue report generation.',
      },
    });
  });

  test('worker failure persists report errorMessage and emits report-failed notification', async () => {
    vi.useFakeTimers();
    prismaMock.report.findFirst.mockResolvedValueOnce(
      buildReport({
        id: 'report-worker-fail',
        status: 'PENDING',
      }),
    );
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.transaction.findMany.mockResolvedValueOnce([]);

    const promise = processReportJob({
      reportId: 'report-worker-fail',
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
      where: { id: 'report-worker-fail' },
      data: {
        status: 'FAILED',
        errorMessage: 'User for report generation was not found.',
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

  test('download payload enforces ownership', async () => {
    prismaMock.report.findFirst.mockResolvedValueOnce(null);

    await expect(getReportDownloadPayload('user-1', 'report-other-user')).rejects.toMatchObject({
      message: 'Report not found.',
      statusCode: 404,
    });
  });

  test('download payload returns safe error when completed file is missing', async () => {
    prismaMock.report.findFirst.mockResolvedValueOnce(
      buildReport({
        id: 'report-completed-missing',
        status: 'COMPLETED',
        fileUrl: '/reports/missing.pdf',
      }),
    );
    accessMock.mockRejectedValueOnce(new Error('ENOENT'));

    await expect(getReportDownloadPayload('user-1', 'report-completed-missing')).rejects.toMatchObject({
      message: 'Report file is no longer available. Please regenerate the report.',
      statusCode: 404,
    });
  });

  test('regenerate failed report creates new pending report and enqueues job', async () => {
    prismaMock.report.findFirst
      .mockResolvedValueOnce(
        buildReport({
          id: 'report-failed',
          status: 'FAILED',
          month: 3,
          year: 2026,
          name: 'March 2026 Monthly Report',
        }),
      )
      .mockResolvedValueOnce(null);
    prismaMock.report.create.mockResolvedValueOnce(
      buildReport({
        id: 'report-regenerated',
        status: 'PENDING',
      }),
    );

    const regenerated = await regenerateFailedReport('user-1', 'report-failed');

    expect(prismaMock.report.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        userId: 'user-1',
        status: 'PENDING',
        month: 3,
        year: 2026,
      },
      select: { id: true },
    });
    expect(regenerated.id).toBe('report-regenerated');
    expect(publishQueueMessageMock).toHaveBeenCalledWith(expect.any(String), {
      reportId: 'report-regenerated',
      userId: 'user-1',
      month: 3,
      year: 2026,
    });
  });

  test('regenerate blocks obvious duplicate pending report for same period', async () => {
    prismaMock.report.findFirst
      .mockResolvedValueOnce(
        buildReport({
          id: 'report-failed',
          status: 'FAILED',
          month: 3,
          year: 2026,
        }),
      )
      .mockResolvedValueOnce({ id: 'pending-3-2026' });

    await expect(regenerateFailedReport('user-1', 'report-failed')).rejects.toMatchObject({
      message: 'A pending report already exists for this period.',
      statusCode: 409,
    });

    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });
});
