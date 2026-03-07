import { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
import { useAuth } from '../context/AuthContext';
import {
  ApiClientError,
  fetchAdminOverview,
  fetchAdminRecurringOperations,
} from '../services/api';
import type {
  AdminOverviewResponse,
  AdminRecurringOperationIssueType,
  AdminRecurringOperationsResponse,
} from '../types/finance';
import {
  getFriendlyRecurringReason,
  getRecurringExecutionStatusBadgeClass,
  getRecurringReasonToneClass,
  getRecurringRuleStatusBadgeClass,
} from '../utils/recurring-operation-presenter';
import { formatRecurringDateTime } from '../utils/recurring';

const INITIAL_OVERVIEW: AdminOverviewResponse = {
  summary: {
    totalUsers: 0,
  },
  users: [],
};

const INITIAL_RECURRING_OPERATIONS: AdminRecurringOperationsResponse = {
  summary: {
    failedExecutions: 0,
    pausedRules: 0,
    affectedUsers: 0,
  },
  items: [],
};

export function AdminPage(): JSX.Element {
  const { token } = useAuth();
  const [overview, setOverview] = useState<AdminOverviewResponse>(INITIAL_OVERVIEW);
  const [operations, setOperations] = useState<AdminRecurringOperationsResponse>(
    INITIAL_RECURRING_OPERATIONS,
  );
  const [issueFilter, setIssueFilter] = useState<'ALL' | AdminRecurringOperationIssueType>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadOverview(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const [result, operationsResult] = await Promise.all([
          fetchAdminOverview(tokenValue, 20, controller.signal),
          fetchAdminRecurringOperations(
            tokenValue,
            {
              take: 50,
              issueType: issueFilter === 'ALL' ? undefined : issueFilter,
            },
            controller.signal,
          ),
        ]);

        if (!isMounted) {
          return;
        }

        setOverview(result);
        setOperations(operationsResult);
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

        setErrorMessage('Falha ao carregar dados administrativos.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [issueFilter, reloadKey, token]);

  return (
    <AppShell activeItem="admin">
      <PremiumPageHeader
        title="Admin"
        description="Overview of registered accounts on the platform."
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex h-10 items-center rounded-lg border border-slate-300/80 bg-white/70 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total Accounts</p>
        <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {overview.summary.totalUsers}
        </p>
      </section>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Loading admin overview...
        </div>
      ) : null}

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!loading && !errorMessage ? (
        <>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <header className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Latest 20 Users
              </h2>
            </header>

            {overview.users.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                No users were found in the database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                      <th className="px-6 py-3">Name</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {overview.users.map((user) => (
                      <tr key={user.id} className="bg-white dark:bg-slate-900">
                        <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-100">{user.name}</td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{user.email}</td>
                        <td className="px-6 py-3">
                          <span
                            className={[
                              'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                              user.role === 'ADMIN'
                                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                            ].join(' ')}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                          {new Intl.DateTimeFormat('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(user.createdAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <header className="flex flex-wrap items-center gap-3">
              <h2 className="mr-auto text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recurring Operations
              </h2>

              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Issue
                </span>
                <select
                  value={issueFilter}
                  onChange={(event) => setIssueFilter(event.target.value as 'ALL' | AdminRecurringOperationIssueType)}
                  className="bg-transparent text-sm outline-none"
                >
                  <option value="ALL">All</option>
                  <option value="FAILED_EXECUTION">Failed executions</option>
                  <option value="PAUSED_RULE">Paused rules</option>
                </select>
              </label>
            </header>

            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Failed executions
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {operations.summary.failedExecutions}
                </p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Paused rules
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {operations.summary.pausedRules}
                </p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Affected users
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {operations.summary.affectedUsers}
                </p>
              </article>
            </div>

            {operations.items.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                No recurring operational issues found for the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Rule</th>
                      <th className="px-4 py-3">Last execution</th>
                      <th className="px-4 py-3">Failure / paused reason</th>
                      <th className="px-4 py-3">Scheduled / recent time</th>
                      <th className="px-4 py-3">Rule status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {operations.items.map((item) => {
                      const reason = getFriendlyRecurringReason({
                        issueType: item.issueType,
                        executionStatus: item.execution?.status,
                        errorType: item.execution?.errorType,
                        errorMessage: item.execution?.errorMessage,
                        ruleStatus: item.rule.status,
                        pausedReason: item.rule.pausedReason,
                      });

                      return (
                        <tr key={`${item.issueType}-${item.rule.id}-${item.execution?.id ?? item.occurredAt}`} className="bg-white dark:bg-slate-900">
                          <td className="px-4 py-3 align-top">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{item.user.name}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.user.email}</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                              {item.rule.description?.trim() || `${item.rule.type} recurring rule`}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {item.rule.amount} · {item.rule.frequency}
                            </p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            {item.execution ? (
                              <span
                                className={[
                                  'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                                  getRecurringExecutionStatusBadgeClass(item.execution.status),
                                ].join(' ')}
                              >
                                {item.execution.status}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className={['text-sm font-medium', getRecurringReasonToneClass(reason.tone)].join(' ')}>
                              {reason.label}
                            </p>
                            {reason.details ? (
                              <p className="mt-1 max-w-[260px] text-xs text-slate-500 dark:text-slate-400">
                                {reason.details}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                            <p>
                              {formatRecurringDateTime(
                                item.execution?.scheduledFor ?? item.occurredAt,
                                item.rule.timezone,
                              )}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {item.rule.timezone}
                            </p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span
                              className={[
                                'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                                getRecurringRuleStatusBadgeClass(item.rule.status),
                              ].join(' ')}
                            >
                              {item.rule.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
