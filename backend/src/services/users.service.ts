import { Prisma, type User } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

type PaginationOptions = {
  take?: number;
  skip?: number;
};

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  defaultCurrency?: string;
};

export type UpdateUserInput = Partial<CreateUserInput>;
export type UpdateMyProfileInput = {
  name: string;
  defaultCurrency: string;
};

type SafeUser = Omit<User, 'passwordHash'>;

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    googleId: user.googleId,
    avatarUrl: user.avatarUrl,
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

export async function listUsers(options: PaginationOptions): Promise<SafeUser[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: options.take,
    skip: options.skip,
  });

  return users.map(toSafeUser);
}

export async function getUserById(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('Utilizador não encontrado.', 404);
  }

  return toSafeUser(user);
}

export async function createUser(input: CreateUserInput): Promise<SafeUser> {
  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        defaultCurrency: input.defaultCurrency ?? 'EUR',
      },
    });

    return toSafeUser(user);
  } catch (error) {
    throwConflictIfUniqueViolation(error, 'Já existe um utilizador com este email.');
  }
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<SafeUser> {
  await getUserById(userId);

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: input,
    });

    return toSafeUser(user);
  } catch (error) {
    throwConflictIfUniqueViolation(error, 'Já existe um utilizador com este email.');
  }
}

export async function deleteUser(userId: string): Promise<SafeUser> {
  await getUserById(userId);

  const deletedUser = await prisma.user.delete({
    where: { id: userId },
  });

  return toSafeUser(deletedUser);
}

export async function updateMyProfile(
  userId: string,
  input: UpdateMyProfileInput,
): Promise<SafeUser> {
  await getUserById(userId);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      defaultCurrency: input.defaultCurrency,
    },
  });

  return toSafeUser(user);
}

export async function deleteMyAccount(userId: string): Promise<void> {
  await getUserById(userId);

  await prisma.user.delete({
    where: { id: userId },
  });
}
