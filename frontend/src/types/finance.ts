export type ApiUser = {
  id: string;
  name: string;
  email: string;
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
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  fileUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'BUDGET' | 'SYSTEM' | 'REPORT';
  isRead: boolean;
  createdAt: string;
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
  token: string;
  user: ApiUser;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  defaultCurrency?: string;
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
  budgetStatus: {
    totalBudgets: number;
    warningCount: number;
    criticalCount: number;
    hasAlerts: boolean;
    items: HomeBudgetInsight[];
  };
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
