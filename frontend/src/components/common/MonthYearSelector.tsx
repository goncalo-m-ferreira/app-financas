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
    return 'inline-flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] p-1.5 shadow-[0_8px_18px_rgba(16,34,51,0.08)] backdrop-blur-sm';
  }

  return 'flex items-center gap-2';
}

function resolveSelectClassName(variant: MonthYearSelectorVariant): string {
  if (variant === 'dashboardTopbar') {
    return 'ds-focus-ring h-9 rounded-lg border border-transparent bg-[color:var(--surface-muted)] px-3 text-sm font-medium text-[color:var(--text-main)] outline-none transition focus:border-[color:var(--accent)]';
  }

  return 'ds-focus-ring rounded-md border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] px-2.5 py-1.5 text-sm text-[color:var(--text-main)] outline-none transition dark:bg-[color:var(--surface-card)]';
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
