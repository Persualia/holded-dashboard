import { timingSafeEqual } from 'node:crypto';
import { signToken } from './_lib/auth';

export const config = { runtime: 'nodejs' };

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * POST /api/login — body { username, password }. On success returns { token }.
 * Credentials are checked against LOGIN/PASSWORD env vars; the token is an
 * HMAC-signed payload with a 30-day expiry (see api/_lib/auth.ts).
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expectedUser = process.env.LOGIN;
  const expectedPass = process.env.PASSWORD;
  if (!expectedUser || !expectedPass) {
    return new Response('LOGIN/PASSWORD env vars not configured', { status: 500 });
  }
  if (!process.env.AUTH_SECRET) {
    return new Response('AUTH_SECRET env var not configured', { status: 500 });
  }

  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const userOk = safeEqualString(username, expectedUser);
  const passOk = safeEqualString(password, expectedPass);
  if (!userOk || !passOk) {
    return new Response('Invalid credentials', { status: 401 });
  }

  return Response.json({ token: signToken(expectedUser), user: expectedUser });
}
