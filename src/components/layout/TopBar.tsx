import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthProvider';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { CURRENT_MONTH_IDX, MONTH_LABELS_LONG_ES, TODAY } from '@/lib/time';

export function TopBar() {
  const { base } = useDatasetCtx();
  const { user, logout } = useAuth();
  const dateLabel = `${TODAY.getDate()} ${MONTH_LABELS_LONG_ES[CURRENT_MONTH_IDX].toLowerCase()} ${TODAY.getFullYear()}`;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div className="flex items-center gap-3">
        <img src="/persualia-logo.svg" alt="Persualia" className="h-14 w-auto rounded-sm" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Persualia · Dashboard financiero</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {base
              ? `${base.months[0]} → ${base.months[base.months.length - 1]}`
              : 'cargando dataset…'}
            <span className="mx-2 text-border">·</span>
            hoy: {dateLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {user && <span className="text-xs text-muted-foreground">{user}</span>}
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="mr-1 h-3.5 w-3.5" />
          Salir
        </Button>
      </div>
    </header>
  );
}
