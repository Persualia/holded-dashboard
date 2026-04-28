import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

interface TokenPayload {
  u: string;
  exp: number;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET env var not configured');
  return secret;
}

export function signToken(username: string, ttlSeconds = TOKEN_TTL_SECONDS): string {
  const payload: TokenPayload = {
    u: username,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = createHmac('sha256', getSecret()).update(body).digest();
  let provided: Buffer;
  try {
    provided = b64urlDecode(sig);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8')) as TokenPayload;
  } catch {
    return null;
  }
  if (typeof payload.u !== 'string' || typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload.u;
}

/** Reads the bearer token from the Authorization header, verifies it. */
export function checkAuth(req: Request): { user: string } | Response {
  if (!process.env.AUTH_SECRET) {
    return new Response('AUTH_SECRET env var not configured', { status: 500 });
  }
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const user = verifyToken(match?.[1]);
  if (!user) return new Response('Unauthorized', { status: 401 });
  return { user };
}
