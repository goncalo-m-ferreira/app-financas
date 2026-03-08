import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BalanceTrendDatum, ExpenseByCategoryDatum } from '../../types/finance';

type ChartCardsProps = {
  expenseByCategory: ExpenseByCategoryDatum[];
  balanceTrend: BalanceTrendDatum[];
  totalExpenses: number;
  currency: string;
  isDarkMode: boolean;
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

function formatShare(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function ChartCards({
  expenseByCategory,
  balanceTrend,
  totalExpenses,
  currency,
  isDarkMode,
}: ChartCardsProps): JSX.Element {
  const axisColor = isDarkMode ? '#94a3b8' : '#94a3b8';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';
  const safeTotalExpenses = Number.isFinite(totalExpenses) ? Math.max(totalExpenses, 0) : 0;
  const hasCategoryRows = expenseByCategory.length > 0;

  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Charts">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Assets
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">Expenses by category</span>
        </header>

        <div className="min-h-[250px] rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
          {hasCategoryRows ? (
            <ul className="space-y-3" aria-label="Category expense shares">
              {expenseByCategory.map((entry) => {
                const share = safeTotalExpenses > 0 ? (entry.expense / safeTotalExpenses) * 100 : 0;
                const clampedShare = Math.min(100, Math.max(0, share));

                return (
                  <li key={entry.category} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-medium text-slate-700 dark:text-slate-200">
                        {entry.category}
                      </p>
                      <div className="shrink-0 whitespace-nowrap text-right text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {formatCurrency(entry.expense, currency)}
                        </span>{' '}
                        ({formatShare(share)})
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200/80 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{
                          width: `${clampedShare}%`,
                          backgroundColor: entry.color,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-10 text-sm text-slate-500 dark:text-slate-400">
              No expense data available for this period.
            </p>
          )}
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Performance
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">Balance evolution</span>
        </header>

        <div className="w-full h-64 min-h-[250px] rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={balanceTrend} margin={{ top: 16, right: 14, left: 2, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="dateLabel" tick={{ fill: axisColor, fontSize: 11 }} />
              <YAxis
                tick={{ fill: axisColor, fontSize: 11 }}
                width={84}
                tickFormatter={(value: number) => `${value.toFixed(0)} ${currency}`}
              />
              <Tooltip
                cursor={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }}
                contentStyle={{
                  borderRadius: 10,
                  border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                  backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                  color: isDarkMode ? '#e2e8f0' : '#1e293b',
                }}
                formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#22c7e7"
                strokeWidth={3}
                dot={{ r: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
