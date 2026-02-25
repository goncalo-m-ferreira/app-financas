import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import type { RequestWithId } from '../types/http.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(
  err: unknown,
  req: RequestWithId,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Dados de entrada inválidos.',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      requestId,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
      requestId,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(400).json({
      message: 'Erro de base de dados.',
      details: { code: err.code, meta: err.meta },
      requestId,
    });
  }

  res.status(500).json({
    message: 'Erro interno do servidor.',
    requestId,
  });
}
