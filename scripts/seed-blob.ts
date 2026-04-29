/**
 * One-shot script to seed Vercel Blob with a local xlsx scoped to a month.
 *
 * Usage: `pnpm seed <YYYY-MM> [path/to/file.xlsx]`
 *   - Defaults to `data/data.xlsx` if no path is given.
 *   - Writes `data/YYYY-MM.xlsx` and `data/YYYY-MM.json` to the configured
 *     Vercel Blob store, mirroring what /api/upload does in production.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { put } from '@vercel/blob';
import { isValidMonthKey, jsonKey, xlsxKey } from '../api/_lib/blob';
import { parseHoldedBuffer } from '../src/lib/xlsx';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN missing. Run `vercel env pull .env.local` or set it manually, then `pnpm seed`.',
    );
  }

  const monthArg = process.argv[2];
  if (!monthArg || !isValidMonthKey(monthArg)) {
    throw new Error('First arg must be a YYYY-MM month key, e.g. `pnpm seed 2026-04`.');
  }
  const filePath = process.argv[3]
    ? resolve(process.cwd(), process.argv[3])
    : resolve(process.cwd(), 'data/data.xlsx');

  const buf = await readFile(filePath);
  const dataset = parseHoldedBuffer(buf);
  const json = JSON.stringify(dataset);

  await Promise.all([
    put(xlsxKey(monthArg), buf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: XLSX_CONTENT_TYPE,
    }),
    put(jsonKey(monthArg), json, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    }),
  ]);

  console.log(
    `Seeded ${monthArg} from ${filePath} — ${dataset.items.length} items across ${dataset.months.length} months.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
