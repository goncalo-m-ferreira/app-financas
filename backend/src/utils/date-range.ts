type MonthYearInput = {
  month?: number;
  year?: number;
};

export type MonthYearRange = {
  month: number;
  year: number;
  start: Date;
  endExclusive: Date;
};

export function resolveMonthYearRange(input: MonthYearInput): MonthYearRange {
  const now = new Date();
  const month = input.month ?? now.getMonth() + 1;
  const year = input.year ?? now.getFullYear();
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endExclusive = new Date(year, month, 1, 0, 0, 0, 0);

  return {
    month,
    year,
    start,
    endExclusive,
  };
}
