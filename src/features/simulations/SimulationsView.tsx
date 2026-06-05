import { useMemo, useState } from 'react';
import { FileDown, FolderOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDatasetCtx } from '@/context/DatasetProvider';
import { AuthRequiredError } from '@/lib/auth';
import { evaluateSim, SIM_COMPARE_COLORS } from '@/lib/simEvaluation';
import { exportSimulationPdf } from '@/lib/simPdfExport';
import { cn } from '@/lib/utils';
import type { SavedSim } from '@/lib/types';
import { BiasHistogram } from './BiasHistogram';
import { ComparePanel } from './ComparePanel';
import { DiffPanel } from './DiffPanel';
import { HeatmapCompare } from './HeatmapCompare';
import { PerMonthWinners } from './PerMonthWinners';
import { RenameSimulationDialog } from './RenameSimulationDialog';
import { SimulationCard } from './SimulationCard';
import { StatStrip } from './StatStrip';
import { TimelineRuler } from './TimelineRuler';

type FilterMode = 'all' | 'scored' | 'pending';
type SortMode = 'newest' | 'accuracy' | 'name';

const MAX_COMPARE = SIM_COMPARE_COLORS.length;

export function SimulationsView() {
  const ds = useDatasetCtx();
  const sims = ds.savedSims;

  const evaluations = useMemo(
    () => sims.map((s) => evaluateSim(s, ds.base)),
    [sims, ds.base],
  );

  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renameTarget, setRenameTarget] = useState<SavedSim | null>(null);
  const [loadTarget, setLoadTarget] = useState<SavedSim | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedSim | null>(null);
  const [busy, setBusy] = useState(false);

  // Cleanup selections when sims change.
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const validSelected = selectedIds.filter((id) => sims.some((s) => s.id === id));
  if (validSelected.length !== selectedIds.length) {
    // Defer to a microtask via setState in render path is OK because new array equals criterion.
    queueMicrotask(() => setSelectedIds(validSelected));
  }

  const cellsCount = ds.simCount;
  const hasLocalChanges = cellsCount > 0;

  // Filter + sort ----------------------------------------------------------
  const filteredEntries = useMemo(() => {
    const entries = sims.map((s, i) => ({ sim: s, evaluation: evaluations[i] }));
    const f = entries.filter(({ evaluation }) =>
      filter === 'all' ? true : filter === 'scored' ? evaluation.hasData : !evaluation.hasData,
    );
    f.sort((a, b) => {
      if (sortMode === 'newest') return b.sim.createdAt - a.sim.createdAt;
      if (sortMode === 'name') return a.sim.name.localeCompare(b.sim.name);
      const aa = a.evaluation.hasData ? a.evaluation.accuracyPct : -1;
      const bb = b.evaluation.hasData ? b.evaluation.accuracyPct : -1;
      return bb - aa;
    });
    return f;
  }, [sims, evaluations, filter, sortMode]);

  // Aggregates for stat strip ---------------------------------------------
  const scoredEvals = evaluations.filter((e) => e.hasData);
  const avgAccuracyPct =
    scoredEvals.length > 0
      ? Math.round((scoredEvals.reduce((a, b) => a + b.accuracyPct, 0) / scoredEvals.length) * 100)
      : null;
  const avgBiasPct =
    scoredEvals.length > 0
      ? (scoredEvals.reduce((a, b) => a + b.avgSignedErrNet, 0) / scoredEvals.length) * 100
      : null;
  const bestSim = (() => {
    let bestIdx = -1;
    let bestAcc = -1;
    evaluations.forEach((e, i) => {
      if (e.hasData && e.accuracyPct > bestAcc) {
        bestAcc = e.accuracyPct;
        bestIdx = i;
      }
    });
    return bestIdx >= 0 ? sims[bestIdx] : null;
  })();

  // Selection helpers ------------------------------------------------------
  const selectionItems = selectedIds
    .map((id) => {
      const idx = sims.findIndex((s) => s.id === id);
      if (idx < 0) return null;
      return { sim: sims[idx], evaluation: evaluations[idx] };
    })
    .filter((x): x is { sim: SavedSim; evaluation: ReturnType<typeof evaluateSim> } => x != null)
    .map((x, i) => ({ ...x, color: SIM_COMPARE_COLORS[i] ?? '#888' }));

  function colorFor(simId: string): string | null {
    const idx = selectedIds.indexOf(simId);
    return idx >= 0 ? SIM_COMPARE_COLORS[idx] ?? null : null;
  }

  function toggleSelect(sim: SavedSim) {
    setSelectedIds((prev) => {
      if (prev.includes(sim.id)) return prev.filter((id) => id !== sim.id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, sim.id];
    });
  }

  function removeFromCompare(sim: SavedSim) {
    setSelectedIds((prev) => prev.filter((id) => id !== sim.id));
  }

  // Mutations --------------------------------------------------------------
  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await ds.deleteSim(deleteTarget.id);
      toast.success('Simulación borrada');
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        toast.error('Sesión caducada — vuelve a iniciar sesión');
      } else {
        toast.error('No se pudo borrar', { description: (err as Error).message });
      }
    } finally {
      setBusy(false);
    }
  }

  function confirmLoad() {
    if (!loadTarget) return;
    ds.loadSim(loadTarget);
    toast.success(`Cargada "${loadTarget.name}"`);
    setLoadTarget(null);
  }

  async function exportPDF(sim: SavedSim) {
    try {
      const evaluation = evaluateSim(sim, ds.base);
      await exportSimulationPdf(sim, evaluation);
      toast.success(`PDF generado — "${sim.name}"`);
    } catch (err) {
      toast.error('No se pudo generar el PDF', {
        description: (err as Error).message,
      });
    }
  }

  function exportComparisonPDF() {
    toast.info('Exportar comparación — pendiente de implementar');
  }

  // Render -----------------------------------------------------------------
  if (ds.savedSimsLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando simulaciones…
      </div>
    );
  }

  if (sims.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center text-sm text-muted-foreground">
          <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="text-base font-medium text-foreground">
              Aún no tienes simulaciones guardadas
            </p>
            <p className="mt-1 max-w-md">
              Modifica celdas en Cockpit, Pivote o Timeline y pulsa{' '}
              <strong>“Guardar simulación”</strong> en la barra superior para almacenar la foto
              completa. Aquí podrás compararlas y ver cuáles aciertan según pasen los meses.
            </p>
            {hasLocalChanges ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Tienes {cellsCount} celda{cellsCount === 1 ? '' : 's'} modificada
                {cellsCount === 1 ? '' : 's'} sin guardar.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <StatStrip
        total={sims.length}
        scored={scoredEvals.length}
        avgAccuracyPct={avgAccuracyPct}
        bestSimName={bestSim ? bestSim.name : null}
        avgBiasPct={avgBiasPct}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Línea temporal</CardTitle>
          <p className="text-xs text-muted-foreground">cuándo guardaste cada simulación</p>
        </CardHeader>
        <CardContent>
          <TimelineRuler sims={sims} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Tus simulaciones</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {filteredEntries.length} de {sims.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">filtrar</span>
          {(['all', 'scored', 'pending'] as FilterMode[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={cn('h-7 px-2.5', filter === f ? '' : 'bg-background')}
            >
              {f === 'all' ? 'todas' : f === 'scored' ? 'evaluables' : 'pendientes'}
            </Button>
          ))}
          <span className="ml-2 text-muted-foreground">orden</span>
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="h-8 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="accuracy">Mejor acierto</SelectItem>
              <SelectItem value="name">Nombre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Ninguna simulación cumple el filtro actual.
              </CardContent>
            </Card>
          ) : (
            filteredEntries.map(({ sim, evaluation }) => (
              <SimulationCard
                key={sim.id}
                sim={sim}
                evaluation={evaluation}
                selected={selectedIdSet.has(sim.id)}
                selectionDisabled={selectedIds.length >= MAX_COMPARE}
                selectionColor={colorFor(sim.id)}
                onToggleSelect={toggleSelect}
                onLoad={setLoadTarget}
                onRename={setRenameTarget}
                onDelete={setDeleteTarget}
                onExportPDF={exportPDF}
              />
            ))
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <ComparePanel
            selected={selectionItems}
            maxSelectable={MAX_COMPARE}
            onRemove={removeFromCompare}
            onClear={() => setSelectedIds([])}
          />
          <BiasHistogram sims={sims} evaluations={evaluations} />
        </div>
      </div>

      {selectionItems.length > 0 ? (
        <div className="space-y-4">
          <HeatmapCompare items={selectionItems} />
          {selectionItems.length >= 2 ? (
            <>
              <DiffPanel items={selectionItems} />
              <PerMonthWinners items={selectionItems} />
            </>
          ) : null}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportComparisonPDF}>
              <FileDown className="mr-1 h-3.5 w-3.5" />
              Exportar comparación a PDF
            </Button>
          </div>
        </div>
      ) : null}

      <RenameSimulationDialog
        sim={renameTarget}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null);
        }}
      />

      <Dialog
        open={loadTarget != null}
        onOpenChange={(o) => {
          if (!o) setLoadTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cargar simulación</DialogTitle>
            <DialogDescription>
              {loadTarget ? (
                <>
                  {ds.isDirty ? (
                    <>
                      Tienes cambios sin guardar
                      {ds.activeSim ? (
                        <>
                          {' '}
                          en <span className="font-medium">"{ds.activeSim.name}"</span>
                        </>
                      ) : null}
                      {cellsCount > 0
                        ? ` (${cellsCount} celda${cellsCount === 1 ? '' : 's'})`
                        : ''}{' '}
                      que se perderán.{' '}
                    </>
                  ) : null}
                  Se cargará <span className="font-medium">"{loadTarget.name}"</span> en su lugar.
                  Esta acción no se puede deshacer.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLoadTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmLoad}>Cargar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(o) => {
          if (!o && !busy) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar simulación</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  La simulación <span className="font-medium">"{deleteTarget.name}"</span> se
                  borrará del servidor. No se puede deshacer.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirmDelete}>
              {busy ? 'Borrando…' : 'Borrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
