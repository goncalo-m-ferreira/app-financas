import type { SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { Prisma, type User } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

const SALT_ROUNDS = 12;
const googleOAuthClient = new OAuth2Client(env.googleClientId);

type SafeUser = {
  id: string;
  name: string;
  email: string;
  defaultCurrency: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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

type GoogleLoginInput = {
  credential: string;
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

type DefaultWallet = {
  name: string;
  color: string;
  balance: string;
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

const DEFAULT_WALLETS: DefaultWallet[] = [
  { name: 'Personal Wallet', color: '#0ea5e9', balance: '0.00' },
];

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    defaultCurrency: user.defaultCurrency,
    avatarUrl: user.avatarUrl,
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

async function createDefaultUserResources(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
      userId,
      name: category.name,
      color: category.color,
      icon: category.icon,
    })),
  });

  await tx.wallet.createMany({
    data: DEFAULT_WALLETS.map((wallet) => ({
      userId,
      name: wallet.name,
      color: wallet.color,
      balance: new Prisma.Decimal(wallet.balance),
    })),
  });
}

function resolveGoogleProfileOrThrow(payload: TokenPayload | undefined): {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
} {
  if (!payload?.sub) {
    throw new AppError('Token Google inválido: sub ausente.', 401);
  }

  if (!payload.email) {
    throw new AppError('Token Google inválido: email ausente.', 401);
  }

  if (payload.email_verified === false) {
    throw new AppError('O email da conta Google não está verificado.', 401);
  }

  const email = payload.email.trim().toLowerCase();
  const fallbackName = email.split('@')[0] || 'Google User';
  const name = payload.name?.trim() || payload.given_name?.trim() || fallbackName;
  const avatarUrl =
    typeof payload.picture === 'string' && payload.picture.trim().length > 0
      ? payload.picture.trim()
      : null;

  return {
    googleId: payload.sub,
    email,
    name,
    avatarUrl,
  };
}

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

      await createDefaultUserResources(tx, createdUser.id);

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

  if (!user.passwordHash) {
    throw new AppError('Esta conta usa login com Google. Use o botão "Google".', 401);
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

export async function loginWithGoogle(input: GoogleLoginInput): Promise<AuthResponse> {
  let payload: TokenPayload | undefined;

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: input.credential,
      audience: env.googleClientId,
    });

    payload = ticket.getPayload();
  } catch {
    throw new AppError('Credencial Google inválida ou expirada.', 401);
  }

  const googleProfile = resolveGoogleProfileOrThrow(payload);

  const user = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: googleProfile.email },
    });

    if (!existingUser) {
      const createdUser = await tx.user.create({
        data: {
          name: googleProfile.name,
          email: googleProfile.email,
          passwordHash: null,
          googleId: googleProfile.googleId,
          avatarUrl: googleProfile.avatarUrl,
          defaultCurrency: 'EUR',
        },
      });

      await createDefaultUserResources(tx, createdUser.id);
      return createdUser;
    }

    if (existingUser.googleId && existingUser.googleId !== googleProfile.googleId) {
      throw new AppError(
        'Esta conta já está associada a outro Google account. Use o método de login original.',
        401,
      );
    }

    let shouldUpdate = false;
    const updateData: Prisma.UserUpdateInput = {};

    if (!existingUser.googleId) {
      updateData.googleId = googleProfile.googleId;
      shouldUpdate = true;
    }

    if (googleProfile.avatarUrl && googleProfile.avatarUrl !== existingUser.avatarUrl) {
      updateData.avatarUrl = googleProfile.avatarUrl;
      shouldUpdate = true;
    }

    if (!shouldUpdate) {
      return existingUser;
    }

    return tx.user.update({
      where: { id: existingUser.id },
      data: updateData,
    });
  });

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
