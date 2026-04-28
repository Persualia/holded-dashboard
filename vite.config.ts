import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Mounts `api/*.ts` Vercel functions on the Vite dev server.
 *
 * Each api file exports a Node-style `(req, res)` handler (see
 * `api/_lib/node-adapter.ts`), so we just delegate — no shimming needed.
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
        let handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
        try {
          const mod = await server.ssrLoadModule(modulePath);
          handler = mod.default;
          if (typeof handler !== 'function') throw new Error('default export is not a function');
        } catch (e) {
          res.statusCode = 500;
          res.end(`api dev middleware: failed to load ${route}: ${(e as Error).message}`);
          return;
        }

        await handler(req, res);
      });
    },
  };
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
