import { CircleCheck, CircleSlash, Hourglass, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SimEvaluation } from '@/lib/simEvaluation';

interface Props {
  evaluation: SimEvaluation;
  className?: string;
}

/**
 * Compact pill summarizing a sim's accuracy. Shows "pendiente" until a closed
 * month exists, then TOP / CERCA / FALLO based on the average net error band.
 */
export function AccuracyBadge({ evaluation, className }: Props) {
  if (!evaluation.hasData) {
    return (
      <Badge variant="muted" className={cn('gap-1', className)}>
        <Hourglass className="h-3 w-3" />
        pendiente
      </Badge>
    );
  }

  const pct = Math.round(evaluation.accuracyPct * 100);
  let kind: 'top' | 'close' | 'fail';
  if (pct >= 95) kind = 'top';
  else if (pct >= 90) kind = 'close';
  else kind = 'fail';

  const Icon = kind === 'top' ? CircleCheck : kind === 'close' ? TriangleAlert : CircleSlash;
  const label = kind === 'top' ? 'TOP' : kind === 'close' ? 'CERCA' : 'FALLO';

  return (
    <Badge
      className={cn(
        'gap-1',
        kind === 'top' && 'bg-success text-success-foreground',
        kind === 'close' && 'bg-secondary text-secondary-foreground',
        kind === 'fail' && 'bg-destructive text-destructive-foreground',
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label} · {pct}%
    </Badge>
  );
}
