import dotenv from 'dotenv';

dotenv.config();

const parsedPort = Number(process.env.PORT ?? '4000');

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000,
};
