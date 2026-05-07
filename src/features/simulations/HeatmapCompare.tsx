import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEUR, formatPct } from '@/lib/format';
import type { MonthScore, SimEvaluation } from '@/lib/simEvaluation';
import { BAND_COLORS, BAND_TEXT } from '@/lib/simEvaluation';
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

function findScore(scores: MonthScore[], m: number): MonthScore | undefined {
  return scores.find((s) => s.m === m);
}

/**
 * Mes × sim grid. Each cell is colored by accuracy band (top/close/fail) for
 * closed months; current and future months render as muted/dashed cells.
 */
export function HeatmapCompare({ items }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Heatmap mes a mes · % error sobre el neto real</CardTitle>
        <div className="flex flex-wrap gap-3 pt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: BAND_COLORS.top }}
            />
            ≤5% TOP
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: BAND_COLORS.close }}
            />
            5-10% CERCA
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: BAND_COLORS.fail }}
            />
            &gt;10% FALLO
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-border" />
            futuro · pendiente
          </span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div
            className="grid items-center gap-1 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            style={{ gridTemplateColumns: 'minmax(140px, 1.4fr) repeat(12, 1fr) 60px' }}
          >
            <div>simulación</div>
            {MONTH_LABELS_ES.map((l) => (
              <div key={l} className="text-center">
                {l}
              </div>
            ))}
            <div className="text-right">acierto</div>
          </div>
          {items.map(({ sim, evaluation, color }) => {
            const acc = evaluation.hasData ? Math.round(evaluation.accuracyPct * 100) : null;
            return (
              <div
                key={sim.id}
                className="grid items-center gap-1 py-1"
                style={{ gridTemplateColumns: 'minmax(140px, 1.4fr) repeat(12, 1fr) 60px' }}
              >
                <div
                  className="truncate border-l-[3px] pl-2 text-sm"
                  style={{ borderColor: color }}
                  title={sim.name}
                >
                  {sim.name}
                </div>
                {MONTH_LABELS_ES.map((label, m) => {
                  const isFuture = m >= CURRENT_MONTH_IDX;
                  const s = findScore(evaluation.monthScores, m);
                  if (isFuture) {
                    return (
                      <div
                        key={m}
                        className="h-7 rounded-sm border border-dashed border-border"
                        title={`${label}: pendiente`}
                      />
                    );
                  }
                  if (!s) {
                    return (
                      <div
                        key={m}
                        className="h-7 rounded-sm bg-muted/60"
                        title={`${label}: sin datos`}
                      />
                    );
                  }
                  return (
                    <div
                      key={m}
                      className="flex h-7 items-center justify-center rounded-sm font-mono text-[10px] font-medium"
                      style={{ background: BAND_COLORS[s.band], color: BAND_TEXT[s.band] }}
                      title={`${label}: ${formatPct(s.errNet * 100)} · predicho ${formatEUR(s.predNet, { compact: true })} vs real ${formatEUR(s.realNet, { compact: true })}`}
                    >
                      {Math.round(Math.abs(s.errNet) * 100)}
                    </div>
                  );
                })}
                <div className="text-right font-mono text-xs tabular-nums">
                  {acc != null ? `${acc}%` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
