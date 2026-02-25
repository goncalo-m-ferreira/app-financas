import { Prisma, type ExpenseCategory } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

export type CreateExpenseCategoryInput = {
  name: string;
  color?: string;
  icon?: string;
};

export type UpdateExpenseCategoryInput = {
  name?: string;
  color?: string;
  icon?: string | null;
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

async function getCategoryOrThrow(userId: string, categoryId: string): Promise<ExpenseCategory> {
  const category = await prisma.expenseCategory.findUnique({
    where: {
      userId_id: {
        userId,
        id: categoryId,
      },
    },
  });

  if (!category) {
    throw new AppError('Categoria de despesa não encontrada.', 404);
  }

  return category;
}

function throwConflictIfUniqueViolation(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(message, 409);
  }

  throw error;
}

export async function listExpenseCategoriesByUser(userId: string): Promise<ExpenseCategory[]> {
  await ensureUserExists(userId);

  return prisma.expenseCategory.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
}

export async function getExpenseCategoryById(
  userId: string,
  categoryId: string,
): Promise<ExpenseCategory> {
  await ensureUserExists(userId);
  return getCategoryOrThrow(userId, categoryId);
}

export async function createExpenseCategory(
  userId: string,
  input: CreateExpenseCategoryInput,
): Promise<ExpenseCategory> {
  await ensureUserExists(userId);

  try {
    return await prisma.expenseCategory.create({
      data: {
        userId,
        name: input.name,
        color: input.color,
        icon: input.icon,
      },
    });
  } catch (error) {
    throwConflictIfUniqueViolation(error, 'Já existe uma categoria com este nome para o utilizador.');
  }
}

export async function updateExpenseCategory(
  userId: string,
  categoryId: string,
  input: UpdateExpenseCategoryInput,
): Promise<ExpenseCategory> {
  await ensureUserExists(userId);
  await getCategoryOrThrow(userId, categoryId);

  try {
    return await prisma.expenseCategory.update({
      where: {
        userId_id: {
          userId,
          id: categoryId,
        },
      },
      data: {
        ...input,
      },
    });
  } catch (error) {
    throwConflictIfUniqueViolation(error, 'Já existe uma categoria com este nome para o utilizador.');
  }
}

export async function deleteExpenseCategory(
  userId: string,
  categoryId: string,
): Promise<ExpenseCategory> {
  await ensureUserExists(userId);
  await getCategoryOrThrow(userId, categoryId);

  return prisma.expenseCategory.delete({
    where: {
      userId_id: {
        userId,
        id: categoryId,
      },
    },
  });
}
