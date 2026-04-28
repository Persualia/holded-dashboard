import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthBadge } from '@/components/sim/MonthBadge';
import { formatEUR } from '@/lib/format';
import { MONTH_LABELS_ES, monthState } from '@/lib/time';
import { cn } from '@/lib/utils';

interface Props {
  income: number[];
  expense: number[];
  net: number[];
  simByMonth: boolean[];
}

export function MonthStrip({ income, expense, net, simByMonth }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tira mensual</CardTitle>
        <p className="text-xs text-muted-foreground">real (cerrado) · en curso · previsión (futuro)</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
          {MONTH_LABELS_ES.map((m, i) => {
            const state = monthState(i);
            const hasSim = simByMonth[i];
            return (
              <div
                key={m}
                className={cn(
                  'rounded-md border p-2.5 text-center',
                  state === 'current' && 'border-success/50 bg-success/5',
                  hasSim && 'border-primary/50 bg-primary/5',
                  state === 'past' && !hasSim && 'bg-muted/30',
                )}
              >
                <div className="flex justify-center">
                  <MonthBadge monthIdx={i} hasSim={hasSim} />
                </div>
                <div className="mt-1.5 text-base font-semibold">{m}</div>
                <div className="mt-1 text-[11px] tabular-nums text-success">
                  +{formatEUR(income[i], { compact: true })}
                </div>
                <div className="text-[11px] tabular-nums text-destructive">
                  {formatEUR(expense[i], { compact: true })}
                </div>
                <div
                  className={cn(
                    'mt-1 border-t pt-1 text-xs font-semibold tabular-nums',
                    net[i] >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {formatEUR(net[i], { compact: true, sign: true })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
