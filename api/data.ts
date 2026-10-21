import { DATA_PREFIX, isValidMonthKey, jsonKey, monthKeyFromPathname } from './_lib/blob.js';
import { toNodeHandler } from './_lib/node-adapter.js';
import { listBlobs, streamBlob } from './_lib/storage.js';

interface PersistedItem {
  name: string;
  account: string;
  values: number[];
}
/** A stored export: `months` lists its YYYY-MM columns (12 for a one-year
 *  export, more when Holded exports several years) and `values` follow it. */
interface PersistedDataset {
  months: string[];
  items: PersistedItem[];
}
interface ApiDataResponse {
  base: PersistedDataset;
  forecast: PersistedDataset;
  /** Upload keys of the exports that have columns for the requested year. */
  monthsUploaded: string[];
  /** Every upload key, across all years. */
  allMonthsUploaded: string[];
  /** Years that at least one export has columns for. */
  availableYears: number[];
}

const EMPTY: PersistedDataset = { months: [], items: [] };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatMonthKey(year: number, monthIdx: number): string {
  return `${year}-${pad2(monthIdx + 1)}`;
}

async function fetchJsonMonth(monthKey: string): Promise<PersistedDataset | null> {
  const res = await streamBlob(jsonKey(monthKey));
  if (!res) return null;
  try {
    return (await res.json()) as PersistedDataset;
  } catch {
    return null;
  }
}

/** A loaded export plus lookups by month column and by account. */
interface Export {
  key: string;
  ds: PersistedDataset;
  col: Map<string, number>;
  byAccount: Map<string, PersistedItem>;
}

function cellValue(exp: Export, account: string, monthKey: string): number | undefined {
  const c = exp.col.get(monthKey);
  const it = exp.byAccount.get(account);
  if (c == null || !it || !Array.isArray(it.values)) return undefined;
  return it.values[c];
}

/**
 * GET /api/data — returns the composed dataset for a given year.
 *
 * Query params (both optional):
 *   year  = YYYY        (default: current UTC year)
 *   asOf  = YYYY-MM     (default: current UTC year+month) — defines which
 *                       months count as "closed" (strictly before asOf).
 *
 * Every upload is a Holded export stored under the month it was uploaded for
 * (its key orders exports by recency) and may carry columns for any span of
 * months, possibly across years. The year is composed month by month:
 *
 * - `base`: each month's column comes from the most recent export that has
 *   it, so a newer export refreshes every month it covers — including past
 *   years — while months it no longer covers keep their last known values.
 *   Accounts are the union of the contributing exports; an account missing
 *   from the export that supplies a month counts as 0 there. A year with no
 *   columns in any export comes back empty.
 * - `forecast` mirrors `base`; for each closed month, values come from the
 *   most recent earlier export (key <= that month, not the one supplying
 *   base) that has the column. Months without such a source keep the base
 *   values — those rows are filtered out as "no comparison" downstream.
 */
async function handle(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const now = new Date();

  const yearParam = url.searchParams.get('year');
  const year =
    yearParam && /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : now.getUTCFullYear();

  const asOfParam = url.searchParams.get('asOf');
  let asOfYear = now.getUTCFullYear();
  let asOfMonthIdx = now.getUTCMonth();
  if (asOfParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(asOfParam)) {
    asOfYear = parseInt(asOfParam.slice(0, 4), 10);
    asOfMonthIdx = parseInt(asOfParam.slice(5, 7), 10) - 1;
  }

  const blobs = await listBlobs(DATA_PREFIX);
  const monthsWithJson = new Set<string>();
  for (const b of blobs) {
    if (!b.pathname.endsWith('.json')) continue;
    const mk = monthKeyFromPathname(b.pathname);
    if (mk && isValidMonthKey(mk)) monthsWithJson.add(mk);
  }
  const allMonthsUploaded = Array.from(monthsWithJson).sort();

  // Newest first. Every export is needed to know which months it carries.
  const loaded = await Promise.all(allMonthsUploaded.map(fetchJsonMonth));
  const exportsDesc: Export[] = [];
  for (let i = allMonthsUploaded.length - 1; i >= 0; i--) {
    const ds = loaded[i];
    if (!ds || !Array.isArray(ds.months) || !Array.isArray(ds.items)) continue;
    exportsDesc.push({
      key: allMonthsUploaded[i],
      ds,
      col: new Map(ds.months.map((m, c) => [m, c])),
      byAccount: new Map(ds.items.map((it) => [it.account, it])),
    });
  }

  const years = new Set<number>();
  for (const e of exportsDesc) {
    for (const m of e.ds.months) if (isValidMonthKey(m)) years.add(parseInt(m.slice(0, 4), 10));
  }
  const availableYears = Array.from(years).sort((a, b) => a - b);

  const monthKeys = Array.from({ length: 12 }, (_, i) => formatMonthKey(year, i));
  const source = monthKeys.map((mk) => exportsDesc.find((e) => e.col.has(mk)) ?? null);
  const contributing = exportsDesc.filter((e) => source.includes(e));
  const monthsUploaded = exportsDesc
    .filter((e) => monthKeys.some((mk) => e.col.has(mk)))
    .map((e) => e.key)
    .sort();

  const respond = (base: PersistedDataset, forecast: PersistedDataset) =>
    Response.json({ base, forecast, monthsUploaded, allMonthsUploaded, availableYears } satisfies ApiDataResponse, {
      headers: { 'cache-control': 'no-store' },
    });

  if (contributing.length === 0) return respond(EMPTY, EMPTY);

  // Union of accounts, newest export first so names and order follow it.
  const names = new Map<string, string>();
  for (const e of contributing) {
    for (const it of e.ds.items) if (!names.has(it.account)) names.set(it.account, it.name);
  }

  const baseDataset: PersistedDataset = {
    months: monthKeys,
    items: Array.from(names, ([account, name]) => ({
      name,
      account,
      values: monthKeys.map((mk, i) => {
        const src = source[i];
        return src ? cellValue(src, account, mk) ?? 0 : 0;
      }),
    })),
  };

  let closedMonthsCount: number;
  if (year < asOfYear) closedMonthsCount = 12;
  else if (year === asOfYear) closedMonthsCount = Math.max(0, asOfMonthIdx);
  else closedMonthsCount = 0;

  // Build forecast as a deep-cloned base, then overwrite closed-month cells
  // from the chosen source per month. Including K == M (the M-file itself)
  // treats its M column as the at-time-of-export estimate — useful when no
  // earlier file exists.
  const forecast: PersistedDataset = {
    months: baseDataset.months,
    items: baseDataset.items.map((it) => ({
      name: it.name,
      account: it.account,
      values: it.values.slice(),
    })),
  };
  for (let i = 0; i < closedMonthsCount; i++) {
    const mk = monthKeys[i];
    const src = exportsDesc.find((e) => e.key <= mk && e !== source[i] && e.col.has(mk));
    if (!src) continue;
    for (const it of forecast.items) {
      const old = cellValue(src, it.account, mk);
      if (old !== undefined) it.values[i] = old;
    }
  }

  return respond(baseDataset, forecast);
}

export default toNodeHandler(handle);
