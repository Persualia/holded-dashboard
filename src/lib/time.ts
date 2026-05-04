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

/**
 * Application "today".
 * Past months (< CURRENT_MONTH_IDX) are real & immutable;
 * current is in-progress; future is forecast.
 */
export const TODAY = new Date();
export const CURRENT_YEAR = TODAY.getFullYear();
export const CURRENT_MONTH_IDX = TODAY.getMonth();

export function monthState(monthIdx: number): MonthState {
  if (monthIdx < CURRENT_MONTH_IDX) return 'past';
  if (monthIdx === CURRENT_MONTH_IDX) return 'current';
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
      return 'en curso';
    case 'future':
      return 'previsión';
  }
}
