import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const buildPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = globalThis.prismaGlobal ?? buildPrismaClient();

if (env.nodeEnv !== 'production') {
  globalThis.prismaGlobal = prisma;
}
