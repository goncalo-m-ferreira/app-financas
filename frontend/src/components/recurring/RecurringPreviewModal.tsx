import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiRecurringRule, RecurringPreviewResponse } from '../../types/finance';
import { formatRecurringDateTime } from '../../utils/recurring';

const PREVIEW_COUNT = 12;

type RecurringPreviewModalProps = {
  open: boolean;
  rule: ApiRecurringRule | null;
  onClose: () => void;
  onLoadPreview: (ruleId: string, count: number) => Promise<RecurringPreviewResponse>;
};

export function RecurringPreviewModal({
  open,
  rule,
  onClose,
  onLoadPreview,
}: RecurringPreviewModalProps): JSX.Element | null {
  const [preview, setPreview] = useState<RecurringPreviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const loadRequestIdRef = useRef<number>(0);

  const loadPreviewForRule = useCallback(async (activeRule: ApiRecurringRule): Promise<void> => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    setPreview(null);
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await onLoadPreview(activeRule.id, PREVIEW_COUNT);
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      setPreview(response);
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to load recurring preview.');
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [onLoadPreview]);

  useEffect(() => {
    if (!open || !rule) {
      loadRequestIdRef.current += 1;
      setPreview(null);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const activeRule = rule;

    async function load(): Promise<void> {
      if (!isMounted) {
        return;
      }

      await loadPreviewForRule(activeRule);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [loadPreviewForRule, open, rule]);

  useEffect(() => {
    if (!open) {
      if (triggerElementRef.current) {
        triggerElementRef.current.focus();
        triggerElementRef.current = null;
      }
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
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      onClose();
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  if (!open || !rule) {
    return null;
  }

  const previewTimezone = preview?.timezone ?? rule.timezone;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurring-preview-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="recurring-preview-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Preview Occurrences
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Preview does not create transactions.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Rule</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
            {rule.description?.trim() || `${rule.type} recurring rule`}
          </p>

          <p className="mt-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Timezone</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{previewTimezone}</p>

          <p className="mt-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Next run</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
            {formatRecurringDateTime(preview?.nextRunAt ?? rule.nextRunAt, previewTimezone)} ({previewTimezone})
          </p>
        </div>

        {loading ? (
          <p className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Loading preview...
          </p>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                void loadPreviewForRule(rule);
              }}
              disabled={loading}
              className="mt-2 rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Retrying...' : 'Retry preview'}
            </button>
          </div>
        ) : null}

        {!loading && !errorMessage ? (
          <ul className="mt-4 space-y-2">
            {(preview?.occurrences ?? []).length === 0 ? (
              <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                No upcoming occurrences.
              </li>
            ) : (
              (preview?.occurrences ?? []).map((occurrence) => (
                <li
                  key={occurrence}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                >
                  {formatRecurringDateTime(occurrence, previewTimezone)} ({previewTimezone})
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
