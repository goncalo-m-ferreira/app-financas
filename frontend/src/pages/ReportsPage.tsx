import { useEffect, useMemo, useState } from 'react';
import { MonthYearSelector } from '../components/common/MonthYearSelector';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import {
  ApiClientError,
  createReport,
  downloadReport,
  fetchReports,
  regenerateReport,
} from '../services/api';
import type { ApiReport } from '../types/finance';

const POLLING_INTERVAL_MS = 5000;
const FAILED_REASON_FALLBACK = 'This report failed to generate. Please try regenerate.';

type StatusFilterOption = 'ALL' | ApiReport['status'];

function resolveStatusBadgeClass(status: ApiReport['status']): string {
  if (status === 'COMPLETED') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }

  if (status === 'FAILED') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  }

  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
}

function resolveStatusFilterValue(value: StatusFilterOption): ApiReport['status'] | undefined {
  return value === 'ALL' ? undefined : value;
}

function formatReportPeriod(month: number, year: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function resolveFailureReason(report: ApiReport): string {
  const reason = report.errorMessage?.trim();
  return reason && reason.length > 0 ? reason : FAILED_REASON_FALLBACK;
}

function downloadBlobToFile(blob: Blob, report: ApiReport): void {
  if (typeof window === 'undefined' || typeof window.URL.createObjectURL !== 'function') {
    throw new Error('Download is not available in this environment.');
  }

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = report.name.toLowerCase().endsWith('.pdf') ? report.name : `${report.name}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function ReportsPage(): JSX.Element {
  const { token } = useAuth();
  const { month, year } = useDateFilter();
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('ALL');
  const [regeneratingIds, setRegeneratingIds] = useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadReports(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const data = await fetchReports(
          tokenValue,
          {
            status: resolveStatusFilterValue(statusFilter),
            month,
            year,
          },
          controller.signal,
        );

        if (!isMounted) {
          return;
        }

        setReports(data);
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

        setErrorMessage('Unexpected error while loading reports.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [month, refreshTick, statusFilter, token, year]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(year, month - 1, 1)),
    [month, year],
  );

  const hasPendingReports = useMemo(
    () => reports.some((report) => report.status === 'PENDING'),
    [reports],
  );

  async function handleGenerateReport(): Promise<void> {
    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      await createReport(token, {
        month,
        year,
      });
      setRefreshTick((current) => current + 1);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to enqueue report generation.');
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRegenerate(report: ApiReport): Promise<void> {
    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    if (regeneratingIds.includes(report.id)) {
      return;
    }

    setErrorMessage(null);
    setRegeneratingIds((current) => [...current, report.id]);

    try {
      await regenerateReport(token, report.id);
      setRefreshTick((current) => current + 1);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to regenerate report.');
      }
    } finally {
      setRegeneratingIds((current) => current.filter((id) => id !== report.id));
    }
  }

  async function handleDownload(report: ApiReport): Promise<void> {
    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    if (downloadingIds.includes(report.id)) {
      return;
    }

    setErrorMessage(null);
    setDownloadingIds((current) => [...current, report.id]);

    try {
      const reportBlob = await downloadReport(token, report.id);
      downloadBlobToFile(reportBlob, report);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to download report.');
      }
    } finally {
      setDownloadingIds((current) => current.filter((id) => id !== report.id));
    }
  }

  return (
    <AppShell activeItem="reports">
      <PremiumPageHeader
        title="Reports"
        description="Generate asynchronous monthly PDF reports via RabbitMQ."
        actions={
          <>
            <MonthYearSelector variant="dashboardTopbar" />

            <label className="rounded-xl border border-slate-200/70 bg-white/75 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/65 dark:text-slate-300">
              <span className="mr-2 font-semibold">Status</span>
              <select
                aria-label="Report status filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilterOption)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleGenerateReport()}
              disabled={isGenerating}
              className="inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:from-blue-500 hover:to-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 active:scale-95 disabled:cursor-not-allowed disabled:opacity-65 disabled:shadow-none disabled:hover:from-blue-600 disabled:hover:to-cyan-500 disabled:active:scale-100"
            >
              {isGenerating ? 'Enqueuing...' : 'Generate Monthly Report'}
            </button>
            <button
              type="button"
              onClick={() => setRefreshTick((current) => current + 1)}
              className="inline-flex h-10 items-center rounded-lg border border-slate-300/80 bg-white/70 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
          </>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        Showing reports for <span className="font-semibold">{selectedMonthLabel}</span>. Month/year
        selection filters the list and is also used when generating new reports.
      </div>

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {hasPendingReports ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          At least one report is still processing. This page auto-refreshes every 5 seconds.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <header className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Your Reports
          </h2>
        </header>

        {loading ? (
          <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">No reports generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Period</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created At</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports.map((report) => {
                  const isDownloading = downloadingIds.includes(report.id);
                  const isRegenerating = regeneratingIds.includes(report.id);

                  return (
                    <tr key={report.id} className="bg-white dark:bg-slate-900">
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{report.name}</p>
                        {report.status === 'FAILED' ? (
                          <p className="mt-1 max-w-xl text-xs text-rose-600 dark:text-rose-300">
                            {resolveFailureReason(report)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                        {formatReportPeriod(report.month, report.year)}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={[
                            'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                            resolveStatusBadgeClass(report.status),
                          ].join(' ')}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                        {new Intl.DateTimeFormat('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(report.createdAt))}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {report.status === 'COMPLETED' ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleDownload(report);
                            }}
                            disabled={isDownloading}
                            className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                          >
                            {isDownloading ? 'Downloading...' : 'Download'}
                          </button>
                        ) : report.status === 'FAILED' ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleRegenerate(report);
                            }}
                            disabled={isRegenerating}
                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                          >
                            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
