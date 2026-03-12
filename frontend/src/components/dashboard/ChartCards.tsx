import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SurfacePanel } from '../design/SurfacePanel';
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
  const axisColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridColor = isDarkMode ? '#334155' : '#d9e2ec';
  const safeTotalExpenses = Number.isFinite(totalExpenses) ? Math.max(totalExpenses, 0) : 0;
  const hasCategoryRows = expenseByCategory.length > 0;

  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Charts">
      <SurfacePanel as="article" variant="glass" reveal className="rounded-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            Expense Breakdown
          </h2>
          <span className="text-sm text-[color:var(--text-muted)]">Expenses by category</span>
        </header>

        <div className="min-h-[250px] rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-muted)] p-3">
          {hasCategoryRows ? (
            <ul className="space-y-3" aria-label="Category expense shares">
              {expenseByCategory.map((entry) => {
                const share = safeTotalExpenses > 0 ? (entry.expense / safeTotalExpenses) * 100 : 0;
                const clampedShare = Math.min(100, Math.max(0, share));

                return (
                  <li key={entry.category} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-medium text-[color:var(--text-main)]">
                        {entry.category}
                      </p>
                      <div className="shrink-0 whitespace-nowrap text-right text-xs text-[color:var(--text-muted)]">
                        <span className="font-semibold text-[color:var(--text-main)]">
                          {formatCurrency(entry.expense, currency)}
                        </span>{' '}
                        ({formatShare(share)})
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[color:var(--surface-border)]/80">
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
            <p className="px-2 py-10 text-sm text-[color:var(--text-muted)]">
              No expense data available for this period.
            </p>
          )}
        </div>
      </SurfacePanel>

      <SurfacePanel as="article" variant="glass" reveal className="rounded-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            Performance
          </h2>
          <span className="text-sm text-[color:var(--text-muted)]">Balance evolution</span>
        </header>

        <div className="h-64 min-h-[250px] w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-muted)] p-2">
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
                  borderRadius: 12,
                  border: `1px solid ${isDarkMode ? '#334155' : '#d9e2ec'}`,
                  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                  color: isDarkMode ? '#e2e8f0' : '#1e293b',
                }}
                formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#14b8a6"
                strokeWidth={3}
                dot={{ r: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SurfacePanel>
    </section>
  );
}
