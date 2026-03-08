import type { ApiBudget } from '../../types/finance';

type BudgetCardsProps = {
  budgets: ApiBudget[];
  currency: string;
  deletingBudgetId?: string | null;
  onCreateFirstBudget?: () => void;
  onEditBudget?: (budget: ApiBudget) => void;
  onDeleteBudget?: (budget: ApiBudget) => void;
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
  if (usageRatio < 0.8) {
    return 'bg-emerald-500';
  }

  if (usageRatio < 1) {
    return 'bg-amber-400';
  }

  return 'bg-rose-500';
}

function getStatusTone(usageRatio: number): {
  label: 'NORMAL' | 'WARNING' | 'EXCEEDED';
  className: string;
} {
  if (usageRatio >= 1) {
    return {
      label: 'EXCEEDED',
      className:
        'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
    };
  }

  if (usageRatio >= 0.8) {
    return {
      label: 'WARNING',
      className:
        'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    };
  }

  return {
    label: 'NORMAL',
    className:
      'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  };
}

function normalizeCategoryColor(color: string | null): string {
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color.trim())) {
    return color.trim();
  }

  return '#60a5fa';
}

export function BudgetCards({
  budgets,
  currency,
  deletingBudgetId = null,
  onCreateFirstBudget,
  onEditBudget,
  onDeleteBudget,
}: BudgetCardsProps): JSX.Element {
  if (budgets.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          No budgets yet
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Create your first budget to track category limits.
        </p>
        {onCreateFirstBudget ? (
          <button
            type="button"
            onClick={onCreateFirstBudget}
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Create budget
          </button>
        ) : null}
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
        const statusTone = getStatusTone(usageRatio);
        const categoryColor = normalizeCategoryColor(budget.category.color);
        const isDeleting = deletingBudgetId === budget.id;

        return (
          <article
            key={budget.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <header className="mb-4 flex items-start justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                  aria-hidden="true"
                />
                <h3 className="break-words text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                  {budget.category.name}
                </h3>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone.className}`}>
                  {statusTone.label}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {Math.round(usageRatio * 100)}%
                </span>
              </div>
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
                <dd className="break-words text-right font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(Number.isFinite(limitAmount) ? limitAmount : 0, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Spent this month</dt>
                <dd className="break-words text-right font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(Number.isFinite(spentAmount) ? spentAmount : 0, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Remaining</dt>
                <dd
                  className={[
                    'break-words text-right font-semibold',
                    remainingAmount >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  ].join(' ')}
                >
                  {formatCurrency(Number.isFinite(remainingAmount) ? remainingAmount : 0, currency)}
                </dd>
              </div>
            </dl>

            {onEditBudget || onDeleteBudget ? (
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                {onEditBudget ? (
                  <button
                    type="button"
                    onClick={() => onEditBudget(budget)}
                    disabled={isDeleting}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Edit
                  </button>
                ) : null}
                {onDeleteBudget ? (
                  <button
                    type="button"
                    onClick={() => onDeleteBudget(budget)}
                    disabled={isDeleting}
                    className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
