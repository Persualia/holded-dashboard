import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MONTH_LABELS_ES } from '@/lib/time';
import { formatEUR } from '@/lib/format';

interface Props {
  income: number[];
  expense: number[];
  height?: number;
}

export function PivotTrendChart({ income, expense, height = 200 }: Props) {
  const data = MONTH_LABELS_ES.map((m, i) => ({
    month: m,
    income: income[i] ?? 0,
    expense: Math.abs(expense[i] ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="trend-income" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(152 60% 36%)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="hsl(152 60% 36%)" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="income"
          name="Ingresos"
          stroke="hsl(152 60% 36%)"
          strokeWidth={2}
          fill="url(#trend-income)"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="expense"
          name="Gastos (abs)"
          stroke="hsl(0 70% 45%)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
