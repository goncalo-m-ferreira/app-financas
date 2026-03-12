import type { NextFunction, Request, Response } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
  maxBuckets?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_CLEANUP_INTERVAL = 500;
const DEFAULT_MAX_BUCKETS = 10_000;

function resolveClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function removeExpiredBuckets(buckets: Map<string, Bucket>, now: number): void {
  for (const [bucketKey, bucketValue] of buckets.entries()) {
    if (bucketValue.resetAt <= now) {
      buckets.delete(bucketKey);
    }
  }
}

function evictOldestBucket(buckets: Map<string, Bucket>): void {
  let oldestKey: string | null = null;
  let oldestResetAt = Number.POSITIVE_INFINITY;

  for (const [bucketKey, bucketValue] of buckets.entries()) {
    if (bucketValue.resetAt < oldestResetAt) {
      oldestResetAt = bucketValue.resetAt;
      oldestKey = bucketKey;
    }
  }

  if (oldestKey) {
    buckets.delete(oldestKey);
  }
}

export function createIpRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const maxBuckets = Math.max(1, options.maxBuckets ?? DEFAULT_MAX_BUCKETS);
  let requestsSinceCleanup = 0;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = options.keyGenerator?.(req) ?? resolveClientIp(req);

    if (!buckets.has(key) && buckets.size >= maxBuckets) {
      removeExpiredBuckets(buckets, now);
      if (buckets.size >= maxBuckets) {
        evictOldestBucket(buckets);
      }
    }

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
      removeExpiredBuckets(buckets, now);
    }

    next();
  };
}
