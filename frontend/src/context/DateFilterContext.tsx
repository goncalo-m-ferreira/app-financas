import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type DateFilterContextValue = {
  month: number;
  year: number;
  setMonth: (month: number) => void;
  setYear: (year: number) => void;
};

function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

const DateFilterContext = createContext<DateFilterContextValue | null>(null);

export function DateFilterProvider({ children }: PropsWithChildren): JSX.Element {
  const current = getCurrentMonthYear();
  const [month, setMonth] = useState<number>(current.month);
  const [year, setYear] = useState<number>(current.year);

  const value = useMemo<DateFilterContextValue>(
    () => ({
      month,
      year,
      setMonth,
      setYear,
    }),
    [month, year],
  );

  return <DateFilterContext.Provider value={value}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter(): DateFilterContextValue {
  const context = useContext(DateFilterContext);

  if (!context) {
    throw new Error('useDateFilter must be used inside DateFilterProvider.');
  }

  return context;
}
