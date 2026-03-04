import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const parsedPort = Number(process.env.PORT ?? '4000');
const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-change-me';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
const rabbitMqUrl = process.env.AMQP_URL ?? 'amqp://localhost';
const reportsQueueName = process.env.REPORTS_QUEUE_NAME ?? 'pdf_reports_queue';
const googleClientId =
  process.env.GOOGLE_CLIENT_ID ??
  '84485673553-br2mf821lbd9qfpqmjqlkm3c54g4uijj.apps.googleusercontent.com';
const fallbackDatabaseUrl = 'file:../prisma/dev.db';

function normalizeDatabaseUrl(rawUrl: string): string {
  if (!rawUrl.startsWith('file:')) {
    return rawUrl;
  }

  const sqlitePath = rawUrl.slice('file:'.length);

  if (sqlitePath.startsWith('/')) {
    return rawUrl;
  }

  const configDir = path.dirname(fileURLToPath(import.meta.url));
  const backendRoot = path.resolve(configDir, '..', '..');
  const absoluteSqlitePath = path.resolve(backendRoot, sqlitePath);

  return `file:${absoluteSqlitePath}`;
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL ?? fallbackDatabaseUrl);
process.env.DATABASE_URL = databaseUrl;

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000,
  jwtSecret,
  jwtExpiresIn,
  rabbitMqUrl,
  reportsQueueName,
  googleClientId,
  databaseUrl,
};
