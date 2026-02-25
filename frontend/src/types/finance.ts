export type ApiUser = {
  id: string;
  name: string;
  email: string;
  defaultCurrency: string;
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

export type ApiTransaction = {
  id: string;
  userId: string;
  categoryId: string | null;
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
};

export type DashboardApiData = {
  user: ApiUser | null;
  categories: ApiExpenseCategory[];
  transactions: ApiTransaction[];
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

export type AssetsBarGroup = {
  id: string;
  first: number;
  second: number;
  third: number;
  label: string;
};

export type PerformanceSeries = {
  primary: number[];
  secondary: number[];
};
