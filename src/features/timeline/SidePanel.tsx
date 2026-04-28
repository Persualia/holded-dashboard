import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SimComparisonChart } from '@/components/charts/SimComparisonChart';
import { formatEUR } from '@/lib/format';
import { MONTH_LABELS_ES } from '@/lib/time';
import { cn } from '@/lib/utils';

interface Props {
  totalNet: number;
  baseTotalNet: number;
  simCount: number;
  bestMonthIdx: number;
  bestMonthValue: number;
  worstMonthIdx: number;
  worstMonthValue: number;
  baseNet: number[];
  effectiveNet: number[];
}

export function SidePanel({
  totalNet,
  baseTotalNet,
  simCount,
  bestMonthIdx,
  bestMonthValue,
  worstMonthIdx,
  worstMonthValue,
  baseNet,
  effectiveNet,
}: Props) {
  const delta = totalNet - baseTotalNet;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Si todo va según el plan…</CardTitle>
          <p className="text-xs text-muted-foreground">resultado del año</p>
        </CardHeader>
        <CardContent>
          <div className={cn('text-2xl font-semibold tabular-nums', totalNet >= 0 ? 'text-success' : 'text-destructive')}>
            {formatEUR(totalNet, { sign: true, compact: true })}
          </div>
          {simCount > 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {simCount} cambio{simCount === 1 ? '' : 's'} en simulación · vs plan original{' '}
              <span className={cn('font-medium', delta >= 0 ? 'text-success' : 'text-destructive')}>
                {formatEUR(delta, { sign: true, compact: true })}
              </span>
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">sin simulación activa</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mejor / peor mes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="success">mejor</Badge>
            <span className="font-medium">{MONTH_LABELS_ES[bestMonthIdx]}</span>
            <span className="ml-auto text-success tabular-nums">
              {formatEUR(bestMonthValue, { sign: true })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive">peor</Badge>
            <span className="font-medium">{MONTH_LABELS_ES[worstMonthIdx]}</span>
            <span className="ml-auto text-destructive tabular-nums">
              {formatEUR(worstMonthValue, { sign: true })}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Original vs simulación</CardTitle>
          <p className="text-xs text-muted-foreground">resultado neto mes a mes</p>
        </CardHeader>
        <CardContent>
          <SimComparisonChart original={baseNet} withSim={effectiveNet} />
        </CardContent>
      </Card>
    </div>
  );
}
