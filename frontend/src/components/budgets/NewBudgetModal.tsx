import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ActionButton } from '../design/ActionButton';
import { CONTROL_INPUT_CLASS_NAME, FieldControl } from '../design/FieldControl';
import { ModalSurface } from '../design/ModalSurface';
import { StatusBanner } from '../design/StatusBanner';
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
    <ModalSurface size="sm" labelledBy="new-budget-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="new-budget-title" className="ds-display text-lg font-semibold text-[color:var(--text-main)]">
          {isEditMode ? 'Edit Budget' : 'New Budget'}
        </h2>
        <ActionButton
          ref={closeButtonRef}
          type="button"
          variant="neutral"
          size="sm"
          onClick={handleRequestClose}
          disabled={isSubmitting}
        >
          Close
        </ActionButton>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        {isEditMode && activeBudget ? (
          <section className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
              Category
            </p>
            <p className="mt-1 break-words font-semibold text-[color:var(--text-main)]">{activeBudget.category.name}</p>
          </section>
        ) : (
          <FieldControl label="Category" htmlFor="budget-category-id">
            <select
              id="budget-category-id"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
              disabled={hasNoCategories || hasNoAvailableCategories || isSubmitting}
              className={CONTROL_INPUT_CLASS_NAME}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FieldControl>
        )}

        <FieldControl label="Monthly limit" htmlFor="budget-monthly-limit">
          <input
            id="budget-monthly-limit"
            ref={amountInputRef}
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            min="0"
            step="0.01"
            required
            disabled={((hasNoCategories || hasNoAvailableCategories) && !isEditMode) || isSubmitting}
            className={CONTROL_INPUT_CLASS_NAME}
          />
        </FieldControl>

        {hasNoCategories && !isEditMode ? (
          <StatusBanner tone="info">No categories found. Please create an expense category first.</StatusBanner>
        ) : null}

        {hasNoAvailableCategories && !isEditMode ? (
          <StatusBanner tone="info">
            All categories already have a budget. Edit an existing budget before creating a new one.
          </StatusBanner>
        ) : null}

        {localMessage ? <StatusBanner tone="info">{localMessage}</StatusBanner> : null}

        {errorMessage ? <StatusBanner tone="danger">{errorMessage}</StatusBanner> : null}

        <div className="flex justify-end gap-2 pt-2">
          <ActionButton type="button" variant="neutral" onClick={handleRequestClose} disabled={isSubmitting}>
            Cancel
          </ActionButton>
          <ActionButton
            type="submit"
            disabled={isSubmitting || (!isEditMode && (hasNoCategories || hasNoAvailableCategories))}
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Save changes' : 'Create budget'}
          </ActionButton>
        </div>
      </form>
    </ModalSurface>
  );
}
