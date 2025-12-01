import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

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

type NormalizedMessage = {
  id: string;
  chatId: string;
  chatName: string | null;
  chatIsGroup: boolean;
  from: string | null;
  to: string | null;
  type: string | null;
  body: string | null;
  hasMedia: boolean;
  timestamp: Date;
  payload: Record<string, unknown>;
};

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

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

async function storeEvent(event: StoredEvent, supabase: SupabaseClient) {
  const { error } = await supabase.from('whatsapp_webhook_events').insert(event);

  if (error) {
    throw new Error(`Erro ao salvar evento: ${error.message}`);
  }
}

function parseTimestamp(value: unknown): Date {
  if (typeof value === 'number') {
    const isMs = value > 1e12;
    return new Date(isMs ? value : value * 1000);
  }

  const numeric = typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isNaN(numeric)) {
    const isMs = numeric > 1e12;
    return new Date(isMs ? numeric : numeric * 1000);
  }

  return new Date();
}

function normalizeMessagePayload(payload: Record<string, unknown>, eventName: string): NormalizedMessage | null {
  const rawChat = (payload as { chat?: Record<string, unknown> }).chat;
  const chatId = String(
    (rawChat as { id?: unknown })?.id ||
      (payload as { chat_id?: unknown }).chat_id ||
      (payload as { chatId?: unknown }).chatId ||
      '',
  );

  const id = String((payload as { id?: unknown }).id || (payload as { message_id?: unknown }).message_id || '');

  if (!id || !chatId) return null;

  const timestamp = parseTimestamp((payload as { timestamp?: unknown }).timestamp ?? Date.now());

  return {
    id,
    chatId,
    chatName:
      typeof rawChat?.name === 'string'
        ? rawChat.name
        : typeof (payload as { chatName?: unknown }).chatName === 'string'
          ? (payload as { chatName?: string }).chatName
          : null,
    chatIsGroup: Boolean(
      (rawChat as { isGroup?: unknown })?.isGroup ||
        (rawChat as { is_group?: unknown })?.is_group ||
        (payload as { chatIsGroup?: unknown }).chatIsGroup,
    ),
    from: typeof (payload as { from?: unknown }).from === 'string' ? (payload as { from?: string }).from : null,
    to: typeof (payload as { to?: unknown }).to === 'string' ? (payload as { to?: string }).to : null,
    type:
      typeof (payload as { type?: unknown }).type === 'string'
        ? (payload as { type?: string }).type
        : (eventName || null),
    body:
      typeof (payload as { body?: unknown }).body === 'string'
        ? (payload as { body?: string }).body
        : typeof (payload as { message?: unknown }).message === 'string'
          ? (payload as { message?: string }).message
          : null,
    hasMedia: Boolean((payload as { hasMedia?: unknown }).hasMedia || (payload as { has_media?: unknown }).has_media),
    timestamp,
    payload,
  };
}

async function upsertChat(message: NormalizedMessage, supabase: SupabaseClient) {
  const { error } = await supabase.from('whatsapp_chats').upsert(
    {
      id: message.chatId,
      name: message.chatName,
      is_group: message.chatIsGroup,
      last_message_at: message.timestamp.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Erro ao salvar chat: ${error.message}`);
  }
}

async function upsertMessage(message: NormalizedMessage, supabase: SupabaseClient) {
  const { error } = await supabase.from('whatsapp_messages').upsert(
    {
      id: message.id,
      chat_id: message.chatId,
      from_number: message.from,
      to_number: message.to,
      type: message.type,
      body: message.body,
      has_media: message.hasMedia,
      timestamp: message.timestamp.toISOString(),
      payload: message.payload,
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Erro ao salvar mensagem: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  let supabase: SupabaseClient;

  try {
    supabase = getSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('whatsapp-webhook: erro ao iniciar Supabase', message);
    return respond({ error: message }, { status: 500 });
  }

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
    await storeEvent({ event: eventName, payload, headers }, supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('whatsapp-webhook: erro ao salvar evento', message, { eventName, payload });
    return respond({ error: message }, { status: 500 });
  }

  const messagePayload = normalizeMessagePayload(payload, eventName);

  if (messagePayload) {
    try {
      await upsertChat(messagePayload, supabase);
      await upsertMessage(messagePayload, supabase);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('whatsapp-webhook: erro ao salvar mensagem/chat', message, { eventName, payload });
      return respond({ error: message }, { status: 500 });
    }
  }

  return respond({ success: true, event: eventName, storedMessage: Boolean(messagePayload) });
});
