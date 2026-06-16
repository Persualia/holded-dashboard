import { randomBytes } from 'node:crypto';
import { checkAuth, isAdminUser } from './_lib/auth.js';
import { bonusKey } from './_lib/blob.js';
import { toNodeHandler } from './_lib/node-adapter.js';
import { putBlob, streamBlob } from './_lib/storage.js';

interface BonusWorker {
  id: string;
  name: string;
  weightPct: number;
  lockedTotal?: number;
}

interface BonusConfig {
  taxRatePct: number;
  minNetProfit: number;
  distributePct: number;
  maxDistribute: number;
  lockTotals: boolean;
  workers: BonusWorker[];
  updatedAt?: number;
}

const DEFAULT_CONFIG: BonusConfig = {
  taxRatePct: 23,
  minNetProfit: 0,
  distributePct: 0,
  maxDistribute: 0,
  lockTotals: false,
  workers: [],
};

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function newWorkerId(): string {
  return `w_${randomBytes(6).toString('hex')}`;
}

function sanitizeWorkers(raw: unknown): BonusWorker[] {
  if (!Array.isArray(raw)) return [];
  const out: BonusWorker[] = [];
  for (const r of raw.slice(0, 200)) {
    if (!r || typeof r !== 'object') continue;
    const w = r as Record<string, unknown>;
    out.push({
      id: typeof w.id === 'string' && w.id ? w.id.slice(0, 64) : newWorkerId(),
      name: typeof w.name === 'string' ? w.name.slice(0, 120) : '',
      weightPct: num(w.weightPct, 0),
      lockedTotal: typeof w.lockedTotal === 'number' && Number.isFinite(w.lockedTotal)
        ? w.lockedTotal
        : undefined,
    });
  }
  return out;
}

function sanitizeConfig(raw: unknown): BonusConfig {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    taxRatePct: num(obj.taxRatePct, DEFAULT_CONFIG.taxRatePct),
    minNetProfit: num(obj.minNetProfit, 0),
    distributePct: num(obj.distributePct, 0),
    maxDistribute: num(obj.maxDistribute, 0),
    lockTotals: obj.lockTotals === true,
    workers: sanitizeWorkers(obj.workers),
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : undefined,
  };
}

async function readConfig(): Promise<BonusConfig> {
  const res = await streamBlob(bonusKey());
  if (!res) return DEFAULT_CONFIG;
  try {
    return sanitizeConfig(await res.json());
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * /api/bonus — admin-only persistence of the bonus configuration.
 *   GET → current config (defaults if none saved yet).
 *   PUT → validate body and persist; returns the saved config.
 * Stored as the single global blob `data/bonus.json`.
 */
async function handle(req: Request): Promise<Response> {
  const auth = checkAuth(req);
  if (auth instanceof Response) return auth;
  if (!isAdminUser(auth.user)) return new Response('Forbidden', { status: 403 });

  if (req.method === 'GET') {
    const config = await readConfig();
    return Response.json({ config }, { headers: { 'cache-control': 'no-store' } });
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    const config = sanitizeConfig(body);
    config.updatedAt = Date.now();
    await putBlob(bonusKey(), JSON.stringify(config), 'application/json');
    return Response.json({ config });
  }

  return new Response('Method not allowed', { status: 405 });
}

export default toNodeHandler(handle);
