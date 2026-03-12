import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createIpRateLimiter } from '../src/middlewares/rate-limit.js';

type MutableResponse = Response & {
  body?: unknown;
  headers: Record<string, string>;
  statusCode?: number;
};

function createMockRequest(input?: {
  ip?: string;
  remoteAddress?: string | null;
  headers?: Record<string, string>;
}): Request {
  const headerMap = new Map<string, string>();
  const headers = input?.headers ?? {};

  for (const [key, value] of Object.entries(headers)) {
    headerMap.set(key.toLowerCase(), value);
  }

  return {
    ip: input?.ip ?? '198.51.100.10',
    socket: {
      remoteAddress: input?.remoteAddress ?? input?.ip ?? '198.51.100.10',
    },
    header: (name: string) => headerMap.get(name.toLowerCase()),
  } as Request;
}

function createMockResponse(): MutableResponse {
  const response = {
    headers: {},
    setHeader: vi.fn((name: string, value: string) => {
      response.headers[name.toLowerCase()] = String(value);
    }),
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response as Response;
    }),
    json: vi.fn((payload: unknown) => {
      response.body = payload;
      return response as Response;
    }),
  } as MutableResponse;

  return response;
}

function executeLimiter(
  limiter: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
) {
  const res = createMockResponse();
  const next = vi.fn();
  limiter(req, res, next);
  return { res, next };
}

describe('createIpRateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('ignores spoofed x-forwarded-for when using default key resolution', () => {
    const limiter = createIpRateLimiter({
      windowMs: 60_000,
      max: 1,
      message: 'Too many requests.',
    });

    const first = executeLimiter(
      limiter,
      createMockRequest({
        ip: '203.0.113.10',
        headers: {
          'x-forwarded-for': '1.1.1.1',
        },
      }),
    );
    const second = executeLimiter(
      limiter,
      createMockRequest({
        ip: '203.0.113.10',
        headers: {
          'x-forwarded-for': '8.8.8.8',
        },
      }),
    );

    expect(first.next).toHaveBeenCalledTimes(1);
    expect(second.next).not.toHaveBeenCalled();
    expect(second.res.status).toHaveBeenCalledWith(429);
    expect(second.res.body).toEqual({
      message: 'Too many requests.',
    });
  });

  test('uses keyGenerator when explicitly provided', () => {
    const limiter = createIpRateLimiter({
      windowMs: 60_000,
      max: 1,
      message: 'Too many requests.',
      keyGenerator: (req) => req.header('x-forwarded-for') ?? req.ip,
    });

    const first = executeLimiter(
      limiter,
      createMockRequest({
        ip: '203.0.113.11',
        headers: {
          'x-forwarded-for': '1.1.1.1',
        },
      }),
    );
    const second = executeLimiter(
      limiter,
      createMockRequest({
        ip: '203.0.113.11',
        headers: {
          'x-forwarded-for': '8.8.8.8',
        },
      }),
    );

    expect(first.next).toHaveBeenCalledTimes(1);
    expect(second.next).toHaveBeenCalledTimes(1);
    expect(second.res.status).not.toHaveBeenCalled();
  });

  test('bounds memory by evicting the oldest active bucket when full', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T12:00:00.000Z'));

    const limiter = createIpRateLimiter({
      windowMs: 60_000,
      max: 1,
      maxBuckets: 2,
      message: 'Too many requests.',
    });

    const firstA = executeLimiter(limiter, createMockRequest({ ip: '198.51.100.1' }));
    vi.advanceTimersByTime(1);
    const firstB = executeLimiter(limiter, createMockRequest({ ip: '198.51.100.2' }));
    vi.advanceTimersByTime(1);
    const firstC = executeLimiter(limiter, createMockRequest({ ip: '198.51.100.3' }));
    vi.advanceTimersByTime(1);
    const secondA = executeLimiter(limiter, createMockRequest({ ip: '198.51.100.1' }));

    expect(firstA.next).toHaveBeenCalledTimes(1);
    expect(firstB.next).toHaveBeenCalledTimes(1);
    expect(firstC.next).toHaveBeenCalledTimes(1);
    expect(secondA.next).toHaveBeenCalledTimes(1);
    expect(secondA.res.status).not.toHaveBeenCalled();

  });
});
