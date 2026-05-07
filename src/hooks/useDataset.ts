import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/auth';
import { hydrateDataset } from '@/lib/xlsx';
import { getJSON, setJSON, STORAGE_KEYS } from '@/lib/storage';
import { CURRENT_MONTH_IDX, CURRENT_YEAR, isLocked } from '@/lib/time';
import type {
  ApiDataResponse,
  ApplyScope,
  Dataset,
  EffectiveDataset,
  EffectiveItem,
  ItemType,
  PersistedSimItem,
  SaveSimInput,
  SavedSim,
  SimOverrides,
  SimPatch,
  SimRow,
} from '@/lib/types';

export interface UseDatasetReturn {
  /** Latest uploaded dataset for the year — the "current state". null while loading. */
  base: Dataset | null;
  /**
   * Forecast composite — same shape as `base`, with each closed-month column
   * filled from the most recent file uploaded BEFORE that month. Months
   * without an earlier source mirror `base` (no comparison). null while loading.
   */
  forecast: Dataset | null;
  /** Sorted list of YYYY-MM keys currently uploaded for the active year. */
  monthsUploaded: string[];
  /** Base merged with sim overrides (when showSim). null while loading. */
  effective: EffectiveDataset | null;
  /** Per-account overrides keyed by month index. */
  sim: SimOverrides;
  /** Total number of overridden cells (for the simulation banner). */
  simCount: number;
  /** Whether the simulation overlay is visible. */
  showSim: boolean;
  setShowSim: (show: boolean) => void;
  /** Override a single cell. No-ops on locked (past) months. */
  setOverride: (account: string, monthIdx: number, value: number | null) => void;
  /** Override a full row (all 12 months). */
  setRowOverride: (account: string, valuesArray: number[]) => void;
  /**
   * Bulk-apply a percentage to every item from `fromMonthIdx` forward.
   * Past months are skipped (silently clamped to CURRENT_MONTH_IDX).
   */
  applyForwardPct: (fromMonthIdx: number, pct: number, scope: ApplyScope) => void;
  /** Add a synthetic simulated row inside an existing group. Returns its synthetic id. */
  addSimRow: (group: string, type: ItemType, name?: string) => string;
  /** Rename a previously added simulated row. */
  renameSimRow: (id: string, name: string) => void;
  /** Remove a simulated row and any of its overridden values. */
  deleteSimRow: (id: string) => void;
  /** Wipe all overrides and any user-added sim rows. */
  clearSim: () => void;
  /**
   * POST a new xlsx to /api/upload, scoped to a YYYY-MM month key. Re-uploading
   * the same key overwrites it server-side.
   */
  loadXlsx: (file: File, monthKey: string) => Promise<void>;
  /** Last error message (e.g. fetch / upload failure). */
  error: string | null;
  /** Saved scenarios persisted on the server, most-recent-first. */
  savedSims: SavedSim[];
  savedSimsLoading: boolean;
  /** Capture the current local sim as a named scenario stored server-side. */
  saveSim: (input: SaveSimInput) => Promise<SavedSim>;
  /** Rename / re-tag a saved scenario. */
  patchSim: (id: string, patch: SimPatch) => Promise<void>;
  /** Remove a saved scenario from the server. */
  deleteSim: (id: string) => Promise<void>;
  /**
   * Replace the active local simulation (overrides + sim rows) with the saved
   * one. The previous local sim is discarded.
   */
  loadSim: (sim: SavedSim) => void;
}

interface FetchedData {
  base: Dataset;
  forecast: Dataset;
  monthsUploaded: string[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

async function fetchDataset(): Promise<FetchedData> {
  const asOf = `${CURRENT_YEAR}-${pad2(CURRENT_MONTH_IDX + 1)}`;
  const url = `/api/data?year=${CURRENT_YEAR}&asOf=${asOf}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as ApiDataResponse;
  return {
    base: hydrateDataset(raw.base),
    forecast: hydrateDataset(raw.forecast),
    monthsUploaded: raw.monthsUploaded,
  };
}

export function useDataset(): UseDatasetReturn {
  const [base, setBase] = useState<Dataset | null>(null);
  const [forecast, setForecast] = useState<Dataset | null>(null);
  const [monthsUploaded, setMonthsUploaded] = useState<string[]>([]);
  const [sim, setSim] = useState<SimOverrides>(() => getJSON<SimOverrides>(STORAGE_KEYS.sim, {}));
  const [simRows, setSimRows] = useState<SimRow[]>(() => getJSON<SimRow[]>(STORAGE_KEYS.simRows, []));
  const [showSim, setShowSim] = useState<boolean>(() => getJSON<boolean>(STORAGE_KEYS.showSim, true));
  const [error, setError] = useState<string | null>(null);
  const [savedSims, setSavedSims] = useState<SavedSim[]>([]);
  const [savedSimsLoading, setSavedSimsLoading] = useState<boolean>(true);

  // Initial load: fetch base + forecast composite from the server.
  useEffect(() => {
    let cancelled = false;
    fetchDataset()
      .then((d) => {
        if (cancelled) return;
        setBase(d.base);
        setForecast(d.forecast);
        setMonthsUploaded(d.monthsUploaded);
      })
      .catch((e: Error) => {
        if (!cancelled) setError('No se pudieron cargar los datos: ' + e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist sim + show toggle.
  useEffect(() => {
    setJSON(STORAGE_KEYS.sim, sim);
  }, [sim]);
  useEffect(() => {
    setJSON(STORAGE_KEYS.simRows, simRows);
  }, [simRows]);
  useEffect(() => {
    setJSON(STORAGE_KEYS.showSim, showSim);
  }, [showSim]);

  // Effective dataset: base values overridden where sim has entries (and showSim is on),
  // plus any user-added simulated rows (also gated on showSim).
  const effective = useMemo<EffectiveDataset | null>(() => {
    if (!base) return null;
    const items: EffectiveItem[] = base.items.map((it) => {
      const overrides = sim[it.account];
      const simMask = new Array(12).fill(false) as boolean[];
      if (!overrides || !showSim) return { ...it, simMask };
      const values = it.values.slice();
      for (const k of Object.keys(overrides)) {
        const idx = Number.parseInt(k, 10);
        if (Number.isFinite(idx) && idx >= 0 && idx < 12) {
          values[idx] = overrides[idx];
          simMask[idx] = true;
        }
      }
      return { ...it, values, simMask };
    });
    if (showSim) {
      for (const row of simRows) {
        const overrides = sim[row.id];
        const values = new Array(12).fill(0) as number[];
        const simMask = new Array(12).fill(false) as boolean[];
        if (overrides) {
          for (const k of Object.keys(overrides)) {
            const idx = Number.parseInt(k, 10);
            if (Number.isFinite(idx) && idx >= 0 && idx < 12) {
              values[idx] = overrides[idx];
              simMask[idx] = true;
            }
          }
        }
        items.push({
          name: row.name,
          account: row.id,
          values,
          type: row.type,
          group: row.group,
          simMask,
          isSimRow: true,
        });
      }
    }
    return { months: base.months, items };
  }, [base, sim, simRows, showSim]);

  const simCount = useMemo(
    () => Object.values(sim).reduce((s, o) => s + Object.keys(o).length, 0),
    [sim],
  );

  const setOverride = useCallback((account: string, monthIdx: number, value: number | null) => {
    if (isLocked(monthIdx)) return;
    setSim((prev) => {
      const copy: SimOverrides = { ...prev };
      const cur = { ...(copy[account] ?? {}) };
      if (value == null || Number.isNaN(value)) {
        delete cur[monthIdx];
      } else {
        cur[monthIdx] = value;
      }
      if (Object.keys(cur).length === 0) delete copy[account];
      else copy[account] = cur;
      return copy;
    });
  }, []);

  const setRowOverride = useCallback((account: string, valuesArray: number[]) => {
    setSim((prev) => {
      const copy: SimOverrides = { ...prev };
      const cur: Record<number, number> = {};
      for (let i = CURRENT_MONTH_IDX; i < 12; i++) cur[i] = valuesArray[i];
      copy[account] = cur;
      return copy;
    });
  }, []);

  const applyForwardPct = useCallback(
    (fromMonthIdx: number, pct: number, scope: ApplyScope) => {
      if (!base) return;
      const startIdx = Math.max(fromMonthIdx, CURRENT_MONTH_IDX);
      setSim((prev) => {
        const copy: SimOverrides = { ...prev };
        for (const it of base.items) {
          if (scope === 'income' && it.type !== 'income') continue;
          if (scope === 'expense' && it.type !== 'expense') continue;
          const cur = { ...(copy[it.account] ?? {}) };
          for (let m = startIdx; m < 12; m++) {
            cur[m] = Math.round(it.values[m] * (1 + pct) * 100) / 100;
          }
          copy[it.account] = cur;
        }
        return copy;
      });
    },
    [base],
  );

  const addSimRow = useCallback(
    (group: string, type: ItemType, name?: string): string => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `sim-${crypto.randomUUID()}`
          : `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setSimRows((prev) => [...prev, { id, name: name ?? 'Nueva simulación', group, type }]);
      return id;
    },
    [],
  );

  const renameSimRow = useCallback((id: string, name: string) => {
    const trimmed = name.trim() || 'Nueva simulación';
    setSimRows((prev) => prev.map((r) => (r.id === id ? { ...r, name: trimmed } : r)));
  }, []);

  const deleteSimRow = useCallback((id: string) => {
    setSimRows((prev) => prev.filter((r) => r.id !== id));
    setSim((prev) => {
      if (!(id in prev)) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const clearSim = useCallback(() => {
    setSim({});
    setSimRows([]);
  }, []);

  // Load saved-sim list from the server on mount.
  useEffect(() => {
    let cancelled = false;
    setSavedSimsLoading(true);
    authFetch('/api/simulations')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { sims: SavedSim[] };
        if (!cancelled) setSavedSims(data.sims ?? []);
      })
      .catch((e: Error) => {
        if (!cancelled) setError('No se pudieron cargar las simulaciones: ' + e.message);
      })
      .finally(() => {
        if (!cancelled) setSavedSimsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSim = useCallback(
    async (input: SaveSimInput): Promise<SavedSim> => {
      if (!base || !effective) throw new Error('Dataset no cargado todavía');

      // Full predicted snapshot: every account × 12 months at "right now",
      // with sim overrides + sim rows already merged into `effective`.
      const predictedItems: PersistedSimItem[] = effective.items.map((it) => ({
        account: it.account,
        name: it.name,
        type: it.type,
        group: it.group,
        values: it.values.slice(),
      }));

      const overrideKeys: Record<string, number[]> = {};
      for (const [account, months] of Object.entries(sim)) {
        const indexes = Object.keys(months)
          .map((k) => Number.parseInt(k, 10))
          .filter((m) => Number.isInteger(m) && m >= 0 && m <= 11);
        if (indexes.length > 0) overrideKeys[account] = indexes.sort((a, b) => a - b);
      }

      const body = {
        name: input.name,
        hypothesis: input.hypothesis ?? '',
        description: input.description ?? '',
        tag: 'neutral',
        savedAtYear: CURRENT_YEAR,
        savedAtMonthIdx: CURRENT_MONTH_IDX,
        predicted: { months: base.months.slice(), items: predictedItems },
        overrideKeys,
        simRows,
      };
      const res = await authFetch('/api/simulations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
      }
      const { sim: created } = (await res.json()) as { sim: SavedSim };
      setSavedSims((prev) => [created, ...prev]);
      return created;
    },
    [base, effective, sim, simRows],
  );

  const patchSim = useCallback(async (id: string, patch: SimPatch) => {
    const res = await authFetch(`/api/simulations?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const { sim: updated } = (await res.json()) as { sim: SavedSim };
    setSavedSims((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }, []);

  const deleteSim = useCallback(async (id: string) => {
    const res = await authFetch(`/api/simulations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    setSavedSims((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const loadSim = useCallback(
    (s: SavedSim) => {
      const next: SimOverrides = {};
      const baseByAcc = new Map<string, number[]>();
      if (base) {
        for (const it of base.items) baseByAcc.set(it.account, it.values);
      }
      const predictedItems = s.predicted?.items ?? [];
      for (const it of predictedItems) {
        const flagged = new Set(s.overrideKeys?.[it.account] ?? []);
        const baseVals = baseByAcc.get(it.account);
        const cur: Record<number, number> = {};
        for (let m = CURRENT_MONTH_IDX; m < 12; m++) {
          const predicted = it.values[m] ?? 0;
          const real = baseVals?.[m] ?? predicted;
          if (flagged.has(m) || predicted !== real) cur[m] = predicted;
        }
        if (Object.keys(cur).length > 0) next[it.account] = cur;
      }
      setSim(next);
      setSimRows(s.simRows ?? []);
    },
    [base],
  );

  const loadXlsx = useCallback(async (file: File, monthKey: string) => {
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('month', monthKey);
    const res = await authFetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const msg = `HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
      const err = new Error(msg);
      (err as Error & { status?: number }).status = res.status;
      setError('Error subiendo xlsx: ' + msg);
      throw err;
    }
    const d = await fetchDataset();
    setBase(d.base);
    setForecast(d.forecast);
    setMonthsUploaded(d.monthsUploaded);
  }, []);

  return {
    base,
    forecast,
    monthsUploaded,
    effective,
    sim,
    simCount,
    showSim,
    setShowSim,
    setOverride,
    setRowOverride,
    applyForwardPct,
    addSimRow,
    renameSimRow,
    deleteSimRow,
    clearSim,
    loadXlsx,
    error,
    savedSims,
    savedSimsLoading,
    saveSim,
    patchSim,
    deleteSim,
    loadSim,
  };
}
