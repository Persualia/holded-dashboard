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

export type SimTag = 'optimista' | 'moderado' | 'conservador' | 'crisis' | 'planA' | 'neutral';

/** A line item as captured inside a saved simulation snapshot. */
export interface PersistedSimItem {
  account: string;
  name: string;
  type: ItemType;
  group: string;
  /** Twelve effective monthly amounts at save time. */
  values: number[];
}

/**
 * Saved scenario as persisted server-side. We store the full predicted
 * snapshot — every account × every month — so that later, as months close
 * and `base` evolves, we can fairly compare what was predicted to what
 * actually happened. `overrideKeys` records which cells the user explicitly
 * touched, so we can rehydrate the sim into the active simulation as edits.
 */
export interface SavedSim {
  id: string;
  name: string;
  hypothesis: string;
  description: string;
  tag: SimTag;
  createdAt: number;
  /** Last time the snapshot was overwritten in place (absent for never-overwritten sims). */
  updatedAt?: number;
  savedAtYear: number;
  savedAtMonthIdx: number;
  predicted: {
    months: string[];
    items: PersistedSimItem[];
  };
  /** Per-account list of monthIdx the user explicitly overrode at save time. */
  overrideKeys: Record<string, number[]>;
  simRows: SimRow[];
}

export interface SaveSimInput {
  name: string;
  hypothesis?: string;
  description?: string;
}

/** Metadata-only edit of a saved sim (rename / re-tag). */
export interface SimPatch {
  name?: string;
  hypothesis?: string;
  description?: string;
}
