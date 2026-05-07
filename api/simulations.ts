import { randomBytes } from 'node:crypto';
import { checkAuth } from './_lib/auth.js';
import { isValidSimId, SIM_PREFIX, simIdFromPathname, simKey } from './_lib/blob.js';
import { toNodeHandler } from './_lib/node-adapter.js';
import { deleteBlob, listBlobs, putBlob, streamBlob } from './_lib/storage.js';

const VALID_TAGS = new Set(['optimista', 'moderado', 'conservador', 'crisis', 'planA', 'neutral']);

interface SavedSimRow {
  id: string;
  name: string;
  group: string;
  type: 'income' | 'expense';
}

interface PersistedSimItem {
  account: string;
  name: string;
  type: 'income' | 'expense';
  group: string;
  values: number[];
}

interface PersistedSimSnapshot {
  months: string[];
  items: PersistedSimItem[];
}

interface SavedSim {
  id: string;
  name: string;
  hypothesis: string;
  description: string;
  tag: string;
  createdAt: number;
  savedAtYear: number;
  savedAtMonthIdx: number;
  predicted: PersistedSimSnapshot;
  overrideKeys: Record<string, number[]>;
  simRows: SavedSimRow[];
}

interface SaveBody {
  name?: unknown;
  hypothesis?: unknown;
  description?: unknown;
  tag?: unknown;
  savedAtYear?: unknown;
  savedAtMonthIdx?: unknown;
  predicted?: unknown;
  overrideKeys?: unknown;
  simRows?: unknown;
}

interface PatchBody {
  name?: unknown;
  hypothesis?: unknown;
  description?: unknown;
  tag?: unknown;
}

function asString(v: unknown, max = 4096): string {
  if (typeof v !== 'string') return '';
  return v.length > max ? v.slice(0, max) : v;
}

function newSimId(): string {
  return `sim_${randomBytes(8).toString('hex')}`;
}

function sanitizeValues(raw: unknown): number[] {
  const out = new Array<number>(12).fill(0);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < 12; i++) {
    const v = raw[i];
    if (typeof v === 'number' && Number.isFinite(v)) out[i] = v;
  }
  return out;
}

function sanitizePredicted(raw: unknown): PersistedSimSnapshot {
  if (!raw || typeof raw !== 'object') return { months: [], items: [] };
  const obj = raw as Record<string, unknown>;
  const months: string[] = Array.isArray(obj.months)
    ? (obj.months as unknown[]).slice(0, 12).map((m) => (typeof m === 'string' ? m.slice(0, 16) : ''))
    : [];
  const itemsRaw = Array.isArray(obj.items) ? (obj.items as unknown[]) : [];
  const items: PersistedSimItem[] = [];
  for (const r of itemsRaw) {
    if (!r || typeof r !== 'object') continue;
    const it = r as Record<string, unknown>;
    if (typeof it.account !== 'string') continue;
    const type = it.type === 'income' || it.type === 'expense' ? it.type : 'expense';
    items.push({
      account: it.account.slice(0, 64),
      name: typeof it.name === 'string' ? it.name.slice(0, 200) : '',
      type,
      group: typeof it.group === 'string' ? it.group.slice(0, 80) : '',
      values: sanitizeValues(it.values),
    });
  }
  return { months, items };
}

function sanitizeOverrideKeys(raw: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [account, monthsRaw] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(monthsRaw)) continue;
    const cur = new Set<number>();
    for (const m of monthsRaw) {
      const idx = typeof m === 'number' ? m : Number.parseInt(String(m), 10);
      if (Number.isInteger(idx) && idx >= 0 && idx <= 11) cur.add(idx);
    }
    if (cur.size > 0) {
      out[String(account).slice(0, 64)] = Array.from(cur).sort((a, b) => a - b);
    }
  }
  return out;
}

function sanitizeSimRows(raw: unknown): SavedSimRow[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedSimRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue;
    if (typeof r.group !== 'string') continue;
    if (r.type !== 'income' && r.type !== 'expense') continue;
    out.push({
      id: r.id.slice(0, 64),
      name: r.name.slice(0, 200),
      group: r.group.slice(0, 80),
      type: r.type,
    });
  }
  return out;
}

async function fetchSim(id: string): Promise<SavedSim | null> {
  const res = await streamBlob(simKey(id));
  if (!res) return null;
  try {
    return (await res.json()) as SavedSim;
  } catch {
    return null;
  }
}

async function listSims(): Promise<SavedSim[]> {
  const blobs = await listBlobs(SIM_PREFIX);
  const ids: string[] = [];
  for (const b of blobs) {
    const id = simIdFromPathname(b.pathname);
    if (id) ids.push(id);
  }
  const sims = await Promise.all(ids.map((id) => fetchSim(id)));
  return sims.filter((s): s is SavedSim => s != null).sort((a, b) => b.createdAt - a.createdAt);
}

async function handleGet(): Promise<Response> {
  const sims = await listSims();
  return Response.json({ sims }, { headers: { 'cache-control': 'no-store' } });
}

async function handlePost(req: Request): Promise<Response> {
  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const name = asString(body.name, 200).trim();
  if (!name) return new Response('Missing "name"', { status: 400 });

  const tagRaw = asString(body.tag, 32);
  const tag = VALID_TAGS.has(tagRaw) ? tagRaw : 'neutral';

  const yearN = Number(body.savedAtYear);
  const monthIdxN = Number(body.savedAtMonthIdx);
  const now = new Date();
  const savedAtYear =
    Number.isInteger(yearN) && yearN >= 1900 && yearN <= 9999 ? yearN : now.getUTCFullYear();
  const savedAtMonthIdx =
    Number.isInteger(monthIdxN) && monthIdxN >= 0 && monthIdxN <= 11
      ? monthIdxN
      : now.getUTCMonth();

  const sim: SavedSim = {
    id: newSimId(),
    name,
    hypothesis: asString(body.hypothesis, 1000).trim(),
    description: asString(body.description, 4000).trim(),
    tag,
    createdAt: Date.now(),
    savedAtYear,
    savedAtMonthIdx,
    predicted: sanitizePredicted(body.predicted),
    overrideKeys: sanitizeOverrideKeys(body.overrideKeys),
    simRows: sanitizeSimRows(body.simRows),
  };

  await putBlob(simKey(sim.id), JSON.stringify(sim), 'application/json');
  return Response.json({ sim }, { status: 201 });
}

async function handleDelete(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') ?? '';
  if (!isValidSimId(id)) return new Response('Invalid id', { status: 400 });
  await deleteBlob(simKey(id));
  return Response.json({ ok: true });
}

async function handlePatch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') ?? '';
  if (!isValidSimId(id)) return new Response('Invalid id', { status: 400 });
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const existing = await fetchSim(id);
  if (!existing) return new Response('Not found', { status: 404 });

  const next: SavedSim = { ...existing };
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim();
    if (trimmed) next.name = trimmed.slice(0, 200);
  }
  if (typeof body.hypothesis === 'string') {
    next.hypothesis = body.hypothesis.slice(0, 1000).trim();
  }
  if (typeof body.description === 'string') {
    next.description = body.description.slice(0, 4000).trim();
  }
  if (typeof body.tag === 'string' && VALID_TAGS.has(body.tag)) {
    next.tag = body.tag;
  }
  await putBlob(simKey(id), JSON.stringify(next), 'application/json');
  return Response.json({ sim: next });
}

/**
 * /api/simulations — CRUD for saved scenarios.
 *   GET                 → list all sims (most recent first).
 *   POST                → create from JSON body { name, hypothesis, description, tag,
 *                         savedAtYear, savedAtMonthIdx, predicted, overrideKeys, simRows }.
 *   DELETE  ?id=sim_… → remove one.
 *   PATCH   ?id=sim_… → rename (body { name?, hypothesis?, description?, tag? }).
 *
 * Each sim is stored as `data/simulations/<id>.json` via the same blob shim
 * used by uploads. Auth is required for every method.
 */
async function handle(req: Request): Promise<Response> {
  const auth = checkAuth(req);
  if (auth instanceof Response) return auth;

  switch (req.method) {
    case 'GET':
      return handleGet();
    case 'POST':
      return handlePost(req);
    case 'DELETE':
      return handleDelete(req);
    case 'PATCH':
      return handlePatch(req);
    default:
      return new Response('Method not allowed', { status: 405 });
  }
}

export default toNodeHandler(handle);
