import { useEffect, useMemo, useState } from 'react';
import { Info, Lock, Plus, Trash2, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { useBonus } from '@/hooks/useBonus';
import { aggregate } from '@/lib/aggregate';
import { formatEUR, formatNumberInput, parseUserNumber } from '@/lib/format';
import type { BonusWorker } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Text input that parses Spanish-formatted numbers and commits live + on blur. */
function NumField({
  value,
  onCommit,
  className,
  ariaLabel,
}: {
  value: number;
  onCommit: (n: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(() => formatNumberInput(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(formatNumberInput(value));
  }, [value, focused]);
  return (
    <Input
      aria-label={ariaLabel}
      inputMode="decimal"
      value={text}
      className={cn('tabular-nums', className)}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseUserNumber(e.target.value);
        if (n != null) onCommit(n);
      }}
      onBlur={() => {
        setFocused(false);
        const n = parseUserNumber(text);
        setText(formatNumberInput(n ?? value));
        if (n != null) onCommit(n);
      }}
    />
  );
}

/** Mono uppercase label with an optional info tooltip. */
function InfoLabel({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      <span>{label}</span>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help text-muted-foreground/70 hover:text-foreground">
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-[11px] leading-snug">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div>
      <InfoLabel label={label} tooltip={tooltip} />
      <div className={cn('text-2xl font-semibold tabular-nums', color)}>{value}</div>
    </div>
  );
}

export function BonusView() {
  const ds = useDatasetCtx();
  const { config, loading, saving, update } = useBonus();

  const aggEffective = useMemo(
    () => (ds.effective ? aggregate(ds.effective.items) : null),
    [ds.effective],
  );

  const usingScenario = ds.showSim && ds.simCount > 0;

  // Core derivations. Profit follows the globally active scenario (ds.effective).
  const netPre = aggEffective?.totals.net ?? 0;
  const netAfterTax = netPre * (1 - config.taxRatePct / 100);
  const meetsMin = netAfterTax >= config.minNetProfit;
  const rawPool = netAfterTax * (config.distributePct / 100);
  let pool = 0;
  if (meetsMin && rawPool > 0) {
    pool = config.maxDistribute > 0 ? Math.min(rawPool, config.maxDistribute) : rawPool;
  }

  const locked = config.lockTotals ?? false;

  // While locked, the pinned euro amount is the source of truth and the weight
  // becomes the derived value; otherwise the weight drives the euro total.
  function workerTotal(w: BonusWorker): number {
    return locked ? (w.lockedTotal ?? 0) : (pool * w.weightPct) / 100;
  }
  function workerWeight(w: BonusWorker): number {
    if (!locked) return w.weightPct;
    return pool > 0 ? ((w.lockedTotal ?? 0) / pool) * 100 : 0;
  }

  const weightSum = config.workers.reduce((s, w) => s + workerWeight(w), 0);
  const distributed = config.workers.reduce((s, w) => s + workerTotal(w), 0);
  const hasDistribution = distributed > 0;
  const overPool = locked && pool > 0 && distributed - pool > 0.01;

  // The bonus is a deductible expense: it lowers the taxable base, so corporate
  // tax applies to what's left after distributing it.
  const resultPre = netPre - distributed;
  const resultAfterTax = resultPre * (1 - config.taxRatePct / 100);

  function updateWorker(id: string, patch: Partial<BonusWorker>) {
    update({ workers: config.workers.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  }
  function addWorker() {
    update({
      workers: [
        ...config.workers,
        { id: crypto.randomUUID(), name: '', weightPct: 0, lockedTotal: 0 },
      ],
    });
  }
  function removeWorker(id: string) {
    update({ workers: config.workers.filter((w) => w.id !== id) });
  }
  function setWorkerWeight(w: BonusWorker, weightPct: number) {
    if (locked) {
      // Editing a weight re-pins that worker's euro total at the current pool.
      const patch: Partial<BonusWorker> = { weightPct };
      if (pool > 0) patch.lockedTotal = (pool * weightPct) / 100;
      updateWorker(w.id, patch);
    } else {
      updateWorker(w.id, { weightPct });
    }
  }
  function setWorkerTotal(w: BonusWorker, total: number) {
    const weightPct = pool > 0 ? (total / pool) * 100 : w.weightPct;
    updateWorker(w.id, locked ? { lockedTotal: total, weightPct } : { weightPct });
  }
  function toggleLock() {
    if (locked) {
      // Unlock: back-derive each weight from its pinned total so nothing jumps.
      update({
        lockTotals: false,
        workers: config.workers.map((w) => ({
          ...w,
          weightPct: pool > 0 ? ((w.lockedTotal ?? 0) / pool) * 100 : w.weightPct,
        })),
      });
    } else {
      // Lock: snapshot the current euro totals as the pinned amounts.
      update({
        lockTotals: true,
        workers: config.workers.map((w) => ({ ...w, lockedTotal: (pool * w.weightPct) / 100 })),
      });
    }
  }
  function normalizeWeights() {
    if (weightSum <= 0) return;
    update({
      workers: config.workers.map((w) => ({ ...w, weightPct: (w.weightPct / weightSum) * 100 })),
    });
  }

  const taxColor = netAfterTax >= 0 ? 'text-success' : 'text-destructive';
  const grossColor = netPre >= 0 ? 'text-success' : 'text-destructive';

  if (loading || !ds.effective) {
    return <div className="p-10 text-center text-muted-foreground">Cargando datos…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Extended profit KPI */}
      <Card>
        <CardHeader>
          <CardTitle>Beneficio</CardTitle>
          <CardDescription>
            {usingScenario
              ? 'Refleja el escenario activo cargado.'
              : 'Sobre los datos reales/previstos.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-6 sm:grid-cols-3">
            <Stat
              label="Beneficio bruto (previsto)"
              value={formatEUR(netPre, { sign: true })}
              color={grossColor}
              tooltip="Resultado neto previsto del año (ingresos − gastos), antes de impuestos. Refleja el escenario activo si hay uno cargado."
            />
            <div>
              <InfoLabel
                label="Impuesto de Sociedades"
                tooltip="Tipo impositivo sobre el beneficio. Editable; por defecto 23% (pyme pequeña). Se guarda automáticamente."
              />
              <div className="mt-1 flex items-center gap-1.5">
                <NumField
                  value={config.taxRatePct}
                  onCommit={(n) => update({ taxRatePct: n })}
                  className="w-20"
                  ariaLabel="Tipo de impuesto de sociedades (%)"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                impuestos: {formatEUR(netPre - netAfterTax)}
              </div>
            </div>
            <Stat
              label="Beneficio neto (después de impuestos)"
              value={formatEUR(netAfterTax, { sign: true })}
              color={taxColor}
              tooltip="Beneficio bruto menos el Impuesto de Sociedades, SIN repartir bonus. Orientativo de lo que quedaría si no se reparte la bolsa."
            />
          </div>

          {hasDistribution ? (
            <div className="grid gap-6 border-t pt-5 sm:grid-cols-3">
              <Stat
                label="Resultado sin impuestos (tras bonus)"
                value={formatEUR(resultPre, { sign: true })}
                color={resultPre >= 0 ? 'text-success' : 'text-destructive'}
                tooltip="Beneficio bruto menos el total repartido en bonus. Aún no se han aplicado impuestos."
              />
              <Stat
                label="Total repartido"
                value={formatEUR(distributed)}
                tooltip="Suma de los importes asignados a cada trabajador. Es la parte de la bolsa efectivamente repartida según los pesos."
              />
              <Stat
                label="Resultado con impuestos (tras bonus)"
                value={formatEUR(resultAfterTax, { sign: true })}
                color={resultAfterTax >= 0 ? 'text-success' : 'text-destructive'}
                tooltip="Resultado final real: (beneficio bruto − bonus) con el Impuesto de Sociedades aplicado. El bonus es gasto deducible, así que reduce la base imponible."
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Config (left) + Workers (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Configuración del bonus</CardTitle>
            <CardDescription>Define cómo se calcula la bolsa a repartir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Mínimo de beneficio neto (después de impuestos)
              </Label>
              <div className="flex items-center gap-1.5">
                <NumField
                  value={config.minNetProfit}
                  onCommit={(n) => update({ minNetProfit: n })}
                  ariaLabel="Mínimo de beneficio neto"
                />
                <span className="text-muted-foreground">€</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Por debajo de este beneficio no se reparte nada.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">% del beneficio a repartir</Label>
              <div className="flex items-center gap-1.5">
                <NumField
                  value={config.distributePct}
                  onCommit={(n) => update({ distributePct: n })}
                  className="w-28"
                  ariaLabel="Porcentaje a repartir"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Máximo a repartir</Label>
              <div className="flex items-center gap-1.5">
                <NumField
                  value={config.maxDistribute}
                  onCommit={(n) => update({ maxDistribute: n })}
                  ariaLabel="Máximo a repartir"
                />
                <span className="text-muted-foreground">€</span>
              </div>
              <p className="text-xs text-muted-foreground">0 = sin límite.</p>
            </div>

            <div className="rounded-md border border-input bg-muted/40 p-3">
              <InfoLabel
                label="Bolsa de bonus disponible"
                tooltip="% del beneficio neto (después de impuestos) a repartir, limitado por el máximo. Es 0 si el beneficio neto no llega al mínimo."
              />
              <div className="text-2xl font-semibold tabular-nums text-primary">
                {formatEUR(pool)}
              </div>
              {!meetsMin ? (
                <p className="mt-1 text-xs text-destructive">
                  El beneficio neto no alcanza el mínimo configurado.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Reparto por trabajador</CardTitle>
              <CardDescription>
                Edita el peso (%) o el total (€); lo demás se recalcula.
              </CardDescription>
            </div>
            <Button size="sm" onClick={addWorker}>
              <Plus className="mr-1 h-4 w-4" />
              Añadir trabajador
            </Button>
          </CardHeader>
          <CardContent>
            {config.workers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin trabajadores. Añade el primero para repartir la bolsa.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trabajador</TableHead>
                    <TableHead className="w-32">Peso (%)</TableHead>
                    <TableHead className="w-40">
                      <div className="flex items-center gap-1.5">
                        <span>Total (€)</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={toggleLock}
                              aria-pressed={locked}
                              aria-label={locked ? 'Desbloquear totales' : 'Bloquear totales'}
                              className={cn(
                                'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                                locked
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground/60 hover:bg-muted hover:text-foreground',
                              )}
                            >
                              {locked ? (
                                <Lock className="h-3.5 w-3.5" />
                              ) : (
                                <Unlock className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[260px] text-[11px] leading-snug">
                            {locked
                              ? 'Totales bloqueados: el € de cada trabajador se mantiene fijo aunque cambien el beneficio, los porcentajes o la simulación. Pulsa para desbloquear.'
                              : 'Bloquea el total (€) de cada trabajador para conservar la previsión aunque cambien el beneficio o la simulación.'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.workers.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Input
                          value={w.name}
                          placeholder="Nombre"
                          onChange={(e) => updateWorker(w.id, { name: e.target.value })}
                          maxLength={120}
                        />
                      </TableCell>
                      <TableCell>
                        <NumField
                          value={workerWeight(w)}
                          onCommit={(n) => setWorkerWeight(w, n)}
                          ariaLabel={`Peso de ${w.name || 'trabajador'}`}
                        />
                      </TableCell>
                      <TableCell>
                        <NumField
                          value={workerTotal(w)}
                          onCommit={(n) => setWorkerTotal(w, n)}
                          className={cn(locked && 'border-primary/40 bg-primary/5')}
                          ariaLabel={`Total de ${w.name || 'trabajador'}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeWorker(w.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {config.workers.length > 0 ? (
              <div className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'tabular-nums',
                        Math.abs(weightSum - 100) < 0.01 ? 'text-success' : 'text-destructive',
                      )}
                    >
                      Suma de pesos: {weightSum.toFixed(1)}%
                    </span>
                    <span
                      className={cn('tabular-nums', overPool ? 'text-destructive' : 'text-muted-foreground')}
                    >
                      Repartido: {formatEUR(distributed)} / {formatEUR(pool)}
                    </span>
                  </div>
                  {!locked && Math.abs(weightSum - 100) >= 0.01 && weightSum > 0 ? (
                    <Button variant="outline" size="sm" onClick={normalizeWeights}>
                      Normalizar a 100%
                    </Button>
                  ) : null}
                </div>
                {overPool ? (
                  <p className="text-xs text-destructive">
                    Los totales bloqueados ({formatEUR(distributed)}) superan la bolsa disponible (
                    {formatEUR(pool)}). Se mantienen tal cual; desbloquea el candado para reajustarlos.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <p className="text-right text-xs text-muted-foreground">
        {saving ? 'Guardando…' : 'Cambios guardados automáticamente.'}
      </p>
    </div>
  );
}
