import { MetaError, parseNotifications, verifySignature, type MetaConfig, type Receipt } from '../_shared/meta-ads/domain.ts';

type Dependencies = {
  config: () => Promise<MetaConfig>; secret: string; verifyToken: string;
  enqueue: (receipts: Receipt[]) => Promise<void>;
};
export function createWebhookHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    if (req.method === 'GET') {
      const challenge = url.searchParams.get('hub.challenge');
      if (deps.verifyToken && challenge && challenge.length <= 256 &&
        url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === deps.verifyToken) {
        return new Response(challenge, { headers: { 'Content-Type': 'text/plain' } });
      }
      return new Response('Forbidden', { status: 403 });
    }
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!deps.secret) return new Response('Not configured', { status: 503 });
    // Bound the stream before materializing it, even when content-length is absent.
    const reader = req.body?.getReader();
    if (!reader) return new Response('Invalid body', { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 262144) { await reader.cancel(); return new Response('Too large', { status: 413 }); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (!await verifySignature(bytes, req.headers.get('x-hub-signature-256'), deps.secret)) {
      return new Response('Forbidden', { status: 403 });
    }
    try {
      const config = await deps.config();
      if (!config.enabled) return new Response('Paused', { status: 503 });
      const receipts = parseNotifications(JSON.parse(new TextDecoder().decode(bytes)), config);
      if (receipts.length) await deps.enqueue(receipts);
      // Acknowledge only after the durable transaction; Graph retrieval happens in the worker.
      return Response.json({ received: receipts.length });
    } catch (error) {
      const invalid = error instanceof MetaError || error instanceof SyntaxError;
      return new Response(invalid ? 'Invalid notification' : 'Try again', { status: invalid ? 400 : 503 });
    }
  };
}
