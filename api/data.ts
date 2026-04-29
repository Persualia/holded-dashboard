import { isValidMonthKey, jsonKey, monthKeyFromPathname, yearPrefix } from './_lib/blob.js';
import { toNodeHandler } from './_lib/node-adapter.js';
import { listBlobs, streamBlob } from './_lib/storage.js';

interface PersistedItem {
  name: string;
  account: string;
  values: number[];
}
interface PersistedDataset {
  months: string[];
  items: PersistedItem[];
}
interface ApiDataResponse {
  base: PersistedDataset;
  forecast: PersistedDataset;
  monthsUploaded: string[];
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

/**
 * GET /api/data — returns the composed dataset for a given year.
 *
 * Query params (both optional):
 *   year  = YYYY        (default: current UTC year)
 *   asOf  = YYYY-MM     (default: current UTC year+month) — defines which
 *                       months count as "closed" (strictly before asOf).
 *
 * Response shape:
 *   { base, forecast, monthsUploaded }
 *
 * - `base` is the most recently uploaded month's dataset (latest snapshot).
 * - `forecast` mirrors `base` shape; for each closed month i, values[i] are
 *   pulled from the most recent file uploaded BEFORE that month (largest
 *   monthKey K < formatMonthKey(year, i)). For months without an earlier
 *   source (and for current/future months), forecast values fall back to
 *   the corresponding base values — those rows are filtered out as
 *   "no comparison" downstream.
 * - `monthsUploaded` is the sorted list of YYYY-MM keys present for the year.
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

  const blobs = await listBlobs(yearPrefix(year));
  const monthsWithJson = new Set<string>();
  for (const b of blobs) {
    if (!b.pathname.endsWith('.json')) continue;
    const mk = monthKeyFromPathname(b.pathname);
    if (mk && isValidMonthKey(mk)) monthsWithJson.add(mk);
  }
  const monthsUploaded = Array.from(monthsWithJson).sort();

  const empty = (): ApiDataResponse => ({ base: EMPTY, forecast: EMPTY, monthsUploaded });

  if (monthsUploaded.length === 0) {
    return Response.json(empty(), { headers: { 'cache-control': 'no-store' } });
  }

  const latestKey = monthsUploaded[monthsUploaded.length - 1];
  const baseDataset = await fetchJsonMonth(latestKey);
  if (!baseDataset) {
    return Response.json(empty(), { headers: { 'cache-control': 'no-store' } });
  }

  let closedMonthsCount: number;
  if (year < asOfYear) closedMonthsCount = 12;
  else if (year === asOfYear) closedMonthsCount = Math.max(0, asOfMonthIdx);
  else closedMonthsCount = 0;

  // Pick the forecast-source file per closed month: largest K with K <= monthKey(i)
  // and K != latestKey (the latest file is the "real" snapshot, not a forecast).
  // Including K == M (the M-file itself) treats its M column as the at-time-of-
  // export estimate — useful when no earlier file exists.
  const forecastSourcePerMonth: Array<string | null> = new Array(12).fill(null);
  for (let i = 0; i < closedMonthsCount; i++) {
    const mi = formatMonthKey(year, i);
    let chosen: string | null = null;
    for (const k of monthsUploaded) {
      if (k <= mi && k !== latestKey) chosen = k;
      else if (k > mi) break;
    }
    forecastSourcePerMonth[i] = chosen;
  }

  // Fetch all unique forecast sources in parallel.
  const needed = new Set<string>();
  for (const k of forecastSourcePerMonth) if (k) needed.add(k);
  const cache = new Map<string, PersistedDataset | null>();
  await Promise.all(
    Array.from(needed).map(async (k) => {
      cache.set(k, await fetchJsonMonth(k));
    }),
  );

  // Build forecast as a deep-cloned base, then overwrite closed-month cells
  // from the chosen source per month.
  const forecast: PersistedDataset = {
    months: baseDataset.months,
    items: baseDataset.items.map((it) => ({
      name: it.name,
      account: it.account,
      values: it.values.slice(),
    })),
  };

  const indexedByKey = new Map<string, Map<string, PersistedItem>>();
  for (const [k, ds] of cache) {
    if (!ds) continue;
    const m = new Map<string, PersistedItem>();
    for (const it of ds.items) m.set(it.account, it);
    indexedByKey.set(k, m);
  }

  for (let i = 0; i < closedMonthsCount; i++) {
    const src = forecastSourcePerMonth[i];
    if (!src) continue;
    const idx = indexedByKey.get(src);
    if (!idx) continue;
    for (const it of forecast.items) {
      const old = idx.get(it.account);
      if (old && Array.isArray(old.values) && old.values.length >= 12) {
        it.values[i] = old.values[i];
      }
    }
  }

  const body: ApiDataResponse = { base: baseDataset, forecast, monthsUploaded };
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
}

export default toNodeHandler(handle);
