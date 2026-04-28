import { BLOB_DATASET_KEY } from './_lib/blob.js';
import { streamBlob } from './_lib/storage.js';

const EMPTY_DATASET = { months: [], items: [] };

/**
 * GET /api/data — returns the cached dataset JSON.
 *
 * The JSON is generated server-side at upload time (see /api/upload), so this
 * endpoint never parses the xlsx — it just proxies the blob payload.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const blob = await streamBlob(BLOB_DATASET_KEY);
  if (!blob || !blob.body) {
    return Response.json(EMPTY_DATASET, {
      headers: { 'cache-control': 'no-store' },
    });
  }

  return new Response(blob.body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
