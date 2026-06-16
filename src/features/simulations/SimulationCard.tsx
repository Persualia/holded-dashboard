import { CalendarClock, FileText, Lock, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { MONTH_LABELS_LONG_ES } from '@/lib/time';
import { formatPct } from '@/lib/format';
import type { SavedSim } from '@/lib/types';
import type { SimEvaluation } from '@/lib/simEvaluation';
import { cn } from '@/lib/utils';
import { AccuracyBadge } from './AccuracyBadge';
import { BandPips } from './BandPips';
import { PredictedVsRealSpark } from './PredictedVsRealSpark';

interface Props {
  sim: SavedSim;
  evaluation: SimEvaluation;
  selected: boolean;
  selectionDisabled: boolean;
  selectionColor: string | null;
  onToggleSelect: (sim: SavedSim) => void;
  onLoad: (sim: SavedSim) => void;
  onRename: (sim: SavedSim) => void;
  onDelete: (sim: SavedSim) => void;
  onExportPDF: (sim: SavedSim) => void;
}

function countOverrides(sim: SavedSim): number {
  let n = 0;
  for (const months of Object.values(sim.overrideKeys ?? {})) n += months.length;
  return n;
}

const DATE_FMT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const TIME_FMT = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
});

export function SimulationCard({
  sim,
  evaluation,
  selected,
  selectionDisabled,
  selectionColor,
  onToggleSelect,
  onLoad,
  onRename,
  onDelete,
  onExportPDF,
}: Props) {
  const cells = countOverrides(sim);
  const rows = sim.simRows?.length ?? 0;
  const created = new Date(sim.createdAt);
  const savedMonth = MONTH_LABELS_LONG_ES[sim.savedAtMonthIdx] ?? '';

  const bias = evaluation.hasData ? evaluation.avgSignedErrNet * 100 : null;

  return (
    <Card
      className={cn(
        'flex flex-col transition-shadow',
        selected && 'ring-2 ring-offset-2 ring-offset-background',
      )}
      style={selected && selectionColor ? { boxShadow: `0 0 0 2px ${selectionColor}` } : undefined}
    >
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            disabled={!selected && selectionDisabled}
            onCheckedChange={() => onToggleSelect(sim)}
            aria-label="Seleccionar para comparar"
            className="mt-1"
            style={selected && selectionColor ? { backgroundColor: selectionColor, borderColor: selectionColor } : undefined}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold leading-tight" title={sim.name}>
              {sim.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {DATE_FMT.format(created)} · {TIME_FMT.format(created)}
              </span>
              {sim.visibility === 'private' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
                  <Lock className="h-3 w-3" />
                  Privado
                </span>
              ) : null}
            </div>
          </div>
          <AccuracyBadge evaluation={evaluation} />
        </div>

        {sim.hypothesis ? (
          <p className="line-clamp-2 rounded-md bg-muted/60 px-3 py-2 text-sm italic text-foreground/80">
            “{sim.hypothesis}”
          </p>
        ) : null}

        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            neto mensual · — — predicho · ── real
          </div>
          <PredictedVsRealSpark predicted={evaluation.predNet} real={evaluation.realNet} />
          <div className="mt-1.5">
            <BandPips scores={evaluation.monthScores} />
          </div>
        </div>

        {bias != null && Math.abs(bias) > 0.01 ? (
          <p className="text-xs">
            Sesgo:{' '}
            <span className={cn('font-medium', bias > 0 ? 'text-destructive' : 'text-primary')}>
              {bias > 0 ? '↑ sobreestimo' : '↓ infraestimo'} {formatPct(Math.abs(bias))}
            </span>
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Celdas
            </div>
            <div className="font-medium tabular-nums">{cells}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Filas sim
            </div>
            <div className="font-medium tabular-nums">{rows}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Guardada
            </div>
            <div className="truncate font-medium" title={`${savedMonth} ${sim.savedAtYear}`}>
              {savedMonth} {sim.savedAtYear}
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Button variant="ghost" size="sm" onClick={() => onExportPDF(sim)} title="Exportar PDF">
            <FileText className="mr-1 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRename(sim)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(sim)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Borrar
          </Button>
          <Button size="sm" onClick={() => onLoad(sim)}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Cargar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
