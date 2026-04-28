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
  forecastSnapshot: 'hd_forecast_snapshot',
  sim: 'hd_sim',
  showSim: 'hd_show_sim',
  authToken: 'hd_auth_token',
} as const;
