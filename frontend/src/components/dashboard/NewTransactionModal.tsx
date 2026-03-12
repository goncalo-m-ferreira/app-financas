import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ActionButton } from '../design/ActionButton';
import { CONTROL_INPUT_CLASS_NAME, FieldControl } from '../design/FieldControl';
import { ModalSurface } from '../design/ModalSurface';
import { StatusBanner } from '../design/StatusBanner';
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
    <ModalSurface size="lg" labelledBy="new-transaction-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="new-transaction-title" className="ds-display text-lg font-semibold text-[color:var(--text-main)]">
          New Transaction
        </h2>
        <ActionButton
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
        <FieldControl label="Type" htmlFor="new-transaction-type">
          <select
            id="new-transaction-type"
            value={type}
            onChange={(event) => setType(event.target.value as 'INCOME' | 'EXPENSE')}
            disabled={inputsDisabled}
            className={CONTROL_INPUT_CLASS_NAME}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </FieldControl>

        <FieldControl label="Wallet" htmlFor="new-transaction-wallet">
          <select
            id="new-transaction-wallet"
            value={walletId}
            onChange={(event) => setWalletId(event.target.value)}
            required
            disabled={inputsDisabled}
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

        <FieldControl label="Amount" htmlFor="new-transaction-amount">
          <input
            id="new-transaction-amount"
            ref={amountInputRef}
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            min="0"
            step="0.01"
            required
            disabled={inputsDisabled}
            className={CONTROL_INPUT_CLASS_NAME}
          />
        </FieldControl>

        <FieldControl label="Description" htmlFor="new-transaction-description">
          <input
            id="new-transaction-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={255}
            disabled={inputsDisabled}
            className={CONTROL_INPUT_CLASS_NAME}
          />
        </FieldControl>

        <FieldControl label="Date and time" htmlFor="new-transaction-date">
          <input
            id="new-transaction-date"
            type="datetime-local"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
            required
            disabled={inputsDisabled}
            className={CONTROL_INPUT_CLASS_NAME}
          />
        </FieldControl>

        {type === 'EXPENSE' ? (
          <FieldControl label="Category" htmlFor="new-transaction-category">
            <select
              id="new-transaction-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
              disabled={inputsDisabled}
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
          <ActionButton type="button" variant="neutral" onClick={handleRequestClose} disabled={isSubmitting}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" disabled={isSubmitting || !hasWallets}>
            {isSubmitting ? 'Saving...' : 'Create transaction'}
          </ActionButton>
        </div>
      </form>
    </ModalSurface>
  );
}
