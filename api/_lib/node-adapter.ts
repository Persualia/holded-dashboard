import type { IncomingMessage, ServerResponse } from 'node:http';

export type WebHandler = (req: Request) => Promise<Response>;

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? 'localhost';
  const proto =
    (Array.isArray(req.headers['x-forwarded-proto'])
      ? req.headers['x-forwarded-proto'][0]
      : req.headers['x-forwarded-proto']) ?? 'https';
  const url = `${proto}://${host}${req.url ?? '/'}`;

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

async function sendWebResponse(res: ServerResponse, webRes: Response): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((v, k) => {
    res.setHeader(k, v);
  });
  if (webRes.body) {
    const buf = Buffer.from(await webRes.arrayBuffer());
    res.end(buf);
  } else {
    res.end();
  }
}

/**
 * Wraps a Web-Fetch–style handler so it can be exported as a Vercel Node
 * Function. Vercel's Node runtime always invokes the default export with
 * `(req: IncomingMessage, res: ServerResponse)` — it does not auto-detect the
 * Web Fetch signature — so handlers that want to use `Request`/`Response` must
 * adapt at the boundary.
 */
export function toNodeHandler(handle: WebHandler) {
  return async function nodeHandler(req: IncomingMessage, res: ServerResponse) {
    try {
      const webReq = await toWebRequest(req);
      const webRes = await handle(webReq);
      await sendWebResponse(res, webRes);
    } catch (e) {
      const err = e as Error;
      const msg = `handler crashed: ${err?.message ?? e}\n${err?.stack ?? ''}`;
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(msg);
    }
  };
}
