import dotenv from 'dotenv';

dotenv.config();

const parsedPort = Number(process.env.PORT ?? '4000');
const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-change-me';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '7d';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000,
  jwtSecret,
  jwtExpiresIn,
};
