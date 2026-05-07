import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { AuthRequiredError } from '@/lib/auth';
import type { SavedSim } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (sim: SavedSim) => void;
}

export function SaveSimulationDialog({ open, onOpenChange, onSaved }: Props) {
  const ds = useDatasetCtx();
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setHypothesis('');
      setDescription('');
      setSaving(false);
    }
  }, [open]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const sim = await ds.saveSim({
        name: trimmed,
        hypothesis: hypothesis.trim(),
        description: description.trim(),
      });
      toast.success(`Simulación "${sim.name}" guardada`);
      onSaved?.(sim);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        toast.error('Sesión caducada — vuelve a iniciar sesión');
      } else {
        toast.error('No se pudo guardar la simulación', {
          description: (err as Error).message,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  const cellsCount = ds.simCount;
  const rowsCount = ds.effective?.items.filter((i) => i.isSimRow).length ?? 0;
  const canSave = name.trim().length > 0 && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Guardar simulación</DialogTitle>
          <DialogDescription>
            Se guarda en el servidor la foto completa de tu simulación actual: {cellsCount} celda
            {cellsCount === 1 ? '' : 's'} modificada{cellsCount === 1 ? '' : 's'}
            {rowsCount > 0 ? ` · ${rowsCount} fila${rowsCount === 1 ? '' : 's'} sim` : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="sim-name" className="text-xs text-muted-foreground">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sim-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Plan optimista 2026"
              className="mt-1"
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="sim-hyp" className="text-xs text-muted-foreground">
              Hipótesis <span className="text-muted-foreground/60">— qué estás probando</span>
            </Label>
            <textarea
              id="sim-hyp"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="ej. Cerramos los 3 distribuidores en Q1 y subimos precios un 8% en julio"
              className="mt-1 min-h-[60px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={2}
              maxLength={1000}
            />
          </div>

          <div>
            <Label htmlFor="sim-desc" className="text-xs text-muted-foreground">
              Notas <span className="text-muted-foreground/60">— opcional</span>
            </Label>
            <textarea
              id="sim-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto, supuestos, links…"
              className="mt-1 min-h-[60px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={2}
              maxLength={4000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={handleSubmit}>
            {saving ? 'Guardando…' : 'Guardar simulación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
