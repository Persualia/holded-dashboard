import type { Item } from './types';

/** Variations under this absolute EUR threshold are treated as noise. */
const DEFAULT_THRESHOLD_EUR = 1000;

export interface MonthVariation {
  /** Holded account code, used as React key. */
  account: string;
  /** Human-readable display name (after the "CODE - " prefix when present). */
  name: string;
  /** Signed delta: positive = better than forecast (more income or less expense). */
  delta: number;
}

function shortName(name: string): string {
  const parts = name.split(' - ');
  const after = parts[1]?.trim();
  const before = parts[0]?.trim();
  const candidate = after && after.length >= 3 ? after : before || name;
  return candidate.length > 40 ? candidate.slice(0, 37) + '…' : candidate;
}

/**
 * List per-item real-vs-forecast variations for a given month, keeping only
 * those whose absolute delta meets `thresholdEur`. Sorted by magnitude desc.
 *
 * `baseItems` is the latest snapshot ("real"); `forecastItems` is the
 * server-composed forecast for the same month.
 */
export function notableVariations(
  monthIdx: number,
  baseItems: Item[],
  forecastItems: Item[],
  thresholdEur: number = DEFAULT_THRESHOLD_EUR,
): MonthVariation[] {
  const fcstByAccount = new Map(forecastItems.map((it) => [it.account, it]));
  const out: MonthVariation[] = [];
  for (const b of baseItems) {
    const f = fcstByAccount.get(b.account);
    const real = b.values[monthIdx] ?? 0;
    const forecast = f?.values[monthIdx] ?? real;
    const delta = real - forecast;
    if (Math.abs(delta) < thresholdEur) continue;
    out.push({ account: b.account, name: shortName(b.name), delta });
  }
  out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return out;
}
