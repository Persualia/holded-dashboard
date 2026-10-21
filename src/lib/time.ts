import type { MonthState } from './types';

export const MONTH_LABELS_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

export const MONTH_LABELS_LONG_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/** Real-world "today" — independent of the year being viewed. */
export const TODAY = new Date();
export const TODAY_YEAR = TODAY.getFullYear();
export const TODAY_MONTH_IDX = TODAY.getMonth();

/**
 * Year currently on screen and its month boundary. These are live bindings:
 * `setViewYear` rewrites them, and the dashboard tree is remounted (keyed by
 * year) right after, so every reader sees a consistent value.
 *
 * Months < CURRENT_MONTH_IDX are real & immutable; the rest are forecast.
 * Past years are fully closed (12), future years fully open (0).
 */
export let VIEW_YEAR = TODAY_YEAR;
export let CURRENT_MONTH_IDX = TODAY_MONTH_IDX;
/** Index of today's month inside VIEW_YEAR, or null when viewing another year. */
export let TODAY_IDX: number | null = TODAY_MONTH_IDX;

export function setViewYear(year: number): void {
  VIEW_YEAR = year;
  if (year < TODAY_YEAR) CURRENT_MONTH_IDX = 12;
  else if (year > TODAY_YEAR) CURRENT_MONTH_IDX = 0;
  else CURRENT_MONTH_IDX = TODAY_MONTH_IDX;
  TODAY_IDX = year === TODAY_YEAR ? TODAY_MONTH_IDX : null;
}

export function monthState(monthIdx: number): MonthState {
  if (monthIdx < CURRENT_MONTH_IDX) return 'past';
  if (monthIdx === TODAY_IDX) return 'current';
  return 'future';
}

export function isLocked(monthIdx: number): boolean {
  return monthState(monthIdx) === 'past';
}

export function monthStateLabel(state: MonthState): string {
  switch (state) {
    case 'past':
      return 'real';
    case 'current':
      return 'previsión';
    case 'future':
      return 'previsión';
  }
}
