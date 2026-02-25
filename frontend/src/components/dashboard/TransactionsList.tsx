import type { TransactionGroup } from '../../types/finance';

type TransactionsListProps = {
  groups: TransactionGroup[];
};

export function TransactionsList({ groups }: TransactionsListProps): JSX.Element {
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
            Sem transações disponíveis. Cria transações na API para preencher esta tabela.
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
                    className="grid grid-cols-[56px_1fr_auto_auto_auto_18px] items-center gap-3 py-3 text-sm"
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

                    <span
                      className={[
                        'whitespace-nowrap font-semibold',
                        item.amountValue < 0 ? 'text-slate-700 dark:text-slate-200' : 'text-emerald-600',
                      ].join(' ')}
                    >
                      {item.amountLabel}
                    </span>

                    {item.badgeLabel ? (
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-100"
                        style={{ backgroundColor: `${item.badgeColor}33` }}
                      >
                        {item.badgeLabel}
                      </span>
                    ) : (
                      <span />
                    )}

                    <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                      {item.accountLabel}
                    </span>

                    <button
                      type="button"
                      aria-label={`Open options for ${item.merchantLabel}`}
                      className="text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      <DotsIcon />
                    </button>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            +
          </span>
          Zaubi 2023. All rights reserved.
        </span>

        <div className="flex items-center gap-4">
          <button type="button" className="transition hover:text-slate-800 dark:hover:text-slate-100">
            About
          </button>
          <button type="button" className="transition hover:text-slate-800 dark:hover:text-slate-100">
            Help
          </button>
          <button type="button" className="transition hover:text-slate-800 dark:hover:text-slate-100">
            Support
          </button>
          <button type="button" className="transition hover:text-slate-800 dark:hover:text-slate-100">
            Terms & Conditions
          </button>
        </div>
      </footer>
    </section>
  );
}

function DotsIcon(): JSX.Element {
  return (
    <svg width="4" height="14" viewBox="0 0 4 14" fill="none" aria-hidden="true">
      <circle cx="2" cy="2" r="1.2" fill="currentColor" />
      <circle cx="2" cy="7" r="1.2" fill="currentColor" />
      <circle cx="2" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}
