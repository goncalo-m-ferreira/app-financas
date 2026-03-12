import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ActionButton } from '../design/ActionButton';
import { CONTROL_INPUT_CLASS_NAME } from '../design/FieldControl';
import { ModalSurface } from '../design/ModalSurface';
import { StatusBanner } from '../design/StatusBanner';
import type {
  ApiExpenseCategory,
  ApiRecurringRule,
  ApiWallet,
  CreateRecurringRuleInput,
  RecurringEndMode,
  RecurringFrequency,
  RecurringPreviewResponse,
  UpdateRecurringRuleInput,
} from '../../types/finance';
import {
  dateTimeLocalToIso,
  formatRecurringDateTime,
  getDefaultDateTimeLocal,
  isoToDateTimeLocal,
} from '../../utils/recurring';

const PREVIEW_COUNT = 8;

type RecurringRuleFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  rule: ApiRecurringRule | null;
  wallets: ApiWallet[];
  categories: ApiExpenseCategory[];
  onClose: () => void;
  onCreate: (payload: CreateRecurringRuleInput) => Promise<void>;
  onUpdate: (ruleId: string, payload: UpdateRecurringRuleInput) => Promise<void>;
  onLoadPreview: (ruleId: string, count: number) => Promise<RecurringPreviewResponse>;
};

type RecurringFormState = {
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  description: string;
  walletId: string;
  categoryId: string;
  isSubscription: boolean;
  frequency: RecurringFrequency;
  timezone: string;
  startAt: string;
  endMode: RecurringEndMode;
  endAt: string;
  maxOccurrences: string;
};

function getDefaultTimezone(): string {
  if (typeof Intl === 'undefined') {
    return 'UTC';
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function getInitialCreateState(
  wallets: ApiWallet[],
  categories: ApiExpenseCategory[],
): RecurringFormState {
  const firstWalletId = wallets[0]?.id ?? '';
  const firstCategoryId = categories[0]?.id ?? '';

  return {
    type: 'EXPENSE',
    amount: '',
    description: '',
    walletId: firstWalletId,
    categoryId: firstCategoryId,
    isSubscription: false,
    frequency: 'MONTHLY',
    timezone: getDefaultTimezone(),
    startAt: getDefaultDateTimeLocal(),
    endMode: 'NONE',
    endAt: '',
    maxOccurrences: '',
  };
}

function getInitialEditState(rule: ApiRecurringRule): RecurringFormState {
  return {
    type: rule.type,
    amount: Number.parseFloat(rule.amount).toString(),
    description: rule.description ?? '',
    walletId: rule.walletId,
    categoryId: rule.categoryId ?? '',
    isSubscription: rule.isSubscription,
    frequency: rule.frequency,
    timezone: rule.timezone,
    startAt: isoToDateTimeLocal(rule.startAt),
    endMode: rule.endMode,
    endAt: isoToDateTimeLocal(rule.endAt),
    maxOccurrences: rule.maxOccurrences ? String(rule.maxOccurrences) : '',
  };
}

function normalizeDescription(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAmount(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseMaxOccurrences(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function sameIsoInstant(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return new Date(left).getTime() === new Date(right).getTime();
}

function buildUpdatePayload(rule: ApiRecurringRule, form: RecurringFormState): UpdateRecurringRuleInput {
  const payload: UpdateRecurringRuleInput = {};

  const amount = parseAmount(form.amount);
  const currentAmount = Number.parseFloat(rule.amount);

  if (amount !== null && Number.isFinite(currentAmount) && amount !== currentAmount) {
    payload.amount = amount;
  }

  const nextDescription = normalizeDescription(form.description);
  const currentDescription = rule.description ?? null;

  if (nextDescription !== currentDescription) {
    payload.description = nextDescription;
  }

  if (form.walletId !== rule.walletId) {
    payload.walletId = form.walletId;
  }

  if (rule.type === 'EXPENSE') {
    const nextCategoryId = form.categoryId || null;
    const currentCategoryId = rule.categoryId ?? null;

    if (nextCategoryId !== currentCategoryId) {
      payload.categoryId = nextCategoryId;
    }
  }

  if (form.isSubscription !== rule.isSubscription) {
    payload.isSubscription = form.isSubscription;
  }

  const nextTimezone = form.timezone.trim();
  if (nextTimezone !== rule.timezone) {
    payload.timezone = nextTimezone;
  }

  if (form.frequency !== rule.frequency) {
    payload.frequency = form.frequency;
  }

  const startAtIso = dateTimeLocalToIso(form.startAt);
  if (startAtIso && !sameIsoInstant(startAtIso, rule.startAt)) {
    payload.startAt = startAtIso;
  }

  if (form.endMode !== rule.endMode) {
    payload.endMode = form.endMode;
  }

  if (form.endMode === 'UNTIL_DATE') {
    const endAtIso = dateTimeLocalToIso(form.endAt);

    if (endAtIso && !sameIsoInstant(endAtIso, rule.endAt)) {
      payload.endAt = endAtIso;
    }

    if (rule.maxOccurrences !== null) {
      payload.maxOccurrences = null;
    }
  } else if (form.endMode === 'MAX_OCCURRENCES') {
    const maxOccurrences = parseMaxOccurrences(form.maxOccurrences);

    if (maxOccurrences !== null && maxOccurrences !== rule.maxOccurrences) {
      payload.maxOccurrences = maxOccurrences;
    }

    if (rule.endAt !== null) {
      payload.endAt = null;
    }
  } else {
    if (rule.endAt !== null) {
      payload.endAt = null;
    }

    if (rule.maxOccurrences !== null) {
      payload.maxOccurrences = null;
    }
  }

  return payload;
}

export function RecurringRuleFormModal({
  open,
  mode,
  rule,
  wallets,
  categories,
  onClose,
  onCreate,
  onUpdate,
  onLoadPreview,
}: RecurringRuleFormModalProps): JSX.Element | null {
  const [form, setForm] = useState<RecurringFormState>(() =>
    getInitialCreateState(wallets, categories),
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<RecurringPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.name.trim().length > 0),
    [categories],
  );

  const isEditMode = mode === 'edit';
  const activeRule = isEditMode ? rule : null;

  function handleRequestClose(): void {
    if (isSubmitting) {
      return;
    }

    onClose();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    if (isEditMode && activeRule) {
      setForm(getInitialEditState(activeRule));
      return;
    }

    setForm(getInitialCreateState(wallets, categories));
  }, [open, isEditMode, activeRule, wallets, categories]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!form.walletId && wallets.length > 0) {
      setForm((current) => ({
        ...current,
        walletId: wallets[0].id,
      }));
    }
  }, [form.walletId, open, wallets]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (form.type === 'INCOME' && form.categoryId) {
      setForm((current) => ({
        ...current,
        categoryId: '',
      }));
      return;
    }

    if (form.type === 'EXPENSE' && !form.categoryId && expenseCategories.length > 0) {
      setForm((current) => ({
        ...current,
        categoryId: expenseCategories[0].id,
      }));
    }
  }, [expenseCategories, form.categoryId, form.type, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setErrorMessage(null);
  }, [form, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!isEditMode || !activeRule) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const currentRule = activeRule;
    let isMounted = true;

    async function loadPreview(): Promise<void> {
      setPreview(null);
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const response = await onLoadPreview(currentRule.id, PREVIEW_COUNT);

        if (!isMounted) {
          return;
        }

        setPreview(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof Error) {
          setPreviewError(error.message);
        } else {
          setPreviewError('Failed to load preview.');
        }
      } finally {
        if (isMounted) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isMounted = false;
    };
  }, [open, isEditMode, activeRule, onLoadPreview]);

  useEffect(() => {
    if (!open) {
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
    if (open) {
      return;
    }

    if (isSubmitting) {
      setIsSubmitting(false);
    }

    setErrorMessage(null);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);

    if (triggerElementRef.current) {
      triggerElementRef.current.focus();
      triggerElementRef.current = null;
    }
  }, [isSubmitting, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || isSubmitting) {
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

  const title = isEditMode ? 'Edit Recurring Rule' : 'Add Recurring Rule';
  const hasWallets = wallets.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);

    const amount = parseAmount(form.amount);
    if (amount === null) {
      setErrorMessage('Amount must be greater than 0.');
      return;
    }

    if (!form.walletId) {
      setErrorMessage('Select a wallet.');
      return;
    }

    if (form.type === 'EXPENSE' && !form.categoryId) {
      setErrorMessage('Select a category for expense rules.');
      return;
    }

    const timezone = form.timezone.trim();
    if (!timezone) {
      setErrorMessage('Timezone is required.');
      return;
    }

    const startAtIso = dateTimeLocalToIso(form.startAt);
    if (!startAtIso) {
      setErrorMessage('Invalid start date/time.');
      return;
    }

    let endAtIso: string | null = null;
    let maxOccurrences: number | null = null;

    if (form.endMode === 'UNTIL_DATE') {
      endAtIso = dateTimeLocalToIso(form.endAt);

      if (!endAtIso) {
        setErrorMessage('Until date is required.');
        return;
      }
    }

    if (form.endMode === 'MAX_OCCURRENCES') {
      maxOccurrences = parseMaxOccurrences(form.maxOccurrences);

      if (maxOccurrences === null) {
        setErrorMessage('Max occurrences must be a positive number.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && activeRule) {
        const payload = buildUpdatePayload(activeRule, form);

        if (Object.keys(payload).length === 0) {
          setErrorMessage('No changes detected.');
          return;
        }

        await onUpdate(activeRule.id, payload);
      } else {
        const payload: CreateRecurringRuleInput = {
          type: form.type,
          amount,
          description: normalizeDescription(form.description) ?? undefined,
          walletId: form.walletId,
          categoryId: form.type === 'EXPENSE' ? form.categoryId : undefined,
          isSubscription: form.isSubscription,
          timezone,
          frequency: form.frequency,
          startAt: startAtIso,
          endMode: form.endMode,
          endAt: form.endMode === 'UNTIL_DATE' ? endAtIso : undefined,
          maxOccurrences: form.endMode === 'MAX_OCCURRENCES' ? maxOccurrences : undefined,
        };

        await onCreate(payload);
      }

      onClose();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to save recurring rule.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshPreview(): Promise<void> {
    if (!activeRule) {
      return;
    }

    setPreview(null);
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await onLoadPreview(activeRule.id, PREVIEW_COUNT);
      setPreview(response);
    } catch (error) {
      if (error instanceof Error) {
        setPreviewError(error.message);
      } else {
        setPreviewError('Failed to load preview.');
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <ModalSurface size="4xl" labelledBy="recurring-rule-form-title" className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="recurring-rule-form-title"
                className="ds-display text-lg font-semibold text-[color:var(--text-main)]"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                Edits affect future executions only.
              </p>
            </div>
            <ActionButton
              ref={closeButtonRef}
              type="button"
              variant="neutral"
              size="sm"
              onClick={handleRequestClose}
              disabled={isSubmitting}
            >
              Close
            </ActionButton>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[75vh] space-y-5 overflow-y-auto px-5 py-4">
            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Basic details
              </h3>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Type</span>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as 'INCOME' | 'EXPENSE',
                      }))
                    }
                    disabled={isEditMode}
                    className={CONTROL_INPUT_CLASS_NAME}
                  >
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Amount
                  </span>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    min="0"
                    step="0.01"
                    required
                    disabled={!hasWallets}
                    className={CONTROL_INPUT_CLASS_NAME}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Wallet
                  </span>
                  <select
                    value={form.walletId}
                    onChange={(event) => setForm((current) => ({ ...current, walletId: event.target.value }))}
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
                </label>

                {form.type === 'EXPENSE' ? (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Category
                    </span>
                    <select
                      value={form.categoryId}
                      onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                      required
                      disabled={!hasWallets}
                      className={CONTROL_INPUT_CLASS_NAME}
                    >
                      <option value="">Select category</option>
                      {expenseCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                    Income rules do not use category.
                  </div>
                )}

                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Description
                  </span>
                  <input
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    maxLength={255}
                    disabled={!hasWallets}
                    className={CONTROL_INPUT_CLASS_NAME}
                  />
                </label>

                <label className="inline-flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isSubscription}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isSubscription: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-900"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Mark as subscription</span>
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Schedule
              </h3>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Frequency
                  </span>
                  <select
                    value={form.frequency}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        frequency: event.target.value as RecurringFrequency,
                      }))
                    }
                    className={CONTROL_INPUT_CLASS_NAME}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Start date/time
                  </span>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))}
                    required
                    className={CONTROL_INPUT_CLASS_NAME}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Timezone
                  </span>
                  <input
                    value={form.timezone}
                    onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                    required
                    placeholder="Europe/Lisbon"
                    className={CONTROL_INPUT_CLASS_NAME}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ending rules
              </h3>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    End mode
                  </span>
                  <select
                    value={form.endMode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endMode: event.target.value as RecurringEndMode,
                      }))
                    }
                    className={CONTROL_INPUT_CLASS_NAME}
                  >
                    <option value="NONE">None</option>
                    <option value="UNTIL_DATE">Until date</option>
                    <option value="MAX_OCCURRENCES">Max occurrences</option>
                  </select>
                </label>

                {form.endMode === 'UNTIL_DATE' ? (
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Until date/time
                    </span>
                    <input
                      type="datetime-local"
                      value={form.endAt}
                      onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))}
                      required
                      className={CONTROL_INPUT_CLASS_NAME}
                    />
                  </label>
                ) : null}

                {form.endMode === 'MAX_OCCURRENCES' ? (
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Max occurrences
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.maxOccurrences}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, maxOccurrences: event.target.value }))
                      }
                      required
                      className={CONTROL_INPUT_CLASS_NAME}
                    />
                  </label>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Preview
                </h3>

                {isEditMode ? (
                  <ActionButton
                    type="button"
                    variant="neutral"
                    size="sm"
                    onClick={() => void handleRefreshPreview()}
                    disabled={previewLoading}
                  >
                    {previewLoading ? 'Refreshing...' : 'Refresh preview'}
                  </ActionButton>
                ) : null}
              </div>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Preview does not create transactions.
              </p>

              {!isEditMode ? (
                <div className="mt-3 rounded-md border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-muted)] px-3 py-3 text-sm text-[color:var(--text-muted)]">
                  Preview will be available after the first save.
                </div>
              ) : (
                <>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Preview reflects currently saved rule values.
                  </p>

                  {previewError ? (
                    <StatusBanner tone="danger" className="mt-3" role="alert">
                      <p>{previewError}</p>
                      <ActionButton
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleRefreshPreview()}
                        disabled={previewLoading}
                        className="mt-2"
                      >
                        {previewLoading ? 'Retrying...' : 'Retry preview'}
                      </ActionButton>
                    </StatusBanner>
                  ) : null}

                  {!previewError ? (
                    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Timezone
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                        {preview?.timezone ?? form.timezone}
                      </p>

                      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Next run
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                        {formatRecurringDateTime(
                          preview?.nextRunAt ?? activeRule?.nextRunAt ?? null,
                          preview?.timezone ?? form.timezone,
                        )}{' '}
                        ({preview?.timezone ?? form.timezone})
                      </p>

                      <ul className="mt-3 space-y-1.5">
                        {(preview?.occurrences ?? []).length === 0 ? (
                          <li className="text-sm text-slate-500 dark:text-slate-400">
                            No upcoming occurrences.
                          </li>
                        ) : (
                          (preview?.occurrences ?? []).map((occurrence) => (
                            <li
                              key={occurrence}
                              className="text-sm text-slate-700 dark:text-slate-300"
                            >
                              {formatRecurringDateTime(occurrence, preview?.timezone ?? form.timezone)} (
                              {preview?.timezone ?? form.timezone})
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </section>

            {!hasWallets ? (
              <StatusBanner tone="info">
                No wallets found. Create a wallet first in Accounts &amp; Cards.
              </StatusBanner>
            ) : null}

            {errorMessage ? (
              <StatusBanner tone="danger" role="alert">
                {errorMessage}
              </StatusBanner>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            <ActionButton
              type="button"
              variant="neutral"
              onClick={handleRequestClose}
              disabled={isSubmitting}
            >
              Cancel
            </ActionButton>
            <ActionButton
              type="submit"
              disabled={isSubmitting || !hasWallets}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save changes' : 'Create rule'}
            </ActionButton>
          </div>
        </form>
    </ModalSurface>
  );
}
