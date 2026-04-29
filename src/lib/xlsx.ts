import * as XLSX from 'xlsx';
import { categorize } from './categorize.js';
import type { Dataset, Item } from './types.js';

/**
 * Parse a Holded "Goals" xlsx export from a raw buffer (works in both browser
 * and Node — server uses this directly when handling uploads).
 *
 * Expected layout (matches the Holded export):
 *   row 1: title
 *   row 2: blank
 *   row 3: ['Concepte', 'Compte', '2026-01', '2026-02', …, '2026-12']
 *   rows 4..N-1: data rows: [name, account, jan..dec]
 *   row N: total row ("Resultat de l'exercici") — skipped
 */
export function parseHoldedBuffer(buf: ArrayBuffer | Uint8Array): Dataset {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('El fichero no contiene ninguna hoja.');
  const sheet = wb.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  if (rows.length < 5) throw new Error('Estructura inesperada — el fichero no tiene suficientes filas.');

  const headerRow = rows[2];
  if (!headerRow || headerRow.length < 14) {
    throw new Error('Cabecera no encontrada en la fila 3 (esperado: Concepte, Compte, 12 meses).');
  }

  const months = headerRow
    .slice(2, 14)
    .map((h) => (h == null ? '' : String(h).trim()));
  if (months.length !== 12 || months.some((m) => !m)) {
    throw new Error('No se encontraron 12 columnas de mes en la cabecera.');
  }

  const items: Item[] = [];
  for (let i = 3; i < rows.length - 1; i++) {
    const r = rows[i];
    if (!r) continue;
    const name = (r[0] == null ? '' : String(r[0])).trim();
    const account = (r[1] == null ? '' : String(r[1])).trim();
    if (!account) continue;
    const values: number[] = [];
    for (let m = 0; m < 12; m++) {
      const cell = r[m + 2];
      const num = typeof cell === 'number' ? cell : Number.parseFloat(String(cell ?? 0));
      values.push(Number.isFinite(num) ? Math.round(num * 100) / 100 : 0);
    }
    const c = categorize(account);
    items.push({ name, account, values, type: c.type, group: c.group });
  }

  return { months, items };
}

/** Browser convenience wrapper: parse a `File` from an `<input type="file">`. */
export async function parseHoldedXlsx(file: File): Promise<Dataset> {
  return parseHoldedBuffer(await file.arrayBuffer());
}

/**
 * Best-effort suggestion of which YYYY-MM key a file belongs to, derived from
 * the workbook's core properties (ModifiedDate then CreatedDate). Returns null
 * if the metadata is missing or unparseable — the upload UI falls back to the
 * current month in that case.
 */
export function extractMonthFromBuffer(buf: ArrayBuffer | Uint8Array): string | null {
  let wb;
  try {
    wb = XLSX.read(buf, { type: 'array', bookProps: true });
  } catch {
    return null;
  }
  const props = wb.Props as { ModifiedDate?: unknown; CreatedDate?: unknown } | undefined;
  const candidate = props?.ModifiedDate ?? props?.CreatedDate;
  const d = candidate instanceof Date ? candidate : new Date(String(candidate ?? ''));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Hydrate a raw JSON dataset (e.g. from /api/data or from a stored snapshot)
 * — re-categorizes in case the rules have evolved.
 */
export function hydrateDataset(raw: { months: string[]; items: Array<Omit<Item, 'type' | 'group'>> }): Dataset {
  const items = raw.items.map((it) => {
    const c = categorize(it.account);
    return { ...it, type: c.type, group: c.group } as Item;
  });
  return { months: raw.months, items };
}
