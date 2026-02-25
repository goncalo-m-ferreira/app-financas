import type { SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Prisma, type User } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

const SALT_ROUNDS = 12;

type SafeUser = Omit<User, 'passwordHash'>;

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  defaultCurrency?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  user: SafeUser;
};

type DefaultCategory = {
  name: string;
  color: string;
  icon: string;
};

const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { name: 'BILLS', color: '#60a5fa', icon: 'receipt' },
  { name: 'CLOUD DRIVE', color: '#a78bfa', icon: 'cloud' },
  { name: 'SUBSCRIPTION', color: '#818cf8', icon: 'repeat' },
  { name: 'TRANSPORT', color: '#fb923c', icon: 'train' },
  { name: 'GROCERIES', color: '#34d399', icon: 'shopping-basket' },
  { name: 'SHOPPING', color: '#fbbf24', icon: 'shopping-bag' },
  { name: 'DINING', color: '#f87171', icon: 'utensils' },
  { name: 'HEALTH', color: '#22c55e', icon: 'heart-pulse' },
];

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    defaultCurrency: user.defaultCurrency,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function throwConflictIfUniqueViolation(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(message, 409);
  }

  throw error;
}

function createAccessToken(user: SafeUser): string {
  const signOptions: SignOptions = {
    subject: user.id,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign({ email: user.email }, env.jwtSecret, signOptions);
}

// TODO(auth): Integrar login federado com Google OAuth2 (Google API) para SSO.
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          defaultCurrency: input.defaultCurrency ?? 'EUR',
        },
      });

      await tx.expenseCategory.createMany({
        data: DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
          userId: createdUser.id,
          name: category.name,
          color: category.color,
          icon: category.icon,
        })),
      });

      return createdUser;
    });

    const safeUser = toSafeUser(user);

    return {
      token: createAccessToken(safeUser),
      user: safeUser,
    };
  } catch (error) {
    throwConflictIfUniqueViolation(error, 'Já existe um utilizador com este email.');
  }
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError('Credenciais inválidas.', 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError('Credenciais inválidas.', 401);
  }

  const safeUser = toSafeUser(user);

  return {
    token: createAccessToken(safeUser),
    user: safeUser,
  };
}

export async function getAuthenticatedUser(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('Utilizador autenticado não encontrado.', 404);
  }

  return toSafeUser(user);
}
