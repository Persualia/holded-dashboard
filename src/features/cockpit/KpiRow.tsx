import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Sparkline } from '@/components/charts/Sparkline';
import { formatEUR } from '@/lib/format';
import { CURRENT_MONTH_IDX, MONTH_LABELS_LONG_ES } from '@/lib/time';
import { cn } from '@/lib/utils';

interface KpiRowProps {
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
  income: number[];
  expense: number[];
  net: number[];
  recurrentPct: number;
  monthlyAvgExpense: number;
  marginPct: number;
  currentMonthIncome: number;
  currentMonthIncomeForecast: number;
}

function KpiCard({
  label,
  value,
  delta,
  sparkValues,
  sparkColor,
  sparkNegativeColor,
  emphasis = 'foreground',
}: {
  label: string;
  value: string;
  delta?: { text: string; positive: boolean } | string;
  sparkValues: number[];
  sparkColor: string;
  sparkNegativeColor?: string;
  emphasis?: 'foreground' | 'success' | 'destructive' | 'primary';
}) {
  const valueColor =
    emphasis === 'success'
      ? 'text-success'
      : emphasis === 'destructive'
      ? 'text-destructive'
      : emphasis === 'primary'
      ? 'text-primary'
      : 'text-foreground';

  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className={cn('text-2xl font-semibold tabular-nums', valueColor)}>{value}</div>
        <div className="-mx-1 h-9">
          <Sparkline
            values={sparkValues}
            color={sparkColor}
            negativeColor={sparkNegativeColor}
            height={36}
          />
        </div>
        {typeof delta === 'string' ? (
          <div className="text-xs text-muted-foreground">{delta}</div>
        ) : delta ? (
          <div className={cn('flex items-center gap-1 text-xs', delta.positive ? 'text-success' : 'text-destructive')}>
            {delta.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta.text}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function KpiRow({
  totalIncome,
  totalExpense,
  totalNet,
  income,
  expense,
  net,
  recurrentPct,
  monthlyAvgExpense,
  marginPct,
  currentMonthIncome,
  currentMonthIncomeForecast,
}: KpiRowProps) {
  const currentPct = currentMonthIncomeForecast
    ? (currentMonthIncome / currentMonthIncomeForecast) * 100
    : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Ingresos año"
        value={formatEUR(totalIncome, { compact: true })}
        sparkValues={income}
        sparkColor="hsl(152 60% 36%)"
        delta={`${recurrentPct.toFixed(0)}% recurrente`}
        emphasis="foreground"
      />
      <KpiCard
        label="Gastos año"
        value={formatEUR(Math.abs(totalExpense), { compact: true })}
        sparkValues={expense.map((v) => Math.abs(v))}
        sparkColor="hsl(0 70% 45%)"
        delta={`≈ ${formatEUR(monthlyAvgExpense, { compact: true })}/mes`}
        emphasis="foreground"
      />
      <KpiCard
        label="Resultado neto"
        value={formatEUR(totalNet, { compact: true, sign: true })}
        sparkValues={net}
        sparkColor="hsl(152 60% 36%)"
        sparkNegativeColor="hsl(0 70% 45%)"
        delta={`margen ${marginPct.toFixed(1)}%`}
        emphasis={totalNet >= 0 ? 'success' : 'destructive'}
      />
      <Card>
        <CardContent className="space-y-2 p-5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {MONTH_LABELS_LONG_ES[CURRENT_MONTH_IDX]} (en curso)
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatEUR(currentMonthIncome, { compact: true })}
          </div>
          <div className="text-xs text-muted-foreground">
            de {formatEUR(currentMonthIncomeForecast, { compact: true })} previstos ·{' '}
            <span className="font-semibold text-foreground">{currentPct.toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(100, currentPct)} className="h-1.5" />
        </CardContent>
      </Card>
    </div>
  );
}
