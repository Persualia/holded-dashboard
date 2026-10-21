import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthProvider';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { useViewYear } from '@/context/ViewYearProvider';
import { MONTH_LABELS_LONG_ES, TODAY, TODAY_MONTH_IDX, TODAY_YEAR } from '@/lib/time';

/**
 * Year to show when the requested one has no data: today's year if it has
 * some, else the latest earlier year (e.g. January before the first export
 * with the new year), else the first year there is.
 */
function fallbackYear(available: number[]): number {
  if (available.includes(TODAY_YEAR)) return TODAY_YEAR;
  const earlier = available.filter((y) => y < TODAY_YEAR);
  return earlier.length > 0 ? earlier[earlier.length - 1] : available[0];
}

/** ‹ year › switcher over the years some export has data for. */
function YearSwitcher() {
  const { base, availableYears } = useDatasetCtx();
  const { year, setYear } = useViewYear();

  useEffect(() => {
    if (!base || availableYears.length === 0 || availableYears.includes(year)) return;
    setYear(fallbackYear(availableYears), { replace: true });
  }, [base, availableYears, year, setYear]);

  const idx = availableYears.indexOf(year);
  const prev = idx > 0 ? availableYears[idx - 1] : null;
  const next = idx >= 0 && idx < availableYears.length - 1 ? availableYears[idx + 1] : null;
  const home = availableYears.length > 0 ? fallbackYear(availableYears) : TODAY_YEAR;
  return (
    <div className="flex items-center rounded-md border">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => prev != null && setYear(prev)}
        disabled={prev == null}
        aria-label="Año anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <button
        type="button"
        className="px-1 font-mono text-sm font-semibold tabular-nums disabled:cursor-default"
        onClick={() => setYear(home)}
        disabled={year === home}
        title={year === home ? undefined : `Volver a ${home}`}
      >
        {year}
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => next != null && setYear(next)}
        disabled={next == null}
        aria-label="Año siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TopBar() {
  const { base } = useDatasetCtx();
  const { user, logout } = useAuth();
  const dateLabel = `${TODAY.getDate()} ${MONTH_LABELS_LONG_ES[TODAY_MONTH_IDX].toLowerCase()} ${TODAY.getFullYear()}`;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div className="flex items-center gap-3">
        <img src="/persualia-holded-icon.png" alt="Persualia" className="h-14 w-auto rounded-sm" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Persualia · Dashboard financiero</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {!base
              ? 'cargando dataset…'
              : base.items.length === 0
                ? 'sin datos para este año'
                : `${base.months[0]} → ${base.months[base.months.length - 1]}`}
            <span className="mx-2 text-border">·</span>
            hoy: {dateLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <YearSwitcher />
        {user && <span className="text-xs text-muted-foreground">{user}</span>}
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="mr-1 h-3.5 w-3.5" />
          Salir
        </Button>
      </div>
    </header>
  );
}
