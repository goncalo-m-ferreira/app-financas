import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import { getAuthUserIdOrThrow } from './auth.js';
import type { AuthenticatedRequest } from '../types/http.js';

export function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  let authUserId: string;

  try {
    authUserId = getAuthUserIdOrThrow(req);
  } catch (error) {
    next(error);
    return;
  }

  void prisma.user
    .findUnique({
      where: { id: authUserId },
      select: {
        role: true,
      },
    })
    .then((user) => {
      if (!user) {
        throw new AppError('Utilizador autenticado não encontrado.', 401);
      }

      if (user.role !== 'ADMIN') {
        throw new AppError('Acesso restrito a administradores.', 403);
      }

      next();
    })
    .catch((error: unknown) => {
      next(error);
    });
}
