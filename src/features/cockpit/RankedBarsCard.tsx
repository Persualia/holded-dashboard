import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEUR } from '@/lib/format';

interface Row {
  label: string;
  value: number;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="space-y-2.5">
            {visible.map((r, i) => {
              const pct = Math.max(0, Math.min(100, (r.value / max) * 100));
              const label = r.label.length > maxLabel ? r.label.slice(0, maxLabel) + '…' : r.label;
              return (
                <li key={i} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3">
                  <span className="truncate text-sm">{label}</span>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
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
