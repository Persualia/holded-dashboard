import { parseHoldedBuffer } from '../src/lib/xlsx.js';
import { checkAuth } from './_lib/auth.js';
import { isValidMonthKey, jsonKey, xlsxKey } from './_lib/blob.js';
import { toNodeHandler } from './_lib/node-adapter.js';
import { putBlob } from './_lib/storage.js';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * POST /api/upload — accepts a multipart upload with `file` (xlsx) and
 * `month` (YYYY-MM) fields.
 *
 * The handler parses the xlsx server-side and writes two blobs (overwrite)
 * scoped to the chosen month:
 *   - data/YYYY-MM.xlsx → the original spreadsheet
 *   - data/YYYY-MM.json → the parsed Dataset
 *
 * Re-uploading the same month replaces both, by design.
 */
async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = checkAuth(req);
  if (auth instanceof Response) return auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return new Response(`Invalid multipart body: ${(e as Error).message}`, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return new Response('Missing "file" field', { status: 400 });
  }

  const monthRaw = form.get('month');
  const month = typeof monthRaw === 'string' ? monthRaw.trim() : '';
  if (!isValidMonthKey(month)) {
    return new Response('Missing or invalid "month" field (expected YYYY-MM)', { status: 400 });
  }

  const buf = await file.arrayBuffer();

  let dataset;
  try {
    dataset = parseHoldedBuffer(buf);
  } catch (e) {
    return new Response(`Parse error: ${(e as Error).message}`, { status: 400 });
  }

  const json = JSON.stringify(dataset);

  await Promise.all([
    putBlob(xlsxKey(month), buf, XLSX_CONTENT_TYPE),
    putBlob(jsonKey(month), json, 'application/json'),
  ]);

  return Response.json({
    ok: true,
    items: dataset.items.length,
    months: dataset.months.length,
    monthKey: month,
  });
}

export default toNodeHandler(handle);
