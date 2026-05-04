import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/auth';
import { downloadCsv } from '@/lib/csv';
import { hydrateDataset } from '@/lib/xlsx';
import { getJSON, setJSON, STORAGE_KEYS } from '@/lib/storage';
import { CURRENT_MONTH_IDX, CURRENT_YEAR, MONTH_LABELS_ES, isLocked } from '@/lib/time';
import type {
  ApiDataResponse,
  ApplyScope,
  Dataset,
  EffectiveDataset,
  EffectiveItem,
  ItemType,
  SimOverrides,
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
  /** Download current overrides as CSV. */
  exportSim: () => void;
  /**
   * POST a new xlsx to /api/upload, scoped to a YYYY-MM month key. Re-uploading
   * the same key overwrites it server-side.
   */
  loadXlsx: (file: File, monthKey: string) => Promise<void>;
  /** Last error message (e.g. fetch / upload failure). */
  error: string | null;
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

  const exportSim = useCallback(() => {
    if (!base) return;
    const rows: Array<Array<unknown>> = [];
    rows.push(['Cuenta', 'Concepto', 'Mes', 'Original', 'Simulado', 'Delta']);
    for (const acc of Object.keys(sim)) {
      const it = base.items.find((x) => x.account === acc);
      if (!it) continue;
      for (const k of Object.keys(sim[acc])) {
        const m = Number.parseInt(k, 10);
        const orig = it.values[m] ?? 0;
        const newVal = sim[acc][m];
        rows.push([
          acc,
          it.name,
          `${MONTH_LABELS_ES[m]} ${base.months[m] ?? ''}`,
          orig,
          newVal,
          newVal - orig,
        ]);
      }
    }
    downloadCsv('simulacion-holded.csv', rows);
  }, [base, sim]);

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
    exportSim,
    loadXlsx,
    error,
  };
}
