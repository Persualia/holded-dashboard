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

const SIM_ID_RE = /^sim_[A-Za-z0-9_-]{1,64}$/;
/** Prefix used for sim listing — kept compatible with the local-fs shim's
 *  `dirname/basename` split (always needs a non-empty filename component). */
export const SIM_PREFIX = 'data/simulations/sim_';

export function isValidSimId(id: string): boolean {
  return SIM_ID_RE.test(id);
}

export function simKey(id: string): string {
  return `data/simulations/${id}.json`;
}

export function simIdFromPathname(pathname: string): string | null {
  const m = /^data\/simulations\/(sim_[A-Za-z0-9_-]{1,64})\.json$/.exec(pathname);
  return m ? m[1] : null;
}

/** Single global document holding the admin-only bonus configuration. */
export function bonusKey(): string {
  return 'data/bonus.json';
}
