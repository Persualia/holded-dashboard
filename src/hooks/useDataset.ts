import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/auth';
import { downloadCsv } from '@/lib/csv';
import { hydrateDataset } from '@/lib/xlsx';
import { getJSON, removeKey, setJSON, STORAGE_KEYS } from '@/lib/storage';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES, isLocked } from '@/lib/time';
import type {
  ApplyScope,
  Dataset,
  EffectiveDataset,
  EffectiveItem,
  Item,
  SimOverrides,
} from '@/lib/types';

export interface UseDatasetReturn {
  /** Raw dataset fetched from /api/data. null while loading. */
  base: Dataset | null;
  /** Forecast snapshot — captured the first time the app ever loaded data. */
  forecast: Dataset | null;
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
  /** Wipe all overrides. */
  clearSim: () => void;
  /** Download current overrides as CSV. */
  exportSim: () => void;
  /** Re-snapshot the current base as the new forecast baseline. */
  resetForecastSnapshot: () => void;
  /** POST a new xlsx to /api/upload. The server parses + caches it. */
  loadXlsx: (file: File) => Promise<void>;
  /** Last error message (e.g. fetch / upload failure). */
  error: string | null;
}

interface PersistedDataset {
  months: string[];
  items: Array<Pick<Item, 'name' | 'account' | 'values'>>;
}

function stripDataset(d: Dataset): PersistedDataset {
  return {
    months: d.months,
    items: d.items.map((it) => ({ name: it.name, account: it.account, values: it.values.slice() })),
  };
}

async function fetchDataset(): Promise<Dataset> {
  const res = await fetch('/api/data', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as PersistedDataset;
  return hydrateDataset(raw);
}

export function useDataset(): UseDatasetReturn {
  const [base, setBase] = useState<Dataset | null>(null);
  const [forecast, setForecast] = useState<Dataset | null>(() => {
    const raw = getJSON<PersistedDataset | null>(STORAGE_KEYS.forecastSnapshot, null);
    return raw ? hydrateDataset(raw) : null;
  });
  const [sim, setSim] = useState<SimOverrides>(() => getJSON<SimOverrides>(STORAGE_KEYS.sim, {}));
  const [showSim, setShowSim] = useState<boolean>(() => getJSON<boolean>(STORAGE_KEYS.showSim, true));
  const [error, setError] = useState<string | null>(null);

  // Initial load: always fetch from the server (which serves the cached JSON
  // produced by the most recent upload).
  useEffect(() => {
    let cancelled = false;
    fetchDataset()
      .then((ds) => {
        if (!cancelled) setBase(ds);
      })
      .catch((e: Error) => {
        if (!cancelled) setError('No se pudieron cargar los datos: ' + e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Capture the forecast baseline the first time we ever see data.
  useEffect(() => {
    if (!base || forecast) return;
    if (base.items.length === 0) return;
    const snap = stripDataset(base);
    setJSON(STORAGE_KEYS.forecastSnapshot, snap);
    setForecast(hydrateDataset(snap));
  }, [base, forecast]);

  // Persist sim + show toggle.
  useEffect(() => {
    setJSON(STORAGE_KEYS.sim, sim);
  }, [sim]);
  useEffect(() => {
    setJSON(STORAGE_KEYS.showSim, showSim);
  }, [showSim]);

  // Effective dataset: base values overridden where sim has entries (and showSim is on).
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
    return { months: base.months, items };
  }, [base, sim, showSim]);

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

  const clearSim = useCallback(() => setSim({}), []);

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

  const loadXlsx = useCallback(async (file: File) => {
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await authFetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const msg = `HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
      const err = new Error(msg);
      (err as Error & { status?: number }).status = res.status;
      setError('Error subiendo xlsx: ' + msg);
      throw err;
    }
    const ds = await fetchDataset();
    setBase(ds);
  }, []);

  const resetForecastSnapshot = useCallback(() => {
    if (!base) {
      removeKey(STORAGE_KEYS.forecastSnapshot);
      setForecast(null);
      return;
    }
    const snap = stripDataset(base);
    setJSON(STORAGE_KEYS.forecastSnapshot, snap);
    setForecast(hydrateDataset(snap));
  }, [base]);

  return {
    base,
    forecast,
    effective,
    sim,
    simCount,
    showSim,
    setShowSim,
    setOverride,
    setRowOverride,
    applyForwardPct,
    clearSim,
    exportSim,
    resetForecastSnapshot,
    loadXlsx,
    error,
  };
}
