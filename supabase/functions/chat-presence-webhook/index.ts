import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

type NormalizedPresence = 'online' | 'offline' | 'unknown';
type NormalizedEventKind = 'presence' | 'typing-start' | 'typing-stop';

type NormalizedEvent = {
  events: string[];
  kind: NormalizedEventKind;
  payload: Record<string, unknown>;
  phone: string;
};

function respond(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function pickFirstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

function normalizePhone(payload: any): string | null {
  return pickFirstString(
    payload?.phone,
    payload?.phoneNumber,
    payload?.chatPhone,
    payload?.chatId,
    payload?.jid,
    payload?.remoteJid,
    payload?.conversationId,
    payload?.participant,
    payload?.senderPhone,
    payload?.sender?.phone,
    payload?.contact?.phone,
    payload?.to,
    payload?.from
  );
}

function parseTimestamp(value: unknown): { epoch: number | null; iso: string | null } {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const numeric = Math.trunc(value);
    if (numeric <= 0) {
      return { epoch: null, iso: null };
    }
    const epoch = numeric >= 1e12 || numeric >= 1e10 ? numeric : numeric * 1000;
    try {
      return { epoch, iso: new Date(epoch).toISOString() };
    } catch (_error) {
      return { epoch, iso: null };
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const epoch = value.getTime();
    return { epoch, iso: value.toISOString() };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return { epoch: null, iso: null };
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return parseTimestamp(numeric);
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return { epoch: parsed, iso: new Date(parsed).toISOString() };
    }
  }

  return { epoch: null, iso: null };
}

function mapPresenceStatus(status: string | null): NormalizedPresence | undefined {
  if (!status) {
    return undefined;
  }

  const normalized = status.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  if (['AVAILABLE', 'ONLINE', 'CONNECTED', 'ACTIVE', 'COMPOSING', 'RECORDING', 'PAUSED'].includes(normalized)) {
    return 'online';
  }

  if (['UNAVAILABLE', 'OFFLINE', 'INACTIVE', 'DISCONNECTED'].includes(normalized)) {
    return 'offline';
  }

  if (normalized === 'UNKNOWN') {
    return 'unknown';
  }

  return undefined;
}

function normalizePresenceEvent(raw: any): NormalizedEvent | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const phone = normalizePhone(raw);
  if (!phone) {
    return null;
  }

  const rawStatus = pickFirstString(raw?.status, raw?.presence, raw?.state, raw?.connectionState);
  const statusUpper = rawStatus ? rawStatus.toUpperCase() : 'UNKNOWN';
  const instanceId = pickFirstString(raw?.instanceId, raw?.instance?.id, raw?.instance?.instanceId);
  const { epoch: lastSeenEpoch, iso: lastSeenIso } = parseTimestamp(raw?.lastSeen ?? raw?.last_seen);
  const now = Date.now();
  const presence = mapPresenceStatus(statusUpper);

  let kind: NormalizedEventKind = 'presence';
  let eventName = 'presence:update';
  let isTyping: boolean | undefined;
  let activity: string | undefined;

  switch (statusUpper) {
    case 'COMPOSING':
      kind = 'typing-start';
      eventName = 'typing:start';
      isTyping = true;
      break;
    case 'RECORDING':
      kind = 'typing-start';
      eventName = 'typing:start';
      isTyping = true;
      activity = 'recording';
      break;
    case 'PAUSED':
      kind = 'typing-stop';
      eventName = 'typing:stop';
      isTyping = false;
      break;
    default:
      kind = 'presence';
      eventName = 'presence:update';
      break;
  }

  const payload: Record<string, unknown> = {
    type: pickFirstString(raw?.type) ?? 'PresenceChatCallback',
    phone,
    chatId: pickFirstString(raw?.chatId, raw?.jid, raw?.remoteJid) ?? phone,
    status: statusUpper,
    instanceId: instanceId ?? null,
    timestamp: now,
    timestampIso: new Date(now).toISOString(),
    kind,
    source: 'chat-presence-webhook',
    rawStatus: rawStatus ?? null,
  };

  if (lastSeenEpoch !== null) {
    payload.lastSeen = lastSeenEpoch;
  }
  if (lastSeenIso) {
    payload.lastSeenIso = lastSeenIso;
  }
  if (presence) {
    payload.presence = presence;
  } else if (kind === 'presence') {
    payload.presence = 'unknown';
  }
  if (typeof isTyping === 'boolean') {
    payload.isTyping = isTyping;
  }
  if (activity) {
    payload.activity = activity;
  }

  return {
    events: eventName === 'zapi:typing-presence' ? [eventName] : [eventName, 'zapi:typing-presence'],
    kind,
    payload,
    phone,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'GET' && path.endsWith('/health')) {
    return respond({ status: 'ok', timestamp: new Date().toISOString(), service: 'chat-presence-webhook' });
  }

  if (req.method !== 'POST') {
    return respond({ success: false, error: 'Método não permitido' }, { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (error) {
    console.error('Erro ao ler payload de presença:', error);
    return respond({ success: false, error: 'Payload inválido' }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Variáveis de ambiente do Supabase ausentes');
    return respond({ success: false, error: 'Configuração do Supabase ausente' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const channel = supabase.channel('zapi-typing-presence', { config: { broadcast: { self: false } } });

  try {
    await channel.subscribe();
  } catch (error) {
    console.error('Falha ao assinar canal de presença:', error);
    return respond({ success: false, error: 'Não foi possível conectar ao canal de presença' }, { status: 500 });
  }

  const events = Array.isArray(payload) ? payload : [payload];
  const results: Array<{ phone: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }> = [];

  try {
    for (const event of events) {
      const normalized = normalizePresenceEvent(event);

      if (!normalized) {
        results.push({ phone: 'unknown', status: 'skipped', reason: 'Evento inválido' });
        continue;
      }

      let success = true;

      for (const eventName of normalized.events) {
        try {
          const sendStatus = await channel.send({
            type: 'broadcast',
            event: eventName,
            payload: normalized.payload,
          });

          if (sendStatus !== 'ok') {
            success = false;
            results.push({
              phone: normalized.phone,
              status: 'failed',
              reason: `Falha ao enviar evento ${eventName}: ${sendStatus}`,
            });
          }
        } catch (error) {
          success = false;
          results.push({
            phone: normalized.phone,
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Erro desconhecido ao enviar evento',
          });
        }
      }

      if (success) {
        results.push({ phone: normalized.phone, status: 'sent' });
      }
    }
  } finally {
    await channel.unsubscribe();
  }

  const processed = results.filter((result) => result.status === 'sent').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;

  return respond({ success: failed === 0, processed, failed, skipped, results });
});
