import type {
  RecurringErrorType,
  RecurringExecutionStatus,
  RecurringFrequency,
  RecurringRuleStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type AdminOverviewOptions = {
  take: number;
};

export type AdminRecurringOperationIssueType = 'FAILED_EXECUTION' | 'PAUSED_RULE';

type AdminRecurringOperationsOptions = {
  take: number;
  issueType?: AdminRecurringOperationIssueType;
};

const FAILED_EXECUTIONS_WINDOW_DAYS = 30;

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

export type AdminRecurringOperationRuleContext = {
  id: string;
  description: string | null;
  type: TransactionType;
  amount: string;
  status: RecurringRuleStatus;
  pausedReason: string | null;
  frequency: RecurringFrequency;
  timezone: string;
  wallet: {
    id: string;
    name: string;
    color: string | null;
  };
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
};

export type AdminRecurringOperationExecutionContext = {
  id: string;
  status: RecurringExecutionStatus;
  scheduledFor: Date;
  attemptedAt: Date | null;
  errorType: RecurringErrorType | null;
  errorMessage: string | null;
};

export type AdminRecurringOperationItem = {
  issueType: AdminRecurringOperationIssueType;
  occurredAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
  rule: AdminRecurringOperationRuleContext;
  execution: AdminRecurringOperationExecutionContext | null;
};

export type AdminRecurringOperationsResponse = {
  summary: {
    failedExecutions: number;
    pausedRules: number;
    affectedUsers: number;
  };
  items: AdminRecurringOperationItem[];
};

function getFailedExecutionsSince(now: Date): Date {
  return new Date(now.getTime() - FAILED_EXECUTIONS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function toRuleContext(params: {
  id: string;
  description: string | null;
  type: TransactionType;
  amount: { toString(): string } | number | string;
  status: RecurringRuleStatus;
  pausedReason: string | null;
  frequency: RecurringFrequency;
  timezone: string;
  wallet: {
    id: string;
    name: string;
    color: string | null;
  };
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
}): AdminRecurringOperationRuleContext {
  return {
    id: params.id,
    description: params.description,
    type: params.type,
    amount:
      typeof params.amount === 'string'
        ? params.amount
        : typeof params.amount === 'number'
          ? params.amount.toString()
          : params.amount.toString(),
    status: params.status,
    pausedReason: params.pausedReason,
    frequency: params.frequency,
    timezone: params.timezone,
    wallet: params.wallet,
    category: params.category,
  };
}

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

export async function getAdminRecurringOperations(
  options: AdminRecurringOperationsOptions,
): Promise<AdminRecurringOperationsResponse> {
  const now = new Date();
  const failedSince = getFailedExecutionsSince(now);

  const [
    failedExecutions,
    pausedRules,
    affectedFailedUsers,
    affectedPausedUsers,
    failedExecutionItems,
    pausedRuleItems,
  ] = await Promise.all([
    prisma.recurringExecution.count({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: failedSince,
        },
      },
    }),
    prisma.recurringRule.count({
      where: {
        status: 'PAUSED',
      },
    }),
    prisma.recurringExecution.findMany({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: failedSince,
        },
      },
      distinct: ['userId'],
      select: {
        userId: true,
      },
    }),
    prisma.recurringRule.findMany({
      where: {
        status: 'PAUSED',
      },
      distinct: ['userId'],
      select: {
        userId: true,
      },
    }),
    options.issueType && options.issueType !== 'FAILED_EXECUTION'
      ? Promise.resolve([])
      : prisma.recurringExecution.findMany({
          where: {
            status: 'FAILED',
            createdAt: {
              gte: failedSince,
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: options.take,
          select: {
            id: true,
            status: true,
            scheduledFor: true,
            attemptedAt: true,
            errorType: true,
            errorMessage: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            rule: {
              select: {
                id: true,
                description: true,
                type: true,
                amount: true,
                status: true,
                pausedReason: true,
                frequency: true,
                timezone: true,
                wallet: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                  },
                },
                category: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    icon: true,
                  },
                },
              },
            },
          },
        }),
    options.issueType && options.issueType !== 'PAUSED_RULE'
      ? Promise.resolve([])
      : prisma.recurringRule.findMany({
          where: {
            status: 'PAUSED',
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: options.take,
          select: {
            id: true,
            description: true,
            type: true,
            amount: true,
            status: true,
            pausedReason: true,
            frequency: true,
            timezone: true,
            lastFailureAt: true,
            updatedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            wallet: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                color: true,
                icon: true,
              },
            },
          },
        }),
  ]);

  const failedExecutionOperationItems: AdminRecurringOperationItem[] = failedExecutionItems.map(
    (execution) => ({
      issueType: 'FAILED_EXECUTION',
      occurredAt: execution.createdAt,
      user: execution.user,
      rule: toRuleContext({
        id: execution.rule.id,
        description: execution.rule.description,
        type: execution.rule.type,
        amount: execution.rule.amount,
        status: execution.rule.status,
        pausedReason: execution.rule.pausedReason,
        frequency: execution.rule.frequency,
        timezone: execution.rule.timezone,
        wallet: execution.rule.wallet,
        category: execution.rule.category,
      }),
      execution: {
        id: execution.id,
        status: execution.status,
        scheduledFor: execution.scheduledFor,
        attemptedAt: execution.attemptedAt,
        errorType: execution.errorType,
        errorMessage: execution.errorMessage,
      },
    }),
  );

  const pausedRuleOperationItems: AdminRecurringOperationItem[] = pausedRuleItems.map((rule) => ({
    issueType: 'PAUSED_RULE',
    occurredAt: rule.lastFailureAt ?? rule.updatedAt,
    user: rule.user,
    rule: toRuleContext({
      id: rule.id,
      description: rule.description,
      type: rule.type,
      amount: rule.amount,
      status: rule.status,
      pausedReason: rule.pausedReason,
      frequency: rule.frequency,
      timezone: rule.timezone,
      wallet: rule.wallet,
      category: rule.category,
    }),
    execution: null,
  }));

  const items = [...failedExecutionOperationItems, ...pausedRuleOperationItems]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(0, options.take);

  const affectedUsers = new Set<string>();
  affectedFailedUsers.forEach((entry) => affectedUsers.add(entry.userId));
  affectedPausedUsers.forEach((entry) => affectedUsers.add(entry.userId));

  return {
    summary: {
      failedExecutions,
      pausedRules,
      affectedUsers: affectedUsers.size,
    },
    items,
  };
}
