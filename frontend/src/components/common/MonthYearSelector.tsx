import { useId } from 'react';
import { useDateFilter } from '../../context/DateFilterContext';

const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

function buildYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];

  for (let year = currentYear - 6; year <= currentYear + 2; year += 1) {
    years.push(year);
  }

  return years;
}

type MonthYearSelectorVariant = 'default' | 'dashboardTopbar';

type MonthYearSelectorProps = {
  variant?: MonthYearSelectorVariant;
  className?: string;
};

function joinClassNames(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function resolveWrapperClassName(variant: MonthYearSelectorVariant): string {
  if (variant === 'dashboardTopbar') {
    return 'inline-flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/70 bg-white/75 p-1.5 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/65';
  }

  return 'flex items-center gap-2';
}

function resolveSelectClassName(variant: MonthYearSelectorVariant): string {
  if (variant === 'dashboardTopbar') {
    return 'h-9 rounded-lg border border-transparent bg-slate-100/80 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30 dark:bg-slate-800/75 dark:text-slate-100 dark:focus:border-cyan-400/70 dark:focus:ring-cyan-400/30';
  }

  return 'rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
}

export function MonthYearSelector({
  variant = 'default',
  className,
}: MonthYearSelectorProps): JSX.Element {
  const { month, year, setMonth, setYear } = useDateFilter();
  const monthSelectorId = useId();
  const yearSelectorId = useId();
  const yearOptions = buildYearOptions();
  const selectClassName = resolveSelectClassName(variant);

  return (
    <div className={joinClassNames(resolveWrapperClassName(variant), className)}>
      <label className="sr-only" htmlFor={monthSelectorId}>
        Select month
      </label>
      <select
        id={monthSelectorId}
        value={month}
        onChange={(event) => setMonth(Number.parseInt(event.target.value, 10))}
        className={selectClassName}
      >
        {MONTH_OPTIONS.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={yearSelectorId}>
        Select year
      </label>
      <select
        id={yearSelectorId}
        value={year}
        onChange={(event) => setYear(Number.parseInt(event.target.value, 10))}
        className={selectClassName}
      >
        {yearOptions.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}
