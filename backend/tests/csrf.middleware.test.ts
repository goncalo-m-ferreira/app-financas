import type { NextFunction, Request, Response } from 'express';
import { describe, expect, test, vi } from 'vitest';
import { AppError } from '../src/errors/app-error.js';
import { requireCsrfForCookieSession } from '../src/middlewares/csrf.js';

function createMockRequest(input: {
  method: string;
  headers?: Record<string, string>;
}): Request {
  const headers = new Map<string, string>();

  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers.set(name.toLowerCase(), value);
  }

  return {
    method: input.method,
    header: (name: string) => headers.get(name.toLowerCase()),
  } as Request;
}

function executeMiddleware(req: Request): { next: NextFunction } {
  const next = vi.fn() as NextFunction;
  requireCsrfForCookieSession(req, {} as Response, next);
  return { next };
}

describe('requireCsrfForCookieSession', () => {
  test('allows safe methods without CSRF validation', () => {
    const { next } = executeMiddleware(
      createMockRequest({
        method: 'GET',
        headers: {
          cookie: 'app_financas_session=session-token',
        },
      }),
    );

    expect(next).toHaveBeenCalledWith();
  });

  test('skips CSRF when request uses Authorization Bearer token', () => {
    const { next } = executeMiddleware(
      createMockRequest({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer jwt.header.signature',
          cookie: 'app_financas_session=session-token',
        },
      }),
    );

    expect(next).toHaveBeenCalledWith();
  });

  test('rejects unsafe cookie-authenticated request with missing CSRF header', () => {
    const { next } = executeMiddleware(
      createMockRequest({
        method: 'DELETE',
        headers: {
          cookie: 'app_financas_session=session-token; app_financas_csrf=csrf-token',
        },
      }),
    );

    const [[error]] = vi.mocked(next).mock.calls as [[unknown]];
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).message).toBe('Invalid or missing CSRF token.');
    expect((error as AppError).statusCode).toBe(403);
  });

  test('allows unsafe cookie-authenticated request without CSRF when origin is allowlisted', () => {
    const { next } = executeMiddleware(
      createMockRequest({
        method: 'DELETE',
        headers: {
          cookie: 'app_financas_session=session-token',
          origin: 'http://localhost:5173',
        },
      }),
    );

    expect(next).toHaveBeenCalledWith();
  });

  test('rejects unsafe cookie-authenticated request without CSRF from non-allowlisted origin', () => {
    const { next } = executeMiddleware(
      createMockRequest({
        method: 'DELETE',
        headers: {
          cookie: 'app_financas_session=session-token',
          origin: 'https://evil.example.com',
        },
      }),
    );

    const [[error]] = vi.mocked(next).mock.calls as [[unknown]];
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).message).toBe('Invalid or missing CSRF token.');
    expect((error as AppError).statusCode).toBe(403);
  });

  test('allows unsafe cookie-authenticated request when CSRF cookie and header match', () => {
    const { next } = executeMiddleware(
      createMockRequest({
        method: 'DELETE',
        headers: {
          cookie: 'app_financas_session=session-token; app_financas_csrf=csrf-token',
          'x-csrf-token': 'csrf-token',
        },
      }),
    );

    expect(next).toHaveBeenCalledWith();
  });
});
