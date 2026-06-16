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
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthProvider';
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
  const { isAdmin } = useAuth();
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [description, setDescription] = useState('');
  const [privateOnly, setPrivateOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeSim = ds.activeSim;
  useEffect(() => {
    if (open) {
      // "Guardar como…" over a loaded sim: prefill from it as a starting point
      // for the new copy. Fresh sim: start blank.
      setName(activeSim ? `${activeSim.name} (copia)` : '');
      setHypothesis(activeSim?.hypothesis ?? '');
      setDescription(activeSim?.description ?? '');
      setPrivateOnly(activeSim?.visibility === 'private');
      setSaving(false);
    }
  }, [open, activeSim]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const sim = await ds.saveSim({
        name: trimmed,
        hypothesis: hypothesis.trim(),
        description: description.trim(),
        visibility: isAdmin && privateOnly ? 'private' : 'shared',
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
          <DialogTitle>{activeSim ? 'Guardar como nueva simulación' : 'Guardar simulación'}</DialogTitle>
          <DialogDescription>
            {activeSim ? (
              <>
                Se creará una simulación nueva sin tocar{' '}
                <span className="font-medium">"{activeSim.name}"</span>.{' '}
              </>
            ) : null}
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

          {isAdmin && (
            <div className="flex items-center justify-between rounded-md border border-input px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="sim-private" className="cursor-pointer text-sm">
                    Solo visible para mí
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {privateOnly
                      ? 'Este escenario será privado.'
                      : 'Este escenario será visible para todos.'}
                  </p>
                </div>
              </div>
              <Switch id="sim-private" checked={privateOnly} onCheckedChange={setPrivateOnly} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={handleSubmit}>
            {saving ? 'Guardando…' : activeSim ? 'Guardar como nueva' : 'Guardar simulación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
