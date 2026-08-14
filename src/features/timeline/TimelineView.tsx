import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CumulativeNetChart } from '@/components/charts/CumulativeNetChart';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { aggregate } from '@/lib/aggregate';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES, isLocked } from '@/lib/time';
import { MonthBlock } from './MonthBlock';
import { SidePanel } from './SidePanel';

export function TimelineView() {
  const ds = useDatasetCtx();
  // Abrimos el último mes cerrado: es el más reciente con datos reales, frente
  // al mes en curso, que todavía es previsión. En enero no hay mes anterior
  // dentro del año, así que se queda en el propio enero.
  const [openMonth, setOpenMonth] = useState<number>(Math.max(0, CURRENT_MONTH_IDX - 1));

  const aggEff = useMemo(() => (ds.effective ? aggregate(ds.effective.items) : null), [ds.effective]);
  const aggBase = useMemo(() => (ds.base ? aggregate(ds.base.items) : null), [ds.base]);

  const cumulative = useMemo(() => {
    if (!aggEff) return [];
    let cum = 0;
    return aggEff.net.map((v) => (cum += v));
  }, [aggEff]);

  const handleCopyPrevious = useCallback(
    (monthIdx: number) => {
      if (!ds.effective || isLocked(monthIdx) || monthIdx === 0) return;
      for (const it of ds.effective.items) {
        const prev = it.values[monthIdx - 1];
        if (prev !== it.values[monthIdx]) {
          ds.setOverride(it.account, monthIdx, prev);
        }
      }
    },
    [ds],
  );

  const handleApply5Pct = useCallback(
    (monthIdx: number) => {
      if (!ds.effective || isLocked(monthIdx)) return;
      for (const it of ds.effective.items) {
        const cur = it.values[monthIdx];
        if (cur !== 0) ds.setOverride(it.account, monthIdx, Math.round(cur * 1.05 * 100) / 100);
      }
    },
    [ds],
  );

  if (!ds.effective || !aggEff || !aggBase || !ds.base) {
    return <div className="p-10 text-center text-muted-foreground">Cargando datos…</div>;
  }

  const bestIdx = aggEff.net.indexOf(Math.max(...aggEff.net));
  const worstIdx = aggEff.net.indexOf(Math.min(...aggEff.net));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Resultado acumulado · YTD</CardTitle>
            <p className="text-xs text-muted-foreground">
              Suma del resultado neto desde enero, con cualquier simulación activa
            </p>
          </CardHeader>
          <CardContent>
            <CumulativeNetChart values={cumulative} />
          </CardContent>
        </Card>

        <div className="relative ml-3 border-l border-dashed pl-6 pt-2">
          <div className="space-y-4">
            {MONTH_LABELS_ES.map((_, i) => {
              const hasSim = ds.effective!.items.some((it) => it.simMask[i]);
              return (
                <MonthBlock
                  key={i}
                  monthIdx={i}
                  income={aggEff.income[i]}
                  expense={aggEff.expense[i]}
                  net={aggEff.net[i]}
                  items={ds.effective!.items}
                  base={ds.base!}
                  forecast={ds.forecast}
                  open={openMonth === i}
                  hasSim={hasSim}
                  onToggle={() => setOpenMonth(openMonth === i ? -1 : i)}
                  onOverride={ds.setOverride}
                  onCopyPrevious={() => handleCopyPrevious(i)}
                  onApply5Pct={() => handleApply5Pct(i)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <SidePanel
        totalNet={aggEff.totals.net}
        baseTotalNet={aggBase.totals.net}
        simCount={ds.simCount}
        bestMonthIdx={bestIdx}
        bestMonthValue={aggEff.net[bestIdx]}
        worstMonthIdx={worstIdx}
        worstMonthValue={aggEff.net[worstIdx]}
        baseNet={aggBase.net}
        effectiveNet={aggEff.net}
      />
    </div>
  );
}
