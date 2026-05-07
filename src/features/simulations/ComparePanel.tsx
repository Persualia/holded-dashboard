import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SavedSim } from '@/lib/types';
import type { SimEvaluation } from '@/lib/simEvaluation';

interface Selected {
  sim: SavedSim;
  evaluation: SimEvaluation;
  color: string;
}

interface Props {
  selected: Selected[];
  maxSelectable: number;
  onRemove: (sim: SavedSim) => void;
  onClear: () => void;
}

/** Sticky right-rail panel listing the currently selected sims (up to N). */
export function ComparePanel({ selected, maxSelectable, onRemove, onClear }: Props) {
  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="text-base">
          Comparar
          {selected.length > 0 ? (
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {selected.length}/{maxSelectable}
            </span>
          ) : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Marca el ☐ de hasta <strong>{maxSelectable}</strong> simulaciones para verlas frente a
          frente y vs lo real.
        </p>
      </CardHeader>
      <CardContent>
        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin selección.</p>
        ) : (
          <div className="space-y-2">
            {selected.map(({ sim, evaluation, color }) => {
              const acc = evaluation.hasData ? Math.round(evaluation.accuracyPct * 100) : null;
              return (
                <div
                  key={sim.id}
                  className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm" title={sim.name}>
                    {sim.name}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {acc != null ? `${acc}%` : '—'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => onRemove(sim)}
                    aria-label="Quitar de comparación"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" onClick={onClear} className="w-full">
              Limpiar selección
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
