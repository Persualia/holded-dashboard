import { parseHoldedBuffer } from '../src/lib/xlsx.js';
import { checkAuth } from './_lib/auth.js';
import { BLOB_DATASET_KEY, BLOB_XLSX_KEY } from './_lib/blob.js';
import { toNodeHandler } from './_lib/node-adapter.js';
import { putBlob } from './_lib/storage.js';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * POST /api/upload — accepts a multipart upload with a single `file` field.
 *
 * The handler parses the xlsx server-side, then writes two blobs (overwrite):
 *   - data.xlsx → the original spreadsheet
 *   - data.json → the parsed Dataset, which is what the frontend reads on load
 *
 * Parsing happens once here so reads via /api/data never touch xlsx logic.
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

  const buf = await file.arrayBuffer();

  let dataset;
  try {
    dataset = parseHoldedBuffer(buf);
  } catch (e) {
    return new Response(`Parse error: ${(e as Error).message}`, { status: 400 });
  }

  const json = JSON.stringify(dataset);

  await Promise.all([
    putBlob(BLOB_XLSX_KEY, buf, XLSX_CONTENT_TYPE),
    putBlob(BLOB_DATASET_KEY, json, 'application/json'),
  ]);

  return Response.json({
    ok: true,
    items: dataset.items.length,
    months: dataset.months.length,
  });
}

export default toNodeHandler(handle);
