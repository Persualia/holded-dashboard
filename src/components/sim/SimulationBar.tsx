import { useRef, useState } from 'react';
import { Download, Eraser, FlaskConical, Percent, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { AuthRequiredError } from '@/lib/auth';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES } from '@/lib/time';
import type { ApplyScope } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SimulationBar() {
  const ds = useDatasetCtx();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pctOpen, setPctOpen] = useState(false);
  const [pct, setPct] = useState(10);
  const [fromMonth, setFromMonth] = useState<number>(CURRENT_MONTH_IDX);
  const [scope, setScope] = useState<ApplyScope>('income');
  const [confirmReset, setConfirmReset] = useState(false);

  function applyPct() {
    ds.applyForwardPct(fromMonth, pct / 100, scope);
    setPctOpen(false);
    toast.success(
      `Simulación aplicada: ${pct >= 0 ? '+' : ''}${pct}% en ${
        scope === 'all' ? 'todo' : scope === 'income' ? 'ingresos' : 'gastos'
      } desde ${MONTH_LABELS_ES[fromMonth]}`,
    );
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      await ds.loadXlsx(f);
      toast.success(`Cargado: ${f.name}`);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        toast.error('Sesión caducada — vuelve a iniciar sesión');
        return;
      }
      toast.error('Error leyendo el fichero', {
        description: (err as Error).message,
      });
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-2.5 text-sm shadow-sm',
        ds.simCount > 0 && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="flex items-center gap-2">
        <FlaskConical className={cn('h-4 w-4', ds.simCount > 0 ? 'text-primary' : 'text-muted-foreground')} />
        <span className="font-medium">Simulación</span>
        <Badge variant={ds.simCount > 0 ? 'default' : 'muted'} className="font-mono normal-case tracking-tight">
          {ds.simCount} celda{ds.simCount === 1 ? '' : 's'}
        </Badge>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        <Popover open={pctOpen} onOpenChange={setPctOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Percent className="mr-1 h-3.5 w-3.5" />
              % desde mes
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">Aplicar % a futuro</h4>
                <p className="text-xs text-muted-foreground">No afecta a meses cerrados.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Sobre</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as ApplyScope)}>
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Ingresos</SelectItem>
                      <SelectItem value="expense">Gastos</SelectItem>
                      <SelectItem value="all">Todo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Desde</Label>
                  <Select
                    value={String(fromMonth)}
                    onValueChange={(v) => setFromMonth(Number.parseInt(v, 10))}
                  >
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_LABELS_ES.map((l, i) => (
                        <SelectItem key={l} value={String(i)} disabled={i < CURRENT_MONTH_IDX}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">%</Label>
                  <Input
                    type="number"
                    value={pct}
                    onChange={(e) => setPct(Number.parseFloat(e.target.value || '0'))}
                    className="mt-1 h-8"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPctOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={applyPct}>
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <Switch id="show-sim" checked={ds.showSim} onCheckedChange={ds.setShowSim} />
          <Label htmlFor="show-sim" className="cursor-pointer text-xs text-muted-foreground">
            ver simulación
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            ds.exportSim();
            toast.success('CSV descargado');
          }}
          disabled={ds.simCount === 0}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          CSV
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmReset(true)}
          disabled={ds.simCount === 0}
          className="text-destructive hover:text-destructive"
        >
          <Eraser className="mr-1 h-3.5 w-3.5" />
          Borrar sim.
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            ds.resetForecastSnapshot();
            toast.success('Snapshot de previsiones actualizado');
          }}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Re-snapshot
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={onFileChange}
        />
        <Button variant="default" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-3.5 w-3.5" />
          Cargar xlsx
        </Button>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Borrar toda la simulación?</DialogTitle>
            <DialogDescription>
              Se eliminarán {ds.simCount} celda{ds.simCount === 1 ? '' : 's'} modificada
              {ds.simCount === 1 ? '' : 's'}. Los datos del fichero original no cambian.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                ds.clearSim();
                setConfirmReset(false);
                toast.success('Simulación borrada');
              }}
            >
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
