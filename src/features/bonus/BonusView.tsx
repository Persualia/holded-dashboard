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
import { computeBonusPool, type PoolLimit } from '@/lib/bonus';
import type { BonusWorker } from '@/lib/types';
import { cn } from '@/lib/utils';

const bonusFieldClass =
  'border-secondary/50 bg-secondary/20 shadow-sm hover:border-secondary/70 hover:bg-secondary/30 focus-visible:border-primary/70 focus-visible:bg-secondary/20 focus-visible:ring-primary/30';

const lockedHeadClass = 'border-x border-primary/30 bg-primary/10 text-primary';
const lockedCellClass = 'border-x border-primary/20 bg-primary/10';

const lockedFieldClass =
  'border-[var(--muted-foreground)] bg-[var(--muted-foreground)] text-[var(--primary-foreground)] ring-1 ring-[var(--muted-foreground)] shadow-sm placeholder:text-[var(--primary-foreground)]/70 hover:border-[var(--muted-foreground)] hover:bg-[var(--muted-foreground)] focus-visible:bg-[var(--muted-foreground)] focus-visible:text-[var(--primary-foreground)]';

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
      className={cn(bonusFieldClass, 'tabular-nums', className)}
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

/** Column-header padlock. Exactly one column (weights or totals) is locked at a
 *  time: the locked one stays fixed when the pool changes, the other is derived. */
function LockToggle({
  active,
  onClick,
  label,
  tooltip,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-pressed={active}
          aria-label={active ? `${label} bloqueados` : `Bloquear ${label}`}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
            active
              ? 'cursor-default bg-[var(--muted-foreground)] text-[var(--primary-foreground)]'
              : 'text-muted-foreground/60 hover:bg-muted hover:text-foreground',
          )}
        >
          {active ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-[11px] leading-snug">{tooltip}</TooltipContent>
    </Tooltip>
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

/** One line of the profit → bonus → tax → net cascade. */
function CascadeRow({
  label,
  hint,
  value,
  total,
  color,
}: {
  label: string;
  hint?: string;
  value: string;
  total?: boolean;
  color?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-2',
        total && 'border-t border-foreground/20 font-semibold',
      )}
    >
      <div className="min-w-0">
        <span className={cn('text-sm', !total && 'text-muted-foreground')}>{label}</span>
        {hint ? <span className="ml-2 text-xs text-muted-foreground/80">{hint}</span> : null}
      </div>
      <span className={cn('shrink-0 tabular-nums', total ? 'text-base' : 'text-sm', color)}>
        {value}
      </span>
    </div>
  );
}

/** Labelled numeric input with a unit suffix and optional help line. */
function ConfigField({
  label,
  help,
  unit,
  value,
  onCommit,
  className,
}: {
  label: string;
  help?: string;
  unit: string;
  value: number;
  onCommit: (n: number) => void;
  className?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <NumField value={value} onCommit={onCommit} className={className} ariaLabel={label} />
        <span className="text-muted-foreground">{unit}</span>
      </div>
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function formatPct(n: number): string {
  return `${formatNumberInput(n)}%`;
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
  // The workers' share is taken from the profit BEFORE corporate tax; the
  // minimum is what the company must keep AFTER bonus and tax.
  const netPre = aggEffective?.totals.net ?? 0;
  const { rawPool, pool, limitedBy, startsAt, fullPctAt } = computeBonusPool(netPre, config);
  const taxRate = config.taxRatePct / 100;

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
  const overPool = locked && distributed - pool > 0.01;

  // The bonus is a deductible expense: it lowers the taxable base, so corporate
  // tax applies to what's left after it. Until workers are set up, the cascade
  // shows the full pool.
  const bonus = hasDistribution ? distributed : pool;
  const taxableBase = netPre - bonus;
  const tax = Math.max(0, taxableBase) * taxRate;
  const companyNet = taxableBase - tax;
  const meetsMin = companyNet >= config.minNetProfit - 0.5;

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
  function setLockMode(mode: 'weights' | 'totals') {
    if ((mode === 'totals') === locked) return;
    if (mode === 'weights') {
      // Lock weights: back-derive each weight from its pinned total so nothing jumps.
      update({
        lockTotals: false,
        workers: config.workers.map((w) => ({
          ...w,
          weightPct: pool > 0 ? ((w.lockedTotal ?? 0) / pool) * 100 : w.weightPct,
        })),
      });
    } else {
      // Lock totals: snapshot the current euro totals as the pinned amounts.
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

  const pctLabel = formatPct(config.distributePct);
  const poolReason: Record<PoolLimit, string> = {
    percentage: `${pctLabel} del beneficio antes de impuestos.`,
    cap: `Limitada por el máximo a repartir. El ${pctLabel} serían ${formatEUR(rawPool)}.`,
    minimum:
      pool > 0
        ? `Reducida para que la empresa conserve ${formatEUR(config.minNetProfit)} netos. El ${pctLabel} serían ${formatEUR(rawPool)}.`
        : `El beneficio no llega para repartir y conservar ${formatEUR(config.minNetProfit)} netos.`,
    none: 'Sin beneficio antes de impuestos no hay bolsa.',
  };

  if (loading || !ds.effective) {
    return <div className="p-10 text-center text-muted-foreground">Cargando datos…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Profit → bonus → tax → company net */}
      <Card>
        <CardHeader>
          <CardTitle>Beneficio y bonus</CardTitle>
          <CardDescription>
            {usingScenario
              ? 'Refleja el escenario activo cargado.'
              : 'Sobre los datos reales/previstos.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-6 sm:grid-cols-3">
            <Stat
              label="Beneficio antes de impuestos"
              value={formatEUR(netPre, { sign: true })}
              color={netPre >= 0 ? 'text-success' : 'text-destructive'}
              tooltip="Resultado previsto del año (ingresos − gastos), antes de bonus e impuestos. Refleja el escenario activo si hay uno cargado."
            />
            <Stat
              label={hasDistribution ? 'Bonus repartido' : 'Bolsa de bonus'}
              value={formatEUR(bonus)}
              color="text-primary"
              tooltip={`Parte del beneficio antes de impuestos que va a los trabajadores (${pctLabel}), limitada para que la empresa conserve el mínimo neto y por el máximo a repartir.`}
            />
            <div>
              <Stat
                label="Beneficio neto empresa"
                value={formatEUR(companyNet, { sign: true })}
                color={meetsMin ? 'text-success' : 'text-destructive'}
                tooltip="Lo que le queda a la empresa tras pagar el bonus y el Impuesto de Sociedades. El bonus es gasto deducible, así que reduce la base imponible."
              />
              <div
                className={cn(
                  'mt-1 text-xs',
                  meetsMin ? 'text-muted-foreground' : 'text-destructive',
                )}
              >
                {meetsMin ? 'Cumple' : 'No cumple'} el mínimo de {formatEUR(config.minNetProfit)}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-input bg-muted/30 px-4 py-1">
            <CascadeRow label="Beneficio antes de impuestos" value={formatEUR(netPre)} />
            <CascadeRow
              label={hasDistribution ? '− Bonus repartido' : '− Bolsa de bonus'}
              hint={
                limitedBy === 'percentage' ? `${pctLabel} antes de impuestos` : 'limitada'
              }
              value={formatEUR(-bonus)}
            />
            <CascadeRow label="Base imponible" value={formatEUR(taxableBase)} total />
            <CascadeRow
              label="− Impuesto de Sociedades"
              hint={formatPct(config.taxRatePct)}
              value={formatEUR(-tax)}
            />
            <CascadeRow
              label="Beneficio neto empresa"
              value={formatEUR(companyNet)}
              color={meetsMin ? 'text-success' : 'text-destructive'}
              total
            />
          </div>
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
            <ConfigField
              label="% para trabajadores (antes de impuestos)"
              help="Porcentaje del beneficio antes del Impuesto de Sociedades."
              unit="%"
              value={config.distributePct}
              onCommit={(n) => update({ distributePct: n })}
              className="w-28"
            />
            <ConfigField
              label="Beneficio neto mínimo para la empresa"
              help="Después de bonus e impuestos. La bolsa se reduce lo necesario para garantizarlo."
              unit="€"
              value={config.minNetProfit}
              onCommit={(n) => update({ minNetProfit: n })}
            />
            <ConfigField
              label="Máximo a repartir"
              help="0 = sin límite."
              unit="€"
              value={config.maxDistribute}
              onCommit={(n) => update({ maxDistribute: n })}
            />
            <ConfigField
              label="Impuesto de Sociedades"
              help="Por defecto 23% (pyme pequeña)."
              unit="%"
              value={config.taxRatePct}
              onCommit={(n) => update({ taxRatePct: n })}
              className="w-20"
            />

            <div className="rounded-md border border-input bg-muted/40 p-3">
              <InfoLabel
                label="Bolsa de bonus disponible"
                tooltip="El menor de: % para trabajadores sobre el beneficio antes de impuestos, lo que permite conservar el beneficio neto mínimo, y el máximo a repartir."
              />
              <div className="text-2xl font-semibold tabular-nums text-primary">
                {formatEUR(pool)}
              </div>
              <p
                className={cn(
                  'mt-1 text-xs',
                  pool > 0 ? 'text-muted-foreground' : 'text-destructive',
                )}
              >
                {poolReason[limitedBy]}
              </p>
              {Number.isFinite(startsAt) && config.distributePct > 0 ? (
                <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                  Se reparte a partir de {formatEUR(startsAt)} de beneficio antes de impuestos
                  {Number.isFinite(fullPctAt)
                    ? `; el ${pctLabel} completo a partir de ${formatEUR(fullPctAt)}.`
                    : '.'}
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
                Edita el peso (%) o el total (€). El candado marca qué columna se mantiene fija si cambia la bolsa.
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
                    <TableHead
                      className={cn('w-32 transition-colors', !locked && lockedHeadClass)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Peso (%)</span>
                        <LockToggle
                          active={!locked}
                          onClick={() => setLockMode('weights')}
                          label="pesos"
                          tooltip={
                            !locked
                              ? 'Pesos bloqueados: el % de cada trabajador se mantiene fijo y su total (€) se recalcula si cambian el beneficio o la simulación.'
                              : 'Bloquea el peso (%) de cada trabajador: los totales (€) se recalcularán con la bolsa.'
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead
                      className={cn('w-40 transition-colors', locked && lockedHeadClass)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Total (€)</span>
                        <LockToggle
                          active={locked}
                          onClick={() => setLockMode('totals')}
                          label="totales"
                          tooltip={
                            locked
                              ? 'Totales bloqueados: el € de cada trabajador se mantiene fijo y su peso (%) se recalcula si cambian el beneficio o la simulación.'
                              : 'Bloquea el total (€) de cada trabajador para conservar la previsión aunque cambien el beneficio o la simulación.'
                          }
                        />
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
                          className={bonusFieldClass}
                        />
                      </TableCell>
                      <TableCell className={cn('transition-colors', !locked && lockedCellClass)}>
                        <NumField
                          value={workerWeight(w)}
                          onCommit={(n) => setWorkerWeight(w, n)}
                          className={cn(!locked && lockedFieldClass)}
                          ariaLabel={`Peso de ${w.name || 'trabajador'}`}
                        />
                      </TableCell>
                      <TableCell className={cn('transition-colors', locked && lockedCellClass)}>
                        <NumField
                          value={workerTotal(w)}
                          onCommit={(n) => setWorkerTotal(w, n)}
                          className={cn(locked && lockedFieldClass)}
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
                      {netPre > 0
                        ? ` (${((distributed / netPre) * 100).toFixed(1)}% del beneficio antes de impuestos)`
                        : ''}
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
                    {formatEUR(pool)}). Se mantienen tal cual; bloquea los pesos para reajustarlos a la bolsa.
                  </p>
                ) : null}
                {!meetsMin && hasDistribution ? (
                  <p className="text-xs text-destructive">
                    Con este reparto la empresa se queda en {formatEUR(companyNet)} netos, por debajo
                    del mínimo de {formatEUR(config.minNetProfit)}.
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
