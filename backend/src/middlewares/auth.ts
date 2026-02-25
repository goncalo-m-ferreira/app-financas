import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import type { AuthenticatedRequest } from '../types/http.js';

type TokenPayload = {
  sub?: string;
  email?: string;
};

function extractBearerToken(headerValue: string | undefined): string {
  if (!headerValue) {
    throw new AppError('Token de autenticação em falta.', 401);
  }

  const [scheme, token] = headerValue.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Formato de Authorization inválido. Use: Bearer <token>.', 401);
  }

  return token;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req.header('authorization'));

  try {
    const decodedToken = jwt.verify(token, env.jwtSecret) as TokenPayload;

    if (!decodedToken.sub) {
      throw new AppError('Token inválido: sub ausente.', 401);
    }

    req.authUserId = decodedToken.sub;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError('Token inválido ou expirado.', 401));
  }
}

export function getAuthUserIdOrThrow(req: AuthenticatedRequest): string {
  if (!req.authUserId) {
    throw new AppError('Utilizador não autenticado.', 401);
  }

  return req.authUserId;
}
