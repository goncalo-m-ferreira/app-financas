import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    expenseCategory: {
      findUnique: vi.fn(),
    },
    budget: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { deleteBudget, updateBudget } from '../src/services/budgets.service.js';

function buildBudget(overrides: Record<string, unknown> = {}) {
  return {
    id: 'budget-1',
    userId: 'user-1',
    categoryId: 'category-1',
    amount: new Prisma.Decimal('100.00'),
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    updatedAt: new Date('2026-03-01T10:00:00.000Z'),
    category: {
      id: 'category-1',
      name: 'Bills',
      color: '#111111',
      icon: null,
    },
    ...overrides,
  };
}

describe('budgets service', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('updates budget amount and returns overview item with canonical spending fields', async () => {
    prismaMock.budget.findUnique.mockResolvedValueOnce(buildBudget());
    prismaMock.budget.update.mockResolvedValueOnce(
      buildBudget({
        amount: new Prisma.Decimal('150.00'),
        updatedAt: new Date('2026-03-08T12:00:00.000Z'),
      }),
    );
    prismaMock.transaction.aggregate.mockResolvedValueOnce({
      _sum: {
        amount: new Prisma.Decimal('75.50'),
      },
    });

    const result = await updateBudget('user-1', 'budget-1', {
      amount: 150,
    });

    expect(prismaMock.budget.update).toHaveBeenCalledWith({
      where: { id: 'budget-1' },
      data: { amount: 150 },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    expect(result.amount).toBe('150.00');
    expect(result.spentThisMonth).toBe('75.50');
    expect(result.remaining).toBe('74.50');
    expect(result.usageRatio).toBe(0.5033);
  });

  test('deletes budget and returns overview item while leaving spending history intact', async () => {
    prismaMock.budget.findUnique.mockResolvedValueOnce(buildBudget());
    prismaMock.budget.delete.mockResolvedValueOnce(buildBudget());
    prismaMock.transaction.aggregate.mockResolvedValueOnce({
      _sum: {
        amount: new Prisma.Decimal('120.00'),
      },
    });

    const result = await deleteBudget('user-1', 'budget-1');

    expect(prismaMock.budget.delete).toHaveBeenCalledWith({
      where: { id: 'budget-1' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    expect(result.amount).toBe('100.00');
    expect(result.spentThisMonth).toBe('120.00');
    expect(result.remaining).toBe('-20.00');
    expect(result.usageRatio).toBe(1.2);
  });

  test('rejects budget update when budget does not exist for the user', async () => {
    prismaMock.budget.findUnique.mockResolvedValueOnce(null);

    await expect(
      updateBudget('user-1', 'missing-budget', {
        amount: 90,
      }),
    ).rejects.toMatchObject({
      message: 'Orçamento não encontrado.',
      statusCode: 404,
    });

    expect(prismaMock.budget.update).not.toHaveBeenCalled();
  });

  test('rejects budget delete when budget belongs to another user', async () => {
    prismaMock.budget.findUnique.mockResolvedValueOnce(
      buildBudget({
        userId: 'user-2',
      }),
    );

    await expect(deleteBudget('user-1', 'budget-1')).rejects.toMatchObject({
      message: 'Orçamento não encontrado.',
      statusCode: 404,
    });

    expect(prismaMock.budget.delete).not.toHaveBeenCalled();
  });
});
