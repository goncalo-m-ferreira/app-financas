import type { ApiBudget } from '../../types/finance';

type BudgetCardsProps = {
  budgets: ApiBudget[];
  currency: string;
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/,/g, "'")
    .concat(` ${currency}`);
}

function getProgressToneClass(usageRatio: number): string {
  if (usageRatio < 0.75) {
    return 'bg-emerald-500';
  }

  if (usageRatio < 0.9) {
    return 'bg-amber-400';
  }

  return 'bg-rose-500';
}

function normalizeCategoryColor(color: string | null): string {
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color.trim())) {
    return color.trim();
  }

  return '#60a5fa';
}

export function BudgetCards({ budgets, currency }: BudgetCardsProps): JSX.Element {
  if (budgets.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          No budgets yet
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Create your first budget to track category limits.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Budget cards">
      {budgets.map((budget) => {
        const limitAmount = Number.parseFloat(budget.amount);
        const spentAmount = Number.parseFloat(budget.spentThisMonth);
        const remainingAmount = Number.parseFloat(budget.remaining);
        const usageRatio = Number.isFinite(budget.usageRatio)
          ? Math.max(0, budget.usageRatio)
          : 0;
        const progressPercent = Math.min(usageRatio * 100, 100);
        const progressClass = getProgressToneClass(usageRatio);
        const categoryColor = normalizeCategoryColor(budget.category.color);

        return (
          <article
            key={budget.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <header className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                  {budget.category.name}
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {Math.round(usageRatio * 100)}%
              </span>
            </header>

            <div
              className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.max(0, Math.min(Math.round(usageRatio * 100), 100))}
              aria-label={`Budget ${budget.category.name}`}
            >
              <div className={`h-full rounded-full ${progressClass}`} style={{ width: `${progressPercent}%` }} />
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Limit</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(Number.isFinite(limitAmount) ? limitAmount : 0, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Spent this month</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(Number.isFinite(spentAmount) ? spentAmount : 0, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Remaining</dt>
                <dd
                  className={[
                    'font-semibold',
                    remainingAmount >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  ].join(' ')}
                >
                  {formatCurrency(Number.isFinite(remainingAmount) ? remainingAmount : 0, currency)}
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
    </section>
  );
}
