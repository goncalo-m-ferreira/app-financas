import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonthYearSelector } from '../components/common/MonthYearSelector';
import { Sidebar } from '../components/dashboard/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import { useTheme } from '../context/ThemeContext';
import { ApiClientError, createReport, fetchReports } from '../services/api';
import type { ApiReport } from '../types/finance';

const POLLING_INTERVAL_MS = 5000;

function resolveReportUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }

  const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');

  if (configuredApiBaseUrl) {
    const origin = configuredApiBaseUrl.replace(/\/api$/, '');
    return `${origin}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`;
  }

  if (typeof window === 'undefined') {
    return fileUrl;
  }

  return `${window.location.protocol}//${window.location.hostname}:4010${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`;
}

function getStatusBadgeClass(status: ApiReport['status']): string {
  if (status === 'COMPLETED') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }

  if (status === 'FAILED') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  }

  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
}

export function ReportsPage(): JSX.Element {
  const { token, logout } = useAuth();
  const { month, year } = useDateFilter();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
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

        const data = await fetchReports(tokenValue, controller.signal);

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

    loadReports();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [refreshTick, token]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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
      const createdReport = await createReport(token, {
        month,
        year,
      });

      setReports((current) => [createdReport, ...current]);
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

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#eef0f1] p-3 dark:bg-[#020617] lg:p-5">
      <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#f6f7f8] shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-[#0b1220] dark:shadow-[0_20px_55px_rgba(2,6,23,0.85)]">
        <div className="lg:grid lg:grid-cols-[240px_1fr]">
          <Sidebar isDarkMode={isDarkMode} onToggleTheme={toggleTheme} activeItem="reports" />

          <main className="space-y-4 p-4 lg:p-6" aria-live="polite">
            <header className="rounded-xl bg-slate-50 px-6 py-6 dark:bg-slate-950/50">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    Reports
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Generate asynchronous monthly PDF reports via RabbitMQ.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <MonthYearSelector />
                  <button
                    type="button"
                    onClick={() => void handleGenerateReport()}
                    disabled={isGenerating}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isGenerating ? 'Enqueuing...' : 'Generate Monthly Report'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefreshTick((current) => current + 1)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </header>

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
                <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  No reports generated yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Created At</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reports.map((report) => (
                        <tr key={report.id} className="bg-white dark:bg-slate-900">
                          <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-100">
                            {report.name}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={[
                                'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                                getStatusBadgeClass(report.status),
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
                            {report.status === 'COMPLETED' && report.fileUrl ? (
                              <a
                                href={resolveReportUrl(report.fileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                              >
                                Download
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
