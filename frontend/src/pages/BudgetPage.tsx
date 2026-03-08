import { useEffect, useMemo, useState } from 'react';
import { BudgetCards } from '../components/budgets/BudgetCards';
import { BudgetDeleteConfirmModal } from '../components/budgets/BudgetDeleteConfirmModal';
import { MonthYearSelector } from '../components/common/MonthYearSelector';
import { NewBudgetModal } from '../components/budgets/NewBudgetModal';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import {
  ApiClientError,
  createBudget,
  deleteBudget,
  fetchBudgets,
  fetchExpenseCategories,
  updateBudget,
} from '../services/api';
import type {
  ApiBudget,
  ApiExpenseCategory,
  BudgetOverview,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../types/finance';

const INITIAL_BUDGET_OVERVIEW: BudgetOverview = {
  currentMonth: {
    month: 1,
    year: 1970,
    start: '',
    endExclusive: '',
  },
  budgets: [],
};

const SUCCESS_TOAST_TTL_MS = 2600;

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/,/g, "'")
    .concat(` ${currency}`);
}

export function BudgetPage(): JSX.Element {
  const { token, user } = useAuth();
  const { month, year } = useDateFilter();
  const [overview, setOverview] = useState<BudgetOverview>(INITIAL_BUDGET_OVERVIEW);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingBudget, setEditingBudget] = useState<ApiBudget | null>(null);
  const [pendingDeleteBudget, setPendingDeleteBudget] = useState<ApiBudget | null>(null);
  const [isDeletingBudget, setIsDeletingBudget] = useState<boolean>(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadBudgetData(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const [budgetsResponse, categoriesResponse] = await Promise.all([
          fetchBudgets(
            tokenValue,
            {
              month,
              year,
            },
            controller.signal,
          ),
          fetchExpenseCategories(tokenValue, controller.signal),
        ]);

        if (!isMounted) {
          return;
        }

        setOverview({
          ...budgetsResponse,
          budgets: [...budgetsResponse.budgets].sort((left, right) =>
            left.category.name.localeCompare(right.category.name),
          ),
        });
        setCategories(categoriesResponse);
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

        setErrorMessage('Unexpected error while loading budgets.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadBudgetData();

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

  const currency = user?.defaultCurrency || 'EUR';
  const monthLabel = useMemo(() => {
    const referenceDate = overview.currentMonth.start
      ? new Date(overview.currentMonth.start)
      : new Date(year, month - 1, 1);

    return new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
    }).format(referenceDate);
  }, [month, overview.currentMonth.start, year]);

  const availableCategories = useMemo(() => {
    const budgetedCategoryIds = new Set(overview.budgets.map((budget) => budget.categoryId));
    return categories.filter((category) => !budgetedCategoryIds.has(category.id));
  }, [categories, overview.budgets]);

  const totals = useMemo(() => {
    return overview.budgets.reduce(
      (accumulator, budget) => {
        const limit = Number.parseFloat(budget.amount);
        const spent = Number.parseFloat(budget.spentThisMonth);

        if (Number.isFinite(limit)) {
          accumulator.limit += limit;
        }

        if (Number.isFinite(spent)) {
          accumulator.spent += spent;
        }

        return accumulator;
      },
      { limit: 0, spent: 0 },
    );
  }, [overview.budgets]);

  function triggerCanonicalReload(): void {
    setReloadKey((value) => value + 1);
  }

  function openCreateModal(): void {
    setActionErrorMessage(null);
    setModalMode('create');
    setEditingBudget(null);
    setIsModalOpen(true);
  }

  function openEditModal(budget: ApiBudget): void {
    setActionErrorMessage(null);
    setModalMode('edit');
    setEditingBudget(budget);
    setIsModalOpen(true);
  }

  function closeBudgetModal(): void {
    setIsModalOpen(false);
  }

  function showSuccess(message: string): void {
    setSuccessMessage(message);
  }

  async function handleCreateBudget(payload: CreateBudgetInput): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    setActionErrorMessage(null);

    try {
      await createBudget(token, payload);
      showSuccess('Budget created successfully.');
      triggerCanonicalReload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create budget.';
      setActionErrorMessage(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async function handleUpdateBudget(
    budgetId: string,
    payload: UpdateBudgetInput,
  ): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    setActionErrorMessage(null);

    try {
      await updateBudget(token, budgetId, payload);
      showSuccess('Budget updated successfully.');
      triggerCanonicalReload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update budget.';
      setActionErrorMessage(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async function handleConfirmDeleteBudget(): Promise<void> {
    if (!token || !pendingDeleteBudget) {
      return;
    }

    setActionErrorMessage(null);
    setIsDeletingBudget(true);

    try {
      await deleteBudget(token, pendingDeleteBudget.id);
      setPendingDeleteBudget(null);
      showSuccess('Budget deleted successfully.');
      triggerCanonicalReload();
    } catch (error) {
      if (error instanceof Error) {
        setActionErrorMessage(error.message);
      } else {
        setActionErrorMessage('Failed to delete budget.');
      }
    } finally {
      setIsDeletingBudget(false);
    }
  }

  return (
    <>
      <AppShell activeItem="budgets">
        <PremiumPageHeader
          title="Budgets"
          description={`Manage spending limits by category for ${monthLabel}.`}
          actions={
            <>
              <MonthYearSelector variant="dashboardTopbar" />
              <div className="rounded-xl border border-slate-200/70 bg-white/75 px-3 py-2 text-xs text-slate-500 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/65 dark:text-slate-300">
                Total limit:{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totals.limit, currency)}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white/75 px-3 py-2 text-xs text-slate-500 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/65 dark:text-slate-300">
                Total spent:{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totals.spent, currency)}
                </span>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:from-blue-500 hover:to-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 active:scale-95"
              >
                New Budget
              </button>
            </>
          }
        />

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Loading budgets from API...
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

        {actionErrorMessage ? (
          <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p>{actionErrorMessage}</p>
          </section>
        ) : null}

        {!loading && !errorMessage ? (
          <BudgetCards
            budgets={overview.budgets}
            currency={currency}
            deletingBudgetId={isDeletingBudget ? pendingDeleteBudget?.id ?? null : null}
            onCreateFirstBudget={openCreateModal}
            onEditBudget={openEditModal}
            onDeleteBudget={(budget) => {
              setActionErrorMessage(null);
              setPendingDeleteBudget(budget);
            }}
          />
        ) : null}
      </AppShell>

      <NewBudgetModal
        open={isModalOpen}
        mode={modalMode}
        budget={editingBudget}
        categories={availableCategories}
        totalCategoriesCount={categories.length}
        onClose={closeBudgetModal}
        onCreate={handleCreateBudget}
        onUpdate={handleUpdateBudget}
      />

      <BudgetDeleteConfirmModal
        open={pendingDeleteBudget !== null}
        budget={pendingDeleteBudget}
        isDeleting={isDeletingBudget}
        onClose={() => {
          if (!isDeletingBudget) {
            setPendingDeleteBudget(null);
          }
        }}
        onConfirm={() => {
          void handleConfirmDeleteBudget();
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
