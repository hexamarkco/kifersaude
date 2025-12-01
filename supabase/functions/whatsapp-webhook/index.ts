import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key, X-Webhook-Event',
};

type StoredEvent = {
  event: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
};

function respond(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function extractEventName(payload: any, headers: Headers, url: URL): string {
  const headerEvent = headers.get('x-webhook-event') || headers.get('x-whatsapp-event');
  if (headerEvent && headerEvent.trim()) {
    return headerEvent.trim();
  }

  const queryEvent = url.searchParams.get('event');
  if (queryEvent && queryEvent.trim()) {
    return queryEvent.trim();
  }

  const bodyEvent =
    (typeof payload?.event === 'string' && payload.event) ||
    (typeof payload?.type === 'string' && payload.type) ||
    (typeof payload?.status === 'string' && payload.status);

  if (bodyEvent && bodyEvent.trim()) {
    return bodyEvent.trim();
  }

  return 'unknown';
}

function extractHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

async function storeEvent(event: StoredEvent) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.from('whatsapp_webhook_events').insert(event);

  if (error) {
    throw new Error(`Erro ao salvar evento: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 });
  }

  let payload: Record<string, unknown> = {};

  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = normalizeJson(await req.json());
    } else {
      const text = await req.text();
      try {
        payload = normalizeJson(JSON.parse(text));
      } catch (_err) {
        payload = { raw: text };
      }
    }
  } catch (error) {
    console.error('whatsapp-webhook: erro ao ler payload', error);
    return respond({ error: 'Payload inválido' }, { status: 400 });
  }

  const headers = extractHeaders(req.headers);
  const eventName = extractEventName(payload, req.headers, url);

  try {
    await storeEvent({ event: eventName, payload, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('whatsapp-webhook: erro ao salvar evento', message, { eventName, payload });
    return respond({ error: message }, { status: 500 });
  }

  return respond({ success: true, event: eventName });
});
