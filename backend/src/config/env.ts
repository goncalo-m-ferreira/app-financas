import dotenv from 'dotenv';

dotenv.config();

type SameSiteValue = 'lax' | 'strict' | 'none';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

function parseSameSite(value: string | undefined, fallback: SameSiteValue): SameSiteValue {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
    return normalized;
  }

  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const parsedPort = Number(process.env.PORT ?? '4000');
const nodeEnv = process.env.NODE_ENV ?? 'development';
const rawJwtSecret = process.env.JWT_SECRET?.trim();

if (nodeEnv === 'production') {
  if (!rawJwtSecret) {
    throw new Error('JWT_SECRET must be set in production.');
  }

  if (rawJwtSecret.length < 32) {
    throw new Error('JWT_SECRET must have at least 32 characters in production.');
  }
}

const jwtSecret = rawJwtSecret || 'dev-only-change-me';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
const rabbitMqUrl = process.env.AMQP_URL ?? 'amqp://localhost';
const reportsQueueName = process.env.REPORTS_QUEUE_NAME ?? 'pdf_reports_queue';
const googleClientId =
  process.env.GOOGLE_CLIENT_ID ??
  '84485673553-br2mf821lbd9qfpqmjqlkm3c54g4uijj.apps.googleusercontent.com';
const fallbackDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/app_financas?schema=public';
const databaseUrl = process.env.DATABASE_URL ?? fallbackDatabaseUrl;
const authCookieName = process.env.AUTH_COOKIE_NAME?.trim() || 'app_financas_session';
const csrfCookieName = process.env.CSRF_COOKIE_NAME?.trim() || 'app_financas_csrf';
const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || undefined;
const cookieSecure = parseBoolean(process.env.COOKIE_SECURE, nodeEnv === 'production');
const cookieSameSite = parseSameSite(process.env.COOKIE_SAMESITE, 'lax');
const trustProxy = parseBoolean(process.env.TRUST_PROXY, false);

if (cookieSameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SECURE=true is required when COOKIE_SAMESITE=none.');
}

const recurringWorkerEnabled = parseBoolean(process.env.RECURRING_WORKER_ENABLED, false);
const recurringWorkerIntervalMs = parsePositiveInt(process.env.RECURRING_WORKER_INTERVAL_MS, 60_000);
const recurringRetryBackoffMs = parsePositiveInt(process.env.RECURRING_RETRY_BACKOFF_MS, 300_000);
process.env.DATABASE_URL = databaseUrl;

export const env = {
  nodeEnv,
  port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000,
  jwtSecret,
  jwtExpiresIn,
  rabbitMqUrl,
  reportsQueueName,
  googleClientId,
  databaseUrl,
  authCookieName,
  csrfCookieName,
  cookieDomain,
  cookieSecure,
  cookieSameSite,
  trustProxy,
  recurringWorkerEnabled,
  recurringWorkerIntervalMs,
  recurringRetryBackoffMs,
};
