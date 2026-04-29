import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEUR, formatPct } from '@/lib/format';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';
import { cn } from '@/lib/utils';

export interface ClosedMonthAccuracy {
  monthIdx: number;
  realIncome: number;
  forecastIncome: number;
  realExpense: number;
  forecastExpense: number;
  incomeDiffPct: number | null;
  expenseDiffPct: number | null;
}

interface Props {
  closed: ClosedMonthAccuracy[];
}

/** Hide subsections whose absolute EUR delta is below this. */
const ROW_NOISE_EUR = 0.01;

export function AccuracyPanel({ closed }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Precisión de las previsiones</CardTitle>
        <p className="text-xs text-muted-foreground">
          % real vs lo que se previó originalmente, en los meses ya cerrados
          {CURRENT_MONTH_IDX > 0 ? ` (${MONTH_LABELS_ES.slice(0, CURRENT_MONTH_IDX).join(', ')})` : ''}
        </p>
      </CardHeader>
      <CardContent>
        {closed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay previsiones anteriores con las que comparar. Sube ficheros de meses
            anteriores del año para ver la desviación real vs previsto.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {closed.map((c) => {
              const showInc = Math.abs(c.realIncome - c.forecastIncome) > ROW_NOISE_EUR;
              const showExp = Math.abs(c.realExpense - c.forecastExpense) > ROW_NOISE_EUR;
              return (
                <div key={c.monthIdx} className="rounded-md border bg-background p-3">
                  <div className="text-base font-semibold">{MONTH_LABELS_ES[c.monthIdx]}</div>
                  <div className="mt-2 space-y-2">
                    {showInc && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Ingresos
                        </div>
                        <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
                          <span>
                            {formatEUR(c.realIncome, { compact: true })} /{' '}
                            <span className="text-muted-foreground">
                              {formatEUR(c.forecastIncome, { compact: true })}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'text-sm font-medium',
                              (c.incomeDiffPct ?? 0) >= 0 ? 'text-success' : 'text-destructive',
                            )}
                          >
                            {formatPct(c.incomeDiffPct, 1)}
                          </span>
                        </div>
                      </div>
                    )}
                    {showExp && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Gastos
                        </div>
                        <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
                          <span>
                            {formatEUR(c.realExpense, { compact: true })} /{' '}
                            <span className="text-muted-foreground">
                              {formatEUR(c.forecastExpense, { compact: true })}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'text-sm font-medium',
                              (c.expenseDiffPct ?? 0) <= 0 ? 'text-success' : 'text-destructive',
                            )}
                          >
                            {formatPct(c.expenseDiffPct, 1)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
