import { ActionButton } from '../design/ActionButton';
import { SurfacePanel } from '../design/SurfacePanel';
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
      className: 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
    };
  }

  if (usageRatio >= 0.8) {
    return {
      label: 'WARNING',
      className: 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    };
  }

  return {
    label: 'NORMAL',
    className: 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
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
      <SurfacePanel
        as="section"
        variant="solid"
        className="border-dashed px-5 py-10 text-center"
      >
        <h2 className="ds-display text-base font-semibold text-[color:var(--text-main)]">No budgets yet</h2>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          Create your first budget to track category limits.
        </p>
        {onCreateFirstBudget ? (
          <ActionButton type="button" onClick={onCreateFirstBudget} className="mt-4">
            Create budget
          </ActionButton>
        ) : null}
      </SurfacePanel>
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
          <SurfacePanel key={budget.id} as="article" variant="glass" reveal className="rounded-2xl">
            <header className="mb-4 flex items-start justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                  aria-hidden="true"
                />
                <h3 className="break-words text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                  {budget.category.name}
                </h3>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone.className}`}>
                  {statusTone.label}
                </span>
                <span className="text-xs text-[color:var(--text-muted)]">{Math.round(usageRatio * 100)}%</span>
              </div>
            </header>

            <div
              className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-border)]"
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
                <dt className="text-[color:var(--text-muted)]">Limit</dt>
                <dd className="break-words text-right font-semibold text-[color:var(--text-main)]">
                  {formatCurrency(Number.isFinite(limitAmount) ? limitAmount : 0, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--text-muted)]">Spent this month</dt>
                <dd className="break-words text-right font-semibold text-[color:var(--text-main)]">
                  {formatCurrency(Number.isFinite(spentAmount) ? spentAmount : 0, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--text-muted)]">Remaining</dt>
                <dd
                  className={[
                    'break-words text-right font-semibold',
                    remainingAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                  ].join(' ')}
                >
                  {formatCurrency(Number.isFinite(remainingAmount) ? remainingAmount : 0, currency)}
                </dd>
              </div>
            </dl>

            {onEditBudget || onDeleteBudget ? (
              <div className="mt-4 flex justify-end gap-2 border-t border-[color:var(--surface-border)] pt-3">
                {onEditBudget ? (
                  <ActionButton
                    type="button"
                    variant="neutral"
                    size="sm"
                    onClick={() => onEditBudget(budget)}
                    disabled={isDeleting}
                  >
                    Edit
                  </ActionButton>
                ) : null}
                {onDeleteBudget ? (
                  <ActionButton
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => onDeleteBudget(budget)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </ActionButton>
                ) : null}
              </div>
            ) : null}
          </SurfacePanel>
        );
      })}
    </section>
  );
}
