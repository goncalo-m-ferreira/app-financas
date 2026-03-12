import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionButton } from '../design/ActionButton';
import { ModalSurface } from '../design/ModalSurface';
import { StatusBanner } from '../design/StatusBanner';
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
    <ModalSurface size="2xl" labelledBy="recurring-preview-title">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="recurring-preview-title" className="ds-display text-lg font-semibold text-[color:var(--text-main)]">
            Preview Occurrences
          </h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">Preview does not create transactions.</p>
        </div>

        <ActionButton ref={closeButtonRef} type="button" variant="neutral" size="sm" onClick={onClose}>
          Close
        </ActionButton>
      </div>

      <section className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-muted)] p-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Rule</p>
        <p className="mt-1 text-sm font-medium text-[color:var(--text-main)]">
          {rule.description?.trim() || `${rule.type} recurring rule`}
        </p>

        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Timezone</p>
        <p className="mt-1 text-sm font-medium text-[color:var(--text-main)]">{previewTimezone}</p>

        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Next run</p>
        <p className="mt-1 text-sm font-medium text-[color:var(--text-main)]">
          {formatRecurringDateTime(preview?.nextRunAt ?? rule.nextRunAt, previewTimezone)} ({previewTimezone})
        </p>
      </section>

      {loading ? <StatusBanner className="mt-4">Loading preview...</StatusBanner> : null}

      {errorMessage ? (
        <StatusBanner tone="danger" className="mt-4" >
          <p>{errorMessage}</p>
          <ActionButton
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              void loadPreviewForRule(rule);
            }}
            disabled={loading}
            className="mt-2"
          >
            {loading ? 'Retrying...' : 'Retry preview'}
          </ActionButton>
        </StatusBanner>
      ) : null}

      {!loading && !errorMessage ? (
        <ul className="mt-4 space-y-2">
          {(preview?.occurrences ?? []).length === 0 ? (
            <li className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-muted)] px-3 py-3 text-sm text-[color:var(--text-muted)]">
              No upcoming occurrences.
            </li>
          ) : (
            (preview?.occurrences ?? []).map((occurrence) => (
              <li
                key={occurrence}
                className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-main)]"
              >
                {formatRecurringDateTime(occurrence, previewTimezone)} ({previewTimezone})
              </li>
            ))
          )}
        </ul>
      ) : null}
    </ModalSurface>
  );
}
