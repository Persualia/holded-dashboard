import { get, put } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Storage shim so dev works without a Vercel Blob token: when
 * BLOB_READ_WRITE_TOKEN is unset, both ops fall back to ./data on disk.
 */

const useLocal = !process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_DIR = path.resolve(process.cwd(), 'data');

export async function putBlob(
  key: string,
  body: ArrayBuffer | string,
  contentType: string,
): Promise<void> {
  if (useLocal) {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    const data = typeof body === 'string' ? body : Buffer.from(body);
    await fs.writeFile(path.join(LOCAL_DIR, key), data);
    return;
  }
  await put(key, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
}

export async function streamBlob(key: string): Promise<Response | null> {
  if (useLocal) {
    try {
      const buf = await fs.readFile(path.join(LOCAL_DIR, key));
      return new Response(buf);
    } catch {
      return null;
    }
  }
  try {
    const result = await get(key, { access: 'private', useCache: false });
    if (result.statusCode !== 200) return null;
    return new Response(result.stream);
  } catch {
    return null;
  }
}
