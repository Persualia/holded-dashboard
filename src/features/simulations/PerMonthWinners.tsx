import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPct } from '@/lib/format';
import type { SimEvaluation } from '@/lib/simEvaluation';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';
import type { SavedSim } from '@/lib/types';

interface Item {
  sim: SavedSim;
  evaluation: SimEvaluation;
  color: string;
}

interface Props {
  items: Item[];
}

/**
 * For each closed month, picks the sim whose predicted-net was closest to the
 * real value. Useful summary of "who got that month right".
 */
export function PerMonthWinners({ items }: Props) {
  if (items.length < 2) return null;

  const winners: Array<{ m: number; item: Item; absErr: number } | null> = [];
  for (let m = 0; m < CURRENT_MONTH_IDX; m++) {
    let best: Item | null = null;
    let bestErr = Infinity;
    for (const it of items) {
      const score = it.evaluation.monthScores.find((s) => s.m === m);
      if (!score) continue;
      const err = Math.abs(score.errNet);
      if (err < bestErr) {
        bestErr = err;
        best = it;
      }
    }
    winners.push(best ? { m, item: best, absErr: bestErr } : null);
  }

  if (winners.every((w) => w == null)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">¿Quién ganó cada mes cerrado?</CardTitle>
        <p className="text-xs text-muted-foreground">
          La simulación con menor error absoluto sobre el neto real de ese mes.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {winners.map((w, idx) => {
            if (!w) return null;
            const sim = w.item.sim;
            return (
              <div
                key={idx}
                className="flex min-w-[88px] flex-col items-center rounded-md border bg-background p-2"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {MONTH_LABELS_ES[w.m]}
                </div>
                <div
                  className="my-1 h-2 w-2 rounded-full border border-border"
                  style={{ background: w.item.color }}
                  aria-hidden
                />
                <div className="text-center text-[11px] leading-tight">
                  {sim.name.split(' ').slice(0, 2).join(' ')}
                </div>
                <div className="font-mono text-[10px] text-success">
                  {formatPct(w.absErr * 100)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
