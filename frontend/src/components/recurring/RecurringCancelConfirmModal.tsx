import { useEffect, useRef } from 'react';

type RecurringCancelConfirmModalProps = {
  open: boolean;
  ruleLabel?: string;
  isCancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function RecurringCancelConfirmModal({
  open,
  ruleLabel,
  isCancelling,
  onClose,
  onConfirm,
}: RecurringCancelConfirmModalProps): JSX.Element | null {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  function handleRequestClose(): void {
    if (isCancelling) {
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
      if (event.key !== 'Escape' || isCancelling) {
        return;
      }

      event.preventDefault();
      onClose();
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isCancelling, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-recurring-rule-title"
      aria-describedby="cancel-recurring-rule-description"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h2 id="cancel-recurring-rule-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Cancel Recurring Rule
        </h2>

        <p
          id="cancel-recurring-rule-description"
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
        >
          This stops future executions without deleting history.
        </p>

        {ruleLabel ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Rule: <span className="font-semibold text-slate-900 dark:text-slate-100">{ruleLabel}</span>
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleRequestClose}
            disabled={isCancelling}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Keep rule
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCancelling}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
