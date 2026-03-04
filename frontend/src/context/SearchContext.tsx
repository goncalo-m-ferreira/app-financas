import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type SearchContextValue = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: PropsWithChildren): JSX.Element {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const value = useMemo<SearchContextValue>(
    () => ({
      searchQuery,
      setSearchQuery,
    }),
    [searchQuery],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const context = useContext(SearchContext);

  if (!context) {
    throw new Error('useSearch must be used inside SearchProvider.');
  }

  return context;
}
