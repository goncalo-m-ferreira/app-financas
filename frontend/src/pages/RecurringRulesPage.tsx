import { useEffect, useMemo, useState } from 'react';
import { RecurringCancelConfirmModal } from '../components/recurring/RecurringCancelConfirmModal';
import { RecurringPreviewModal } from '../components/recurring/RecurringPreviewModal';
import { RecurringRuleFormModal } from '../components/recurring/RecurringRuleFormModal';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
import { useAuth } from '../context/AuthContext';
import {
  ApiClientError,
  cancelRecurringRule,
  createRecurringRule,
  fetchExpenseCategories,
  fetchRecurringPreview,
  fetchRecurringRules,
  fetchWallets,
  pauseRecurringRule,
  resumeRecurringRule,
  updateRecurringRule,
} from '../services/api';
import type {
  ApiExpenseCategory,
  ApiRecurringRule,
  ApiWallet,
  CreateRecurringRuleInput,
  RecurringFrequency,
  RecurringRuleStatus,
  UpdateRecurringRuleInput,
} from '../types/finance';
import { formatRecurringDateTime } from '../utils/recurring';

type StatusFilter = 'ALL' | RecurringRuleStatus;
type FrequencyFilter = 'ALL' | RecurringFrequency;
type RowAction = 'PAUSING' | 'RESUMING' | 'CANCELLING';

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const FREQUENCY_FILTER_OPTIONS: Array<{ value: FrequencyFilter; label: string }> = [
  { value: 'ALL', label: 'All frequencies' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

function formatAmount(value: string, currency: string): string {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return `0.00 ${currency}`;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(parsed)
    .replace(/,/g, "'")
    .concat(` ${currency}`);
}

function getRuleLabel(rule: ApiRecurringRule): string {
  const description = rule.description?.trim();

  if (description) {
    return description;
  }

  return `${rule.type} recurring rule`;
}

function sortRulesByCreatedAt(rules: ApiRecurringRule[]): ApiRecurringRule[] {
  return [...rules].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function getStatusBadgeClass(status: RecurringRuleStatus): string {
  if (status === 'ACTIVE') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }

  if (status === 'PAUSED') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }

  if (status === 'COMPLETED') {
    return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
  }

  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
}

function getEndModeLabel(rule: ApiRecurringRule): { primary: string; secondary: string | null } {
  if (rule.endMode === 'NONE') {
    return {
      primary: 'None',
      secondary: null,
    };
  }

  if (rule.endMode === 'UNTIL_DATE') {
    return {
      primary: 'Until date',
      secondary: rule.endAt
        ? `${formatRecurringDateTime(rule.endAt, rule.timezone)} (${rule.timezone})`
        : null,
    };
  }

  return {
    primary: 'Max occurrences',
    secondary: rule.maxOccurrences ? `${rule.maxOccurrences} total` : null,
  };
}

function getAttentionMessage(rule: ApiRecurringRule): string | null {
  if (rule.status === 'PAUSED' && rule.pausedReason) {
    return rule.pausedReason;
  }

  if (rule.failureCount > 0) {
    if (rule.lastFailureAt) {
      return `Recent failure: ${formatRecurringDateTime(rule.lastFailureAt, rule.timezone)} (${rule.timezone})`;
    }

    return 'Recent failure detected.';
  }

  return null;
}

export function RecurringRulesPage(): JSX.Element {
  const { token, user } = useAuth();
  const [rules, setRules] = useState<ApiRecurringRule[]>([]);
  const [wallets, setWallets] = useState<ApiWallet[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRule, setEditingRule] = useState<ApiRecurringRule | null>(null);
  const [previewRule, setPreviewRule] = useState<ApiRecurringRule | null>(null);
  const [cancelTargetRule, setCancelTargetRule] = useState<ApiRecurringRule | null>(null);
  const [rowActions, setRowActions] = useState<Record<string, RowAction>>({});

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadData(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const [rulesResponse, walletsResponse, categoriesResponse] = await Promise.all([
          fetchRecurringRules(tokenValue, undefined, controller.signal),
          fetchWallets(tokenValue, controller.signal),
          fetchExpenseCategories(tokenValue, controller.signal),
        ]);

        if (!isMounted) {
          return;
        }

        setRules(sortRulesByCreatedAt(rulesResponse));
        setWallets(walletsResponse);
        setCategories(categoriesResponse);
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
          return;
        }

        if (error instanceof Error) {
          setErrorMessage(error.message);
          return;
        }

        setErrorMessage('Unexpected error while loading recurring rules.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [token]);

  const dueSoonCount = useMemo(() => {
    const now = new Date();
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return rules.filter((rule) => {
      if (rule.status !== 'ACTIVE' || !rule.nextRunAt) {
        return false;
      }

      const nextRun = new Date(rule.nextRunAt);
      if (Number.isNaN(nextRun.getTime())) {
        return false;
      }

      return nextRun.getTime() <= sevenDaysAhead.getTime();
    }).length;
  }, [rules]);

  const summary = useMemo(
    () => ({
      active: rules.filter((rule) => rule.status === 'ACTIVE').length,
      paused: rules.filter((rule) => rule.status === 'PAUSED').length,
      dueSoon: dueSoonCount,
      needsAttention: rules.filter(
        (rule) => rule.status === 'PAUSED' || rule.failureCount > 0,
      ).length,
    }),
    [dueSoonCount, rules],
  );

  const filteredRules = useMemo(
    () =>
      rules.filter((rule) => {
        if (statusFilter !== 'ALL' && rule.status !== statusFilter) {
          return false;
        }

        if (frequencyFilter !== 'ALL' && rule.frequency !== frequencyFilter) {
          return false;
        }

        return true;
      }),
    [rules, statusFilter, frequencyFilter],
  );

  const currency = user?.defaultCurrency || 'EUR';

  function replaceRule(updatedRule: ApiRecurringRule): void {
    setRules((current) => {
      const withoutRule = current.filter((rule) => rule.id !== updatedRule.id);
      return sortRulesByCreatedAt([updatedRule, ...withoutRule]);
    });
  }

  function setRowAction(ruleId: string, action: RowAction | null): void {
    setRowActions((current) => {
      if (!action) {
        const next = { ...current };
        delete next[ruleId];
        return next;
      }

      return {
        ...current,
        [ruleId]: action,
      };
    });
  }

  async function loadPreview(ruleId: string, count: number) {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    return fetchRecurringPreview(token, ruleId, count);
  }

  async function handleCreateRule(payload: CreateRecurringRuleInput): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    const createdRule = await createRecurringRule(token, payload);
    setRules((current) => sortRulesByCreatedAt([createdRule, ...current]));
  }

  async function handleUpdateRule(ruleId: string, payload: UpdateRecurringRuleInput): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    const updatedRule = await updateRecurringRule(token, ruleId, payload);
    replaceRule(updatedRule);
  }

  async function handlePauseRule(ruleId: string): Promise<void> {
    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    setErrorMessage(null);
    setRowAction(ruleId, 'PAUSING');

    try {
      const updatedRule = await pauseRecurringRule(token, ruleId);
      replaceRule(updatedRule);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to pause recurring rule.');
      }
    } finally {
      setRowAction(ruleId, null);
    }
  }

  async function handleResumeRule(ruleId: string): Promise<void> {
    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    setErrorMessage(null);
    setRowAction(ruleId, 'RESUMING');

    try {
      const updatedRule = await resumeRecurringRule(token, ruleId);
      replaceRule(updatedRule);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to resume recurring rule.');
      }
    } finally {
      setRowAction(ruleId, null);
    }
  }

  async function handleConfirmCancelRule(): Promise<void> {
    if (!token || !cancelTargetRule) {
      return;
    }

    setErrorMessage(null);
    setRowAction(cancelTargetRule.id, 'CANCELLING');

    try {
      const updatedRule = await cancelRecurringRule(token, cancelTargetRule.id);
      replaceRule(updatedRule);
      setCancelTargetRule(null);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to cancel recurring rule.');
      }
    } finally {
      setRowAction(cancelTargetRule.id, null);
    }
  }

  function openCreateModal(): void {
    setFormMode('create');
    setEditingRule(null);
    setIsFormOpen(true);
  }

  function openEditModal(rule: ApiRecurringRule): void {
    setFormMode('edit');
    setEditingRule(rule);
    setIsFormOpen(true);
  }

  function closeFormModal(): void {
    setIsFormOpen(false);
    setEditingRule(null);
  }

  return (
    <>
      <AppShell activeItem="recurring">
        <PremiumPageHeader
          title="Recurring Rules"
          description="Manage recurring income and expenses with clear status and scheduling."
          actions={
            <>
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="bg-transparent text-sm outline-none"
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Frequency
                </span>
                <select
                  value={frequencyFilter}
                  onChange={(event) => setFrequencyFilter(event.target.value as FrequencyFilter)}
                  className="bg-transparent text-sm outline-none"
                >
                  {FREQUENCY_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:from-blue-500 hover:to-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 active:scale-95"
              >
                Add Rule
              </button>
            </>
          }
        />

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Loading recurring rules...
          </div>
        ) : null}

        {errorMessage ? (
          <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p>{errorMessage}</p>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Recurring summary">
          <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Active</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.active}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Paused</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.paused}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Due / Next 7 days
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.dueSoon}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Needs attention
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {summary.needsAttention}
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Rules
            </h2>
          </header>

          {!loading && rules.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No recurring rules yet
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Create your first recurring rule to automate regular income and expenses.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:from-blue-500 hover:to-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 active:scale-95"
              >
                Add Rule
              </button>
            </div>
          ) : null}

          {!loading && rules.length > 0 && filteredRules.length === 0 ? (
            <div className="px-5 py-8">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No rules match current filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setFrequencyFilter('ALL');
                }}
                className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Clear filters
              </button>
            </div>
          ) : null}

          {!loading && filteredRules.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Wallet</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Frequency</th>
                    <th className="px-5 py-3">Next run</th>
                    <th className="px-5 py-3">End mode</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRules.map((rule) => {
                    const rowAction = rowActions[rule.id];
                    const isRowBusy = Boolean(rowAction);
                    const endMode = getEndModeLabel(rule);
                    const attentionMessage = getAttentionMessage(rule);
                    const canEdit = rule.status === 'ACTIVE' || rule.status === 'PAUSED';
                    const canPause = rule.status === 'ACTIVE';
                    const canResume = rule.status === 'PAUSED';
                    const canCancel = rule.status === 'ACTIVE' || rule.status === 'PAUSED';

                    return (
                      <tr key={rule.id} className="bg-white dark:bg-slate-900">
                        <td className="px-5 py-3 align-top">
                          <span
                            className={[
                              'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                              getStatusBadgeClass(rule.status),
                            ].join(' ')}
                          >
                            {rule.status}
                          </span>
                          {attentionMessage ? (
                            <p className="mt-2 max-w-[240px] text-xs text-slate-500 dark:text-slate-400">
                              {attentionMessage}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 align-top">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{getRuleLabel(rule)}</p>
                          {rule.isSubscription ? (
                            <span className="mt-1 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:border-cyan-800/60 dark:bg-cyan-900/20 dark:text-cyan-300">
                              Subscription
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 align-top text-slate-700 dark:text-slate-300">
                          {rule.type}
                        </td>
                        <td className="px-5 py-3 align-top text-right font-semibold text-slate-800 dark:text-slate-100">
                          {formatAmount(rule.amount, currency)}
                        </td>
                        <td className="px-5 py-3 align-top text-slate-700 dark:text-slate-300">
                          {rule.wallet.name}
                        </td>
                        <td className="px-5 py-3 align-top text-slate-700 dark:text-slate-300">
                          {rule.category?.name ?? '-'}
                        </td>
                        <td className="px-5 py-3 align-top text-slate-700 dark:text-slate-300">
                          {rule.frequency}
                        </td>
                        <td className="px-5 py-3 align-top">
                          <p className="text-slate-800 dark:text-slate-100">
                            {formatRecurringDateTime(rule.nextRunAt, rule.timezone)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rule.timezone}</p>
                        </td>
                        <td className="px-5 py-3 align-top">
                          <p className="text-slate-800 dark:text-slate-100">{endMode.primary}</p>
                          {endMode.secondary ? (
                            <p className="mt-1 max-w-[170px] text-xs text-slate-500 dark:text-slate-400">
                              {endMode.secondary}
                            </p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 align-top text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() => openEditModal(rule)}
                                disabled={isRowBusy}
                                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                Edit
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => setPreviewRule(rule)}
                              disabled={isRowBusy}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Preview
                            </button>

                            {canPause ? (
                              <button
                                type="button"
                                onClick={() => void handlePauseRule(rule.id)}
                                disabled={isRowBusy}
                                className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700/60 dark:text-amber-300 dark:hover:bg-amber-900/20"
                              >
                                {rowAction === 'PAUSING' ? 'Pausing...' : 'Pause'}
                              </button>
                            ) : null}

                            {canResume ? (
                              <button
                                type="button"
                                onClick={() => void handleResumeRule(rule.id)}
                                disabled={isRowBusy}
                                className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700/60 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                              >
                                {rowAction === 'RESUMING' ? 'Resuming...' : 'Resume'}
                              </button>
                            ) : null}

                            {canCancel ? (
                              <button
                                type="button"
                                onClick={() => setCancelTargetRule(rule)}
                                disabled={isRowBusy}
                                className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700/60 dark:text-rose-300 dark:hover:bg-rose-900/20"
                              >
                                {rowAction === 'CANCELLING' ? 'Cancelling...' : 'Cancel'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </AppShell>

      <RecurringRuleFormModal
        open={isFormOpen}
        mode={formMode}
        rule={editingRule}
        wallets={wallets}
        categories={categories}
        onClose={closeFormModal}
        onCreate={handleCreateRule}
        onUpdate={handleUpdateRule}
        onLoadPreview={loadPreview}
      />

      <RecurringPreviewModal
        open={previewRule !== null}
        rule={previewRule}
        onClose={() => setPreviewRule(null)}
        onLoadPreview={loadPreview}
      />

      <RecurringCancelConfirmModal
        open={cancelTargetRule !== null}
        ruleLabel={cancelTargetRule ? getRuleLabel(cancelTargetRule) : undefined}
        isCancelling={cancelTargetRule ? rowActions[cancelTargetRule.id] === 'CANCELLING' : false}
        onClose={() => {
          if (!cancelTargetRule || rowActions[cancelTargetRule.id] !== 'CANCELLING') {
            setCancelTargetRule(null);
          }
        }}
        onConfirm={() => {
          void handleConfirmCancelRule();
        }}
      />
    </>
  );
}
