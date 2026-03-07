import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
  fetchRecurringExecutions,
  fetchRecurringPreview,
  fetchRecurringRules,
  fetchWallets,
  pauseRecurringRule,
  resumeRecurringRule,
  updateRecurringRule,
} from '../services/api';
import type {
  ApiExpenseCategory,
  ApiRecurringExecution,
  ApiRecurringRule,
  ApiWallet,
  CreateRecurringRuleInput,
  RecurringExecutionStatus,
  RecurringFrequency,
  RecurringRuleStatus,
  UpdateRecurringRuleInput,
} from '../types/finance';
import {
  getFriendlyRecurringReason,
  getRecurringExecutionStatusBadgeClass,
  getRecurringReasonToneClass,
  getRecurringRuleStatusBadgeClass,
} from '../utils/recurring-operation-presenter';
import { formatRecurringDateTime } from '../utils/recurring';

type RecurringSegment = 'RULES' | 'EXECUTION_HISTORY';
type StatusFilter = 'ALL' | RecurringRuleStatus;
type FrequencyFilter = 'ALL' | RecurringFrequency;
type HistoryStatusFilter = 'ALL' | 'SUCCESS' | 'FAILED';
type RowAction = 'PAUSING' | 'RESUMING' | 'CANCELLING';

const HISTORY_PAGE_SIZE = 20;
const HIGHLIGHT_TTL_MS = 8000;
const SUCCESS_TOAST_TTL_MS = 2600;
const RULES_TAB_ID = 'recurring-rules-tab';
const RULES_PANEL_ID = 'recurring-rules-panel';
const HISTORY_TAB_ID = 'recurring-history-tab';
const HISTORY_PANEL_ID = 'recurring-history-panel';

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

const HISTORY_STATUS_FILTER_OPTIONS: Array<{
  value: HistoryStatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'All outcomes' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
];

function formatAmount(value: string | null | undefined, currency: string): string {
  const parsed = Number.parseFloat(value ?? '');

  if (!Number.isFinite(parsed)) {
    return `- ${currency}`;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(parsed)
    .replace(/,/g, "'")
    .concat(` ${currency}`);
}

function getRuleLabelFromValues(
  description: string | null | undefined,
  type: 'INCOME' | 'EXPENSE' | undefined,
): string {
  const trimmedDescription = description?.trim();

  if (trimmedDescription) {
    return trimmedDescription;
  }

  if (type) {
    return `${type} recurring rule`;
  }

  return 'Recurring rule';
}

function getRuleLabel(rule: ApiRecurringRule): string {
  return getRuleLabelFromValues(rule.description, rule.type);
}

function sortRulesByCreatedAt(rules: ApiRecurringRule[]): ApiRecurringRule[] {
  return [...rules].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
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
  const reason = getFriendlyRecurringReason({
    executionStatus: rule.failureCount > 0 ? 'FAILED' : undefined,
    errorType: rule.failureCount > 0 ? 'TRANSIENT' : null,
    errorMessage: null,
    ruleStatus: rule.status,
    pausedReason: rule.pausedReason,
  });

  if (rule.status === 'PAUSED' && reason.details) {
    return reason.details;
  }

  if (rule.failureCount > 0) {
    if (rule.lastFailureAt) {
      return `Recent failure: ${formatRecurringDateTime(rule.lastFailureAt, rule.timezone)} (${rule.timezone})`;
    }

    return reason.label;
  }

  return null;
}

function appendUniqueExecutions(
  current: ApiRecurringExecution[],
  nextBatch: ApiRecurringExecution[],
): ApiRecurringExecution[] {
  if (nextBatch.length === 0) {
    return current;
  }

  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];

  for (const item of nextBatch) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    merged.push(item);
  }

  return merged;
}

export function RecurringRulesPage(): JSX.Element {
  const { token, user } = useAuth();
  const [activeSegment, setActiveSegment] = useState<RecurringSegment>('RULES');
  const [rules, setRules] = useState<ApiRecurringRule[]>([]);
  const [wallets, setWallets] = useState<ApiWallet[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRule, setEditingRule] = useState<ApiRecurringRule | null>(null);
  const [previewRule, setPreviewRule] = useState<ApiRecurringRule | null>(null);
  const [cancelTargetRule, setCancelTargetRule] = useState<ApiRecurringRule | null>(null);
  const [rowActions, setRowActions] = useState<Record<string, RowAction>>({});
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);

  const [historyStatusFilter, setHistoryStatusFilter] =
    useState<HistoryStatusFilter>('ALL');
  const [historyRuleFilter, setHistoryRuleFilter] = useState<'ALL' | string>('ALL');
  const [historyItems, setHistoryItems] = useState<ApiRecurringExecution[]>([]);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState<boolean>(false);
  const [historyInitialErrorMessage, setHistoryInitialErrorMessage] = useState<string | null>(
    null,
  );
  const [historyLoadMoreErrorMessage, setHistoryLoadMoreErrorMessage] =
    useState<string | null>(null);
  const [historyReloadKey, setHistoryReloadKey] = useState<number>(0);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);

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
        setLoadErrorMessage(null);

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
          setLoadErrorMessage(error.message);
          return;
        }

        if (error instanceof Error) {
          setLoadErrorMessage(error.message);
          return;
        }

        setLoadErrorMessage('Unexpected error while loading recurring rules.');
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
  }, [reloadKey, token]);

  useEffect(() => {
    if (!token || activeSegment !== 'EXECUTION_HISTORY') {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadExecutionHistory(): Promise<void> {
      try {
        setHistoryLoading(true);
        setHistoryInitialErrorMessage(null);
        setHistoryLoadMoreErrorMessage(null);

        const response = await fetchRecurringExecutions(
          tokenValue,
          {
            status:
              historyStatusFilter === 'ALL'
                ? undefined
                : (historyStatusFilter as RecurringExecutionStatus),
            ruleId: historyRuleFilter === 'ALL' ? undefined : historyRuleFilter,
            take: HISTORY_PAGE_SIZE,
          },
          controller.signal,
        );

        if (!isMounted) {
          return;
        }

        setHistoryItems(response.items);
        setHistoryNextCursor(response.nextCursor);
        setExpandedExecutionId(null);
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setHistoryInitialErrorMessage(error.message);
          return;
        }

        if (error instanceof Error) {
          setHistoryInitialErrorMessage(error.message);
          return;
        }

        setHistoryInitialErrorMessage('Unexpected error while loading execution history.');
      } finally {
        if (isMounted) {
          setHistoryLoading(false);
        }
      }
    }

    void loadExecutionHistory();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [activeSegment, historyReloadKey, historyRuleFilter, historyStatusFilter, token]);

  useEffect(() => {
    if (!highlightedRuleId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedRuleId(null);
    }, HIGHLIGHT_TTL_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedRuleId]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, SUCCESS_TOAST_TTL_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  useEffect(() => {
    if (activeSegment !== 'RULES') {
      setHighlightedRuleId(null);
    }
  }, [activeSegment]);

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

  const rulesById = useMemo(
    () => new Map(rules.map((rule) => [rule.id, rule])),
    [rules],
  );

  useEffect(() => {
    if (!highlightedRuleId) {
      return;
    }

    const isStillVisible = filteredRules.some((rule) => rule.id === highlightedRuleId);
    if (!isStillVisible) {
      setHighlightedRuleId(null);
    }
  }, [filteredRules, highlightedRuleId]);

  useEffect(() => {
    if (historyRuleFilter === 'ALL') {
      return;
    }

    if (rulesById.has(historyRuleFilter)) {
      return;
    }

    setHistoryRuleFilter('ALL');
    setHistoryItems([]);
    setHistoryNextCursor(null);
    setHistoryInitialErrorMessage(null);
    setHistoryLoadMoreErrorMessage(null);
    setExpandedExecutionId(null);
  }, [historyRuleFilter, rulesById]);

  useEffect(() => {
    if (!expandedExecutionId) {
      return;
    }

    const exists = historyItems.some((item) => item.id === expandedExecutionId);
    if (!exists) {
      setExpandedExecutionId(null);
    }
  }, [expandedExecutionId, historyItems]);

  const currency = user?.defaultCurrency || 'EUR';
  const canLoadMoreHistory = historyNextCursor !== null;

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

  function showSuccess(message: string): void {
    setSuccessMessage(message);
  }

  function resetHistoryViewState(): void {
    setHistoryItems([]);
    setHistoryNextCursor(null);
    setHistoryInitialErrorMessage(null);
    setHistoryLoadMoreErrorMessage(null);
    setExpandedExecutionId(null);
  }

  const loadPreview = useCallback(async (ruleId: string, count: number) => {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    return fetchRecurringPreview(token, ruleId, count);
  }, [token]);

  async function handleCreateRule(payload: CreateRecurringRuleInput): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    setActionErrorMessage(null);
    const createdRule = await createRecurringRule(token, payload);
    setRules((current) => sortRulesByCreatedAt([createdRule, ...current]));
    showSuccess('Recurring rule created successfully.');
  }

  async function handleUpdateRule(ruleId: string, payload: UpdateRecurringRuleInput): Promise<void> {
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    setActionErrorMessage(null);
    const updatedRule = await updateRecurringRule(token, ruleId, payload);
    replaceRule(updatedRule);
    showSuccess('Recurring rule updated successfully.');
  }

  async function handlePauseRule(ruleId: string): Promise<void> {
    if (!token) {
      setActionErrorMessage('Session expired. Please sign in again.');
      return;
    }

    setActionErrorMessage(null);
    setRowAction(ruleId, 'PAUSING');

    try {
      const updatedRule = await pauseRecurringRule(token, ruleId);
      replaceRule(updatedRule);
      showSuccess('Recurring rule paused successfully.');
    } catch (error) {
      if (error instanceof Error) {
        setActionErrorMessage(error.message);
      } else {
        setActionErrorMessage('Failed to pause recurring rule.');
      }
    } finally {
      setRowAction(ruleId, null);
    }
  }

  async function handleResumeRule(ruleId: string): Promise<void> {
    if (!token) {
      setActionErrorMessage('Session expired. Please sign in again.');
      return;
    }

    setActionErrorMessage(null);
    setRowAction(ruleId, 'RESUMING');

    try {
      const updatedRule = await resumeRecurringRule(token, ruleId);
      replaceRule(updatedRule);
      showSuccess('Recurring rule resumed successfully.');
    } catch (error) {
      if (error instanceof Error) {
        setActionErrorMessage(error.message);
      } else {
        setActionErrorMessage('Failed to resume recurring rule.');
      }
    } finally {
      setRowAction(ruleId, null);
    }
  }

  async function handleConfirmCancelRule(): Promise<void> {
    if (!token || !cancelTargetRule) {
      return;
    }

    setActionErrorMessage(null);
    setRowAction(cancelTargetRule.id, 'CANCELLING');

    try {
      const updatedRule = await cancelRecurringRule(token, cancelTargetRule.id);
      replaceRule(updatedRule);
      setCancelTargetRule(null);
      showSuccess('Recurring rule cancelled successfully.');
    } catch (error) {
      if (error instanceof Error) {
        setActionErrorMessage(error.message);
      } else {
        setActionErrorMessage('Failed to cancel recurring rule.');
      }
    } finally {
      setRowAction(cancelTargetRule.id, null);
    }
  }

  async function handleLoadMoreHistory(): Promise<void> {
    if (!token || !historyNextCursor || historyLoadingMore) {
      return;
    }

    setHistoryLoadingMore(true);
    setHistoryLoadMoreErrorMessage(null);

    try {
      const response = await fetchRecurringExecutions(token, {
        status:
          historyStatusFilter === 'ALL'
            ? undefined
            : (historyStatusFilter as RecurringExecutionStatus),
        ruleId: historyRuleFilter === 'ALL' ? undefined : historyRuleFilter,
        take: HISTORY_PAGE_SIZE,
        cursor: historyNextCursor,
      });

      setHistoryItems((current) => appendUniqueExecutions(current, response.items));
      setHistoryNextCursor(response.nextCursor);
    } catch (error) {
      if (error instanceof Error) {
        setHistoryLoadMoreErrorMessage(error.message);
      } else {
        setHistoryLoadMoreErrorMessage('Failed to load more execution history.');
      }
    } finally {
      setHistoryLoadingMore(false);
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

  function handleRetryInitialLoad(): void {
    setReloadKey((current) => current + 1);
  }

  function handleRetryHistoryLoad(): void {
    setHistoryReloadKey((current) => current + 1);
  }

  function handleHistoryStatusFilterChange(nextFilter: HistoryStatusFilter): void {
    setHistoryStatusFilter(nextFilter);
    resetHistoryViewState();
  }

  function handleHistoryRuleFilterChange(nextRuleFilter: string): void {
    setHistoryRuleFilter(nextRuleFilter);
    resetHistoryViewState();
  }

  function handleViewRule(ruleId: string): void {
    setActiveSegment('RULES');
    setStatusFilter('ALL');
    setFrequencyFilter('ALL');
    setHighlightedRuleId(ruleId);
    setHistoryLoadMoreErrorMessage(null);
    setHistoryInitialErrorMessage(null);
    setExpandedExecutionId(null);
  }

  function handleSegmentChange(segment: RecurringSegment): void {
    setActiveSegment(segment);
    setExpandedExecutionId(null);
    setHistoryLoadMoreErrorMessage(null);
    if (segment === 'EXECUTION_HISTORY') {
      setHighlightedRuleId(null);
      return;
    }

    setHistoryInitialErrorMessage(null);
  }

  return (
    <>
      <AppShell activeItem="recurring">
        <PremiumPageHeader
          title="Recurring Rules"
          description="Manage recurring income, expenses, and execution operations."
          actions={
            activeSegment === 'RULES' ? (
              <>
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as StatusFilter);
                      setHighlightedRuleId(null);
                    }}
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
                    onChange={(event) => {
                      setFrequencyFilter(event.target.value as FrequencyFilter);
                      setHighlightedRuleId(null);
                    }}
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
            ) : (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:from-blue-500 hover:to-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 active:scale-95"
              >
                Add Rule
              </button>
            )
          }
        />

        <section className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          <div
            className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-950"
            role="tablist"
            aria-label="Recurring content segments"
          >
            <button
              type="button"
              id={RULES_TAB_ID}
              role="tab"
              aria-controls={RULES_PANEL_ID}
              aria-selected={activeSegment === 'RULES'}
              onClick={() => handleSegmentChange('RULES')}
              className={[
                'rounded-md px-4 py-2 text-sm font-semibold transition',
                activeSegment === 'RULES'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100',
              ].join(' ')}
            >
              Rules
            </button>
            <button
              type="button"
              id={HISTORY_TAB_ID}
              role="tab"
              aria-controls={HISTORY_PANEL_ID}
              aria-selected={activeSegment === 'EXECUTION_HISTORY'}
              onClick={() => handleSegmentChange('EXECUTION_HISTORY')}
              className={[
                'rounded-md px-4 py-2 text-sm font-semibold transition',
                activeSegment === 'EXECUTION_HISTORY'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100',
              ].join(' ')}
            >
              Execution History
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Loading recurring rules...
          </div>
        ) : null}

        {loadErrorMessage ? (
          <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p>{loadErrorMessage}</p>
            <button
              type="button"
              onClick={handleRetryInitialLoad}
              className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500"
            >
              Retry
            </button>
          </section>
        ) : null}

        {actionErrorMessage ? (
          <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p>{actionErrorMessage}</p>
          </section>
        ) : null}

        {activeSegment === 'RULES' ? (
          <div
            id={RULES_PANEL_ID}
            role="tabpanel"
            aria-labelledby={RULES_TAB_ID}
            className="space-y-3"
          >
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
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {summary.dueSoon}
                </p>
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
                      setHighlightedRuleId(null);
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
                          <tr
                            key={rule.id}
                            className={[
                              'bg-white dark:bg-slate-900',
                              highlightedRuleId === rule.id
                                ? 'bg-cyan-50/80 dark:bg-cyan-900/15'
                                : '',
                            ].join(' ')}
                          >
                            <td className="px-5 py-3 align-top">
                              <span
                                className={[
                                  'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                                  getRecurringRuleStatusBadgeClass(rule.status),
                                ].join(' ')}
                              >
                                {rule.status}
                              </span>
                              {attentionMessage ? (
                                <p className="mt-2 max-w-[240px] break-words text-xs text-slate-500 dark:text-slate-400">
                                  {attentionMessage}
                                </p>
                              ) : null}
                            </td>
                            <td className="max-w-[260px] px-5 py-3 align-top">
                              <p className="break-words font-medium text-slate-800 dark:text-slate-100">
                                {getRuleLabel(rule)}
                              </p>
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
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {rule.timezone}
                              </p>
                            </td>
                            <td className="px-5 py-3 align-top">
                              <p className="text-slate-800 dark:text-slate-100">{endMode.primary}</p>
                              {endMode.secondary ? (
                                <p className="mt-1 max-w-[170px] break-words text-xs text-slate-500 dark:text-slate-400">
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
          </div>
        ) : (
          <section
            id={HISTORY_PANEL_ID}
            role="tabpanel"
            aria-labelledby={HISTORY_TAB_ID}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="mr-auto text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Execution History
                </h2>

                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status
                  </span>
                  <select
                    value={historyStatusFilter}
                    onChange={(event) =>
                      handleHistoryStatusFilterChange(event.target.value as HistoryStatusFilter)
                    }
                    disabled={historyLoading || historyLoadingMore}
                    className="bg-transparent text-sm outline-none"
                  >
                    {HISTORY_STATUS_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Rule
                  </span>
                  <select
                    value={historyRuleFilter}
                    onChange={(event) => handleHistoryRuleFilterChange(event.target.value)}
                    disabled={historyLoading || historyLoadingMore}
                    className="bg-transparent text-sm outline-none"
                  >
                    <option value="ALL">All rules</option>
                    {rules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {getRuleLabel(rule)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </header>

            {historyLoading ? (
              <div className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
                Loading execution history...
              </div>
            ) : null}

            {historyInitialErrorMessage ? (
              <section className="m-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                <p>{historyInitialErrorMessage}</p>
                <button
                  type="button"
                  onClick={handleRetryHistoryLoad}
                  className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500"
                >
                  Retry
                </button>
              </section>
            ) : null}

            {!historyLoading && !historyInitialErrorMessage && historyItems.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  No execution history found
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Try changing filters or wait for upcoming recurring executions.
                </p>
              </div>
            ) : null}

            {!historyLoading && historyItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Scheduled for</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Rule</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3">Wallet</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Rule status</th>
                      <th className="px-5 py-3">Result / reason</th>
                      <th className="px-5 py-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {historyItems.map((execution) => {
                      const relatedRule = execution.rule ?? rulesById.get(execution.ruleId) ?? null;
                      const ruleLabel = getRuleLabelFromValues(
                        relatedRule?.description,
                        relatedRule?.type,
                      );
                      const amountValue = execution.transaction?.amount ?? relatedRule?.amount ?? null;
                      const amountType = execution.transaction?.type ?? relatedRule?.type;
                      const signedPrefix =
                        amountType === 'EXPENSE'
                          ? '-'
                          : amountType === 'INCOME'
                            ? '+'
                            : '';
                      const walletLabel =
                        execution.transaction?.wallet?.name ?? relatedRule?.wallet?.name ?? '-';
                      const categoryLabel =
                        execution.transaction?.category?.name ?? relatedRule?.category?.name ?? '-';
                      const reason = getFriendlyRecurringReason({
                        executionStatus: execution.status,
                        errorType: execution.errorType,
                        errorMessage: execution.errorMessage,
                        ruleStatus: relatedRule?.status ?? null,
                        pausedReason: relatedRule?.pausedReason ?? null,
                      });
                      const isExpanded = expandedExecutionId === execution.id;

                      return (
                        <Fragment key={execution.id}>
                          <tr className="bg-white dark:bg-slate-900">
                            <td className="px-5 py-3 align-top text-slate-700 dark:text-slate-300">
                              <p>
                                {formatRecurringDateTime(
                                  execution.scheduledFor,
                                  relatedRule?.timezone ?? 'UTC',
                                )}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {relatedRule?.timezone ?? 'UTC'}
                              </p>
                            </td>
                            <td className="px-5 py-3 align-top">
                              <span
                                className={[
                                  'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                                  getRecurringExecutionStatusBadgeClass(execution.status),
                                ].join(' ')}
                              >
                                {execution.status}
                              </span>
                            </td>
                            <td className="max-w-[240px] break-words px-5 py-3 align-top text-slate-800 dark:text-slate-100">
                              {ruleLabel}
                            </td>
                            <td className="px-5 py-3 align-top text-right font-semibold text-slate-800 dark:text-slate-100">
                              {signedPrefix}
                              {formatAmount(amountValue, currency)}
                            </td>
                            <td className="px-5 py-3 align-top text-slate-700 dark:text-slate-300">
                              {walletLabel}
                            </td>
                            <td className="px-5 py-3 align-top text-slate-700 dark:text-slate-300">
                              {categoryLabel}
                            </td>
                            <td className="px-5 py-3 align-top">
                              {relatedRule ? (
                                <span
                                  className={[
                                    'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                                    getRecurringRuleStatusBadgeClass(relatedRule.status),
                                  ].join(' ')}
                                >
                                  {relatedRule.status}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 dark:text-slate-500">Unknown</span>
                              )}
                            </td>
                            <td className="px-5 py-3 align-top">
                              <p
                                className={[
                                  'break-words text-sm font-medium',
                                  getRecurringReasonToneClass(reason.tone),
                                ].join(' ')}
                              >
                                {reason.label}
                              </p>
                              {reason.details ? (
                                <p className="mt-1 max-w-[260px] break-words text-xs text-slate-500 dark:text-slate-400">
                                  {reason.details}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-5 py-3 align-top text-right">
                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                aria-controls={`${execution.id}-details`}
                                aria-label={isExpanded ? 'Hide execution details' : 'View execution details'}
                                onClick={() =>
                                  setExpandedExecutionId((current) =>
                                    current === execution.id ? null : execution.id,
                                  )
                                }
                                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                {isExpanded ? 'Hide' : 'View'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="bg-slate-50/80 dark:bg-slate-950/50">
                              <td id={`${execution.id}-details`} colSpan={9} className="px-5 py-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Attempted at
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                                      {formatRecurringDateTime(
                                        execution.attemptedAt,
                                        relatedRule?.timezone ?? 'UTC',
                                      )}{' '}
                                      ({relatedRule?.timezone ?? 'UTC'})
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Transaction date
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                                      {formatRecurringDateTime(
                                        execution.transaction?.transactionDate ?? null,
                                        relatedRule?.timezone ?? 'UTC',
                                      )}{' '}
                                      ({relatedRule?.timezone ?? 'UTC'})
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Error type
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                                      {execution.errorType ?? '-'}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Error message
                                    </p>
                                    <p className="mt-1 break-words text-sm text-slate-700 dark:text-slate-300">
                                      {execution.errorMessage ?? '-'}
                                    </p>
                                  </div>
                                </div>

                                {relatedRule ? (
                                  <div className="mt-4 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleViewRule(relatedRule.id)}
                                      className="rounded-md border border-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-700/60 dark:text-cyan-300 dark:hover:bg-cyan-900/20"
                                    >
                                      View Rule
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {historyLoadMoreErrorMessage ? (
              <section className="m-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                <p>{historyLoadMoreErrorMessage}</p>
                <button
                  type="button"
                  onClick={() => void handleLoadMoreHistory()}
                  disabled={historyLoadingMore || historyLoading}
                  className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500"
                >
                  {historyLoadingMore ? 'Retrying...' : 'Retry load more'}
                </button>
              </section>
            ) : null}

            {!historyLoading && !historyInitialErrorMessage && canLoadMoreHistory ? (
              <div className="border-t border-slate-100 px-5 py-4 text-right dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => void handleLoadMoreHistory()}
                  disabled={historyLoadingMore || historyLoading}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {historyLoadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            ) : null}
          </section>
        )}
      </AppShell>

      {successMessage ? (
        <div
          className="fixed right-4 top-4 z-[60] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 shadow-lg dark:border-emerald-900/60 dark:bg-emerald-950/80 dark:text-emerald-300"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </div>
      ) : null}

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
