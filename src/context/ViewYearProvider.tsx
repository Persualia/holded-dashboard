import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setViewYear, TODAY_YEAR } from '@/lib/time';

/** Furthest year the dashboard lets you plan for. */
export const MAX_VIEW_YEAR = TODAY_YEAR + 1;

interface ViewYearValue {
  year: number;
  setYear: (year: number) => void;
}

const ViewYearContext = createContext<ViewYearValue | null>(null);

/** Reads `?y=YYYY`; anything missing or out of range falls back to today's year. */
function readYearFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('y');
  if (!raw || !/^\d{4}$/.test(raw)) return TODAY_YEAR;
  const y = Number.parseInt(raw, 10);
  return y <= MAX_VIEW_YEAR ? y : TODAY_YEAR;
}

/**
 * Owns the year on screen and mirrors it in the URL. It also syncs the live
 * bindings in `@/lib/time` during render, so children (remounted per year via
 * `key`) read the right month boundary on their first render.
 */
export function ViewYearProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<number>(readYearFromUrl);

  useEffect(() => {
    const onPop = () => setYearState(readYearFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setYear = useCallback((y: number) => {
    const url = new URL(window.location.href);
    if (y === TODAY_YEAR) url.searchParams.delete('y');
    else url.searchParams.set('y', String(y));
    window.history.pushState(null, '', url);
    setYearState(y);
  }, []);

  setViewYear(year);

  return <ViewYearContext.Provider value={{ year, setYear }}>{children}</ViewYearContext.Provider>;
}

export function useViewYear(): ViewYearValue {
  const ctx = useContext(ViewYearContext);
  if (!ctx) throw new Error('useViewYear must be used inside <ViewYearProvider>');
  return ctx;
}
