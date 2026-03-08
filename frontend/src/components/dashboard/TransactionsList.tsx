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
    <section
      className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-labelledby="transactions-title"
    >
      <header className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <h2
          id="transactions-title"
          className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Transactions
        </h2>
      </header>

      <div className="max-h-[520px] overflow-auto">
        {groups.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-slate-500 dark:text-slate-400">
            {normalizedSearchQuery
              ? `No transactions found for "${normalizedSearchQuery}".`
              : 'No transactions available for this period.'}
          </div>
        ) : (
          groups.map((group) => (
            <article key={group.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
              <div className="grid grid-cols-[70px_1fr] items-end gap-4 px-6 py-4">
                <span className="text-4xl font-light leading-none text-slate-900 dark:text-slate-100">
                  {group.dayLabel}
                </span>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{group.monthYearLabel}</span>
                  <span>{group.weekdayLabel}</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 px-6 dark:divide-slate-800">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[56px_minmax(0,1fr)_max-content_auto] items-center gap-3 py-3 text-sm"
                  >
                    <span className="text-xs text-slate-400 dark:text-slate-500">{item.timeLabel}</span>

                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-900 dark:text-slate-950"
                        style={{ backgroundColor: item.avatarColor }}
                        aria-hidden="true"
                      >
                        {item.avatarLabel}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                          {item.merchantLabel}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-[96px_108px_96px] items-center gap-2.5">
                      {item.badgeLabel ? (
                        <span
                          className="justify-self-end rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-100"
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
                          item.amountValue < 0 ? 'text-slate-700 dark:text-slate-200' : 'text-emerald-600',
                        ].join(' ')}
                      >
                        {item.amountLabel}
                      </span>

                      <span className="whitespace-nowrap text-left text-xs text-slate-500 dark:text-slate-400">
                        {item.accountLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit?.(item.id)}
                        aria-label={`Edit ${item.merchantLabel}`}
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(item.id)}
                        aria-label={`Delete ${item.merchantLabel}`}
                        className="rounded p-1 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-rose-400 dark:hover:bg-rose-900/20 dark:hover:text-rose-300"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>

    </section>
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
