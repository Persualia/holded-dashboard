import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setViewYear, TODAY_YEAR } from '@/lib/time';

interface ViewYearValue {
  year: number;
  /** `replace` swaps the history entry instead of adding one (for redirects). */
  setYear: (year: number, opts?: { replace?: boolean }) => void;
}

const ViewYearContext = createContext<ViewYearValue | null>(null);

/** Reads `?y=YYYY`, defaulting to today's year. Whether the year has data is
 *  only known once the dataset loads; the TopBar snaps to one that does. */
function readYearFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('y');
  return raw && /^\d{4}$/.test(raw) ? Number.parseInt(raw, 10) : TODAY_YEAR;
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

  const setYear = useCallback((y: number, opts?: { replace?: boolean }) => {
    const url = new URL(window.location.href);
    if (y === TODAY_YEAR) url.searchParams.delete('y');
    else url.searchParams.set('y', String(y));
    if (opts?.replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
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
