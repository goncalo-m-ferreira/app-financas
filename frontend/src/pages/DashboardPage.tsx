import { useEffect, useMemo, useState } from 'react';
import { ChartCards } from '../components/dashboard/ChartCards';
import { DeleteConfirmModal } from '../components/dashboard/DeleteConfirmModal';
import { EditTransactionModal } from '../components/dashboard/EditTransactionModal';
import { ImportCsvModal } from '../components/dashboard/ImportCsvModal';
import { NewTransactionModal } from '../components/dashboard/NewTransactionModal';
import { TopHeader } from '../components/dashboard/TopHeader';
import { TransactionsList } from '../components/dashboard/TransactionsList';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import { useSearch } from '../context/SearchContext';
import { useTheme } from '../context/ThemeContext';
import {
  ApiClientError,
  createTransaction,
  deleteTransaction,
  fetchDashboardData,
  importTransactionsCsv,
  updateTransaction,
} from '../services/api';
import type {
  ApiTransaction,
  CreateTransactionInput,
  DashboardApiData,
  ImportTransactionsInput,
  UpdateTransactionInput,
} from '../types/finance';
import {
  buildBalanceTrendData,
  buildExpenseByCategoryData,
  buildTransactionGroups,
  calculateTotalBalance,
  formatTotalBalance,
} from '../utils/dashboard';

const INITIAL_DASHBOARD: DashboardApiData = {
  user: {
    id: '',
    name: 'Utilizador',
    email: '',
    role: 'USER',
    defaultCurrency: 'EUR',
    avatarUrl: null,
    createdAt: '',
    updatedAt: '',
  },
  categories: [],
  wallets: [],
  transactions: [],
  balance: '0.00',
};

type PendingDeleteTransaction = {
  id: string;
  description?: string;
};

export function DashboardPage(): JSX.Element {
  const { token, user } = useAuth();
  const { month, year } = useDateFilter();
  const { searchQuery } = useSearch();
  const { isDarkMode } = useTheme();
  const [dashboard, setDashboard] = useState<DashboardApiData>(INITIAL_DASHBOARD);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
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

    async function loadDashboard(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const result = await fetchDashboardData(
          tokenValue,
          {
            month,
            year,
          },
          searchQuery,
          controller.signal,
        );

        if (!isMounted) {
          return;
        }

        setDashboard(result);
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

        setErrorMessage('Falha inesperada ao carregar dashboard.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [month, reloadKey, searchQuery, token, year]);

  const currency = dashboard.user.defaultCurrency || user?.defaultCurrency || 'EUR';
  const totalBalanceLabel = useMemo(() => {
    const totalBalance = calculateTotalBalance(dashboard.transactions);
    return formatTotalBalance(totalBalance, currency);
  }, [currency, dashboard.transactions]);

  const expenseByCategory = useMemo(
    () => buildExpenseByCategoryData(dashboard.transactions, dashboard.categories),
    [dashboard.categories, dashboard.transactions],
  );

  const balanceTrend = useMemo(() => buildBalanceTrendData(dashboard.transactions), [dashboard.transactions]);

  const transactionGroups = useMemo(
    () => buildTransactionGroups(dashboard.transactions, currency),
    [currency, dashboard.transactions],
  );
  const transactionsById = useMemo(
    () => new Map(dashboard.transactions.map((transaction) => [transaction.id, transaction])),
    [dashboard.transactions],
  );

  async function handleCreateTransaction(payload: CreateTransactionInput): Promise<void> {
    if (!token) {
      throw new Error('Sessão expirada. Faz login novamente.');
    }

    const createdTransaction = await createTransaction(token, payload);

    setDashboard((current) => {
      const transactionDate = new Date(createdTransaction.transactionDate);
      const isInSelectedMonth =
        transactionDate.getMonth() + 1 === month && transactionDate.getFullYear() === year;

      if (!isInSelectedMonth) {
        return current;
      }

      if (!matchesSearchQuery(createdTransaction)) {
        return current;
      }

      const nextTransactions = sortTransactionsByDate([createdTransaction, ...current.transactions]);

      return {
        ...current,
        transactions: nextTransactions,
        balance: calculateTotalBalance(nextTransactions).toFixed(2),
      };
    });
  }

  function isInSelectedMonth(transactionDateIso: string): boolean {
    const transactionDate = new Date(transactionDateIso);
    return transactionDate.getMonth() + 1 === month && transactionDate.getFullYear() === year;
  }

  function sortTransactionsByDate(transactions: ApiTransaction[]): ApiTransaction[] {
    return [...transactions].sort(
      (left, right) =>
        new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime(),
    );
  }

  function matchesSearchQuery(transaction: ApiTransaction): boolean {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return true;
    }

    return (transaction.description ?? '').toLowerCase().includes(normalizedSearch);
  }

  async function handleUpdateTransaction(
    transactionId: string,
    payload: UpdateTransactionInput,
  ): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    const updatedTransaction = await updateTransaction(token, transactionId, payload);

    setDashboard((current) => {
      const withoutCurrentTransaction = current.transactions.filter(
        (transaction) => transaction.id !== transactionId,
      );
      const shouldIncludeUpdatedTransaction =
        isInSelectedMonth(updatedTransaction.transactionDate) && matchesSearchQuery(updatedTransaction);

      const nextTransactions = shouldIncludeUpdatedTransaction
        ? sortTransactionsByDate([updatedTransaction, ...withoutCurrentTransaction])
        : withoutCurrentTransaction;

      return {
        ...current,
        transactions: nextTransactions,
        balance: calculateTotalBalance(nextTransactions).toFixed(2),
      };
    });
  }

  async function handleDeleteTransaction(transactionId: string): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    await deleteTransaction(token, transactionId);

    setDashboard((current) => {
      const nextTransactions = current.transactions.filter(
        (transaction) => transaction.id !== transactionId,
      );

      return {
        ...current,
        transactions: nextTransactions,
        balance: calculateTotalBalance(nextTransactions).toFixed(2),
      };
    });
  }

  function resolveTransactionDescription(transaction: ApiTransaction | undefined): string | undefined {
    if (!transaction) {
      return undefined;
    }

    const trimmedDescription = transaction.description?.trim();

    if (trimmedDescription) {
      return trimmedDescription;
    }

    if (transaction.category?.name) {
      return transaction.category.name;
    }

    return transaction.type === 'EXPENSE' ? 'Expense' : 'Income';
  }

  function handleRequestDeleteTransaction(transactionId: string): void {
    const transaction = transactionsById.get(transactionId);
    const description = resolveTransactionDescription(transaction);

    setPendingDeleteTransaction({
      id: transactionId,
      description,
    });
  }

  async function handleConfirmDeleteTransaction(): Promise<void> {
    if (!pendingDeleteTransaction) {
      return;
    }

    setIsDeletingTransaction(true);

    try {
      await handleDeleteTransaction(pendingDeleteTransaction.id);
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

  async function handleImportTransactions(payload: ImportTransactionsInput): Promise<void> {
    if (!token) {
      throw new Error('Sessão expirada. Faz login novamente.');
    }

    const result = await importTransactionsCsv(token, payload);
    window.alert(`${result.importedCount} transações importadas com sucesso!`);
    setReloadKey((value) => value + 1);
  }

  function handleStartEditing(transactionId: string): void {
    const transaction = transactionsById.get(transactionId) ?? null;
    setEditingTransaction(transaction);
  }

  return (
    <>
      <AppShell activeItem="dashboard">
        <TopHeader
          balanceLabel={totalBalanceLabel}
          onAddTransaction={() => setIsModalOpen(true)}
          onImportCsv={() => setIsImportModalOpen(true)}
        />

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            A carregar dados da API...
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
              Tentar novamente
            </button>
          </section>
        ) : null}

        {!errorMessage ? (
          <>
            <ChartCards
              expenseByCategory={expenseByCategory}
              balanceTrend={balanceTrend}
              currency={currency}
              isDarkMode={isDarkMode}
            />
            <TransactionsList
              groups={transactionGroups}
              searchQuery={searchQuery}
              onEdit={handleStartEditing}
              onDelete={handleRequestDeleteTransaction}
            />
          </>
        ) : null}
      </AppShell>

      <NewTransactionModal
        open={isModalOpen}
        categories={dashboard.categories}
        wallets={dashboard.wallets}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTransaction}
      />

      <ImportCsvModal
        open={isImportModalOpen}
        wallets={dashboard.wallets}
        onClose={() => setIsImportModalOpen(false)}
        onSubmit={handleImportTransactions}
      />

      <EditTransactionModal
        open={editingTransaction !== null}
        transaction={editingTransaction}
        categories={dashboard.categories}
        wallets={dashboard.wallets}
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
          void handleConfirmDeleteTransaction();
        }}
      />
    </>
  );
}
