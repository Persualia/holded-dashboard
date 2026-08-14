/**
 * Refresh the local dataset from the production Vercel Blob store.
 *
 * Downloads every blob under `data/` into the local `data/` folder, which is
 * exactly where the dev server's on-disk fallback reads from (see
 * `api/_lib/storage.ts`), so after running this `pnpm dev` serves the real
 * figures. Existing files with the same name are overwritten.
 *
 * Read-only with respect to production: this module imports only `list` and
 * `get`, never `put` or `del`, so it cannot mutate the remote store.
 *
 * The credential is read from BLOB_READ_WRITE_TOKEN_FOR_DOWNLOADS, deliberately
 * NOT from BLOB_READ_WRITE_TOKEN: the dev server picks the latter up (see
 * vite.config.ts) and would then be able to upload to production by accident.
 * Keeping that one empty makes local uploads fall back to the on-disk `data/`.
 * The token has to be passed explicitly — the SDK defaults to the other name.
 *
 * Usage: `node --env-file=.env --experimental-strip-types scripts/pull-blobs.ts`
 */
import { get, list } from '@vercel/blob';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const PREFIX = 'data/';
const DEST = resolve(process.cwd(), 'data');

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN_FOR_DOWNLOADS;
  if (!token) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN_FOR_DOWNLOADS missing — run with `node --env-file=.env …`.',
    );
  }

  const blobs: Array<{ pathname: string; size: number; uploadedAt: Date }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, token });
    for (const b of page.blobs) {
      blobs.push({ pathname: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt) });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
  console.log(`${blobs.length} blobs under "${PREFIX}" → ${DEST}\n`);

  for (const b of blobs) {
    const res = await get(b.pathname, { access: 'private', useCache: false, token });
    if (!res || res.statusCode !== 200) {
      console.log(`  SKIP ${b.pathname} (status ${res?.statusCode ?? 'none'})`);
      continue;
    }
    const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
    const target = join(DEST, b.pathname.slice(PREFIX.length));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buf);
    console.log(
      `  ${b.pathname.padEnd(34)} ${String(buf.length).padStart(8)} B  subido ${b.uploadedAt.toISOString()}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
