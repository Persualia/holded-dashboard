import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MONTH_LABELS_ES } from '@/lib/time';
import { formatEUR } from '@/lib/format';

interface Props {
  original: number[];
  withSim: number[];
  height?: number;
}

export function SimComparisonChart({ original, withSim, height = 200 }: Props) {
  const data = MONTH_LABELS_ES.map((m, i) => ({
    month: m,
    original: original[i] ?? 0,
    sim: withSim[i] ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
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
        <Line
          type="monotone"
          dataKey="original"
          name="Plan original"
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          strokeWidth={1.6}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="sim"
          name="Con simulación"
          stroke="var(--primary)"
          strokeWidth={2.2}
          dot={{ r: 2.5, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
