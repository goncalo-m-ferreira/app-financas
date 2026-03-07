import dotenv from 'dotenv';

dotenv.config();

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const parsedPort = Number(process.env.PORT ?? '4000');
const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-change-me';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
const rabbitMqUrl = process.env.AMQP_URL ?? 'amqp://localhost';
const reportsQueueName = process.env.REPORTS_QUEUE_NAME ?? 'pdf_reports_queue';
const googleClientId =
  process.env.GOOGLE_CLIENT_ID ??
  '84485673553-br2mf821lbd9qfpqmjqlkm3c54g4uijj.apps.googleusercontent.com';
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || undefined;
const fallbackDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/app_financas?schema=public';
const databaseUrl = process.env.DATABASE_URL ?? fallbackDatabaseUrl;
const recurringWorkerEnabled = parseBoolean(process.env.RECURRING_WORKER_ENABLED, false);
const recurringWorkerIntervalMs = parsePositiveInt(process.env.RECURRING_WORKER_INTERVAL_MS, 60_000);
const recurringRetryBackoffMs = parsePositiveInt(process.env.RECURRING_RETRY_BACKOFF_MS, 300_000);
process.env.DATABASE_URL = databaseUrl;

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000,
  jwtSecret,
  jwtExpiresIn,
  rabbitMqUrl,
  reportsQueueName,
  googleClientId,
  adminEmail,
  databaseUrl,
  recurringWorkerEnabled,
  recurringWorkerIntervalMs,
  recurringRetryBackoffMs,
};
