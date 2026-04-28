import { checkAuth } from './_lib/auth.js';
import { toNodeHandler } from './_lib/node-adapter.js';

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  const auth = checkAuth(req);
  if (auth instanceof Response) return auth;
  return Response.json({ user: auth.user });
}

/**
 * GET /api/me — verifies the Bearer token and returns the user, or 401.
 * The frontend calls this on boot to revalidate a stored token.
 */
export default toNodeHandler(handle);
