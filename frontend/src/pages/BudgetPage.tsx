import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BudgetCards } from '../components/budgets/BudgetCards';
import { MonthYearSelector } from '../components/common/MonthYearSelector';
import { NewBudgetModal } from '../components/budgets/NewBudgetModal';
import { Sidebar } from '../components/dashboard/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import { useTheme } from '../context/ThemeContext';
import {
  ApiClientError,
  createBudget,
  fetchBudgets,
  fetchExpenseCategories,
} from '../services/api';
import type { ApiExpenseCategory, BudgetOverview, CreateBudgetInput } from '../types/finance';

const INITIAL_BUDGET_OVERVIEW: BudgetOverview = {
  currentMonth: {
    month: 1,
    year: 1970,
    start: '',
    endExclusive: '',
  },
  budgets: [],
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

export function BudgetPage(): JSX.Element {
  const { token, user, logout } = useAuth();
  const { month, year } = useDateFilter();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<BudgetOverview>(INITIAL_BUDGET_OVERVIEW);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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

  async function handleCreateBudget(payload: CreateBudgetInput): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    const createdBudget = await createBudget(token, payload);
    setOverview((current) => ({
      ...current,
      budgets: [...current.budgets.filter((budget) => budget.id !== createdBudget.id), createdBudget].sort(
        (left, right) => left.category.name.localeCompare(right.category.name),
      ),
    }));
    setReloadKey((value) => value + 1);
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
            <Sidebar isDarkMode={isDarkMode} onToggleTheme={toggleTheme} activeItem="budgets" />

            <main className="space-y-4 p-4 lg:p-6" aria-live="polite">
              <header className="rounded-xl bg-slate-50 px-6 py-6 dark:bg-slate-950/50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      Budgets
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Manage spending limits by category for {monthLabel}.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <MonthYearSelector />

                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      Total limit:{' '}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(totals.limit, currency)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      Total spent:{' '}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(totals.spent, currency)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      New Budget
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

              {!loading && !errorMessage ? (
                <BudgetCards budgets={overview.budgets} currency={currency} />
              ) : null}
            </main>
          </div>
        </div>
      </div>

      <NewBudgetModal
        open={isModalOpen}
        categories={availableCategories}
        totalCategoriesCount={categories.length}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateBudget}
      />
    </>
  );
}
