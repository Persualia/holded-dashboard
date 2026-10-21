import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthProvider';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { MAX_VIEW_YEAR, useViewYear } from '@/context/ViewYearProvider';
import { MONTH_LABELS_ES, MONTH_LABELS_LONG_ES, TODAY, TODAY_MONTH_IDX, TODAY_YEAR } from '@/lib/time';

/** "2026-09" → "sep 2026" */
function monthKeyLabel(key: string): string {
  const idx = Number.parseInt(key.slice(5, 7), 10) - 1;
  return `${(MONTH_LABELS_ES[idx] ?? '').toLowerCase()} ${key.slice(0, 4)}`;
}

function YearSwitcher() {
  const { allMonthsUploaded } = useDatasetCtx();
  const { year, setYear } = useViewYear();
  const firstUploaded = allMonthsUploaded[0];
  const minYear = Math.min(
    firstUploaded ? Number.parseInt(firstUploaded.slice(0, 4), 10) : TODAY_YEAR,
    TODAY_YEAR,
    year,
  );
  return (
    <div className="flex items-center rounded-md border">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => setYear(year - 1)}
        disabled={year <= minYear}
        aria-label="Año anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <button
        type="button"
        className="px-1 font-mono text-sm font-semibold tabular-nums disabled:cursor-default"
        onClick={() => setYear(TODAY_YEAR)}
        disabled={year === TODAY_YEAR}
        title={year === TODAY_YEAR ? undefined : `Volver a ${TODAY_YEAR}`}
      >
        {year}
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => setYear(year + 1)}
        disabled={year >= MAX_VIEW_YEAR}
        aria-label="Año siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TopBar() {
  const { base, projectedFrom, templateFrom } = useDatasetCtx();
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
            {projectedFrom && (
              <span className="ml-2 text-primary">
                (previsión del export de {monthKeyLabel(projectedFrom)})
              </span>
            )}
            {templateFrom && (
              <span className="ml-2 text-primary">
                (plantilla a partir de {monthKeyLabel(templateFrom)} — todo previsión)
              </span>
            )}
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
