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
  monthsUploaded: string[];
  allMonthsUploaded: string[];
  projectedFrom: string | null;
  templateFrom: string | null;
}

const EMPTY: PersistedDataset = { months: [], items: [] };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatMonthKey(year: number, monthIdx: number): string {
  return `${year}-${pad2(monthIdx + 1)}`;
}

function yearMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => formatMonthKey(year, i));
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

function coversYear(ds: PersistedDataset, year: number): boolean {
  return ds.months.some((m) => m.startsWith(`${year}-`));
}

/**
 * Pick the 12 columns of `sourceYear` out of a stored export, labelled as
 * `year` (the same year unless building a copy template). Months the export
 * does not include come out as 0.
 */
function projectToYear(ds: PersistedDataset, sourceYear: number, year = sourceYear): PersistedDataset {
  const cols = yearMonthKeys(sourceYear).map((k) => ds.months.indexOf(k));
  return {
    months: yearMonthKeys(year),
    items: ds.items.map((it) => ({
      name: it.name,
      account: it.account,
      values: cols.map((c) => (c >= 0 ? it.values[c] ?? 0 : 0)),
    })),
  };
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
 *   { base, forecast, monthsUploaded, allMonthsUploaded, projectedFrom, templateFrom }
 *
 * Exports are stored under the month they were uploaded for, but may carry
 * columns for several years, so everything below works by YYYY-MM column key
 * rather than by position.
 *
 * - `base` is the year's 12 columns from the most recent export uploaded for
 *   that year. If the year has no uploads of its own, it comes from the most
 *   recent export (any year) that has columns for it — e.g. a 2026 export that
 *   already includes 2027 — and `projectedFrom` names that export's key.
 *   Failing that, it is a template: the previous year's latest export with
 *   its months relabelled to `year`, named by `templateFrom`.
 * - `forecast` mirrors `base` shape; for each closed month i, values[i] are
 *   pulled from the most recent export (other than base's) uploaded on or
 *   before that month that has a column for it. Months without such a source
 *   (and current/future months) fall back to the base values — those rows
 *   are filtered out as "no comparison" downstream.
 * - `monthsUploaded` is the sorted list of YYYY-MM keys present for the year;
 *   `allMonthsUploaded` the same across every year.
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
  const monthsUploaded = allMonthsUploaded.filter((k) => k.startsWith(`${year}-`));

  // Exports are fetched lazily and at most once per request.
  const cache = new Map<string, Promise<PersistedDataset | null>>();
  const load = (k: string): Promise<PersistedDataset | null> => {
    let p = cache.get(k);
    if (!p) {
      p = fetchJsonMonth(k);
      cache.set(k, p);
    }
    return p;
  };

  const respond = (body: ApiDataResponse) =>
    Response.json(body, { headers: { 'cache-control': 'no-store' } });
  const empty = (): ApiDataResponse => ({
    base: EMPTY,
    forecast: EMPTY,
    monthsUploaded,
    allMonthsUploaded,
    projectedFrom: null,
    templateFrom: null,
  });

  // Resolve which export `base` comes from.
  let latestKey: string | null = monthsUploaded[monthsUploaded.length - 1] ?? null;
  let projectedFrom: string | null = null;
  if (!latestKey) {
    for (let i = allMonthsUploaded.length - 1; i >= 0; i--) {
      const ds = await load(allMonthsUploaded[i]);
      if (ds && coversYear(ds, year)) {
        latestKey = projectedFrom = allMonthsUploaded[i];
        break;
      }
    }
  }

  if (!latestKey) {
    const prevYear = allMonthsUploaded.filter((k) => k.startsWith(`${year - 1}-`));
    const templateFrom = prevYear[prevYear.length - 1];
    const prev = templateFrom ? await load(templateFrom) : null;
    if (!templateFrom || !prev) return respond(empty());
    const template = projectToYear(prev, year - 1, year);
    return respond({
      base: template,
      forecast: template,
      monthsUploaded,
      allMonthsUploaded,
      projectedFrom: null,
      templateFrom,
    });
  }

  const latest = await load(latestKey);
  if (!latest) return respond(empty());
  const baseDataset = projectToYear(latest, year);

  let closedMonthsCount: number;
  if (year < asOfYear) closedMonthsCount = 12;
  else if (year === asOfYear) closedMonthsCount = Math.max(0, asOfMonthIdx);
  else closedMonthsCount = 0;

  // Build forecast as a deep-cloned base, then overwrite closed-month cells
  // from the chosen source per month: the largest K <= monthKey(i), K !=
  // latestKey (that is the "real" snapshot), whose export has a column for
  // month i. Including K == M (the M-file itself) treats its M column as the
  // at-time-of-export estimate — useful when no earlier file exists.
  const forecast: PersistedDataset = {
    months: baseDataset.months,
    items: baseDataset.items.map((it) => ({
      name: it.name,
      account: it.account,
      values: it.values.slice(),
    })),
  };

  const indexed = new Map<string, Map<string, PersistedItem>>();
  for (let i = 0; i < closedMonthsCount; i++) {
    const mi = formatMonthKey(year, i);
    for (let j = allMonthsUploaded.length - 1; j >= 0; j--) {
      const k = allMonthsUploaded[j];
      if (k > mi || k === latestKey) continue;
      const src = await load(k);
      const col = src ? src.months.indexOf(mi) : -1;
      if (!src || col < 0) continue;
      let byAccount = indexed.get(k);
      if (!byAccount) {
        byAccount = new Map(src.items.map((it) => [it.account, it]));
        indexed.set(k, byAccount);
      }
      for (const it of forecast.items) {
        const old = byAccount.get(it.account);
        if (old && Array.isArray(old.values) && old.values.length > col) {
          it.values[i] = old.values[col];
        }
      }
      break;
    }
  }

  return respond({
    base: baseDataset,
    forecast,
    monthsUploaded,
    allMonthsUploaded,
    projectedFrom,
    templateFrom: null,
  });
}

export default toNodeHandler(handle);
