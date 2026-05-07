import { del, get, list, put } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Storage shim so dev works without a Vercel Blob token: when
 * BLOB_READ_WRITE_TOKEN is unset, ops fall back to writing under cwd, with
 * the blob pathname mapped 1:1 to a relative on-disk path. So a key like
 * `data/2026-04.json` lands at `<cwd>/data/2026-04.json`.
 */

const useLocal = !process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_ROOT = process.cwd();

export async function putBlob(
  key: string,
  body: ArrayBuffer | string,
  contentType: string,
): Promise<void> {
  if (useLocal) {
    const full = path.join(LOCAL_ROOT, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const data = typeof body === 'string' ? body : Buffer.from(body);
    await fs.writeFile(full, data);
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
      const buf = await fs.readFile(path.join(LOCAL_ROOT, key));
      return new Response(buf);
    } catch {
      return null;
    }
  }
  try {
    const result = await get(key, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return new Response(result.stream);
  } catch {
    return null;
  }
}

export async function deleteBlob(key: string): Promise<void> {
  if (useLocal) {
    try {
      await fs.unlink(path.join(LOCAL_ROOT, key));
    } catch {
      // already gone — fine
    }
    return;
  }
  await del(key);
}

export interface ListedBlob {
  pathname: string;
  uploadedAt: Date;
}

/**
 * Enumerate blobs whose pathname starts with `prefix`. In dev with the local
 * fallback this scans the equivalent on-disk directory.
 */
export async function listBlobs(prefix: string): Promise<ListedBlob[]> {
  if (useLocal) {
    return listLocal(prefix);
  }
  const out: ListedBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor });
    for (const b of page.blobs) {
      out.push({ pathname: b.pathname, uploadedAt: new Date(b.uploadedAt) });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function listLocal(prefix: string): Promise<ListedBlob[]> {
  // Walk the on-disk equivalent of `${LOCAL_ROOT}/${prefix}*`.
  // The prefix may include a directory portion (e.g. "data/2026-").
  const dir = path.join(LOCAL_ROOT, path.dirname(prefix));
  const baseFilter = path.basename(prefix);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: ListedBlob[] = [];
  for (const name of entries) {
    if (!name.startsWith(baseFilter)) continue;
    const full = path.join(dir, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      const pathname = path.posix.join(path.dirname(prefix), name);
      out.push({ pathname, uploadedAt: stat.mtime });
    } catch {
      // ignore unreadable entries
    }
  }
  return out;
}
