import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ActionButton } from '../design/ActionButton';
import { CONTROL_INPUT_CLASS_NAME, FieldControl } from '../design/FieldControl';
import { ModalSurface } from '../design/ModalSurface';
import { StatusBanner } from '../design/StatusBanner';
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
    <ModalSurface size="lg" labelledBy="edit-transaction-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="edit-transaction-title" className="ds-display text-lg font-semibold text-[color:var(--text-main)]">
          Edit Transaction
        </h2>
        <ActionButton type="button" variant="neutral" size="sm" onClick={onClose} disabled={isSubmitting}>
          Close
        </ActionButton>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <FieldControl label="Type" htmlFor="edit-transaction-type">
          <select
            id="edit-transaction-type"
            value={type}
            onChange={(event) => setType(event.target.value as 'INCOME' | 'EXPENSE')}
            className={CONTROL_INPUT_CLASS_NAME}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </FieldControl>

        <FieldControl label="Wallet" htmlFor="edit-transaction-wallet">
          <select
            id="edit-transaction-wallet"
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

        <FieldControl label="Amount" htmlFor="edit-transaction-amount">
          <input
            id="edit-transaction-amount"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            min="0"
            step="0.01"
            required
            className={CONTROL_INPUT_CLASS_NAME}
          />
        </FieldControl>

        <FieldControl label="Description" htmlFor="edit-transaction-description">
          <input
            id="edit-transaction-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={255}
            className={CONTROL_INPUT_CLASS_NAME}
          />
        </FieldControl>

        <FieldControl label="Date and time" htmlFor="edit-transaction-date">
          <input
            id="edit-transaction-date"
            type="datetime-local"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
            required
            className={CONTROL_INPUT_CLASS_NAME}
          />
        </FieldControl>

        {type === 'EXPENSE' ? (
          <FieldControl label="Category" htmlFor="edit-transaction-category">
            <select
              id="edit-transaction-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
              className={CONTROL_INPUT_CLASS_NAME}
            >
              <option value="">Select category</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FieldControl>
        ) : null}

        {!hasWallets ? (
          <StatusBanner tone="info">No wallets found. Create a wallet first in Accounts &amp; Cards.</StatusBanner>
        ) : null}

        {errorMessage ? <StatusBanner tone="danger">{errorMessage}</StatusBanner> : null}

        <div className="flex justify-end gap-2 pt-2">
          <ActionButton type="button" variant="neutral" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" disabled={isSubmitting || !hasWallets}>
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </ActionButton>
        </div>
      </form>
    </ModalSurface>
  );
}
