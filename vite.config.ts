import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Adapts Web-fetch–style handlers in `api/*.ts` to the Vite dev server.
 *
 * In production these files run as Vercel serverless functions; in dev we want
 * `pnpm dev` to behave the same way without `vercel dev`. The middleware
 * matches `/api/<route>` to `api/<route>.ts`, converts the Node req/res pair
 * to a Web `Request`/`Response`, and delegates to the handler.
 */
function vercelApiDevPlugin(): Plugin {
  return {
    name: 'vercel-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        const pathname = req.url.split('?')[0];
        const route = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
        if (!route || route.startsWith('_')) return next();

        const modulePath = path.resolve(__dirname, 'api', `${route}.ts`);
        let handler: (req: Request) => Promise<Response>;
        try {
          const mod = await server.ssrLoadModule(modulePath);
          handler = mod.default;
          if (typeof handler !== 'function') throw new Error('default export is not a function');
        } catch (e) {
          res.statusCode = 500;
          res.end(`api dev middleware: failed to load ${route}: ${(e as Error).message}`);
          return;
        }

        try {
          const webReq = await toWebRequest(req);
          const webRes = await handler(webReq);
          res.statusCode = webRes.status;
          webRes.headers.forEach((v, k) => res.setHeader(k, v));
          if (webRes.body) {
            const buf = Buffer.from(await webRes.arrayBuffer());
            res.end(buf);
          } else {
            res.end();
          }
        } catch (e) {
          res.statusCode = 500;
          res.end(`api dev middleware: handler threw: ${(e as Error).stack ?? (e as Error).message}`);
        }
      });
    },
  };
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? 'localhost';
  const url = `http://${host}${req.url ?? '/'}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (Array.isArray(v)) headers.set(k, v.join(','));
    else headers.set(k, String(v));
  }

  let body: BodyInit | undefined;
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = Buffer.concat(chunks);
  }

  return new Request(url, { method, headers, body });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['BLOB_READ_WRITE_TOKEN', 'LOGIN', 'PASSWORD', 'AUTH_SECRET']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [react(), vercelApiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
