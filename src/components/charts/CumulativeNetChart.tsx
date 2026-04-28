import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatEUR } from '@/lib/format';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';

interface Props {
  values: number[];
  height?: number;
}

export function CumulativeNetChart({ values, height = 200 }: Props) {
  const data = MONTH_LABELS_ES.map((m, i) => ({ month: m, value: values[i] ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="cum-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
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
        <ReferenceLine
          x={MONTH_LABELS_ES[CURRENT_MONTH_IDX]}
          stroke="var(--primary)"
          strokeDasharray="3 3"
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#cum-grad)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
