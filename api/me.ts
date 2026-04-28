import { checkAuth } from './_lib/auth';

export const config = { runtime: 'nodejs' };

/**
 * GET /api/me — verifies the Bearer token and returns the user, or 401.
 * The frontend calls this on boot to revalidate a stored token.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  const auth = checkAuth(req);
  if (auth instanceof Response) return auth;
  return Response.json({ user: auth.user });
}
