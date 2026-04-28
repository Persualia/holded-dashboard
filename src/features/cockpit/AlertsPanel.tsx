import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type AlertKind = 'ok' | 'warn' | 'bad';

export interface AppAlert {
  kind: AlertKind;
  text: string;
}

const KIND_STYLES: Record<AlertKind, { bg: string; text: string; Icon: typeof AlertTriangle }> = {
  ok: { bg: 'bg-success/10 border-success/20', text: 'text-success', Icon: CheckCircle2 },
  warn: { bg: 'bg-primary/10 border-primary/20', text: 'text-primary', Icon: AlertTriangle },
  bad: { bg: 'bg-destructive/10 border-destructive/20', text: 'text-destructive', Icon: CircleAlert },
};

interface Props {
  alerts: AppAlert[];
  className?: string;
}

export function AlertsPanel({ alerts, className }: Props) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Alertas</CardTitle>
        <p className="text-xs text-muted-foreground">desviaciones detectadas</p>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            Sin alertas — todo OK.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.slice(0, 8).map((a, i) => {
              const { bg, text, Icon } = KIND_STYLES[a.kind];
              return (
                <li key={i} className={cn('flex items-start gap-2 rounded-md border p-2.5 text-sm', bg)}>
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', text)} />
                  <span className="text-foreground/90">{a.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
