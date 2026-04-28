import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { monthState, monthStateLabel } from '@/lib/time';
import { cn } from '@/lib/utils';

interface MonthBadgeProps {
  monthIdx: number;
  hasSim?: boolean;
  className?: string;
}

export function MonthBadge({ monthIdx, hasSim, className }: MonthBadgeProps) {
  const state = monthState(monthIdx);
  if (hasSim) {
    return (
      <Badge variant="default" className={cn('font-mono', className)}>
        simulado
      </Badge>
    );
  }
  return (
    <Badge
      variant={state === 'past' ? 'muted' : state === 'current' ? 'success' : 'outline'}
      className={cn('font-mono', className)}
    >
      {state === 'past' ? <Lock className="mr-1 h-2.5 w-2.5" /> : null}
      {monthStateLabel(state)}
    </Badge>
  );
}
