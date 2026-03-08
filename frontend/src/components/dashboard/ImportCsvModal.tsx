import { useEffect, useRef, useState, type FormEvent } from 'react';
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
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-csv-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="import-csv-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Import CSV
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
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Wallet</span>
            <select
              value={walletId}
              onChange={(event) => setWalletId(event.target.value)}
              required
              disabled={!hasWallets}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Select wallet</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">CSV File</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              required
              disabled={!hasWallets}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:file:bg-slate-800 dark:file:text-slate-200"
            />
          </label>

          {!hasWallets ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No wallets found. Create a wallet first in Accounts & Cards.
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
              disabled={isSubmitting || !hasWallets}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Importing...' : 'Import CSV'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
