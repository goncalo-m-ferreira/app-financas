import { useEffect, useRef } from 'react';
import { ActionButton } from '../design/ActionButton';
import { ModalSurface } from '../design/ModalSurface';
import { StatusBanner } from '../design/StatusBanner';
import type { ApiBudget } from '../../types/finance';

type BudgetDeleteConfirmModalProps = {
  open: boolean;
  budget: ApiBudget | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function BudgetDeleteConfirmModal({
  open,
  budget,
  isDeleting,
  onClose,
  onConfirm,
}: BudgetDeleteConfirmModalProps): JSX.Element | null {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  function handleRequestClose(): void {
    if (isDeleting) {
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
      closeButtonRef.current?.focus();
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
      if (event.key !== 'Escape' || isDeleting) {
        return;
      }

      event.preventDefault();
      onClose();
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isDeleting, onClose, open]);

  if (!open || !budget) {
    return null;
  }

  return (
    <ModalSurface size="sm" labelledBy="delete-budget-title" describedBy="delete-budget-description">
      <h2 id="delete-budget-title" className="ds-display text-lg font-semibold text-[color:var(--text-main)]">
        Delete Budget
      </h2>

      <StatusBanner tone="danger" className="mt-3" >
        <span id="delete-budget-description">
          Deleting this budget removes only the limit. Transactions and spending history remain intact.
        </span>
      </StatusBanner>

      <p className="mt-3 text-sm text-[color:var(--text-muted)]">
        Category: <span className="font-semibold text-[color:var(--text-main)]">{budget.category.name}</span>
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <ActionButton
          ref={closeButtonRef}
          type="button"
          variant="neutral"
          onClick={handleRequestClose}
          disabled={isDeleting}
        >
          Keep budget
        </ActionButton>
        <ActionButton type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete budget'}
        </ActionButton>
      </div>
    </ModalSurface>
  );
}
