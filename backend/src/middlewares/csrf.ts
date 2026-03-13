import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { readAuthTokenCookie, readCsrfCookie } from '../utils/http-cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function hasBearerAuthorizationHeader(req: Request): boolean {
  const authorizationHeader = req.header('authorization')?.trim();

  if (!authorizationHeader) {
    return false;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  return scheme === 'Bearer' && Boolean(token);
}

export function requireCsrfForCookieSession(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (hasBearerAuthorizationHeader(req)) {
    next();
    return;
  }

  const authCookieToken = readAuthTokenCookie(req);

  if (!authCookieToken) {
    next();
    return;
  }

  const csrfCookieToken = readCsrfCookie(req);
  const csrfHeaderToken = req.header('x-csrf-token')?.trim() ?? '';

  if (!csrfCookieToken || !csrfHeaderToken || csrfCookieToken !== csrfHeaderToken) {
    next(new AppError('Invalid or missing CSRF token.', 403));
    return;
  }

  next();
}
