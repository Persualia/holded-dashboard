/**
 * Blob keys for the per-month xlsx + parsed-JSON archive. Each upload writes
 * to a deterministic month-scoped key, so re-uploading the same month
 * overwrites in place and the year's history is implied by what's stored.
 */

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(monthKey: string): boolean {
  return MONTH_KEY_RE.test(monthKey);
}

export function xlsxKey(monthKey: string): string {
  return `data/${monthKey}.xlsx`;
}

export function jsonKey(monthKey: string): string {
  return `data/${monthKey}.json`;
}

export function yearPrefix(year: number): string {
  return `data/${year}-`;
}

/** Parse a `data/YYYY-MM.json` (or .xlsx) pathname back into its YYYY-MM key. */
export function monthKeyFromPathname(pathname: string): string | null {
  const m = /^data\/(\d{4}-(?:0[1-9]|1[0-2]))\.(?:json|xlsx)$/.exec(pathname);
  return m ? m[1] : null;
}
