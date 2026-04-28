import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  values: number[];
  color?: string;
  /** When provided, values below 0 stroke/fill with this color and the line uses 0 as baseline. */
  negativeColor?: string;
  height?: number;
}

export function Sparkline({
  values,
  color = 'var(--primary)',
  negativeColor,
  height = 36,
}: SparklineProps) {
  const data = values.map((v, i) => ({ i, v }));
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const fillId = `spark-fill-${safeId}`;
  const strokeId = `spark-stroke-${safeId}`;

  if (!negativeColor) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 1, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.6}
            fill={`url(#${fillId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const range = max - min;
  const zeroOffset = range > 0 ? max / range : 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 1, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={strokeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset={zeroOffset} stopColor={color} />
            <stop offset={zeroOffset} stopColor={negativeColor} />
            <stop offset="100%" stopColor={negativeColor} />
          </linearGradient>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset={zeroOffset} stopColor={color} stopOpacity={0} />
            <stop offset={zeroOffset} stopColor={negativeColor} stopOpacity={0} />
            <stop offset="100%" stopColor={negativeColor} stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={`url(#${strokeId})`}
          strokeWidth={1.6}
          fill={`url(#${fillId})`}
          isAnimationActive={false}
          baseValue={0}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
