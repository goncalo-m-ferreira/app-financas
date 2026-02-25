import type {
  ApiExpenseCategory,
  ApiTransaction,
  BalanceTrendDatum,
  ExpenseByCategoryDatum,
  TransactionGroup,
  TransactionListItem,
} from '../types/finance';

const ACCOUNT_LABELS = ['Personal CHF', 'Mastercard 1491', 'VISA 9091', 'AmEx 7404'];

const AVATAR_PALETTE = ['#fca5a5', '#fdba74', '#93c5fd', '#86efac', '#c4b5fd', '#f9a8d4', '#67e8f9'];

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

export function buildExpenseByCategoryData(
  transactions: ApiTransaction[],
  categories: ApiExpenseCategory[],
): ExpenseByCategoryDatum[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totalsByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== 'EXPENSE' || !transaction.categoryId) {
      continue;
    }

    const amount = Number.parseFloat(transaction.amount);

    if (!Number.isFinite(amount)) {
      continue;
    }

    totalsByCategory.set(transaction.categoryId, (totalsByCategory.get(transaction.categoryId) ?? 0) + amount);
  }

  const dataset = Array.from(totalsByCategory.entries())
    .map(([categoryId, total]) => {
      const category = categoryById.get(categoryId);

      return {
        category: category?.name ?? 'Uncategorized',
        expense: Number(total.toFixed(2)),
        color: normalizeHexColor(category?.color, '#60a5fa'),
      };
    })
    .sort((left, right) => right.expense - left.expense)
    .slice(0, 8);

  if (dataset.length > 0) {
    return dataset;
  }

  return categories.slice(0, 5).map((category, index) => ({
    category: category.name,
    expense: 0,
    color: normalizeHexColor(category.color, AVATAR_PALETTE[index % AVATAR_PALETTE.length]),
  }));
}

export function buildBalanceTrendData(transactions: ApiTransaction[]): BalanceTrendDatum[] {
  const sortedTransactions = [...transactions].sort(
    (left, right) => new Date(left.transactionDate).getTime() - new Date(right.transactionDate).getTime(),
  );

  let runningBalance = 0;

  const points = sortedTransactions.map((transaction) => {
    const amount = Number.parseFloat(transaction.amount);

    if (Number.isFinite(amount)) {
      runningBalance += transaction.type === 'EXPENSE' ? -amount : amount;
    }

    return {
      dateLabel: new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
      }).format(new Date(transaction.transactionDate)),
      balance: Number(runningBalance.toFixed(2)),
    };
  });

  if (points.length > 0) {
    return points;
  }

  return [
    { dateLabel: 'Day 1', balance: 0 },
    { dateLabel: 'Day 2', balance: 0 },
    { dateLabel: 'Day 3', balance: 0 },
  ];
}
