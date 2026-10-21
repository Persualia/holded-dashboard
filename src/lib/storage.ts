/** Tiny typed wrapper around localStorage with JSON encoding and safe fallbacks. */
export function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Swallow quota errors — non-critical for this app.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const STORAGE_KEYS = {
  sim: 'hd_sim',
  simRows: 'hd_sim_rows',
  showSim: 'hd_show_sim',
  /** Id of the saved sim currently loaded into the working state (null = unsaved/new). */
  activeSimId: 'hd_sim_active',
  /** Signature of the working state as of the last load/save — used to detect unsaved edits. */
  simBaseline: 'hd_sim_baseline',
  authToken: 'hd_auth_token',
} as const;

/** Working-simulation keys that only make sense for one year's dataset. */
const PER_YEAR_SIM_KEYS = ['sim', 'simRows', 'activeSimId', 'simBaseline'] as const;
type PerYearSimKey = (typeof PER_YEAR_SIM_KEYS)[number];

/** Year the un-suffixed (pre multi-year) sim keys were written for. */
const LEGACY_SIM_YEAR = 2026;

/**
 * Storage keys for the working simulation of `year`, e.g. `hd_sim:2027`.
 * The first call moves the legacy un-suffixed keys over to LEGACY_SIM_YEAR.
 */
export function simStorageKeys(year: number): Record<PerYearSimKey, string> {
  for (const k of PER_YEAR_SIM_KEYS) {
    const legacy = STORAGE_KEYS[k];
    try {
      const raw = localStorage.getItem(legacy);
      if (raw == null) continue;
      const target = `${legacy}:${LEGACY_SIM_YEAR}`;
      if (localStorage.getItem(target) == null) localStorage.setItem(target, raw);
      localStorage.removeItem(legacy);
    } catch {
      // ignore
    }
  }
  return {
    sim: `${STORAGE_KEYS.sim}:${year}`,
    simRows: `${STORAGE_KEYS.simRows}:${year}`,
    activeSimId: `${STORAGE_KEYS.activeSimId}:${year}`,
    simBaseline: `${STORAGE_KEYS.simBaseline}:${year}`,
  };
}
