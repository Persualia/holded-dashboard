import { useState } from 'react';
import { ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MonthBadge } from '@/components/sim/MonthBadge';
import { EditableAmount } from '@/components/sim/EditableAmount';
import { formatEUR } from '@/lib/format';
import { MONTH_LABELS_ES, isLocked, monthState } from '@/lib/time';
import type { Dataset, EffectiveItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  monthIdx: number;
  income: number;
  expense: number;
  net: number;
  items: EffectiveItem[];
  base: Dataset;
  open: boolean;
  hasSim: boolean;
  onToggle: () => void;
  onOverride: (account: string, monthIdx: number, value: number | null) => void;
  onCopyPrevious: () => void;
  onApply5Pct: () => void;
}

export function MonthBlock({
  monthIdx,
  income,
  expense,
  net,
  items,
  base,
  open,
  hasSim,
  onToggle,
  onOverride,
  onCopyPrevious,
  onApply5Pct,
}: Props) {
  const state = monthState(monthIdx);
  const locked = isLocked(monthIdx);

  const monthItems = items.filter((it) => it.values[monthIdx] !== 0 || it.simMask[monthIdx]);
  const incs = monthItems.filter((it) => it.type === 'income').sort((a, b) => b.values[monthIdx] - a.values[monthIdx]);
  const exps = monthItems.filter((it) => it.type === 'expense').sort((a, b) => a.values[monthIdx] - b.values[monthIdx]);

  return (
    <div className="relative pl-10">
      {/* Dot */}
      <div
        className={cn(
          'absolute left-2 top-3 h-4 w-4 rounded-full border-2 ring-4 ring-background',
          state === 'past' && 'border-muted-foreground bg-muted-foreground/30',
          state === 'current' && 'border-success bg-success',
          state === 'future' && 'border-border bg-background',
          hasSim && 'border-primary bg-primary',
        )}
      />

      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-muted/40"
      >
        <span className="text-base font-semibold">{MONTH_LABELS_ES[monthIdx]}</span>
        <MonthBadge monthIdx={monthIdx} hasSim={hasSim} />
        <span className="ml-auto flex items-baseline gap-2 font-mono text-xs tabular-nums">
          <span className="text-success">+{formatEUR(income, { compact: true })}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-destructive">{formatEUR(expense, { compact: true })}</span>
          <span className="text-muted-foreground">=</span>
          <span className={cn('font-semibold', net >= 0 ? 'text-success' : 'text-destructive')}>
            {formatEUR(net, { compact: true, sign: true })}
          </span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <Card className="mt-2 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-success">
                + Ingresos del mes
              </div>
              {incs.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Sin ingresos en {MONTH_LABELS_ES[monthIdx]}.</p>
              ) : (
                <BarList
                  items={incs.slice(0, 8)}
                  monthIdx={monthIdx}
                  base={base}
                  locked={locked}
                  onOverride={onOverride}
                  color="hsl(152 60% 36%)"
                />
              )}
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-destructive">
                − Gastos del mes
              </div>
              {exps.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Sin gastos en {MONTH_LABELS_ES[monthIdx]}.</p>
              ) : (
                <GroupedBarList
                  items={exps}
                  monthIdx={monthIdx}
                  base={base}
                  locked={locked}
                  onOverride={onOverride}
                  color="hsl(0 70% 45%)"
                />
              )}
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex flex-wrap items-center gap-2">
            {locked ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Mes cerrado — no editable (datos reales).
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Doble click en cualquier valor para simular · Alt+click para reset
                </p>
                <span className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={onCopyPrevious}>
                    Copiar mes anterior
                  </Button>
                  <Button size="sm" variant="outline" onClick={onApply5Pct}>
                    +5% al mes
                  </Button>
                </span>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

interface BarListProps {
  items: EffectiveItem[];
  monthIdx: number;
  base: Dataset;
  locked: boolean;
  onOverride: (account: string, monthIdx: number, value: number | null) => void;
  color: string;
}

function BarList({ items, monthIdx, base, locked, onOverride, color }: BarListProps) {
  const max = Math.max(...items.map((it) => Math.abs(it.values[monthIdx])), 1);
  return (
    <ul className="mt-2 space-y-2">
      {items.map((it) => {
        const v = it.values[monthIdx];
        const orig = base.items.find((b) => b.account === it.account)?.values[monthIdx] ?? v;
        const pct = Math.min(100, (Math.abs(v) / max) * 100);
        const label = (it.name.split(' - ')[0] || it.name).slice(0, 22);
        return (
          <li key={it.account} className="grid grid-cols-[7rem_1fr_5rem] items-center gap-2 text-xs">
            <span className="truncate" title={it.name}>
              {label}
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="text-right">
              <EditableAmount
                value={v}
                original={orig}
                isSim={it.simMask[monthIdx]}
                locked={locked}
                onChange={(nv) => onOverride(it.account, monthIdx, nv)}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function GroupedBarList({ items, monthIdx, base, locked, onOverride, color }: BarListProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groups = (() => {
    const map = new Map<string, EffectiveItem[]>();
    for (const it of items) {
      const list = map.get(it.group);
      if (list) list.push(it);
      else map.set(it.group, [it]);
    }
    return Array.from(map.entries())
      .map(([group, gItems]) => ({
        group,
        items: gItems.slice().sort((a, b) => a.values[monthIdx] - b.values[monthIdx]),
        total: gItems.reduce((s, it) => s + it.values[monthIdx], 0),
      }))
      .sort((a, b) => a.total - b.total);
  })();

  const max = Math.max(...groups.map((g) => Math.abs(g.total)), 1);

  return (
    <ul className="mt-2 space-y-1">
      {groups.map((g) => {
        const isOpen = !!openGroups[g.group];
        const pct = Math.min(100, (Math.abs(g.total) / max) * 100);
        const itemMax = Math.max(...g.items.map((it) => Math.abs(it.values[monthIdx])), 1);
        return (
          <li key={g.group}>
            <button
              type="button"
              onClick={() => setOpenGroups((s) => ({ ...s, [g.group]: !s[g.group] }))}
              className="grid w-full grid-cols-[1rem_7rem_1fr_5rem] items-center gap-2 rounded px-1 py-1 text-left text-xs hover:bg-muted/40"
            >
              {isOpen ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="truncate font-medium" title={g.group}>
                {g.group}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <span className="text-right font-mono tabular-nums">
                {formatEUR(g.total, { compact: true })}
              </span>
            </button>
            {isOpen && (
              <ul className="ml-4 mt-1 space-y-2 border-l border-border/60 pl-3">
                {g.items.map((it) => {
                  const v = it.values[monthIdx];
                  const orig = base.items.find((b) => b.account === it.account)?.values[monthIdx] ?? v;
                  const ipct = Math.min(100, (Math.abs(v) / itemMax) * 100);
                  const label = (it.name.split(' - ')[0] || it.name).slice(0, 22);
                  return (
                    <li
                      key={it.account}
                      className="grid grid-cols-[7rem_1fr_5rem] items-center gap-2 text-xs"
                    >
                      <span className="truncate text-muted-foreground" title={it.name}>
                        {label}
                      </span>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${ipct}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-right">
                        <EditableAmount
                          value={v}
                          original={orig}
                          isSim={it.simMask[monthIdx]}
                          locked={locked}
                          onChange={(nv) => onOverride(it.account, monthIdx, nv)}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
