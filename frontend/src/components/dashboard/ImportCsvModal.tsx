import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ActionButton } from '../design/ActionButton';
import { CONTROL_INPUT_CLASS_NAME, FieldControl } from '../design/FieldControl';
import { ModalSurface } from '../design/ModalSurface';
import { StatusBanner } from '../design/StatusBanner';
import type { ApiWallet, ImportTransactionsInput } from '../../types/finance';

type ImportCsvModalProps = {
  open: boolean;
  wallets: ApiWallet[];
  onClose: () => void;
  onSubmit: (payload: ImportTransactionsInput) => Promise<void>;
};

const MAX_CLIENT_CSV_SIZE_BYTES = 2 * 1024 * 1024;

export function ImportCsvModal({
  open,
  wallets,
  onClose,
  onSubmit,
}: ImportCsvModalProps): JSX.Element | null {
  const [walletId, setWalletId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || walletId || wallets.length === 0) {
      return;
    }

    setWalletId(wallets[0].id);
  }, [open, walletId, wallets]);

  if (!open) {
    return null;
  }

  const hasWallets = wallets.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);

    if (!walletId) {
      setErrorMessage('Select a wallet for import.');
      return;
    }

    if (!file) {
      setErrorMessage('Select a CSV file.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Invalid format. Select a .csv file.');
      return;
    }

    if (file.size > MAX_CLIENT_CSV_SIZE_BYTES) {
      setErrorMessage('CSV exceeds the maximum allowed size (2MB).');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({ walletId, file });
      setFile(null);
      setErrorMessage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to import CSV.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalSurface size="sm" labelledBy="import-csv-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="import-csv-title" className="ds-display text-lg font-semibold text-[color:var(--text-main)]">
            Import CSV
        </h2>
        <ActionButton type="button" variant="neutral" size="sm" onClick={onClose}>
          Close
        </ActionButton>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <FieldControl label="Wallet" htmlFor="import-wallet-id">
            <select
              id="import-wallet-id"
              value={walletId}
              onChange={(event) => setWalletId(event.target.value)}
              required
              disabled={!hasWallets}
              className={CONTROL_INPUT_CLASS_NAME}
            >
              <option value="">Select wallet</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </select>
        </FieldControl>

        <FieldControl label="CSV File" htmlFor="import-csv-file">
            <input
              id="import-csv-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              required
              disabled={!hasWallets}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className={`${CONTROL_INPUT_CLASS_NAME} file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--surface-muted)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[color:var(--text-main)]`}
            />
        </FieldControl>

        {!hasWallets ? (
          <StatusBanner tone="info">
              No wallets found. Create a wallet first in Accounts & Cards.
          </StatusBanner>
        ) : null}

        {errorMessage ? <StatusBanner tone="danger">{errorMessage}</StatusBanner> : null}

        <div className="flex justify-end gap-2 pt-2">
          <ActionButton type="button" variant="neutral" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" disabled={isSubmitting || !hasWallets}>
            {isSubmitting ? 'Importing...' : 'Import CSV'}
          </ActionButton>
        </div>
      </form>
    </ModalSurface>
  );
}
