import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';
import { formatEUR } from '@/lib/format';

interface Props {
  predicted: number[];
  real: number[];
  width?: number;
  height?: number;
  predictedColor?: string;
  realColor?: string;
}

/**
 * Two-series mini sparkline: dashed predicted line for the whole year, solid
 * real line capped at the current month (closed months only). Today is marked
 * by a vertical dashed accent rule.
 */
export function PredictedVsRealSpark({
  predicted,
  real,
  width = 200,
  height = 56,
  predictedColor = 'hsl(213 60% 45%)',
  realColor = 'var(--foreground)',
}: Props) {
  const pad = 4;
  const all = [...predicted, ...real.slice(0, CURRENT_MONTH_IDX)].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (all.length === 0) return <svg width={width} height={height} aria-hidden />;

  const max = Math.max(...all, 0);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const xStep = (width - pad * 2) / 11;
  const px = (i: number) => pad + i * xStep;
  const py = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);

  const realIdx = real
    .map((_, i) => i)
    .filter((i) => i < CURRENT_MONTH_IDX && Number.isFinite(real[i]));
  const todayX = px(Math.max(0, CURRENT_MONTH_IDX - 0.5));

  const predPath = predicted
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`)
    .join(' ');
  const realPath = realIdx
    .map((i, j) => `${j === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(real[i]).toFixed(1)}`)
    .join(' ');

  const yZero = py(0);

  return (
    <svg width={width} height={height} className="block">
      <line
        x1={pad}
        y1={yZero}
        x2={width - pad}
        y2={yZero}
        stroke="var(--border)"
        strokeDasharray="2 3"
        strokeWidth="0.5"
      />
      {CURRENT_MONTH_IDX > 0 && (
        <line
          x1={todayX}
          y1={pad}
          x2={todayX}
          y2={height - pad}
          stroke="var(--accent)"
          strokeDasharray="2 2"
          strokeWidth="0.8"
          opacity="0.6"
        />
      )}
      <path
        d={predPath}
        fill="none"
        stroke={predictedColor}
        strokeWidth="1.6"
        strokeDasharray="3 2"
        strokeLinecap="round"
        opacity="0.85"
      >
        <title>
          Predicho:{' '}
          {predicted
            .map((v, i) => `${MONTH_LABELS_ES[i]} ${formatEUR(v, { compact: true })}`)
            .join(' · ')}
        </title>
      </path>
      {realPath && (
        <path
          d={realPath}
          fill="none"
          stroke={realColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {realIdx.map((i) => (
        <circle key={i} cx={px(i)} cy={py(real[i])} r="2" fill={realColor} />
      ))}
    </svg>
  );
}
