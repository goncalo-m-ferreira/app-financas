import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MonthYearSelector } from '../components/common/MonthYearSelector';
import { DeleteConfirmModal } from '../components/dashboard/DeleteConfirmModal';
import { EditTransactionModal } from '../components/dashboard/EditTransactionModal';
import { NewTransactionModal } from '../components/dashboard/NewTransactionModal';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import {
  ApiClientError,
  createTransaction,
  deleteTransaction,
  fetchExpenseCategories,
  fetchHomeInsights,
  fetchWallets,
  updateTransaction,
} from '../services/api';
import type {
  ApiExpenseCategory,
  ApiTransaction,
  ApiWallet,
  CreateTransactionInput,
  HomeInsightsResponse,
  UpdateTransactionInput,
} from '../types/finance';

const INITIAL_INSIGHTS: HomeInsightsResponse = {
  period: {
    month: 1,
    year: 1970,
    start: '',
    endExclusive: '',
  },
  recentTransactions: [],
  monthlySummary: {
    incomeThisMonth: '0.00',
    spentThisMonth: '0.00',
    netThisMonth: '0.00',
    transactionCount: 0,
  },
  budgetStatus: {
    totalBudgets: 0,
    warningCount: 0,
    criticalCount: 0,
    exceededCount: 0,
    hasAlerts: false,
    items: [],
  },
  recurringStatus: {
    pausedCount: 0,
    dueSoonCount: 0,
    failedRecentCount: 0,
    needsAttentionCount: 0,
    hasIssues: false,
  },
};

const SUCCESS_TOAST_TTL_MS = 2600;
const FALLBACK_MONTHLY_SUMMARY: HomeInsightsResponse['monthlySummary'] = {
  incomeThisMonth: '0.00',
  spentThisMonth: '0.00',
  netThisMonth: '0.00',
  transactionCount: 0,
};
const FALLBACK_BUDGET_STATUS: HomeInsightsResponse['budgetStatus'] = {
  totalBudgets: 0,
  warningCount: 0,
  criticalCount: 0,
  exceededCount: 0,
  hasAlerts: false,
  items: [],
};
const FALLBACK_RECURRING_STATUS: HomeInsightsResponse['recurringStatus'] = {
  pausedCount: 0,
  dueSoonCount: 0,
  failedRecentCount: 0,
  needsAttentionCount: 0,
  hasIssues: false,
};

type PendingDeleteTransaction = {
  id: string;
  description?: string;
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/,/g, "'")
    .concat(` ${currency}`);
}

function parseHexColor(value: string | null): string {
  if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
    return value.trim();
  }

  return '#0ea5e9';
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = parseHexColor(hex);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function transactionSignedAmount(type: 'INCOME' | 'EXPENSE', amount: string): number {
  const numericAmount = Number.parseFloat(amount);

  if (!Number.isFinite(numericAmount)) {
    return 0;
  }

  return type === 'EXPENSE' ? -Math.abs(numericAmount) : Math.abs(numericAmount);
}

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function HomePage(): JSX.Element {
  const { token, user } = useAuth();
  const { month, year } = useDateFilter();

  const [insights, setInsights] = useState<HomeInsightsResponse>(INITIAL_INSIGHTS);
  const [wallets, setWallets] = useState<ApiWallet[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<ApiTransaction | null>(null);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] =
    useState<PendingDeleteTransaction | null>(null);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState<boolean>(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadHomeData(): Promise<void> {
      try {
        setLoading(true);
        setLoadErrorMessage(null);

        const [insightsData, walletsData, categoriesData] = await Promise.all([
          fetchHomeInsights(
            tokenValue,
            {
              month,
              year,
            },
            controller.signal,
          ),
          fetchWallets(tokenValue, controller.signal),
          fetchExpenseCategories(tokenValue, controller.signal),
        ]);

        if (!isMounted) {
          return;
        }

        setInsights(insightsData);
        setWallets(walletsData);
        setCategories(categoriesData);
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setLoadErrorMessage(error.message);
          return;
        }

        if (error instanceof Error) {
          setLoadErrorMessage(error.message);
          return;
        }

        setLoadErrorMessage('Unexpected error while loading command center.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadHomeData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [month, reloadKey, token, year]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, SUCCESS_TOAST_TTL_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  const currency = user?.defaultCurrency ?? 'EUR';

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(year, month - 1, 1)),
    [month, year],
  );

  const sortedWallets = useMemo(
    () => [...wallets].sort((left, right) => left.name.localeCompare(right.name)),
    [wallets],
  );

  const walletTotal = useMemo(
    () =>
      wallets.reduce((accumulator, wallet) => {
        const numericBalance = Number.parseFloat(wallet.balance);
        return accumulator + (Number.isFinite(numericBalance) ? numericBalance : 0);
      }, 0),
    [wallets],
  );

  const monthlySummary = insights.monthlySummary ?? FALLBACK_MONTHLY_SUMMARY;

  const budgetStatus = useMemo(() => {
    const source = insights.budgetStatus;
    const warningCount = source?.warningCount ?? 0;
    const criticalCount = source?.criticalCount ?? 0;
    const exceededCount = source?.exceededCount ?? criticalCount;
    const hasAlerts = source?.hasAlerts ?? (warningCount > 0 || criticalCount > 0);

    return {
      ...FALLBACK_BUDGET_STATUS,
      ...source,
      warningCount,
      criticalCount,
      exceededCount,
      hasAlerts,
      items: source?.items ?? [],
    };
  }, [insights.budgetStatus]);

  const recurringStatus = useMemo(() => {
    const source = insights.recurringStatus;
    const pausedCount = source?.pausedCount ?? 0;
    const failedRecentCount = source?.failedRecentCount ?? 0;
    const dueSoonCount = source?.dueSoonCount ?? 0;
    const needsAttentionCount = source?.needsAttentionCount ?? pausedCount + failedRecentCount;
    const hasIssues = source?.hasIssues ?? needsAttentionCount > 0;

    return {
      ...FALLBACK_RECURRING_STATUS,
      ...source,
      pausedCount,
      failedRecentCount,
      dueSoonCount,
      needsAttentionCount,
      hasIssues,
    };
  }, [insights.recurringStatus]);

  async function refreshCommandCenter(): Promise<void> {
    if (!token) {
      return;
    }

    try {
      setIsRefreshing(true);

      const [nextInsights, nextWallets] = await Promise.all([
        fetchHomeInsights(token, { month, year }),
        fetchWallets(token),
      ]);

      setInsights(nextInsights);
      setWallets(nextWallets);
    } catch (error) {
      if (error instanceof Error) {
        setActionErrorMessage(error.message);
      } else {
        setActionErrorMessage('Failed to refresh command center data.');
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  function getTransactionDescription(transaction: ApiTransaction): string {
    const trimmedDescription = transaction.description?.trim();

    if (trimmedDescription) {
      return trimmedDescription;
    }

    if (transaction.category?.name) {
      return transaction.category.name;
    }

    return transaction.type === 'EXPENSE' ? 'Expense' : 'Income';
  }

  function showSuccess(message: string): void {
    setSuccessMessage(message);
  }

  async function handleCreateTransaction(payload: CreateTransactionInput): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    setActionErrorMessage(null);

    try {
      await createTransaction(token, payload);
      showSuccess('Transaction created successfully.');
      await refreshCommandCenter();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create transaction.';
      setActionErrorMessage(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async function handleUpdateTransaction(
    transactionId: string,
    payload: UpdateTransactionInput,
  ): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    setActionErrorMessage(null);

    try {
      await updateTransaction(token, transactionId, payload);
      showSuccess('Transaction updated successfully.');
      await refreshCommandCenter();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update transaction.';
      setActionErrorMessage(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  function handleRequestDeleteRecentTransaction(transaction: ApiTransaction): void {
    setPendingDeleteTransaction({
      id: transaction.id,
      description: getTransactionDescription(transaction),
    });
  }

  async function handleDeleteRecentTransaction(transactionId: string): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    await deleteTransaction(token, transactionId);
    showSuccess('Transaction deleted successfully.');
    await refreshCommandCenter();
  }

  async function handleConfirmDeleteRecentTransaction(): Promise<void> {
    if (!pendingDeleteTransaction) {
      return;
    }

    setActionErrorMessage(null);
    setIsDeletingTransaction(true);

    try {
      await handleDeleteRecentTransaction(pendingDeleteTransaction.id);
      setPendingDeleteTransaction(null);
    } catch (error) {
      if (error instanceof Error) {
        setActionErrorMessage(error.message);
      } else {
        setActionErrorMessage('Failed to delete transaction.');
      }
    } finally {
      setIsDeletingTransaction(false);
    }
  }

  return (
    <>
      <AppShell activeItem="home">
        <PremiumPageHeader
          eyebrow="Command Center"
          title={`Welcome back, ${user?.name ?? 'User'}`}
          description="Quick view of wallets, monthly activity, budget alerts and recurring operations."
          actions={
            <>
              <MonthYearSelector variant="dashboardTopbar" />
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                disabled={loading || isRefreshing}
                className="inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:from-blue-500 hover:to-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Add Transaction
              </button>
            </>
          }
        />

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Loading command center data...
          </div>
        ) : null}

        {loadErrorMessage ? (
          <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p>{loadErrorMessage}</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500"
            >
              Retry
            </button>
          </section>
        ) : null}

        {actionErrorMessage ? (
          <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p>{actionErrorMessage}</p>
          </section>
        ) : null}

        {!loading && !loadErrorMessage ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Monthly summary">
              <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Spent This Month
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(parseAmount(monthlySummary.spentThisMonth), currency)}
                </p>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Wallet Total (All Wallets)
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(walletTotal, currency)}
                </p>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Budget Alerts</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {budgetStatus.warningCount} warning, {budgetStatus.exceededCount} exceeded
                </p>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Recurring Attention
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {recurringStatus.needsAttentionCount} issues, {recurringStatus.dueSoonCount} due soon
                </p>
              </article>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Wallet cards">
              {sortedWallets.length === 0 ? (
                <article className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">No wallets yet</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Create wallets in Accounts & Cards to start adding transactions.
                  </p>
                </article>
              ) : (
                sortedWallets.map((wallet) => {
                  const walletColor = parseHexColor(wallet.color);
                  const balance = Number.parseFloat(wallet.balance);

                  return (
                    <article
                      key={wallet.id}
                      className="rounded-2xl border border-white/30 p-5 text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)]"
                      style={{
                        backgroundImage: `linear-gradient(140deg, ${hexToRgba(walletColor, 0.92)} 0%, ${hexToRgba(walletColor, 0.64)} 55%, ${hexToRgba('#0f172a', 0.9)} 120%)`,
                      }}
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-white/75">Wallet</p>
                      <h2 className="mt-3 text-xl font-semibold">{wallet.name}</h2>
                      <p className="mt-6 text-2xl font-semibold">
                        {formatCurrency(Number.isFinite(balance) ? balance : 0, currency)}
                      </p>
                    </article>
                  );
                })
              )}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
              <article className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Recent Transactions
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Showing recent transactions in {monthLabel}.
                  </p>
                </header>

                {isRefreshing ? (
                  <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Refreshing command center data...
                  </p>
                ) : null}

                {insights.recentTransactions.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
                    No transactions found for {monthLabel}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Description</th>
                          <th className="px-5 py-3">Wallet</th>
                          <th className="px-5 py-3 text-right">Amount</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {insights.recentTransactions.map((transaction) => {
                          const signedAmount = transactionSignedAmount(transaction.type, transaction.amount);
                          const description = getTransactionDescription(transaction);

                          return (
                            <tr key={transaction.id} className="bg-white dark:bg-slate-900">
                              <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">
                                {new Intl.DateTimeFormat('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }).format(new Date(transaction.transactionDate))}
                              </td>
                              <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">
                                {description}
                              </td>
                              <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                                {transaction.wallet?.name ?? 'Unassigned'}
                              </td>
                              <td
                                className={[
                                  'whitespace-nowrap px-5 py-3 text-right font-semibold',
                                  signedAmount < 0
                                    ? 'text-slate-700 dark:text-slate-200'
                                    : 'text-emerald-600 dark:text-emerald-400',
                                ].join(' ')}
                              >
                                {signedAmount < 0 ? '-' : '+'}
                                {formatCurrency(Math.abs(signedAmount), currency)}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingTransaction(transaction)}
                                    aria-label={`Edit ${description}`}
                                    className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                  >
                                    <EditIcon />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRequestDeleteRecentTransaction(transaction)}
                                    aria-label={`Delete ${description}`}
                                    className="rounded p-1 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-rose-400 dark:hover:bg-rose-900/20 dark:hover:text-rose-300"
                                  >
                                    <TrashIcon />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <header>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Insights / Alerts
                  </h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Actionable monthly status with quick links.
                  </p>
                </header>

                <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Budgets</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    {budgetStatus.warningCount} near limit and {budgetStatus.exceededCount} exceeded in {monthLabel}.
                  </p>
                  <Link
                    to="/budgets"
                    className="mt-2 inline-flex text-sm font-semibold text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Go to Budgets
                  </Link>
                </section>

                <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Recurring rules</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    {recurringStatus.pausedCount} paused, {recurringStatus.failedRecentCount} failures in last 30 days, {recurringStatus.dueSoonCount} due in 7 days.
                  </p>
                  <Link
                    to="/recurring-rules"
                    className="mt-2 inline-flex text-sm font-semibold text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Go to Recurring Rules
                  </Link>
                </section>
              </article>
            </section>
          </>
        ) : null}
      </AppShell>

      <NewTransactionModal
        open={isModalOpen}
        categories={categories}
        wallets={wallets}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTransaction}
      />

      <EditTransactionModal
        open={editingTransaction !== null}
        transaction={editingTransaction}
        categories={categories}
        wallets={wallets}
        onClose={() => setEditingTransaction(null)}
        onSubmit={handleUpdateTransaction}
      />

      <DeleteConfirmModal
        isOpen={pendingDeleteTransaction !== null}
        itemName={pendingDeleteTransaction?.description}
        isDeleting={isDeletingTransaction}
        onClose={() => {
          if (!isDeletingTransaction) {
            setPendingDeleteTransaction(null);
          }
        }}
        onConfirm={() => {
          void handleConfirmDeleteRecentTransaction();
        }}
      />

      {successMessage ? (
        <div
          className="fixed right-4 top-4 z-[60] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 shadow-lg dark:border-emerald-900/60 dark:bg-emerald-950/80 dark:text-emerald-300"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </div>
      ) : null}
    </>
  );
}

function EditIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10-10-4-4L4 16v4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m12 6 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 7l1 12h10l1-12M9 7V4h6v3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
