import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEUR } from '@/lib/format';

interface Row {
  label: string;
  /** Annual total (real to date + expected for the rest of the year). */
  value: number;
  /** Real to date. When omitted the whole bar is rendered solid. */
  real?: number;
}

interface Props {
  title: string;
  description?: string;
  rows: Row[];
  /** Per-row colour for the fill bar. Defaults to primary. */
  color?: string;
  /** Trim long labels at this length. */
  maxLabel?: number;
  /** Render at most this many bars. */
  limit?: number;
}

export function RankedBarsCard({
  title,
  description,
  rows,
  color = 'var(--primary)',
  maxLabel = 28,
  limit = 7,
}: Props) {
  const max = rows[0]?.value || 1;
  const visible = rows.slice(0, limit);
  const stripeBg = `repeating-linear-gradient(45deg, ${color} 0 3px, transparent 3px 6px)`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          real (sólido) · previsto (rayado)
        </p>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="space-y-2.5">
            {visible.map((r, i) => {
              const total = Math.max(0, r.value);
              const real = r.real != null ? Math.max(0, Math.min(total, r.real)) : total;
              const expected = Math.max(0, total - real);
              const realPct = Math.max(0, Math.min(100, (real / max) * 100));
              const expPct = Math.max(0, Math.min(100 - realPct, (expected / max) * 100));
              const label =
                r.label.length > maxLabel ? r.label.slice(0, maxLabel) + '…' : r.label;
              return (
                <li key={i} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3">
                  <span className="truncate text-sm">{label}</span>
                  <div className="relative flex h-2 overflow-hidden rounded-full bg-muted">
                    {realPct > 0 && (
                      <div
                        className="h-full"
                        style={{ width: `${realPct}%`, backgroundColor: color }}
                      />
                    )}
                    {expPct > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${expPct}%`,
                          backgroundImage: stripeBg,
                          backgroundColor: 'transparent',
                        }}
                      />
                    )}
                  </div>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">
                    {formatEUR(r.value, { compact: true })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
