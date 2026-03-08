import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { ApiExpenseCategory, ApiWallet, CreateTransactionInput } from '../../types/finance';

type NewTransactionModalProps = {
  open: boolean;
  categories: ApiExpenseCategory[];
  wallets: ApiWallet[];
  onClose: () => void;
  onSubmit: (payload: CreateTransactionInput) => Promise<void>;
};

function getDefaultDateTimeLocal(): string {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

export function NewTransactionModal({
  open,
  categories,
  wallets,
  onClose,
  onSubmit,
}: NewTransactionModalProps): JSX.Element | null {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(getDefaultDateTimeLocal());
  const [categoryId, setCategoryId] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef<boolean>(false);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.name.trim().length > 0),
    [categories],
  );

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setErrorMessage(null);
      setIsSubmitting(false);
      return;
    }

    if (wasOpenRef.current) {
      return;
    }

    wasOpenRef.current = true;

    setType('EXPENSE');
    setAmount('');
    setDescription('');
    setTransactionDate(getDefaultDateTimeLocal());
    setCategoryId('');
    setWalletId(wallets[0]?.id ?? '');
    setErrorMessage(null);
    setIsSubmitting(false);

    const focusId = window.requestAnimationFrame(() => {
      amountInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusId);
    };
  }, [open, wallets]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return;
      }

      if (isSubmitting) {
        event.preventDefault();
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

  if (!open) {
    return null;
  }

  const hasWallets = wallets.length > 0;
  const inputsDisabled = !hasWallets || isSubmitting;

  function handleRequestClose(): void {
    if (isSubmitting) {
      return;
    }

    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);

    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Amount must be greater than 0.');
      return;
    }

    if (type === 'EXPENSE' && !categoryId) {
      setErrorMessage('Select an expense category.');
      return;
    }

    if (!walletId) {
      setErrorMessage('Select a wallet.');
      return;
    }

    const parsedDate = new Date(transactionDate);

    if (Number.isNaN(parsedDate.getTime())) {
      setErrorMessage('Invalid transaction date.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        type,
        amount: parsedAmount,
        description: description.trim() || undefined,
        transactionDate: parsedDate.toISOString(),
        categoryId: type === 'EXPENSE' ? categoryId : undefined,
        walletId,
      });

      handleRequestClose();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to create transaction.');
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
      aria-labelledby="new-transaction-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-transaction-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            New Transaction
          </h2>
          <button
            type="button"
            onClick={handleRequestClose}
            disabled={isSubmitting}
            className="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as 'INCOME' | 'EXPENSE')}
              disabled={inputsDisabled}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Wallet</span>
            <select
              value={walletId}
              onChange={(event) => setWalletId(event.target.value)}
              required
              disabled={inputsDisabled}
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
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Amount</span>
            <input
              ref={amountInputRef}
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              min="0"
              step="0.01"
              required
              disabled={inputsDisabled}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={255}
              disabled={inputsDisabled}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Date and time</span>
            <input
              type="datetime-local"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
              required
              disabled={inputsDisabled}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          {type === 'EXPENSE' ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                disabled={inputsDisabled}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Select category</option>
                {expenseCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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
              onClick={handleRequestClose}
              disabled={isSubmitting}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inputsDisabled}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Saving...' : 'Create transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
