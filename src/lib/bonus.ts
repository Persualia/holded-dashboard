import type { BonusConfig } from '@/lib/types';

/** What ended up setting the size of the bonus pool. */
export type PoolLimit = 'percentage' | 'cap' | 'minimum' | 'none';

export interface BonusPool {
  /** distributePct of the pre-tax profit, before any limit. */
  rawPool: number;
  /** Largest pool that still leaves the company `minNetProfit` after bonus and tax. */
  headroom: number;
  /** Final pool available to distribute (never negative). */
  pool: number;
  limitedBy: PoolLimit;
  /** Pre-tax profit from which some bonus starts being distributed. */
  startsAt: number;
  /** Pre-tax profit from which the full percentage is distributed. */
  fullPctAt: number;
}

/**
 * Bonus pool from the pre-tax profit.
 *
 * The workers' share is a percentage of the profit BEFORE corporate tax. The
 * bonus is a deductible expense, so tax applies to what is left after it, and
 * the company must keep at least `minNetProfit` after bonus and tax:
 *   (netPre − pool) · (1 − t) ≥ minNetProfit  ⇒  pool ≤ netPre − minNetProfit / (1 − t)
 */
export function computeBonusPool(netPre: number, config: BonusConfig): BonusPool {
  const keep = 1 - config.taxRatePct / 100;
  const share = config.distributePct / 100;
  const minPre = keep > 0 ? config.minNetProfit / keep : Infinity;

  const rawPool = Math.max(0, netPre * share);
  const headroom = Math.max(0, netPre - minPre);
  const cap = config.maxDistribute > 0 ? config.maxDistribute : Infinity;

  const pool = Math.min(rawPool, headroom, cap);
  let limitedBy: PoolLimit = 'percentage';
  if (pool <= 0) limitedBy = rawPool <= 0 ? 'none' : 'minimum';
  else if (pool === headroom && headroom < rawPool) limitedBy = 'minimum';
  else if (pool === cap && cap < rawPool) limitedBy = 'cap';

  return {
    rawPool,
    headroom,
    pool,
    limitedBy,
    startsAt: minPre,
    fullPctAt: share < 1 ? minPre / (1 - share) : Infinity,
  };
}
