import { useEffect, useRef } from 'react';
import { ActionButton } from '../design/ActionButton';
import { ModalSurface } from '../design/ModalSurface';
import { StatusBanner } from '../design/StatusBanner';

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
    <ModalSurface
      size="sm"
      labelledBy="cancel-recurring-rule-title"
      describedBy="cancel-recurring-rule-description"
    >
      <h2
        id="cancel-recurring-rule-title"
        className="ds-display text-lg font-semibold text-[color:var(--text-main)]"
      >
        Cancel Recurring Rule
      </h2>

      <StatusBanner tone="danger" className="mt-3">
        <span id="cancel-recurring-rule-description">
          This stops future executions without deleting history.
        </span>
      </StatusBanner>

      {ruleLabel ? (
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          Rule: <span className="font-semibold text-[color:var(--text-main)]">{ruleLabel}</span>
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <ActionButton
          ref={closeButtonRef}
          type="button"
          variant="neutral"
          onClick={handleRequestClose}
          disabled={isCancelling}
        >
          Keep rule
        </ActionButton>
        <ActionButton type="button" variant="danger" onClick={onConfirm} disabled={isCancelling}>
          {isCancelling ? 'Cancelling...' : 'Cancel rule'}
        </ActionButton>
      </div>
    </ModalSurface>
  );
}
