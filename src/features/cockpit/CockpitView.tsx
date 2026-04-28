import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  IncomeExpenseNetChart,
  type ChartSeries,
} from '@/components/charts/IncomeExpenseNetChart';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { aggregate } from '@/lib/aggregate';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';
import { formatEUR, formatPct } from '@/lib/format';
import type { Item } from '@/lib/types';
import { KpiRow } from './KpiRow';
import { AccuracyPanel, type ClosedMonthAccuracy } from './AccuracyPanel';
import { AlertsPanel, type AppAlert } from './AlertsPanel';
import { RankedBarsCard } from './RankedBarsCard';
import { MonthStrip } from './MonthStrip';

export function CockpitView() {
  const ds = useDatasetCtx();
  const [showInc, setShowInc] = useState(true);
  const [showExp, setShowExp] = useState(true);
  const [showNet, setShowNet] = useState(true);

  const aggEffective = useMemo(
    () => (ds.effective ? aggregate(ds.effective.items) : null),
    [ds.effective],
  );
  const aggBase = useMemo(() => (ds.base ? aggregate(ds.base.items) : null), [ds.base]);
  const aggForecast = useMemo(() => {
    if (!ds.forecast || !ds.base) return null;
    // Marry forecast values with current item categories so we can aggregate by group consistently.
    const items: Item[] = ds.forecast.items.map((snap) => {
      const cur = ds.base!.items.find((b) => b.account === snap.account);
      return {
        name: cur?.name ?? snap.name,
        account: snap.account,
        values: snap.values,
        type: cur?.type ?? snap.type,
        group: cur?.group ?? snap.group,
      };
    });
    return aggregate(items);
  }, [ds.forecast, ds.base]);

  if (!ds.effective || !aggEffective || !aggBase) {
    return <div className="p-10 text-center text-muted-foreground">Cargando datos…</div>;
  }

  const totals = aggEffective.totals;
  const margin = totals.income !== 0 ? (totals.net / totals.income) * 100 : 0;
  const monthlyAvgExp = Math.abs(totals.expense) / 12;
  const recurrentTotal = aggEffective.byGroup['Ventas recurrentes']?.total ?? 0;
  const recurrentPct = totals.income ? (recurrentTotal / totals.income) * 100 : 0;
  const currentMonthInc = aggBase.income[CURRENT_MONTH_IDX];
  const currentMonthIncFcst = aggForecast?.income[CURRENT_MONTH_IDX] ?? aggBase.income[CURRENT_MONTH_IDX];

  // Top clients (recurrent + non-recurrent by sales amount)
  const clientsIncome = ds.effective.items
    .filter((i) => i.type === 'income' && (i.group === 'Ventas recurrentes' || i.group === 'Ventas no recurrentes'))
    .map((i) => ({ ...i, total: i.values.reduce((a, b) => a + b, 0) }))
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total);
  const top5 = clientsIncome.slice(0, 5);

  // Expense breakdown
  const expGroups = Object.entries(aggEffective.byGroup)
    .filter(([, v]) => v.type === 'expense' && v.total < 0)
    .map(([k, v]) => ({ name: k, total: Math.abs(v.total) }))
    .sort((a, b) => b.total - a.total);

  // Closed-month accuracy
  const closed: ClosedMonthAccuracy[] = [];
  if (aggForecast) {
    for (let i = 0; i < CURRENT_MONTH_IDX; i++) {
      const realInc = aggBase.income[i];
      const fcstInc = aggForecast.income[i];
      const realExp = aggBase.expense[i];
      const fcstExp = aggForecast.expense[i];
      closed.push({
        monthIdx: i,
        realIncome: realInc,
        forecastIncome: fcstInc,
        realExpense: realExp,
        forecastExpense: fcstExp,
        incomeDiffPct: fcstInc ? ((realInc - fcstInc) / Math.abs(fcstInc)) * 100 : null,
        expenseDiffPct: fcstExp ? ((realExp - fcstExp) / Math.abs(fcstExp)) * 100 : null,
      });
    }
  }
  const hasMeaningfulComparison =
    !!aggForecast &&
    closed.some(
      (c) =>
        Math.abs(c.realIncome - c.forecastIncome) > 0.01 ||
        Math.abs(c.realExpense - c.forecastExpense) > 0.01,
    );

  // Alerts
  const alerts: AppAlert[] = [];
  if (ds.simCount > 0 && ds.showSim && aggForecast) {
    const deltaNet = totals.net - aggForecast.totals.net;
    alerts.push({
      kind: deltaNet >= 0 ? 'ok' : 'warn',
      text: `Tu simulación cambia el resultado neto en ${formatEUR(deltaNet, { sign: true })} vs el plan original.`,
    });
  }
  closed.forEach((c) => {
    if (c.incomeDiffPct != null && Math.abs(c.incomeDiffPct) > 10 && hasMeaningfulComparison) {
      alerts.push({
        kind: c.incomeDiffPct < 0 ? 'bad' : 'ok',
        text: `${MONTH_LABELS_ES[c.monthIdx]}: ingresos reales ${formatPct(c.incomeDiffPct, 0)} vs previsión.`,
      });
    }
  });
  aggEffective.net.forEach((n, i) => {
    if (n < 0)
      alerts.push({
        kind: 'bad',
        text: `${MONTH_LABELS_ES[i]} cierra con resultado negativo: ${formatEUR(n)}.`,
      });
  });
  if (top5[0]) {
    const totalSales = clientsIncome.reduce((s, c) => s + c.total, 0);
    const share = top5[0].total / (totalSales || 1);
    if (share > 0.25) {
      alerts.push({
        kind: 'warn',
        text: `${top5[0].name.split(' - ')[0]} concentra el ${(share * 100).toFixed(0)}% de los ingresos. Riesgo de concentración.`,
      });
    }
  }

  // Build chart series (real / forecast / sim)
  const real: ChartSeries = aggBase
    ? { income: aggBase.income, expense: aggBase.expense, net: aggBase.net }
    : { income: [], expense: [], net: [] };
  const forecast: ChartSeries = aggForecast
    ? { income: aggForecast.income, expense: aggForecast.expense, net: aggForecast.net }
    : real;
  const hasSim = ds.simCount > 0 && ds.showSim;
  const sim: ChartSeries | null = hasSim
    ? { income: aggEffective.income, expense: aggEffective.expense, net: aggEffective.net }
    : null;

  const simByMonth = MONTH_LABELS_ES.map((_, i) => ds.effective!.items.some((it) => it.simMask[i]));

  return (
    <div className="space-y-6">
      <KpiRow
        totalIncome={totals.income}
        totalExpense={totals.expense}
        totalNet={totals.net}
        income={aggEffective.income}
        expense={aggEffective.expense}
        net={aggEffective.net}
        recurrentPct={recurrentPct}
        monthlyAvgExpense={monthlyAvgExp}
        marginPct={margin}
        currentMonthIncome={currentMonthInc}
        currentMonthIncomeForecast={currentMonthIncFcst}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ingresos · Gastos · Neto</CardTitle>
            <p className="text-xs text-muted-foreground">
              real (sólido) · previsto (discontinuo claro) · simulado (discontinuo fuerte)
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="m-inc"
                  checked={showInc}
                  onCheckedChange={(v) => setShowInc(Boolean(v))}
                />
                <Label htmlFor="m-inc" className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm bg-success" />
                  Ingresos
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="m-exp"
                  checked={showExp}
                  onCheckedChange={(v) => setShowExp(Boolean(v))}
                />
                <Label htmlFor="m-exp" className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
                  Gastos (abs)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="m-net"
                  checked={showNet}
                  onCheckedChange={(v) => setShowNet(Boolean(v))}
                />
                <Label htmlFor="m-net" className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                  Neto
                </Label>
              </div>
            </div>
            <IncomeExpenseNetChart
              real={real}
              forecast={forecast}
              sim={sim}
              showIncome={showInc}
              showExpense={showExp}
              showNet={showNet}
            />
          </CardContent>
        </Card>

        <AlertsPanel alerts={alerts} />
      </div>

      <AccuracyPanel closed={closed} hasMeaningfulComparison={hasMeaningfulComparison} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankedBarsCard
          title="Top clientes"
          description="por ingresos del año"
          rows={top5.map((c) => ({ label: c.name.split(' - ')[0] || c.name, value: c.total }))}
          color="hsl(152 60% 36%)"
        />
        <RankedBarsCard
          title="Gastos por categoría"
          description={`${expGroups.length} categorías`}
          rows={expGroups.slice(0, 7).map((g) => ({ label: g.name, value: g.total }))}
          color="hsl(0 70% 45%)"
        />
      </div>

      <MonthStrip
        income={aggEffective.income}
        expense={aggEffective.expense}
        net={aggEffective.net}
        simByMonth={simByMonth}
      />
    </div>
  );
}
