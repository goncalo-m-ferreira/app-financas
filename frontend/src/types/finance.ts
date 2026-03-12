export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  defaultCurrency: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiExpenseCategory = {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiWallet = {
  id: string;
  userId: string;
  name: string;
  balance: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiReport = {
  id: string;
  userId: string;
  name: string;
  month: number;
  year: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  fileUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportsStatusFilter = 'PENDING' | 'COMPLETED' | 'FAILED';

export type ReportsQueryInput = {
  status?: ReportsStatusFilter;
  month?: number;
  year?: number;
};

export type ApiNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  targetPath?: string | null;
  type: 'BUDGET' | 'SYSTEM' | 'REPORT' | 'RECURRING';
  isRead: boolean;
  createdAt: string;
};

export type NotificationsTypeFilter = 'BUDGET' | 'SYSTEM' | 'REPORT' | 'RECURRING';

export type NotificationsReadFilter = boolean | undefined;

export type NotificationsQueryInput = {
  isRead?: NotificationsReadFilter;
  type?: NotificationsTypeFilter;
  take?: number;
  cursor?: string;
};

export type NotificationsListResponse = {
  items: ApiNotification[];
  nextCursor: string | null;
};

export type NotificationsUnreadCountResponse = {
  unreadCount: number;
};

export type NotificationsMarkAllAsReadResponse = {
  updatedCount: number;
};

export type ApiTransaction = {
  id: string;
  userId: string;
  categoryId: string | null;
  walletId: string | null;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  description: string | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
  wallet: {
    id: string;
    name: string;
    color: string | null;
  } | null;
};

export type DashboardApiData = {
  user: ApiUser;
  categories: ApiExpenseCategory[];
  wallets: ApiWallet[];
  transactions: ApiTransaction[];
  balance: string;
};

export type ApiBudget = {
  id: string;
  userId: string;
  categoryId: string;
  amount: string;
  spentThisMonth: string;
  remaining: string;
  usageRatio: number;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  };
};

export type BudgetOverview = {
  currentMonth: {
    month: number;
    year: number;
    start: string;
    endExclusive: string;
  };
  budgets: ApiBudget[];
};

export type AuthPayload = {
  user: ApiUser;
  token?: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  defaultCurrency?: string;
};

export type UpdateCurrentUserInput = {
  name: string;
  defaultCurrency: string;
};

export type DeleteCurrentUserResponse = {
  success: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type GoogleAuthInput = {
  credential: string;
};

export type CreateTransactionInput = {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description?: string;
  transactionDate: string;
  categoryId?: string;
  walletId: string;
};

export type UpdateTransactionInput = {
  type?: 'INCOME' | 'EXPENSE';
  amount?: number;
  description?: string | null;
  transactionDate?: string;
  categoryId?: string | null;
  walletId?: string | null;
};

export type ImportTransactionsInput = {
  walletId: string;
  file: File;
};

export type ImportTransactionsResult = {
  importedCount: number;
  walletId: string;
  netAmount: string;
};

export type CreateBudgetInput = {
  amount: number;
  categoryId: string;
};

export type UpdateBudgetInput = {
  amount: number;
};

export type CreateExpenseCategoryInput = {
  name: string;
  color?: string;
};

export type CreateWalletInput = {
  name: string;
  balance?: number;
  color?: string;
};

export type CreateReportInput = {
  name?: string;
  month?: number;
  year?: number;
};

export type UpdateWalletInput = {
  name?: string;
  balance?: number;
  color?: string | null;
};

export type MonthYearFilter = {
  month: number;
  year: number;
};

export type HomeBudgetInsight = {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  limit: string;
  spentThisMonth: string;
  remaining: string;
  usageRatio: number;
  alertLevel: 'SAFE' | 'WARNING' | 'CRITICAL';
};

export type HomeInsightsResponse = {
  period: {
    month: number;
    year: number;
    start: string;
    endExclusive: string;
  };
  recentTransactions: ApiTransaction[];
  monthlySummary: {
    incomeThisMonth: string;
    spentThisMonth: string;
    netThisMonth: string;
    transactionCount: number;
  };
  budgetStatus: {
    totalBudgets: number;
    warningCount: number;
    criticalCount: number;
    exceededCount: number;
    hasAlerts: boolean;
    items: HomeBudgetInsight[];
  };
  recurringStatus: {
    pausedCount: number;
    dueSoonCount: number;
    failedRecentCount: number;
    needsAttentionCount: number;
    hasIssues: boolean;
  };
};

export type AdminOverviewUser = {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
};

export type AdminOverviewResponse = {
  summary: {
    totalUsers: number;
  };
  users: AdminOverviewUser[];
};

export type AdminRecurringOperationIssueType = 'FAILED_EXECUTION' | 'PAUSED_RULE';

export type AdminRecurringOperationItem = {
  issueType: AdminRecurringOperationIssueType;
  occurredAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  rule: {
    id: string;
    description: string | null;
    type: 'INCOME' | 'EXPENSE';
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
  execution: {
    id: string;
    status: RecurringExecutionStatus;
    scheduledFor: string;
    attemptedAt: string | null;
    errorType: 'STRUCTURAL' | 'TRANSIENT' | null;
    errorMessage: string | null;
  } | null;
};

export type AdminRecurringOperationsResponse = {
  summary: {
    failedExecutions: number;
    pausedRules: number;
    affectedUsers: number;
  };
  items: AdminRecurringOperationItem[];
};

export type TransactionListItem = {
  id: string;
  timeLabel: string;
  merchantLabel: string;
  amountLabel: string;
  amountValue: number;
  badgeLabel: string | null;
  badgeColor: string;
  accountLabel: string;
  avatarLabel: string;
  avatarColor: string;
  iconColor: string;
};

export type TransactionGroup = {
  id: string;
  dayLabel: string;
  monthYearLabel: string;
  weekdayLabel: string;
  items: TransactionListItem[];
};

export type ExpenseByCategoryDatum = {
  category: string;
  expense: number;
  color: string;
};

export type BalanceTrendDatum = {
  dateLabel: string;
  balance: number;
};

export type RecurringRuleStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RecurringEndMode = 'NONE' | 'UNTIL_DATE' | 'MAX_OCCURRENCES';
export type RecurringExecutionStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED';

export type ApiRecurringRule = {
  id: string;
  userId: string;
  walletId: string;
  categoryId: string | null;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  description: string | null;
  isSubscription: boolean;
  timezone: string;
  frequency: RecurringFrequency;
  startAt: string;
  nextRunAt: string | null;
  anchorDayOfMonth: number | null;
  anchorWeekday: number | null;
  anchorMonthOfYear: number | null;
  anchorMinuteOfDay: number;
  isLastDayAnchor: boolean;
  endMode: RecurringEndMode;
  endAt: string | null;
  maxOccurrences: number | null;
  occurrencesGenerated: number;
  status: RecurringRuleStatus;
  pausedReason: string | null;
  cancelledAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
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

export type ApiRecurringExecution = {
  id: string;
  userId: string;
  ruleId: string;
  scheduledFor: string;
  status: RecurringExecutionStatus;
  attemptCount: number;
  attemptedAt: string | null;
  errorType: 'STRUCTURAL' | 'TRANSIENT' | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  rule: {
    id: string;
    description: string | null;
    type: 'INCOME' | 'EXPENSE';
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
  } | null;
  transaction: {
    id: string;
    type: 'INCOME' | 'EXPENSE';
    amount: string;
    transactionDate: string;
    wallet: {
      id: string;
      name: string;
      color: string | null;
    } | null;
    category: {
      id: string;
      name: string;
      color: string | null;
      icon: string | null;
    } | null;
  } | null;
};

export type ApiRecurringExecutionsResponse = {
  items: ApiRecurringExecution[];
  nextCursor: string | null;
};

export type CreateRecurringRuleInput = {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description?: string;
  walletId: string;
  categoryId?: string | null;
  isSubscription?: boolean;
  timezone: string;
  frequency: RecurringFrequency;
  startAt: string;
  endMode?: RecurringEndMode;
  endAt?: string | null;
  maxOccurrences?: number | null;
};

export type UpdateRecurringRuleInput = {
  amount?: number;
  description?: string | null;
  walletId?: string;
  categoryId?: string | null;
  isSubscription?: boolean;
  timezone?: string;
  frequency?: RecurringFrequency;
  startAt?: string;
  endMode?: RecurringEndMode;
  endAt?: string | null;
  maxOccurrences?: number | null;
};

export type RecurringPreviewResponse = {
  ruleId: string;
  timezone: string;
  nextRunAt: string | null;
  occurrences: string[];
};
