import { SurfacePanel } from '../design/SurfacePanel';
import type { TransactionGroup } from '../../types/finance';

type TransactionsListProps = {
  groups: TransactionGroup[];
  searchQuery?: string;
  onEdit?: (transactionId: string) => void;
  onDelete?: (transactionId: string) => void;
};

export function TransactionsList({
  groups,
  searchQuery,
  onEdit,
  onDelete,
}: TransactionsListProps): JSX.Element {
  const normalizedSearchQuery = searchQuery?.trim() ?? '';

  return (
    <SurfacePanel
      as="section"
      variant="glass"
      padding="none"
      className="overflow-hidden rounded-2xl"
      aria-labelledby="transactions-title"
    >
      <header className="border-b border-[color:var(--surface-border)] px-6 py-4">
        <h2 id="transactions-title" className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
          Transactions
        </h2>
      </header>

      <div className="max-h-[520px] overflow-auto">
        {groups.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-[color:var(--text-muted)]">
            {normalizedSearchQuery
              ? `No transactions found for "${normalizedSearchQuery}".`
              : 'No transactions available for this period.'}
          </div>
        ) : (
          groups.map((group) => (
            <article key={group.id} className="border-b border-[color:var(--surface-border)] last:border-b-0">
              <div className="grid grid-cols-[70px_1fr] items-end gap-4 px-6 py-4">
                <span className="ds-display text-4xl font-light leading-none text-[color:var(--text-main)]">
                  {group.dayLabel}
                </span>
                <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--text-muted)]">
                  <span className="font-medium text-[color:var(--text-main)]">{group.monthYearLabel}</span>
                  <span>{group.weekdayLabel}</span>
                </div>
              </div>

              <div className="divide-y divide-[color:var(--surface-border)] px-6">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[56px_minmax(0,1fr)_max-content] items-center gap-3 py-3 text-sm"
                  >
                    <span className="text-xs text-[color:var(--text-muted)]">{item.timeLabel}</span>

                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-900 dark:text-slate-950"
                        style={{ backgroundColor: item.avatarColor }}
                        aria-hidden="true"
                      >
                        {item.avatarLabel}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-[color:var(--text-main)]">{item.merchantLabel}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-[max-content_108px_96px_auto] items-center justify-self-end gap-2.5">
                      {item.badgeLabel ? (
                        <span
                          className="justify-self-end rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-main)]"
                          style={{ backgroundColor: `${item.badgeColor}33` }}
                        >
                          {item.badgeLabel}
                        </span>
                      ) : (
                        <span className="justify-self-end" />
                      )}

                      <span
                        className={[
                          'whitespace-nowrap text-right font-semibold tabular-nums',
                          item.amountValue < 0 ? 'text-[color:var(--text-main)]' : 'text-emerald-600 dark:text-emerald-400',
                        ].join(' ')}
                      >
                        {item.amountLabel}
                      </span>

                      <span className="whitespace-nowrap text-left text-xs text-[color:var(--text-muted)]">
                        {item.accountLabel}
                      </span>

                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit?.(item.id)}
                          aria-label={`Edit ${item.merchantLabel}`}
                          className="rounded-lg p-1 text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-main)]"
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete?.(item.id)}
                          aria-label={`Delete ${item.merchantLabel}`}
                          className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-rose-400 dark:hover:bg-rose-900/20 dark:hover:text-rose-300"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </SurfacePanel>
  );
}

function EditIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10-10-4-4L4 16v4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m12 6 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 7l1 12h10l1-12M9 7V4h6v3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
