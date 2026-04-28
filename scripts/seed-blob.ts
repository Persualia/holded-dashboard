/**
 * One-shot script to seed Vercel Blob with the local `data/data.xlsx`.
 *
 * Reads BLOB_READ_WRITE_TOKEN from .env.local and writes both `data.xlsx`
 * and the parsed `data.json` cache, mirroring what /api/upload does in
 * production. Run with: `pnpm seed`.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { put } from '@vercel/blob';
import { parseHoldedBuffer } from '../src/lib/xlsx';

const XLSX_PATH = resolve(process.cwd(), 'data/data.xlsx');
const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN missing. Run `vercel env pull .env.local` or set it manually, then `pnpm seed`.',
    );
  }

  const buf = await readFile(XLSX_PATH);
  const dataset = parseHoldedBuffer(buf);
  const json = JSON.stringify(dataset);

  await Promise.all([
    put('data.xlsx', buf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: XLSX_CONTENT_TYPE,
    }),
    put('data.json', json, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    }),
  ]);

  console.log(
    `Seeded blob from ${XLSX_PATH} — ${dataset.items.length} items across ${dataset.months.length} months.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
