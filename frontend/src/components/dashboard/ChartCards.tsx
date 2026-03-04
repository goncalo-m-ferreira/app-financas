import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

export function ChartCards({
  expenseByCategory,
  balanceTrend,
  currency,
  isDarkMode,
}: ChartCardsProps): JSX.Element {
  const axisColor = isDarkMode ? '#94a3b8' : '#94a3b8';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Charts">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Assets
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">Expenses by category</span>
        </header>

        <div className="w-full h-64 min-h-[250px] rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expenseByCategory} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="category" tick={{ fill: axisColor, fontSize: 11 }} interval={0} angle={-15} height={48} />
              <YAxis tick={{ fill: axisColor, fontSize: 11 }} width={70} />
              <Tooltip
                cursor={{ fill: isDarkMode ? '#0f172a' : '#f1f5f9' }}
                contentStyle={{
                  borderRadius: 10,
                  border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                  backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                  color: isDarkMode ? '#e2e8f0' : '#1e293b',
                }}
                formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
              />
              <Bar dataKey="expense" radius={[8, 8, 0, 0]}>
                {expenseByCategory.map((entry) => (
                  <Cell key={entry.category} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
