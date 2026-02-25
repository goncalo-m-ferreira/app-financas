import { type Prisma, type TransactionType } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

export type ListTransactionsFilters = {
  type?: TransactionType;
  categoryId?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
  take?: number;
  skip?: number;
};

export type CreateTransactionInput = {
  type: TransactionType;
  amount: number;
  description?: string;
  transactionDate: Date;
  categoryId?: string;
};

export type UpdateTransactionInput = {
  type?: TransactionType;
  amount?: number;
  description?: string | null;
  transactionDate?: Date;
  categoryId?: string | null;
};

type TransactionWithCategory = Prisma.TransactionGetPayload<{
  include: {
    category: {
      select: {
        id: true;
        name: true;
        color: true;
        icon: true;
      };
    };
  };
}>;

type TransactionResponse = Omit<TransactionWithCategory, 'amount'> & {
  amount: string;
};

function toTransactionResponse(transaction: TransactionWithCategory): TransactionResponse {
  return {
    ...transaction,
    amount: transaction.amount.toString(),
  };
}

async function ensureUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError('Utilizador não encontrado.', 404);
  }
}

async function ensureCategoryBelongsToUser(userId: string, categoryId: string): Promise<void> {
  const category = await prisma.expenseCategory.findUnique({
    where: {
      userId_id: {
        userId,
        id: categoryId,
      },
    },
    select: { id: true },
  });

  if (!category) {
    throw new AppError('Categoria de despesa não encontrada para este utilizador.', 404);
  }
}

async function getTransactionOrThrow(
  userId: string,
  transactionId: string,
): Promise<TransactionWithCategory> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId,
    },
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

  if (!transaction) {
    throw new AppError('Transação não encontrada.', 404);
  }

  return transaction;
}

function buildTransactionsFilter(
  userId: string,
  filters: ListTransactionsFilters,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.from || filters.to) {
    where.transactionDate = {};

    if (filters.from) {
      where.transactionDate.gte = filters.from;
    }

    if (filters.to) {
      where.transactionDate.lte = filters.to;
    }
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {};

    if (filters.minAmount !== undefined) {
      where.amount.gte = filters.minAmount;
    }

    if (filters.maxAmount !== undefined) {
      where.amount.lte = filters.maxAmount;
    }
  }

  return where;
}

export async function listTransactionsByUser(
  userId: string,
  filters: ListTransactionsFilters,
): Promise<TransactionResponse[]> {
  await ensureUserExists(userId);

  if (filters.categoryId) {
    await ensureCategoryBelongsToUser(userId, filters.categoryId);
  }

  const transactions = await prisma.transaction.findMany({
    where: buildTransactionsFilter(userId, filters),
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
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    take: filters.take,
    skip: filters.skip,
  });

  return transactions.map(toTransactionResponse);
}

export async function getTransactionById(
  userId: string,
  transactionId: string,
): Promise<TransactionResponse> {
  await ensureUserExists(userId);
  const transaction = await getTransactionOrThrow(userId, transactionId);
  return toTransactionResponse(transaction);
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
): Promise<TransactionResponse> {
  await ensureUserExists(userId);

  const categoryId = input.categoryId ?? null;

  if (input.type === 'EXPENSE' && !categoryId) {
    throw new AppError('categoryId é obrigatório para transações do tipo EXPENSE.', 400);
  }

  if (categoryId) {
    await ensureCategoryBelongsToUser(userId, categoryId);
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      transactionDate: input.transactionDate,
      categoryId,
    },
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

  return toTransactionResponse(transaction);
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput,
): Promise<TransactionResponse> {
  await ensureUserExists(userId);

  const currentTransaction = await getTransactionOrThrow(userId, transactionId);

  const nextType = input.type ?? currentTransaction.type;
  let nextCategoryId =
    input.categoryId !== undefined ? input.categoryId : currentTransaction.categoryId;

  if (input.type === 'INCOME' && input.categoryId === undefined) {
    nextCategoryId = null;
  }

  if (nextType === 'EXPENSE' && !nextCategoryId) {
    throw new AppError('categoryId é obrigatório para transações do tipo EXPENSE.', 400);
  }

  if (nextCategoryId) {
    await ensureCategoryBelongsToUser(userId, nextCategoryId);
  }

  const data: Prisma.TransactionUncheckedUpdateInput = {};

  if (input.type !== undefined) {
    data.type = input.type;
  }

  if (input.amount !== undefined) {
    data.amount = input.amount;
  }

  if (input.description !== undefined) {
    data.description = input.description;
  }

  if (input.transactionDate !== undefined) {
    data.transactionDate = input.transactionDate;
  }

  if (input.categoryId !== undefined || input.type !== undefined) {
    data.categoryId = nextCategoryId;
  }

  const updatedTransaction = await prisma.transaction.update({
    where: { id: transactionId },
    data,
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

  return toTransactionResponse(updatedTransaction);
}

export async function deleteTransaction(
  userId: string,
  transactionId: string,
): Promise<TransactionResponse> {
  await ensureUserExists(userId);
  await getTransactionOrThrow(userId, transactionId);

  const deletedTransaction = await prisma.transaction.delete({
    where: { id: transactionId },
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

  return toTransactionResponse(deletedTransaction);
}
