import { Card, CardContent } from '@/components/ui/card';
import { formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  total: number;
  scored: number;
  avgAccuracyPct: number | null;
  bestSimName: string | null;
  avgBiasPct: number | null;
}

function biasTone(b: number | null): string {
  if (b == null) return 'text-muted-foreground';
  if (b > 5) return 'text-destructive';
  if (b < -5) return 'text-primary';
  return 'text-foreground';
}

function biasLabel(b: number | null): string {
  if (b == null) return 'sin datos';
  if (b > 0) return 'sobreestimas';
  if (b < 0) return 'infraestimas';
  return 'calibrado';
}

/** Four KPIs at the top of W4 — count, avg accuracy, best sim, mean bias. */
export function StatStrip({ total, scored, avgAccuracyPct, bestSimName, avgBiasPct }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-3xl font-semibold tabular-nums">{total}</div>
          <div className="mt-1 text-xs text-muted-foreground">simulaciones guardadas</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div
            className={cn(
              'text-3xl font-semibold tabular-nums',
              avgAccuracyPct != null && avgAccuracyPct >= 85 && 'text-success',
            )}
          >
            {avgAccuracyPct != null ? `${avgAccuracyPct}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            acierto medio · {scored}/{total} evaluables
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="truncate text-xl font-semibold" title={bestSimName ?? '—'}>
            {bestSimName ? `★ ${bestSimName}` : '—'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">la que más se acerca al real</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className={cn('text-3xl font-semibold tabular-nums', biasTone(avgBiasPct))}>
            {avgBiasPct != null ? formatPct(avgBiasPct) : '—'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            sesgo medio · {biasLabel(avgBiasPct)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
