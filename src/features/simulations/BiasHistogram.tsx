import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPct } from '@/lib/format';
import type { SimEvaluation } from '@/lib/simEvaluation';
import type { SavedSim } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  sims: SavedSim[];
  evaluations: SimEvaluation[];
}

/**
 * Histogram of signed average net-error per sim. Bars centered on zero —
 * rightward = sobreestimo (predicted > real), leftward = infraestimo.
 */
export function BiasHistogram({ sims, evaluations }: Props) {
  const maxAbs = Math.max(
    0.001,
    ...evaluations.map((e) => (e.hasData ? Math.abs(e.avgSignedErrNet) : 0)),
  );
  const scored = evaluations.filter((e) => e.hasData);
  const avg =
    scored.length > 0
      ? (scored.reduce((a, b) => a + b.avgSignedErrNet, 0) / scored.length) * 100
      : null;

  const interpretation =
    avg == null
      ? 'Sin datos suficientes — guarda escenarios y deja que se cierren meses.'
      : Math.abs(avg) > 8
        ? avg > 0
          ? `💡 Tiendes a ser optimista (~+${Math.abs(avg).toFixed(0)}% de media)`
          : `💡 Tiendes a ser conservador (~-${Math.abs(avg).toFixed(0)}% de media)`
        : '💡 Sin sesgo claro — estás calibrado';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sesgo · ¿sobre o infraestimas?</CardTitle>
        <p className="text-xs text-muted-foreground">
          Error signed medio del neto por simulación.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>← infra</span>
          <span>cero</span>
          <span>sobre →</span>
        </div>

        {sims.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin simulaciones.</p>
        ) : (
          <ul className="space-y-1.5">
            {sims.map((s, i) => {
              const ev = evaluations[i];
              const v = ev?.hasData ? ev.avgSignedErrNet : null;
              const widthPct = v != null ? Math.min(50, (Math.abs(v) / maxAbs) * 50) : 0;
              return (
                <li key={s.id} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-2">
                  <span className="truncate text-xs" title={s.name}>
                    {s.name}
                  </span>
                  <div className="relative h-3 rounded-full bg-muted">
                    <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                    {v != null && v >= 0 && (
                      <div
                        className="absolute top-0 h-full rounded-r-full bg-destructive/70"
                        style={{ left: '50%', width: `${widthPct}%` }}
                      />
                    )}
                    {v != null && v < 0 && (
                      <div
                        className="absolute top-0 h-full rounded-l-full bg-primary/70"
                        style={{ right: '50%', width: `${widthPct}%` }}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-right font-mono text-xs tabular-nums',
                      v == null
                        ? 'text-muted-foreground'
                        : v > 0
                          ? 'text-destructive'
                          : 'text-primary',
                    )}
                  >
                    {v != null ? formatPct(v * 100) : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="pt-1 text-xs italic text-muted-foreground">{interpretation}</p>
      </CardContent>
    </Card>
  );
}
