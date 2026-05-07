import { BAND_COLORS } from '@/lib/simEvaluation';
import type { MonthScore } from '@/lib/simEvaluation';
import { formatPct } from '@/lib/format';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';

interface Props {
  scores: MonthScore[];
}

/**
 * Twelve dots — one per month. Each closed month is colored by its accuracy
 * band; future months are muted to signal "pending".
 */
export function BandPips({ scores }: Props) {
  const byMonth = new Map<number, MonthScore>();
  for (const s of scores) byMonth.set(s.m, s);

  return (
    <div className="flex items-center gap-[3px]">
      {MONTH_LABELS_ES.map((label, m) => {
        const s = byMonth.get(m);
        const isFuture = m >= CURRENT_MONTH_IDX;
        const bg = s
          ? BAND_COLORS[s.band]
          : isFuture
            ? 'transparent'
            : 'var(--muted)';
        const border = isFuture ? '1px dashed var(--border)' : '1px solid transparent';
        const title = s
          ? `${label}: ${formatPct(s.errNet * 100)}`
          : isFuture
            ? `${label}: pendiente`
            : `${label}: sin baseline`;
        return (
          <span
            key={m}
            title={title}
            className="h-2 w-2 rounded-full"
            style={{ background: bg, border }}
          />
        );
      })}
    </div>
  );
}
