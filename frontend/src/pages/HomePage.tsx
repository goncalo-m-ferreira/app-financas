import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonthYearSelector } from '../components/common/MonthYearSelector';
import { DeleteConfirmModal } from '../components/dashboard/DeleteConfirmModal';
import { EditTransactionModal } from '../components/dashboard/EditTransactionModal';
import { NewTransactionModal } from '../components/dashboard/NewTransactionModal';
import { Sidebar } from '../components/dashboard/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import { useTheme } from '../context/ThemeContext';
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
  budgetStatus: {
    totalBudgets: 0,
    warningCount: 0,
    criticalCount: 0,
    hasAlerts: false,
    items: [],
  },
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

function resolveAlertLevel(usageRatio: number): 'SAFE' | 'WARNING' | 'CRITICAL' {
  if (usageRatio >= 0.9) {
    return 'CRITICAL';
  }

  if (usageRatio >= 0.8) {
    return 'WARNING';
  }

  return 'SAFE';
}

export function HomePage(): JSX.Element {
  const { token, user, logout } = useAuth();
  const { month, year } = useDateFilter();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<HomeInsightsResponse>(INITIAL_INSIGHTS);
  const [wallets, setWallets] = useState<ApiWallet[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
        setErrorMessage(null);

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
          setErrorMessage(error.message);
          return;
        }

        if (error instanceof Error) {
          setErrorMessage(error.message);
          return;
        }

        setErrorMessage('Unexpected error while loading command center.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadHomeData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [month, reloadKey, token, year]);

  const currency = user?.defaultCurrency ?? 'EUR';

  const sortedWallets = useMemo(
    () => [...wallets].sort((left, right) => left.name.localeCompare(right.name)),
    [wallets],
  );

  const alertItems = useMemo(
    () =>
      [...insights.budgetStatus.items]
        .filter((item) => item.alertLevel !== 'SAFE')
        .sort((left, right) => right.usageRatio - left.usageRatio),
    [insights.budgetStatus.items],
  );

  async function handleCreateTransaction(payload: CreateTransactionInput): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    const createdTransaction = await createTransaction(token, payload);

    setWallets((current) =>
      current.map((wallet) => {
        if (wallet.id !== createdTransaction.walletId) {
          return wallet;
        }

        const currentBalance = Number.parseFloat(wallet.balance);
        const signedAmount = transactionSignedAmount(createdTransaction.type, createdTransaction.amount);

        return {
          ...wallet,
          balance: (Number.isFinite(currentBalance) ? currentBalance + signedAmount : signedAmount).toFixed(2),
        };
      }),
    );

    setInsights((current) => {
      const recentTransactions = [createdTransaction, ...current.recentTransactions].slice(0, 5);
      const nextBudgetItems: HomeInsightsResponse['budgetStatus']['items'] = current.budgetStatus.items.map(
        (budgetItem) => {
          if (
            createdTransaction.type !== 'EXPENSE' ||
            !createdTransaction.categoryId ||
            createdTransaction.categoryId !== budgetItem.categoryId
          ) {
            return budgetItem;
          }

          const spent = Number.parseFloat(budgetItem.spentThisMonth);
          const limit = Number.parseFloat(budgetItem.limit);
          const transactionAmount = Number.parseFloat(createdTransaction.amount);

          if (!Number.isFinite(spent) || !Number.isFinite(limit) || !Number.isFinite(transactionAmount)) {
            return budgetItem;
          }

          const nextSpent = spent + transactionAmount;
          const usageRatio = limit > 0 ? nextSpent / limit : 0;
          const remaining = limit - nextSpent;

          return {
            ...budgetItem,
            spentThisMonth: nextSpent.toFixed(2),
            remaining: remaining.toFixed(2),
            usageRatio,
            alertLevel: resolveAlertLevel(usageRatio),
          };
        },
      );

      const warningCount = nextBudgetItems.filter((item) => item.alertLevel === 'WARNING').length;
      const criticalCount = nextBudgetItems.filter((item) => item.alertLevel === 'CRITICAL').length;

      return {
        ...current,
        recentTransactions,
        budgetStatus: {
          ...current.budgetStatus,
          warningCount,
          criticalCount,
          hasAlerts: warningCount > 0 || criticalCount > 0,
          items: nextBudgetItems,
        },
      };
    });
  }

  async function handleUpdateTransaction(
    transactionId: string,
    payload: UpdateTransactionInput,
  ): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    const updatedTransaction = await updateTransaction(token, transactionId, payload);

    setInsights((current) => ({
      ...current,
      recentTransactions: current.recentTransactions
        .map((transaction) => (transaction.id === transactionId ? updatedTransaction : transaction))
        .sort(
          (left, right) =>
            new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime(),
        )
        .slice(0, 5),
    }));

    setReloadKey((value) => value + 1);
  }

  async function handleDeleteRecentTransaction(transactionId: string): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    await deleteTransaction(token, transactionId);

    setInsights((current) => ({
      ...current,
      recentTransactions: current.recentTransactions.filter(
        (transaction) => transaction.id !== transactionId,
      ),
    }));

    setReloadKey((value) => value + 1);
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

  function handleRequestDeleteRecentTransaction(transaction: ApiTransaction): void {
    setPendingDeleteTransaction({
      id: transaction.id,
      description: getTransactionDescription(transaction),
    });
  }

  async function handleConfirmDeleteRecentTransaction(): Promise<void> {
    if (!pendingDeleteTransaction) {
      return;
    }

    setIsDeletingTransaction(true);

    try {
      await handleDeleteRecentTransaction(pendingDeleteTransaction.id);
      setPendingDeleteTransaction(null);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to delete transaction.');
      }
    } finally {
      setIsDeletingTransaction(false);
    }
  }

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <div className="min-h-screen bg-[#eef0f1] p-3 dark:bg-[#020617] lg:p-5">
        <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#f6f7f8] shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-[#0b1220] dark:shadow-[0_20px_55px_rgba(2,6,23,0.85)]">
          <div className="lg:grid lg:grid-cols-[240px_1fr]">
            <Sidebar isDarkMode={isDarkMode} onToggleTheme={toggleTheme} activeItem="home" />

            <main className="space-y-4 p-4 lg:p-6" aria-live="polite">
              <header className="rounded-xl bg-slate-50 px-6 py-6 dark:bg-slate-950/50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Command Center
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      Welcome back, {user?.name ?? 'User'}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Quick view of wallets, recent activity and budget alerts.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <MonthYearSelector />
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Add Transaction
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </header>

              {loading ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Loading command center data...
                </div>
              ) : null}

              {errorMessage ? (
                <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  <p>{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500"
                  >
                    Retry
                  </button>
                </section>
              ) : null}

              {!loading && !errorMessage ? (
                <>
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Wallet cards">
                    {sortedWallets.length === 0 ? (
                      <article className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
                        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          No wallets yet
                        </h2>
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
                      </header>

                      {insights.recentTransactions.length === 0 ? (
                        <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
                          No recent transactions.
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
                                const signedAmount = transactionSignedAmount(
                                  transaction.type,
                                  transaction.amount,
                                );
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
                          Budgets above 80% usage are highlighted.
                        </p>
                      </header>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-900/15">
                          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Warning</p>
                          <p className="mt-1 text-lg font-semibold text-amber-800 dark:text-amber-200">
                            {insights.budgetStatus.warningCount}
                          </p>
                        </div>
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-900/15">
                          <p className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-300">Critical</p>
                          <p className="mt-1 text-lg font-semibold text-rose-800 dark:text-rose-200">
                            {insights.budgetStatus.criticalCount}
                          </p>
                        </div>
                      </div>

                      <ul className="mt-4 space-y-2">
                        {alertItems.length === 0 ? (
                          <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                            No budget alerts for the selected month.
                          </li>
                        ) : (
                          alertItems.map((item) => (
                            <li
                              key={item.budgetId}
                              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {item.categoryName}
                                </p>
                                <span
                                  className={[
                                    'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                                    item.alertLevel === 'CRITICAL'
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                                  ].join(' ')}
                                >
                                  {item.alertLevel}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {Math.round(item.usageRatio * 100)}% used ({formatCurrency(Number.parseFloat(item.spentThisMonth), currency)} of{' '}
                                {formatCurrency(Number.parseFloat(item.limit), currency)})
                              </p>
                            </li>
                          ))
                        )}
                      </ul>
                    </article>
                  </section>
                </>
              ) : null}
            </main>
          </div>
        </div>
      </div>

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
