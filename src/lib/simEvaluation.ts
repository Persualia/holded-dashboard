import { monthState } from './time';
import type { Dataset, SavedSim } from './types';

export type AccuracyBand = 'top' | 'close' | 'fail';

export interface MonthScore {
  m: number;
  predIncome: number;
  predExpense: number;
  predNet: number;
  realIncome: number;
  realExpense: number;
  realNet: number;
  /** Signed pct error on net: (predicted - real) / |real|. */
  errNet: number;
  errInc: number;
  errExp: number;
  band: AccuracyBand;
}

export interface SimEvaluation {
  /** Whether at least one closed month has a real-vs-predicted comparison. */
  hasData: boolean;
  closedMonths: number[];
  monthScores: MonthScore[];
  predIncome: number[];
  predExpense: number[];
  predNet: number[];
  realIncome: number[];
  realExpense: number[];
  realNet: number[];
  /** 0..1 — 1 means perfect average accuracy on net. */
  accuracyPct: number;
  /** Average absolute net error (pct, 0..∞). */
  avgAbsErrNet: number;
  /** Average signed net error — positive = systematically optimistic. */
  avgSignedErrNet: number;
  bandCounts: { top: number; close: number; fail: number };
}

export function accuracyBand(absErr: number): AccuracyBand {
  if (absErr <= 0.05) return 'top';
  if (absErr <= 0.1) return 'close';
  return 'fail';
}

function pctErr(pred: number, real: number): number {
  const denom = Math.abs(real) || 1;
  return (pred - real) / denom;
}

/**
 * Compares a saved simulation's predicted snapshot against the current `base`
 * dataset (which has real values for closed months). Only closed months are
 * scored — current and future months contribute nothing because there's no
 * real data to compare against yet.
 */
export function evaluateSim(sim: SavedSim, base: Dataset | null): SimEvaluation {
  const empty = (): SimEvaluation => ({
    hasData: false,
    closedMonths: [],
    monthScores: [],
    predIncome: new Array(12).fill(0),
    predExpense: new Array(12).fill(0),
    predNet: new Array(12).fill(0),
    realIncome: new Array(12).fill(0),
    realExpense: new Array(12).fill(0),
    realNet: new Array(12).fill(0),
    accuracyPct: 0,
    avgAbsErrNet: 0,
    avgSignedErrNet: 0,
    bandCounts: { top: 0, close: 0, fail: 0 },
  });

  if (!base || !sim.predicted?.items) return empty();

  const closedMonths: number[] = [];
  for (let m = 0; m < 12; m++) {
    if (monthState(m) === 'past') closedMonths.push(m);
  }

  const predIncome = new Array<number>(12).fill(0);
  const predExpense = new Array<number>(12).fill(0);
  for (const it of sim.predicted.items) {
    for (let m = 0; m < 12; m++) {
      const v = it.values[m] ?? 0;
      if (it.type === 'income') predIncome[m] += v;
      else predExpense[m] += v;
    }
  }
  const realIncome = new Array<number>(12).fill(0);
  const realExpense = new Array<number>(12).fill(0);
  for (const it of base.items) {
    for (let m = 0; m < 12; m++) {
      const v = it.values[m] ?? 0;
      if (it.type === 'income') realIncome[m] += v;
      else realExpense[m] += v;
    }
  }
  const predNet = predIncome.map((v, i) => v + predExpense[i]);
  const realNet = realIncome.map((v, i) => v + realExpense[i]);

  const monthScores: MonthScore[] = [];
  for (const m of closedMonths) {
    const errNet = pctErr(predNet[m], realNet[m]);
    monthScores.push({
      m,
      predIncome: predIncome[m],
      predExpense: predExpense[m],
      predNet: predNet[m],
      realIncome: realIncome[m],
      realExpense: realExpense[m],
      realNet: realNet[m],
      errNet,
      errInc: pctErr(predIncome[m], realIncome[m]),
      errExp: pctErr(predExpense[m], realExpense[m]),
      band: accuracyBand(Math.abs(errNet)),
    });
  }

  const n = monthScores.length;
  const avgAbsErrNet = n ? monthScores.reduce((a, b) => a + Math.abs(b.errNet), 0) / n : 0;
  const avgSignedErrNet = n ? monthScores.reduce((a, b) => a + b.errNet, 0) / n : 0;
  const accuracyPct = n ? Math.max(0, 1 - avgAbsErrNet) : 0;
  const bandCounts = {
    top: monthScores.filter((s) => s.band === 'top').length,
    close: monthScores.filter((s) => s.band === 'close').length,
    fail: monthScores.filter((s) => s.band === 'fail').length,
  };

  return {
    hasData: n > 0,
    closedMonths,
    monthScores,
    predIncome,
    predExpense,
    predNet,
    realIncome,
    realExpense,
    realNet,
    accuracyPct,
    avgAbsErrNet,
    avgSignedErrNet,
    bandCounts,
  };
}

/** Color scheme used by all comparison panels (heatmap, diff, compare swatches). */
export const SIM_COMPARE_COLORS = [
  'hsl(152 60% 36%)', // green — first selection
  'hsl(213 60% 45%)', // blue
  'hsl(13 70% 50%)', // accent / orange
] as const;

export const BAND_COLORS = {
  top: 'var(--success)',
  close: '#f3c8bb',
  fail: 'var(--destructive)',
} as const;

export const BAND_TEXT = {
  top: '#fff',
  close: 'var(--foreground)',
  fail: '#fff',
} as const;
