import type { Item } from './types';

/** Variations at/over this absolute EUR threshold are always shown. */
const DEFAULT_THRESHOLD_EUR = 500;
/** When variations fall below the threshold, keep this many of the largest. */
const SMALL_TOP_N = 5;

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
 * List per-item real-vs-forecast variations for a given month. All variations
 * with |delta| >= `thresholdEur` are returned; below the threshold, only the
 * top `smallTopN` (by magnitude) are appended. Sorted by magnitude desc.
 *
 * `baseItems` is the latest snapshot ("real"); `forecastItems` is the
 * server-composed forecast for the same month.
 */
export function notableVariations(
  monthIdx: number,
  baseItems: Item[],
  forecastItems: Item[],
  thresholdEur: number = DEFAULT_THRESHOLD_EUR,
  smallTopN: number = SMALL_TOP_N,
): MonthVariation[] {
  const fcstByAccount = new Map(forecastItems.map((it) => [it.account, it]));
  const all: MonthVariation[] = [];
  for (const b of baseItems) {
    const f = fcstByAccount.get(b.account);
    const real = b.values[monthIdx] ?? 0;
    const forecast = f?.values[monthIdx] ?? real;
    const delta = real - forecast;
    if (Math.abs(delta) < 0.005) continue;
    all.push({ account: b.account, name: shortName(b.name), delta });
  }
  all.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const big = all.filter((v) => Math.abs(v.delta) >= thresholdEur);
  const small = all.filter((v) => Math.abs(v.delta) < thresholdEur).slice(0, smallTopN);
  return [...big, ...small];
}
