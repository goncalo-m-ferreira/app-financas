import { useState, type FormEvent } from 'react';
import type { ApiExpenseCategory, CreateBudgetInput } from '../../types/finance';

type NewBudgetModalProps = {
  open: boolean;
  categories: ApiExpenseCategory[];
  totalCategoriesCount: number;
  onClose: () => void;
  onSubmit: (payload: CreateBudgetInput) => Promise<void>;
};

export function NewBudgetModal({
  open,
  categories,
  totalCategoriesCount,
  onClose,
  onSubmit,
}: NewBudgetModalProps): JSX.Element | null {
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const hasNoCategories = totalCategoriesCount === 0;
  const hasNoAvailableCategories = !hasNoCategories && categories.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);

    if (!categoryId) {
      setErrorMessage('Select a category.');
      return;
    }

    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('amount must be greater than 0.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        categoryId,
        amount: parsedAmount,
      });

      setAmount('');
      setCategoryId('');
      onClose();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to create budget.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-budget-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-budget-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            New Budget
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
              disabled={hasNoCategories || hasNoAvailableCategories}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Monthly limit</span>
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              min="0"
              step="0.01"
              required
              disabled={hasNoCategories || hasNoAvailableCategories}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          {hasNoCategories ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No categories found. Please create an expense category first.
            </p>
          ) : null}

          {hasNoAvailableCategories ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              All categories already have a budget. Edit an existing budget before creating a new one.
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || hasNoCategories || hasNoAvailableCategories}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Saving...' : 'Create budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
