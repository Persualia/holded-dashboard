export type ItemType = 'income' | 'expense';

export type MonthState = 'past' | 'current' | 'future';

/** A single line item from the financial export — one P&L row across 12 months. */
export interface Item {
  /** Holded concept name (often "CODE - Customer name"). */
  name: string;
  /** Spanish chart of accounts code, e.g. "705101000". */
  account: string;
  /** Twelve monthly amounts: positive for income, negative for expense. */
  values: number[];
  type: ItemType;
  /** High-level category derived from `account`. */
  group: string;
}

/** Item with simulation overlay applied — `simMask[i]` is true if month i is overridden. */
export interface EffectiveItem extends Item {
  simMask: boolean[];
  /** True when this row was added by the user as part of the simulation (not in `base`). */
  isSimRow?: boolean;
}

/**
 * A row added by the user purely for simulation purposes. Values are stored in the
 * regular `SimOverrides` map keyed by `id` (which doubles as the synthetic account).
 */
export interface SimRow {
  /** Synthetic account id, e.g. "sim-<uuid>". */
  id: string;
  name: string;
  group: string;
  type: ItemType;
}

export interface Dataset {
  /** ISO month strings, e.g. ["2026-01", …, "2026-12"]. */
  months: string[];
  items: Item[];
}

/** Wire shape of an `Item` as stored in the per-month JSON cache and
 *  exchanged with `/api/data` (no derived fields). */
export interface PersistedItem {
  name: string;
  account: string;
  values: number[];
}

export interface PersistedDataset {
  months: string[];
  items: PersistedItem[];
}

/** Response shape of `GET /api/data`. */
export interface ApiDataResponse {
  base: PersistedDataset;
  forecast: PersistedDataset;
  monthsUploaded: string[];
}

export interface EffectiveDataset {
  months: string[];
  items: EffectiveItem[];
}

/**
 * Per-account map of monthIdx → simulated value.
 * Stored in localStorage. Past months are rejected at the boundary.
 */
export type SimOverrides = Record<string, Record<number, number>>;

/** Values pre-aggregated by month and by group. */
export interface Aggregation {
  income: number[];
  expense: number[];
  net: number[];
  byGroup: Record<
    string,
    {
      type: ItemType;
      values: number[];
      total: number;
      items: Array<Item | EffectiveItem>;
    }
  >;
  totals: {
    income: number;
    expense: number;
    net: number;
  };
}

export type ApplyScope = 'income' | 'expense' | 'all';
