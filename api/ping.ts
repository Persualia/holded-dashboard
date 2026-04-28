import { toNodeHandler } from './_lib/node-adapter.js';

export default toNodeHandler(async () => {
  return Response.json({ ok: true, ts: Date.now() });
});
