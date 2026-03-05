import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
import { useAuth } from '../context/AuthContext';
import {
  ApiClientError,
  createExpenseCategory,
  deleteExpenseCategory,
  fetchExpenseCategories,
} from '../services/api';
import type { ApiExpenseCategory } from '../types/finance';

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6})$/;
const DEFAULT_CATEGORY_COLOR = '#60a5fa';

export function CategoryEditorPage(): JSX.Element {
  const { token } = useAuth();
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState<string>('');
  const [color, setColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadSettingsData(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const categoriesData = await fetchExpenseCategories(tokenValue, controller.signal);

        if (!isMounted) {
          return;
        }

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

        setErrorMessage('Unexpected error while loading categories.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadSettingsData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [token]);

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.name.localeCompare(right.name)),
    [categories],
  );

  function validateColor(value: string): boolean {
    return HEX_COLOR_REGEX.test(value.trim());
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    const trimmedName = name.trim();
    const trimmedColor = color.trim();

    if (trimmedName.length < 2) {
      setErrorMessage('Name must be at least 2 characters.');
      return;
    }

    if (!validateColor(trimmedColor)) {
      setErrorMessage('Color must use HEX format (#RRGGBB).');
      return;
    }

    setIsCreating(true);

    try {
      const created = await createExpenseCategory(token, {
        name: trimmedName,
        color: trimmedColor,
      });

      setCategories((current) => [...current, created]);
      setName('');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to create category.');
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteCategory(categoryId: string): Promise<void> {
    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    setErrorMessage(null);
    setDeletingIds((current) => new Set(current).add(categoryId));

    try {
      await deleteExpenseCategory(token, categoryId);
      setCategories((current) => current.filter((category) => category.id !== categoryId));
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to delete category.');
      }
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(categoryId);
        return next;
      });
    }
  }

  return (
    <AppShell activeItem="categories">
      <PremiumPageHeader
        title="Category Editor"
        description="Manage expense categories used in transactions and budgets."
      />

      {errorMessage ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Expense Categories</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add and remove categories used across transactions and budgets.
          </p>
        </div>

        <form onSubmit={handleCreateCategory} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
              placeholder="e.g. Insurance"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={validateColor(color) ? color : DEFAULT_CATEGORY_COLOR}
                onChange={(event) => setColor(event.target.value)}
                aria-label="Choose category color"
                className="h-10 w-12 rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                value={color}
                onChange={(event) => setColor(event.target.value)}
                maxLength={7}
                placeholder="#60a5fa"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isCreating}
              className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCreating ? 'Adding...' : 'Add Category'}
            </button>
          </div>
        </form>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading categories...</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {sortedCategories.length === 0 ? (
              <li className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">No categories found.</li>
            ) : (
              sortedCategories.map((category) => {
                const isDeleting = deletingIds.has(category.id);
                const displayColor = validateColor(category.color ?? '')
                  ? (category.color as string)
                  : DEFAULT_CATEGORY_COLOR;

                return (
                  <li
                    key={category.id}
                    className="flex items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-slate-900"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: displayColor }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {category.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{displayColor}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDeleteCategory(category.id)}
                      disabled={isDeleting}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/20"
                      aria-label={`Delete category ${category.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
