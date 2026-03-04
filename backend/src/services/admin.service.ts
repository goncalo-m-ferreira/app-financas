import type { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type AdminOverviewOptions = {
  take: number;
};

export type AdminOverviewUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
};

export type AdminOverviewResponse = {
  summary: {
    totalUsers: number;
  };
  users: AdminOverviewUser[];
};

export async function getAdminOverview(options: AdminOverviewOptions): Promise<AdminOverviewResponse> {
  const [totalUsers, users] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options.take,
    }),
  ]);

  return {
    summary: {
      totalUsers,
    },
    users,
  };
}
