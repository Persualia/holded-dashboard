import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PivotTrendChart } from '@/components/charts/PivotTrendChart';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { formatEUR } from '@/lib/format';
import { GROUP_ORDER } from '@/lib/categorize';
import { isLocked } from '@/lib/time';
import { PivotFilters, type FilterType } from './PivotFilters';
import { PivotTable } from './PivotTable';

export function PivotView() {
  const ds = useDatasetCtx();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [enabledGroups, setEnabledGroups] = useState<Set<string> | null>(null);

  const allGroups = useMemo(() => {
    if (!ds.base) return [];
    const present = new Set(ds.base.items.map((i) => i.group));
    return GROUP_ORDER.filter((g) => present.has(g));
  }, [ds.base]);

  const filtered = useMemo(() => {
    if (!ds.effective) return [];
    const q = search.trim().toLowerCase();
    return ds.effective.items.filter((it) => {
      if (filterType !== 'all' && it.type !== filterType) return false;
      if (enabledGroups && !enabledGroups.has(it.group)) return false;
      if (
        activeOnly &&
        !it.isSimRow &&
        it.values.every((v) => v === 0) &&
        !it.simMask.some(Boolean)
      )
        return false;
      if (q && !it.name.toLowerCase().includes(q) && !it.account.includes(q)) return false;
      return true;
    });
  }, [ds.effective, filterType, enabledGroups, activeOnly, search]);

  const incomeMonths = new Array(12).fill(0);
  const expenseMonths = new Array(12).fill(0);
  for (const it of filtered) {
    for (let m = 0; m < 12; m++) {
      if (it.type === 'income') incomeMonths[m] += it.values[m] ?? 0;
      else expenseMonths[m] += it.values[m] ?? 0;
    }
  }
  const totalIncome = incomeMonths.reduce((a, b) => a + b, 0);
  const totalExpense = expenseMonths.reduce((a, b) => a + b, 0);

  function toggleGroup(g: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  const setOverride = ds.setOverride;
  const onFillRight = useCallback(
    (account: string, fromMonthIdx: number, value: number, offset: number) => {
      const target = fromMonthIdx + offset;
      if (target >= 12 || isLocked(target)) return false;
      setOverride(account, target, value);
      return true;
    },
    [setOverride],
  );

  function onToggleGroupFilter(g: string, on: boolean) {
    setEnabledGroups((prev) => {
      const cur = prev === null ? new Set(allGroups) : new Set(prev);
      if (on) cur.add(g);
      else cur.delete(g);
      return cur;
    });
  }

  if (!ds.effective || !ds.base) {
    return <div className="p-10 text-center text-muted-foreground">Cargando datos…</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      <PivotFilters
        search={search}
        onSearch={setSearch}
        type={filterType}
        onType={setFilterType}
        enabledGroups={enabledGroups}
        onToggleGroup={onToggleGroupFilter}
        onResetGroups={() => setEnabledGroups(null)}
        allGroups={allGroups}
        activeOnly={activeOnly}
        onActiveOnly={setActiveOnly}
        totalRows={ds.base.items.length}
        matchingRows={filtered.length}
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Tendencia del filtro actual</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ingresos y gastos del subconjunto filtrado, mes a mes
            </p>
          </CardHeader>
          <CardContent>
            <PivotTrendChart income={incomeMonths} expense={expenseMonths} />
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <Stat label="Filas" value={String(filtered.length)} />
              <Stat label="Ingresos" value={formatEUR(totalIncome)} />
              <Stat label="Gastos" value={formatEUR(totalExpense)} />
              <Stat
                label="Neto"
                value={formatEUR(totalIncome + totalExpense)}
                tone={totalIncome + totalExpense >= 0 ? 'success' : 'destructive'}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pivote · concepto × mes</CardTitle>
            <p className="text-xs text-muted-foreground">
              Doble click en cualquier celda futura para simular · Shift+→ extiende una celda (repetir para más meses) · Alt+click para reset
            </p>
          </CardHeader>
          <CardContent>
            <PivotTable
              items={filtered}
              base={ds.base}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              onOverride={ds.setOverride}
              onFillRight={onFillRight}
              onAddSimRow={ds.addSimRow}
              onRenameSimRow={ds.renameSimRow}
              onDeleteSimRow={ds.deleteSimRow}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'destructive';
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          tone === 'success'
            ? 'text-success font-semibold tabular-nums'
            : tone === 'destructive'
            ? 'text-destructive font-semibold tabular-nums'
            : 'font-semibold tabular-nums'
        }
      >
        {value}
      </div>
    </div>
  );
}
