import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkline } from '@/components/charts/Sparkline';
import { formatEUR } from '@/lib/format';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';
import { cn } from '@/lib/utils';

interface KpiRowProps {
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
  income: number[];
  expense: number[];
  net: number[];
  realIncome: number[];
  realExpense: number[];
  realNet: number[];
  forecastIncome: number[];
  forecastExpense: number[];
  forecastNet: number[];
  recurrentPct: number;
  monthlyAvgExpense: number;
  marginPct: number;
}

function rangeLabel(): string | null {
  if (CURRENT_MONTH_IDX <= 0) return null;
  const first = MONTH_LABELS_ES[0].toLowerCase();
  const last = MONTH_LABELS_ES[CURRENT_MONTH_IDX - 1].toLowerCase();
  return first === last ? first : `${first}–${last}`;
}

function sumRange(values: number[], from: number, toExclusive: number): number {
  let s = 0;
  for (let i = from; i < toExclusive; i++) s += values[i] ?? 0;
  return s;
}

function diffPct(real: number, forecast: number): number | null {
  if (Math.abs(forecast) < 1) return null;
  return ((real - forecast) / Math.abs(forecast)) * 100;
}

function KpiCard({
  label,
  value,
  sparkValues,
  sparkColor,
  sparkNegativeColor,
  emphasis = 'foreground',
  realLabel,
  realValue,
  progressPct,
  vsPct,
  vsPositiveIsGood = true,
  footer,
}: {
  label: string;
  value: string;
  sparkValues: number[];
  sparkColor: string;
  sparkNegativeColor?: string;
  emphasis?: 'foreground' | 'success' | 'destructive' | 'primary';
  realLabel: string;
  realValue: string;
  progressPct: number | null;
  vsPct: number | null;
  vsPositiveIsGood?: boolean;
  footer?: string;
}) {
  const valueColor =
    emphasis === 'success'
      ? 'text-success'
      : emphasis === 'destructive'
      ? 'text-destructive'
      : emphasis === 'primary'
      ? 'text-primary'
      : 'text-foreground';

  const pctIsGood = vsPct == null ? true : vsPositiveIsGood ? vsPct >= 0 : vsPct <= 0;
  const pctSign = vsPct != null && vsPct > 0 ? '+' : '';

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
            dashFromIdx={CURRENT_MONTH_IDX}
          />
        </div>
        <div className="pt-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {realLabel}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold tabular-nums text-foreground">{realValue}</span>
            {progressPct != null && (
              <span className="text-xs tabular-nums text-muted-foreground">
                · {progressPct.toFixed(0)}% del año
              </span>
            )}
          </div>
        </div>
        {vsPct != null && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs',
              pctIsGood ? 'text-success' : 'text-destructive',
            )}
          >
            {vsPct >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {pctSign}
            {vsPct.toFixed(1)}% vs previsto
          </div>
        )}
        {footer && <div className="text-xs text-muted-foreground">{footer}</div>}
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
  realIncome,
  realExpense,
  realNet,
  forecastIncome,
  forecastExpense,
  forecastNet,
  recurrentPct,
  monthlyAvgExpense,
  marginPct,
}: KpiRowProps) {
  const range = rangeLabel();
  const hasPast = range !== null;

  const realIncToDate = sumRange(realIncome, 0, CURRENT_MONTH_IDX);
  const fcstIncToDate = sumRange(forecastIncome, 0, CURRENT_MONTH_IDX);
  const realExpToDate = sumRange(realExpense, 0, CURRENT_MONTH_IDX);
  const fcstExpToDate = sumRange(forecastExpense, 0, CURRENT_MONTH_IDX);
  const realNetToDate = sumRange(realNet, 0, CURRENT_MONTH_IDX);
  const fcstNetToDate = sumRange(forecastNet, 0, CURRENT_MONTH_IDX);

  const realLabel = hasPast ? `Real ${range}` : 'Real';
  const noRealValue = '—';

  const progressPct = (real: number, total: number): number | null => {
    if (Math.abs(total) < 1) return null;
    if (real * total < 0) return null;
    return (Math.abs(real) / Math.abs(total)) * 100;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        label="Ingresos año (previsto)"
        value={formatEUR(totalIncome, { compact: true })}
        sparkValues={income}
        sparkColor="hsl(152 60% 36%)"
        emphasis="foreground"
        realLabel={realLabel}
        realValue={hasPast ? formatEUR(realIncToDate, { compact: true }) : noRealValue}
        progressPct={hasPast ? progressPct(realIncToDate, totalIncome) : null}
        vsPct={hasPast ? diffPct(realIncToDate, fcstIncToDate) : null}
        vsPositiveIsGood
        footer={`${recurrentPct.toFixed(0)}% recurrente`}
      />
      <KpiCard
        label="Gastos año (previsto)"
        value={formatEUR(Math.abs(totalExpense), { compact: true })}
        sparkValues={expense.map((v) => Math.abs(v))}
        sparkColor="hsl(0 70% 45%)"
        emphasis="foreground"
        realLabel={realLabel}
        realValue={hasPast ? formatEUR(Math.abs(realExpToDate), { compact: true }) : noRealValue}
        progressPct={hasPast ? progressPct(Math.abs(realExpToDate), Math.abs(totalExpense)) : null}
        vsPct={hasPast ? diffPct(Math.abs(realExpToDate), Math.abs(fcstExpToDate)) : null}
        vsPositiveIsGood={false}
        footer={`≈ ${formatEUR(monthlyAvgExpense, { compact: true })}/mes`}
      />
      <KpiCard
        label="Resultado neto (previsto)"
        value={formatEUR(totalNet, { compact: true, sign: true })}
        sparkValues={net}
        sparkColor="hsl(152 60% 36%)"
        sparkNegativeColor="hsl(0 70% 45%)"
        emphasis={totalNet >= 0 ? 'success' : 'destructive'}
        realLabel={realLabel}
        realValue={hasPast ? formatEUR(realNetToDate, { compact: true, sign: true }) : noRealValue}
        progressPct={hasPast ? progressPct(realNetToDate, totalNet) : null}
        vsPct={hasPast ? diffPct(realNetToDate, fcstNetToDate) : null}
        vsPositiveIsGood
        footer={`margen ${marginPct.toFixed(1)}%`}
      />
    </div>
  );
}
