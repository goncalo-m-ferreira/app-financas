import type { NextFunction, Request, Response } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_CLEANUP_INTERVAL = 500;

function resolveClientIp(req: Request): string {
  const forwardedFor = req.header('x-forwarded-for');

  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function createIpRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  let requestsSinceCleanup = 0;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = options.keyGenerator?.(req) ?? resolveClientIp(req);
    const current = buckets.get(key);
    const isExpired = !current || current.resetAt <= now;

    const bucket: Bucket = isExpired
      ? { count: 0, resetAt: now + options.windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(options.max - bucket.count, 0);
    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);

    res.setHeader('x-ratelimit-limit', String(options.max));
    res.setHeader('x-ratelimit-remaining', String(remaining));
    res.setHeader('x-ratelimit-reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.setHeader('retry-after', String(retryAfterSeconds));
      res.status(429).json({
        message: options.message,
      });
      return;
    }

    requestsSinceCleanup += 1;

    if (requestsSinceCleanup >= DEFAULT_CLEANUP_INTERVAL) {
      requestsSinceCleanup = 0;

      for (const [bucketKey, bucketValue] of buckets.entries()) {
        if (bucketValue.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    next();
  };
}
