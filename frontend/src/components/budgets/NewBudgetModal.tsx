import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  ApiBudget,
  ApiExpenseCategory,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../../types/finance';

type NewBudgetModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  budget: ApiBudget | null;
  categories: ApiExpenseCategory[];
  totalCategoriesCount: number;
  onClose: () => void;
  onCreate: (payload: CreateBudgetInput) => Promise<void>;
  onUpdate: (budgetId: string, payload: UpdateBudgetInput) => Promise<void>;
};

export function NewBudgetModal({
  open,
  mode,
  budget,
  categories,
  totalCategoriesCount,
  onClose,
  onCreate,
  onUpdate,
}: NewBudgetModalProps): JSX.Element | null {
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const isEditMode = mode === 'edit';
  const activeBudget = isEditMode ? budget : null;

  function handleRequestClose(): void {
    if (isSubmitting) {
      return;
    }

    onClose();
  }

  useEffect(() => {
    if (!open) {
      if (triggerElementRef.current) {
        triggerElementRef.current.focus();
        triggerElementRef.current = null;
      }
      return;
    }

    const activeElement = document.activeElement;
    triggerElementRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    const timeoutId = window.setTimeout(() => {
      amountInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || isSubmitting) {
        return;
      }

      event.preventDefault();
      onClose();
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isSubmitting, onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (isEditMode && activeBudget) {
      setAmount(Number.parseFloat(activeBudget.amount).toString());
      setCategoryId(activeBudget.categoryId);
    } else {
      setAmount('');
      setCategoryId(categories[0]?.id ?? '');
    }

    setErrorMessage(null);
    setLocalMessage(null);
    setIsSubmitting(false);
  }, [activeBudget, categories, isEditMode, open]);

  if (!open) {
    return null;
  }

  if (isEditMode && !activeBudget) {
    return null;
  }

  const hasNoCategories = totalCategoriesCount === 0;
  const hasNoAvailableCategories = !isEditMode && !hasNoCategories && categories.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setLocalMessage(null);

    if (!isEditMode && !categoryId) {
      setErrorMessage('Select a category.');
      return;
    }

    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('amount must be greater than 0.');
      return;
    }

    if (isEditMode && activeBudget) {
      const initialAmount = Number.parseFloat(activeBudget.amount);
      const normalizedInitialAmount = Number(initialAmount.toFixed(2));
      const normalizedNextAmount = Number(parsedAmount.toFixed(2));

      if (normalizedNextAmount === normalizedInitialAmount) {
        setLocalMessage('No changes detected.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && activeBudget) {
        await onUpdate(activeBudget.id, {
          amount: parsedAmount,
        });
      } else {
        await onCreate({
          categoryId,
          amount: parsedAmount,
        });
      }

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
            {isEditMode ? 'Edit Budget' : 'New Budget'}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleRequestClose}
            disabled={isSubmitting}
            className="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {isEditMode && activeBudget ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Category
              </p>
              <p className="mt-1 break-words font-semibold text-slate-900 dark:text-slate-100">
                {activeBudget.category.name}
              </p>
            </div>
          ) : (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                disabled={hasNoCategories || hasNoAvailableCategories || isSubmitting}
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
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Monthly limit</span>
            <input
              ref={amountInputRef}
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              min="0"
              step="0.01"
              required
              disabled={((hasNoCategories || hasNoAvailableCategories) && !isEditMode) || isSubmitting}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          {hasNoCategories && !isEditMode ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No categories found. Please create an expense category first.
            </p>
          ) : null}

          {hasNoAvailableCategories && !isEditMode ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              All categories already have a budget. Edit an existing budget before creating a new one.
            </p>
          ) : null}

          {localMessage ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              {localMessage}
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
              onClick={handleRequestClose}
              disabled={isSubmitting}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!isEditMode && (hasNoCategories || hasNoAvailableCategories))}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save changes' : 'Create budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
