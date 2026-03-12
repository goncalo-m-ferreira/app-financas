import { ActionButton } from '../design/ActionButton';
import { ModalSurface } from '../design/ModalSurface';
import { StatusBanner } from '../design/StatusBanner';

type DeleteConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName?: string;
  isDeleting?: boolean;
};

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  isDeleting = false,
}: DeleteConfirmModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalSurface size="sm" labelledBy="delete-confirm-title">
      <h2 id="delete-confirm-title" className="ds-display text-lg font-semibold text-[color:var(--text-main)]">
          Delete Transaction
      </h2>

      <StatusBanner tone="danger" className="mt-3">
          Are you absolutely sure you want to delete this transaction? This action cannot be undone.
      </StatusBanner>

      {itemName ? (
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          Item: <span className="font-semibold text-[color:var(--text-main)]">{itemName}</span>
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <ActionButton type="button" variant="neutral" onClick={onClose} disabled={isDeleting}>
          Cancel
        </ActionButton>
        <ActionButton type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </ActionButton>
      </div>
    </ModalSurface>
  );
}
