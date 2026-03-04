import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  ApiExpenseCategory,
  ApiTransaction,
  ApiWallet,
  UpdateTransactionInput,
} from '../../types/finance';

type EditTransactionModalProps = {
  open: boolean;
  transaction: ApiTransaction | null;
  categories: ApiExpenseCategory[];
  wallets: ApiWallet[];
  onClose: () => void;
  onSubmit: (transactionId: string, payload: UpdateTransactionInput) => Promise<void>;
};

function toDatetimeLocalValue(input: string): string {
  const parsedDate = new Date(input);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  const date = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

export function EditTransactionModal({
  open,
  transaction,
  categories,
  wallets,
  onClose,
  onSubmit,
}: EditTransactionModalProps): JSX.Element | null {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.name.trim().length > 0),
    [categories],
  );

  useEffect(() => {
    if (!open || !transaction) {
      return;
    }

    setType(transaction.type);
    setAmount(Number.parseFloat(transaction.amount).toString());
    setDescription(transaction.description ?? '');
    setTransactionDate(toDatetimeLocalValue(transaction.transactionDate));
    setCategoryId(transaction.categoryId ?? '');
    setWalletId(transaction.walletId ?? '');
    setErrorMessage(null);
  }, [open, transaction]);

  if (!open || !transaction) {
    return null;
  }

  const activeTransaction = transaction;
  const hasWallets = wallets.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);

    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Amount must be greater than 0.');
      return;
    }

    if (!walletId) {
      setErrorMessage('Select a wallet.');
      return;
    }

    if (type === 'EXPENSE' && !categoryId) {
      setErrorMessage('Select an expense category.');
      return;
    }

    const parsedDate = new Date(transactionDate);

    if (Number.isNaN(parsedDate.getTime())) {
      setErrorMessage('Invalid transaction date.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(activeTransaction.id, {
        type,
        amount: parsedAmount,
        description: description.trim() ? description.trim() : null,
        transactionDate: parsedDate.toISOString(),
        categoryId: type === 'EXPENSE' ? categoryId : null,
        walletId,
      });

      onClose();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to update transaction.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-transaction-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-transaction-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Edit Transaction
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
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as 'INCOME' | 'EXPENSE')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Amount</span>
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              min="0"
              step="0.01"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={255}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Date and time</span>
            <input
              type="datetime-local"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          {type === 'EXPENSE' ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
