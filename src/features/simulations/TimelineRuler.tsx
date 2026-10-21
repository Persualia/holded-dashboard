import { MONTH_LABELS_ES, TODAY, TODAY_MONTH_IDX, TODAY_YEAR, VIEW_YEAR } from '@/lib/time';
import type { SavedSim } from '@/lib/types';

interface Props {
  sims: SavedSim[];
}

// The ruler places sims by save date. Plans for a future year are made during
// the current one, so the ruler never goes past today's year.
function rulerYear(): number {
  return Math.min(VIEW_YEAR, TODAY_YEAR);
}

function leftPctFor(date: Date): number {
  // Map Jan 1 → 0%, Dec 31 → 100% within the ruler year. Sims saved in
  // other years are clamped at the edges (rare in practice).
  const year = rulerYear();
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const t = Math.max(start, Math.min(end - 1, date.getTime()));
  return ((t - start) / (end - start)) * 100;
}

/** Horizontal year ruler with a dot per saved sim and a "hoy" marker. */
export function TimelineRuler({ sims }: Props) {
  const showToday = rulerYear() === TODAY_YEAR;
  const todayPct = leftPctFor(TODAY);
  return (
    <div className="relative h-14 select-none">
      <div className="absolute inset-x-0 top-7 h-px bg-border" />
      {MONTH_LABELS_ES.map((label, m) => {
        const left = (m / 11) * 100;
        return (
          <div
            key={m}
            className="absolute top-7 -translate-x-px text-[10px] text-muted-foreground"
            style={{ left: `${left}%` }}
          >
            <div className="h-2 w-px bg-border" />
            <div className="mt-1 -translate-x-1/2 font-mono">{label}</div>
          </div>
        );
      })}
      {showToday && (
        <>
          <div
            className="pointer-events-none absolute top-1 h-12 w-px bg-accent"
            style={{ left: `${todayPct}%` }}
            title={`hoy · ${MONTH_LABELS_ES[TODAY_MONTH_IDX]}`}
          />
          <div
            className="absolute -translate-x-1/2 text-[10px] font-medium text-accent"
            style={{ left: `${todayPct}%`, top: 0 }}
          >
            hoy
          </div>
        </>
      )}
      {sims.map((s, i) => {
        const date = new Date(s.createdAt);
        const left = leftPctFor(date);
        const offset = (i % 3) * 4;
        return (
          <div
            key={s.id}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary shadow"
            style={{ left: `${left}%`, top: `${24 + offset}px` }}
            title={`${s.name} · ${date.toLocaleDateString('es-ES')}`}
          />
        );
      })}
    </div>
  );
}
