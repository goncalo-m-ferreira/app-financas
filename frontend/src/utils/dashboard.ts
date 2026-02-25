import type {
  ApiExpenseCategory,
  ApiTransaction,
  AssetsBarGroup,
  PerformanceSeries,
  TransactionGroup,
  TransactionListItem,
} from '../types/finance';

const ACCOUNT_LABELS = ['Personal CHF', 'Mastercard 1491', 'VISA 9091', 'AmEx 7404'];

const AVATAR_PALETTE = ['#fca5a5', '#fdba74', '#93c5fd', '#86efac', '#c4b5fd', '#f9a8d4', '#67e8f9'];

const FALLBACK_BARS: AssetsBarGroup[] = [
  { id: '1', first: 22, second: 36, third: 30, label: '2' },
  { id: '2', first: 28, second: 42, third: 32, label: '5' },
  { id: '3', first: 36, second: 58, third: 44, label: '9' },
  { id: '4', first: 44, second: 70, third: 58, label: '12' },
  { id: '5', first: 56, second: 86, third: 72, label: '16' },
  { id: '6', first: 62, second: 92, third: 78, label: '19' },
  { id: '7', first: 58, second: 88, third: 74, label: '23' },
  { id: '8', first: 54, second: 76, third: 70, label: '26' },
  { id: '9', first: 48, second: 68, third: 64, label: '30' },
  { id: '10', first: 42, second: 60, third: 56, label: '31' },
];

const FALLBACK_PERFORMANCE: PerformanceSeries = {
  primary: [26, 28, 33, 40, 38, 42, 45, 47, 54, 52, 60, 66, 74, 78, 74, 72, 70, 71, 68, 66, 55, 50, 57, 64],
  secondary: [24, 22, 25, 27, 30, 29, 31, 34, 35, 37, 39, 41, 48, 53, 51, 47, 42, 39, 41, 38, 35, 32, 30, 29],
};

function hashText(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function formatValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/,/g, "'");
}

export function formatAmount(value: number, currency: string): string {
  const sign = value < 0 ? '-' : '+';
  return `${sign}${formatValue(Math.abs(value))} ${currency}`;
}

export function formatTotalBalance(value: number, currency: string): string {
  return `${formatValue(value)} ${currency}`;
}

export function calculateTotalBalance(transactions: ApiTransaction[]): number {
  return transactions.reduce((total, transaction) => {
    const amount = Number.parseFloat(transaction.amount);

    if (!Number.isFinite(amount)) {
      return total;
    }

    return transaction.type === 'EXPENSE' ? total - amount : total + amount;
  }, 0);
}

function normalizeHexColor(color: string | null | undefined, fallback: string): string {
  if (!color) {
    return fallback;
  }

  const normalizedColor = color.trim();

  if (/^#[0-9a-f]{6}$/i.test(normalizedColor)) {
    return normalizedColor;
  }

  return fallback;
}

function resolveBadgeLabel(transaction: ApiTransaction): string | null {
  if (transaction.category?.name) {
    return transaction.category.name.toUpperCase();
  }

  if (transaction.type === 'INCOME') {
    return 'INCOME';
  }

  return null;
}

function buildTransactionItem(transaction: ApiTransaction, currency: string): TransactionListItem {
  const amountValue = Number.parseFloat(transaction.amount);
  const safeAmount = Number.isFinite(amountValue) ? Math.abs(amountValue) : 0;
  const signedAmount = transaction.type === 'EXPENSE' ? -safeAmount : safeAmount;

  const merchantLabel =
    transaction.description?.trim() ||
    transaction.category?.name ||
    (transaction.type === 'EXPENSE' ? 'Expense' : 'Income');

  const badgeLabel = resolveBadgeLabel(transaction);
  const badgeColor = normalizeHexColor(transaction.category?.color, '#cbd5e1');
  const hashSeed = hashText(transaction.id);

  return {
    id: transaction.id,
    timeLabel: new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(transaction.transactionDate)),
    merchantLabel,
    amountLabel: formatAmount(signedAmount, currency),
    amountValue: signedAmount,
    badgeLabel,
    badgeColor,
    accountLabel: ACCOUNT_LABELS[hashSeed % ACCOUNT_LABELS.length],
    avatarLabel: merchantLabel.slice(0, 1).toUpperCase(),
    avatarColor: AVATAR_PALETTE[hashSeed % AVATAR_PALETTE.length],
    iconColor: normalizeHexColor(transaction.category?.color, '#94a3b8'),
  };
}

export function buildTransactionGroups(
  transactions: ApiTransaction[],
  currency: string,
): TransactionGroup[] {
  const sortedTransactions = [...transactions].sort(
    (left, right) =>
      new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime(),
  );

  const groupsMap = new Map<string, { date: Date; items: TransactionListItem[] }>();

  for (const transaction of sortedTransactions) {
    const transactionDate = new Date(transaction.transactionDate);

    if (Number.isNaN(transactionDate.getTime())) {
      continue;
    }

    const dateKey = transactionDate.toISOString().slice(0, 10);
    const existingGroup = groupsMap.get(dateKey);

    if (existingGroup) {
      existingGroup.items.push(buildTransactionItem(transaction, currency));
      continue;
    }

    groupsMap.set(dateKey, {
      date: transactionDate,
      items: [buildTransactionItem(transaction, currency)],
    });
  }

  return Array.from(groupsMap.entries()).map(([dateKey, group]) => {
    const dayLabel = new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(group.date);
    const monthYearLabel = new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
    }).format(group.date);
    const weekdayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(group.date);

    return {
      id: dateKey,
      dayLabel,
      monthYearLabel,
      weekdayLabel,
      items: group.items,
    };
  });
}

export function buildAssetsBars(
  transactions: ApiTransaction[],
  categories: ApiExpenseCategory[],
): AssetsBarGroup[] {
  if (transactions.length === 0) {
    return FALLBACK_BARS;
  }

  const bars = FALLBACK_BARS.map((group) => ({ ...group }));

  transactions.forEach((transaction, index) => {
    const target = bars[index % bars.length];
    const amount = Number.parseFloat(transaction.amount);

    if (!Number.isFinite(amount)) {
      return;
    }

    const contribution = Math.min(24, Math.max(4, Math.round(amount / 45)));

    if (transaction.type === 'EXPENSE') {
      target.second = Math.min(110, target.second + contribution);
      target.third = Math.min(110, target.third + Math.round(contribution / 2));
      return;
    }

    target.first = Math.min(110, target.first + contribution);
    target.third = Math.min(110, target.third + Math.round(contribution / 3));
  });

  categories.forEach((category, index) => {
    const target = bars[index % bars.length];

    if (category.color) {
      target.third = Math.min(110, target.third + 2);
    }
  });

  return bars;
}

function createSeriesPath(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return values.map(() => 50);
  }

  return values.map((value) => 20 + ((value - min) / (max - min)) * 60);
}

export function buildPerformanceSeries(transactions: ApiTransaction[]): PerformanceSeries {
  if (transactions.length === 0) {
    return FALLBACK_PERFORMANCE;
  }

  const buckets = new Array(24).fill(0);

  transactions.forEach((transaction, index) => {
    const amount = Number.parseFloat(transaction.amount);

    if (!Number.isFinite(amount)) {
      return;
    }

    const direction = transaction.type === 'EXPENSE' ? -1 : 1;
    buckets[index % buckets.length] += amount * direction;
  });

  let cumulativePrimary = 0;
  let cumulativeSecondary = 0;

  const primaryRaw = buckets.map((value) => {
    cumulativePrimary += value;
    return cumulativePrimary;
  });

  const secondaryRaw = buckets.map((value) => {
    cumulativeSecondary += Math.abs(value);
    return cumulativeSecondary;
  });

  return {
    primary: createSeriesPath(primaryRaw),
    secondary: createSeriesPath(secondaryRaw),
  };
}
