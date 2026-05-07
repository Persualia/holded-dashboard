import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEUR } from '@/lib/format';
import type { SimEvaluation } from '@/lib/simEvaluation';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';
import type { SavedSim } from '@/lib/types';

interface Item {
  sim: SavedSim;
  evaluation: SimEvaluation;
  color: string;
}

interface Props {
  items: Item[];
}

interface Row {
  month: string;
  realNet: number | null;
  /** sim_<idx>: predicted net, with the current-month boundary in mind. */
  [key: `sim_${number}`]: number | null;
}

/**
 * Visual diff: monthly NET line per selected sim (predicted, full year) plus a
 * solid line for real (closed months only). Renders one line per item using
 * its assigned color.
 */
export function DiffPanel({ items }: Props) {
  const data: Row[] = MONTH_LABELS_ES.map((m, i) => {
    const row: Row = {
      month: m,
      realNet: i < CURRENT_MONTH_IDX ? items[0]?.evaluation.realNet[i] ?? null : null,
    };
    items.forEach((it, idx) => {
      row[`sim_${idx}`] = it.evaluation.predNet[i] ?? null;
    });
    return row;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Diff visual · neto mensual</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada simulación predicho (línea con color) frente a lo real cerrado (línea negra).
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
            <ReferenceLine
              x={MONTH_LABELS_ES[CURRENT_MONTH_IDX]}
              stroke="var(--accent)"
              strokeDasharray="3 3"
              label={{ value: 'hoy', position: 'insideTopRight', fill: 'var(--accent)', fontSize: 10 }}
            />

            {items.map((it, idx) => (
              <Line
                key={it.sim.id}
                type="linear"
                dataKey={`sim_${idx}`}
                name={it.sim.name}
                stroke={it.color}
                strokeWidth={2.2}
                strokeDasharray="6 3"
                dot={{ r: 2.5, strokeWidth: 0, fill: it.color }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            <Line
              type="linear"
              dataKey="realNet"
              name="Real (cerrado)"
              stroke="var(--foreground)"
              strokeWidth={2.4}
              dot={{ r: 2.5, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
