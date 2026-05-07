import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
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
  sim: SavedSim | null;
  onOpenChange: (open: boolean) => void;
}

export function RenameSimulationDialog({ sim, onOpenChange }: Props) {
  const ds = useDatasetCtx();
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sim) {
      setName(sim.name);
      setHypothesis(sim.hypothesis ?? '');
      setDescription(sim.description ?? '');
      setSaving(false);
    }
  }, [sim]);

  if (!sim) {
    return (
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  async function handleSubmit() {
    if (!sim) return;
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await ds.patchSim(sim.id, {
        name: trimmed,
        hypothesis: hypothesis.trim(),
        description: description.trim(),
      });
      toast.success('Simulación actualizada');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        toast.error('Sesión caducada — vuelve a iniciar sesión');
      } else {
        toast.error('No se pudo actualizar', { description: (err as Error).message });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={sim != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar simulación</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="rename-name" className="text-xs text-muted-foreground">
              Nombre
            </Label>
            <Input
              id="rename-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="rename-hyp" className="text-xs text-muted-foreground">
              Hipótesis
            </Label>
            <textarea
              id="rename-hyp"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              className="mt-1 min-h-[60px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={2}
              maxLength={1000}
            />
          </div>
          <div>
            <Label htmlFor="rename-desc" className="text-xs text-muted-foreground">
              Notas
            </Label>
            <textarea
              id="rename-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
          <Button disabled={saving || !name.trim()} onClick={handleSubmit}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
