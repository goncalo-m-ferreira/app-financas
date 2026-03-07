import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    recurringExecution: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    recurringRule: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { getAdminRecurringOperations } from '../src/services/admin.service.js';

describe('admin recurring operations service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T12:00:00.000Z'));

    prismaMock.recurringExecution.count.mockResolvedValue(3);
    prismaMock.recurringRule.count.mockResolvedValue(2);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('returns summary and recent-first merged items', async () => {
    prismaMock.recurringExecution.findMany
      .mockResolvedValueOnce([{ userId: 'user-1' }, { userId: 'user-2' }])
      .mockResolvedValueOnce([
        {
          id: 'exec-1',
          status: 'FAILED',
          scheduledFor: new Date('2026-03-05T09:00:00.000Z'),
          attemptedAt: new Date('2026-03-05T09:02:00.000Z'),
          errorType: 'TRANSIENT',
          errorMessage: 'Temporary timeout',
          createdAt: new Date('2026-03-05T09:03:00.000Z'),
          user: {
            id: 'user-1',
            name: 'User One',
            email: 'user1@app.local',
          },
          rule: {
            id: 'rule-1',
            description: 'Internet',
            type: 'EXPENSE',
            amount: 39.9,
            status: 'ACTIVE',
            pausedReason: null,
            frequency: 'MONTHLY',
            timezone: 'Europe/Lisbon',
            wallet: {
              id: 'wallet-1',
              name: 'Main',
              color: '#0ea5e9',
            },
            category: {
              id: 'cat-1',
              name: 'Bills',
              color: '#111111',
              icon: null,
            },
          },
        },
      ]);

    prismaMock.recurringRule.findMany
      .mockResolvedValueOnce([{ userId: 'user-2' }, { userId: 'user-3' }])
      .mockResolvedValueOnce([
        {
          id: 'rule-2',
          description: 'Gym',
          type: 'EXPENSE',
          amount: 25,
          status: 'PAUSED',
          pausedReason: 'Wallet not found',
          frequency: 'MONTHLY',
          timezone: 'Europe/Lisbon',
          lastFailureAt: new Date('2026-03-06T11:00:00.000Z'),
          updatedAt: new Date('2026-03-06T11:30:00.000Z'),
          user: {
            id: 'user-3',
            name: 'User Three',
            email: 'user3@app.local',
          },
          wallet: {
            id: 'wallet-2',
            name: 'Side',
            color: null,
          },
          category: {
            id: 'cat-2',
            name: 'Health',
            color: null,
            icon: null,
          },
        },
      ]);

    const result = await getAdminRecurringOperations({
      take: 10,
    });

    expect(result.summary).toEqual({
      failedExecutions: 3,
      pausedRules: 2,
      affectedUsers: 3,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].issueType).toBe('PAUSED_RULE');
    expect(result.items[1].issueType).toBe('FAILED_EXECUTION');
    expect(result.items[0].execution).toBeNull();
    expect(result.items[1].execution?.id).toBe('exec-1');
    expect(result.items[1].rule.amount).toBe('39.9');
  });

  test('filters items by PAUSED_RULE while keeping summary', async () => {
    prismaMock.recurringExecution.findMany.mockResolvedValueOnce([{ userId: 'user-1' }]);
    prismaMock.recurringRule.findMany
      .mockResolvedValueOnce([{ userId: 'user-2' }])
      .mockResolvedValueOnce([
        {
          id: 'rule-2',
          description: null,
          type: 'INCOME',
          amount: 100,
          status: 'PAUSED',
          pausedReason: 'Category missing',
          frequency: 'MONTHLY',
          timezone: 'UTC',
          lastFailureAt: null,
          updatedAt: new Date('2026-03-07T10:00:00.000Z'),
          user: {
            id: 'user-2',
            name: 'User Two',
            email: 'user2@app.local',
          },
          wallet: {
            id: 'wallet-2',
            name: 'Main',
            color: null,
          },
          category: null,
        },
      ]);

    const result = await getAdminRecurringOperations({
      take: 5,
      issueType: 'PAUSED_RULE',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].issueType).toBe('PAUSED_RULE');
    expect(result.summary.failedExecutions).toBe(3);
    expect(prismaMock.recurringExecution.findMany).toHaveBeenCalledTimes(1);
  });
});
