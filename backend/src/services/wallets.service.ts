import { Prisma, type Wallet } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

export type CreateWalletInput = {
  name: string;
  balance?: number;
  color?: string;
};

export type UpdateWalletInput = {
  name?: string;
  balance?: number;
  color?: string | null;
};

export type WalletResponse = Omit<Wallet, 'balance'> & {
  balance: string;
};

function toWalletResponse(wallet: Wallet): WalletResponse {
  return {
    ...wallet,
    balance: wallet.balance.toFixed(2),
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

async function getWalletOrThrow(userId: string, walletId: string): Promise<Wallet> {
  const wallet = await prisma.wallet.findUnique({
    where: {
      userId_id: {
        userId,
        id: walletId,
      },
    },
  });

  if (!wallet) {
    throw new AppError('Wallet not found.', 404);
  }

  return wallet;
}

function throwConflictIfUniqueViolation(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(message, 409);
  }

  throw error;
}

export async function listWalletsByUser(userId: string): Promise<WalletResponse[]> {
  await ensureUserExists(userId);

  const wallets = await prisma.wallet.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }],
  });

  return wallets.map(toWalletResponse);
}

export async function createWallet(userId: string, input: CreateWalletInput): Promise<WalletResponse> {
  await ensureUserExists(userId);

  try {
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        name: input.name,
        balance: input.balance ?? 0,
        color: input.color,
      },
    });

    return toWalletResponse(wallet);
  } catch (error) {
    throwConflictIfUniqueViolation(error, 'A wallet with this name already exists.');
  }
}

export async function updateWallet(
  userId: string,
  walletId: string,
  input: UpdateWalletInput,
): Promise<WalletResponse> {
  await ensureUserExists(userId);
  await getWalletOrThrow(userId, walletId);

  try {
    const wallet = await prisma.wallet.update({
      where: {
        userId_id: {
          userId,
          id: walletId,
        },
      },
      data: {
        ...input,
      },
    });

    return toWalletResponse(wallet);
  } catch (error) {
    throwConflictIfUniqueViolation(error, 'A wallet with this name already exists.');
  }
}

export async function deleteWallet(userId: string, walletId: string): Promise<WalletResponse> {
  await ensureUserExists(userId);
  await getWalletOrThrow(userId, walletId);

  try {
    const wallet = await prisma.wallet.delete({
      where: {
        userId_id: {
          userId,
          id: walletId,
        },
      },
    });

    return toWalletResponse(wallet);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new AppError(
        'Cannot delete wallet because it is linked to existing transactions.',
        409,
      );
    }

    throw error;
  }
}
