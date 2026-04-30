import { Fragment, useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  values: number[];
  color?: string;
  /** When provided, values below 0 stroke/fill with this color and the line uses 0 as baseline. */
  negativeColor?: string;
  height?: number;
  /**
   * If set, indices `< dashFromIdx` render solid (real) and indices
   * `>= dashFromIdx` render dashed (estimated). The boundary point is shared
   * between both segments so they connect visually.
   */
  dashFromIdx?: number;
}

interface Stop {
  offset: string;
  color: string;
  opacity: number;
}

function fillStops(values: number[], color: string, negativeColor: string): Stop[] {
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (min >= 0) {
    return [
      { offset: '0%', color, opacity: 0.4 },
      { offset: '100%', color, opacity: 0 },
    ];
  }
  if (max <= 0) {
    return [
      { offset: '0%', color: negativeColor, opacity: 0 },
      { offset: '100%', color: negativeColor, opacity: 0.4 },
    ];
  }
  const range = max - min;
  const off = `${(max / range) * 100}%`;
  return [
    { offset: '0%', color, opacity: 0.4 },
    { offset: off, color, opacity: 0 },
    { offset: off, color: negativeColor, opacity: 0 },
    { offset: '100%', color: negativeColor, opacity: 0.4 },
  ];
}

function strokeStops(values: number[], color: string, negativeColor: string): Stop[] {
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (min >= 0) return [{ offset: '0%', color, opacity: 1 }];
  if (max <= 0) return [{ offset: '0%', color: negativeColor, opacity: 1 }];
  const range = max - min;
  const off = `${(max / range) * 100}%`;
  return [
    { offset: '0%', color, opacity: 1 },
    { offset: off, color, opacity: 1 },
    { offset: off, color: negativeColor, opacity: 1 },
    { offset: '100%', color: negativeColor, opacity: 1 },
  ];
}

function dimFill(stops: Stop[]): Stop[] {
  return stops.map((s) => ({ ...s, opacity: s.opacity * 0.45 }));
}

export function Sparkline({
  values,
  color = 'var(--primary)',
  negativeColor,
  height = 36,
  dashFromIdx,
}: SparklineProps) {
  const split = dashFromIdx != null && dashFromIdx > 0 && dashFromIdx < values.length;
  const data = values.map((v, i) => ({
    i,
    vReal: !split || i < dashFromIdx! ? v : null,
    vEst: split && i >= dashFromIdx! - 1 ? v : null,
  }));
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const fillRealId = `spark-fill-real-${safeId}`;
  const fillEstId = `spark-fill-est-${safeId}`;
  const strokeRealId = `spark-stroke-real-${safeId}`;
  const strokeEstId = `spark-stroke-est-${safeId}`;

  if (!negativeColor) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 1, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fillRealId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={fillEstId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="vReal"
            stroke={color}
            strokeWidth={1.6}
            fill={`url(#${fillRealId})`}
            isAnimationActive={false}
            connectNulls={false}
          />
          {split && (
            <Area
              type="monotone"
              dataKey="vEst"
              stroke={color}
              strokeWidth={1.6}
              strokeDasharray="3 3"
              fill={`url(#${fillEstId})`}
              isAnimationActive={false}
              connectNulls={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  const realValues = split ? values.slice(0, dashFromIdx!) : values;
  const estValues = split ? values.slice(dashFromIdx! - 1) : [];
  const realFill = fillStops(realValues, color, negativeColor);
  const realStroke = strokeStops(realValues, color, negativeColor);
  const estFill = dimFill(fillStops(estValues, color, negativeColor));
  const estStroke = strokeStops(estValues, color, negativeColor);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 1, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={strokeRealId} x1="0" y1="0" x2="0" y2="1">
            {realStroke.map((s, idx) => (
              <Fragment key={idx}>
                <stop offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
              </Fragment>
            ))}
          </linearGradient>
          <linearGradient id={fillRealId} x1="0" y1="0" x2="0" y2="1">
            {realFill.map((s, idx) => (
              <Fragment key={idx}>
                <stop offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
              </Fragment>
            ))}
          </linearGradient>
          {split && (
            <>
              <linearGradient id={strokeEstId} x1="0" y1="0" x2="0" y2="1">
                {estStroke.map((s, idx) => (
                  <Fragment key={idx}>
                    <stop offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
                  </Fragment>
                ))}
              </linearGradient>
              <linearGradient id={fillEstId} x1="0" y1="0" x2="0" y2="1">
                {estFill.map((s, idx) => (
                  <Fragment key={idx}>
                    <stop offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
                  </Fragment>
                ))}
              </linearGradient>
            </>
          )}
        </defs>
        <Area
          type="monotone"
          dataKey="vReal"
          stroke={`url(#${strokeRealId})`}
          strokeWidth={1.6}
          fill={`url(#${fillRealId})`}
          isAnimationActive={false}
          baseValue={0}
          connectNulls={false}
        />
        {split && (
          <Area
            type="monotone"
            dataKey="vEst"
            stroke={`url(#${strokeEstId})`}
            strokeWidth={1.6}
            strokeDasharray="3 3"
            fill={`url(#${fillEstId})`}
            isAnimationActive={false}
            baseValue={0}
            connectNulls={false}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
