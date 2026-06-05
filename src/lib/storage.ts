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
