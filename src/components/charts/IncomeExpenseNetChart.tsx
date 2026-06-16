import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';
import { formatEUR } from '@/lib/format';

export interface ChartSeries {
  income: number[];
  expense: number[];
  net: number[];
}

interface Props {
  /** Real values for past + current months (null elsewhere). */
  real: ChartSeries;
  /** Forecast snapshot — full year. */
  forecast: ChartSeries;
  /** Simulation overlay — non-null only on current+future when there is a sim. */
  sim: ChartSeries | null;
  showIncome: boolean;
  showExpense: boolean;
  showNet: boolean;
  height?: number;
}

const COLORS = {
  income: 'hsl(152 60% 36%)',
  expense: 'hsl(0 70% 45%)',
  net: 'hsl(13 70% 50%)',
};

interface Row {
  month: string;
  monthIdx: number;
  realIncome: number | null;
  realExpense: number | null;
  realNet: number | null;
  fcstIncome: number;
  fcstExpense: number;
  fcstNet: number;
  simIncome: number | null;
  simExpense: number | null;
  simNet: number | null;
}

export function IncomeExpenseNetChart({
  real,
  forecast,
  sim,
  showIncome,
  showExpense,
  showNet,
  height = 320,
}: Props) {
  const data: Row[] = MONTH_LABELS_ES.map((m, i) => ({
    month: m,
    monthIdx: i,
    realIncome: i < CURRENT_MONTH_IDX ? real.income[i] ?? null : null,
    realExpense: i < CURRENT_MONTH_IDX ? Math.abs(real.expense[i] ?? 0) : null,
    realNet: i < CURRENT_MONTH_IDX ? real.net[i] ?? null : null,
    fcstIncome: forecast.income[i] ?? 0,
    fcstExpense: Math.abs(forecast.expense[i] ?? 0),
    fcstNet: forecast.net[i] ?? 0,
    simIncome: sim && i >= CURRENT_MONTH_IDX ? sim.income[i] ?? null : null,
    simExpense: sim && i >= CURRENT_MONTH_IDX ? Math.abs(sim.expense[i] ?? 0) : null,
    simNet: sim && i >= CURRENT_MONTH_IDX ? sim.net[i] ?? null : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="month"
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickFormatter={(v) => formatEUR(v, { compact: true })}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          width={60}
        />
        <Tooltip
          formatter={(v: number) => formatEUR(v)}
          labelClassName="font-medium"
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />

        <ReferenceLine
          x={MONTH_LABELS_ES[CURRENT_MONTH_IDX]}
          stroke={COLORS.net}
          strokeDasharray="3 3"
          label={{ value: 'hoy', position: 'insideTopRight', fill: COLORS.net, fontSize: 10 }}
        />

        {/* Forecast (light dashed) */}
        {showIncome && (
          <Line
            type="linear"
            dataKey="fcstIncome"
            name="Ingresos previstos"
            stroke={COLORS.income}
            strokeDasharray="4 4"
            strokeOpacity={0.45}
            dot={false}
            isAnimationActive={false}
          />
        )}
        {showExpense && (
          <Line
            type="linear"
            dataKey="fcstExpense"
            name="Gastos previstos"
            stroke={COLORS.expense}
            strokeDasharray="4 4"
            strokeOpacity={0.45}
            dot={false}
            isAnimationActive={false}
          />
        )}
        {showNet && (
          <Line
            type="linear"
            dataKey="fcstNet"
            name="Neto previsto"
            stroke={COLORS.net}
            strokeDasharray="4 4"
            strokeOpacity={0.45}
            dot={false}
            isAnimationActive={false}
          />
        )}

        {/* Real (solid) */}
        {showIncome && (
          <Line
            type="linear"
            dataKey="realIncome"
            name="Ingresos real"
            stroke={COLORS.income}
            strokeWidth={2.4}
            dot={{ r: 2.5, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
        {showExpense && (
          <Line
            type="linear"
            dataKey="realExpense"
            name="Gastos real"
            stroke={COLORS.expense}
            strokeWidth={2.4}
            dot={{ r: 2.5, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
        {showNet && (
          <Line
            type="linear"
            dataKey="realNet"
            name="Neto real"
            stroke={COLORS.net}
            strokeWidth={2.4}
            dot={{ r: 2.5, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}

        {/* Simulation (strong dashed) */}
        {sim && showIncome && (
          <Line
            type="linear"
            dataKey="simIncome"
            name="Ingresos sim"
            stroke={COLORS.income}
            strokeWidth={2.4}
            strokeDasharray="6 3"
            dot={{ r: 3, strokeWidth: 1, fill: 'white', stroke: COLORS.income }}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
        {sim && showExpense && (
          <Line
            type="linear"
            dataKey="simExpense"
            name="Gastos sim"
            stroke={COLORS.expense}
            strokeWidth={2.4}
            strokeDasharray="6 3"
            dot={{ r: 3, strokeWidth: 1, fill: 'white', stroke: COLORS.expense }}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
        {sim && showNet && (
          <Line
            type="linear"
            dataKey="simNet"
            name="Neto sim"
            stroke={COLORS.net}
            strokeWidth={2.4}
            strokeDasharray="6 3"
            dot={{ r: 3, strokeWidth: 1, fill: 'white', stroke: COLORS.net }}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
