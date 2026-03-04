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

export function MonthYearSelector(): JSX.Element {
  const { month, year, setMonth, setYear } = useDateFilter();
  const yearOptions = buildYearOptions();

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="month-selector">
        Select month
      </label>
      <select
        id="month-selector"
        value={month}
        onChange={(event) => setMonth(Number.parseInt(event.target.value, 10))}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {MONTH_OPTIONS.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="year-selector">
        Select year
      </label>
      <select
        id="year-selector"
        value={year}
        onChange={(event) => setYear(Number.parseInt(event.target.value, 10))}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
