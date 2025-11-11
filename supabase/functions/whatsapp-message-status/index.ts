import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'received'
  | 'read'
  | 'read_by_me'
  | 'played'
  | 'failed';

type SupabaseTypedClient = SupabaseClient<any, any, any>;

type StatusEvent = {
  ids?: unknown;
  status?: unknown;
  momment?: unknown;
  timestamp?: unknown;
  statusMomment?: unknown;
};

type StatusUpdateResult = {
  status: DeliveryStatus | 'ignored' | 'missing_status';
  updated: string[];
  skipped: { id: string; reason: string }[];
};

const DELIVERY_STATUS_PRECEDENCE: Record<DeliveryStatus, number> = {
  pending: 0,
  sent: 1,
  received: 2,
  read: 3,
  played: 4,
  read_by_me: 1,
  failed: 5,
};

const respond = (body: Record<string, unknown>, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeDeliveryStatus = (value: unknown): DeliveryStatus | null => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    switch (normalized.replace(/\s+/g, '_')) {
      case 'pending':
      case 'waiting':
      case 'sending':
        return 'pending';
      case 'sent':
        return 'sent';
      case 'delivered':
      case 'delivery':
      case 'received':
        return 'received';
      case 'read':
      case 'seen':
      case 'viewed':
        return 'read';
      case 'played':
        return 'played';
      case 'read_by_me':
        return 'read_by_me';
      case 'failed':
      case 'error':
        return 'failed';
      default:
        return null;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    if (normalized <= -1) {
      return 'failed';
    }

    switch (normalized) {
      case 0:
        return 'pending';
      case 1:
        return 'sent';
      case 2:
        return 'received';
      case 3:
        return 'read';
      case 4:
        return 'played';
      default:
        return null;
    }
  }

  return null;
};

const normalizeStatusTimestamp = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    const millis = normalized > 1_000_000_000_000 ? normalized : normalized * 1000;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
};

const toMillis = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getTime();
};

const extractMessageIds = (candidate: unknown): string[] => {
  if (!candidate) {
    return [];
  }

  if (Array.isArray(candidate)) {
    return candidate
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
};

const buildSupabaseClient = (): SupabaseTypedClient | null => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Variáveis de ambiente do Supabase ausentes');
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
};

const shouldUpdateStatus = (
  existingStatus: DeliveryStatus | null,
  newStatus: DeliveryStatus,
  existingUpdatedAt: string | null | undefined,
  newUpdatedAt: string,
): boolean => {
  const existingMillis = toMillis(existingUpdatedAt ?? null);
  const newMillis = toMillis(newUpdatedAt);

  const isNewer = existingMillis === null || (newMillis ?? 0) >= existingMillis;

  if (!isNewer) {
    return false;
  }

  if (!existingStatus) {
    return true;
  }

  if (newStatus === existingStatus) {
    return isNewer;
  }

  return (
    DELIVERY_STATUS_PRECEDENCE[newStatus] >= DELIVERY_STATUS_PRECEDENCE[existingStatus] ||
    newStatus === 'failed'
  );
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respond({ success: false, error: 'Método não permitido' }, { status: 405 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (error) {
    console.error('Erro ao ler payload do webhook de status:', error);
    return respond({ success: false, error: 'Payload inválido' }, { status: 400 });
  }

  const events = Array.isArray(payload) ? (payload as StatusEvent[]) : [payload as StatusEvent];
  const supabase = buildSupabaseClient();

  if (!supabase) {
    return respond({ success: false, error: 'Configuração do Supabase ausente' }, { status: 500 });
  }

  const preparedEvents = events.map((event) => {
    const messageIds = extractMessageIds(event.ids);
    const status = normalizeDeliveryStatus(event.status);
    const timestamp =
      normalizeStatusTimestamp(event.momment) ||
      normalizeStatusTimestamp(event.statusMomment) ||
      normalizeStatusTimestamp(event.timestamp) ||
      new Date().toISOString();

    return { messageIds, status, timestamp };
  });

  const allMessageIds = new Set<string>();
  preparedEvents.forEach(({ messageIds }) => {
    messageIds.forEach((id) => allMessageIds.add(id));
  });

  const uniqueIds = Array.from(allMessageIds);

  let existingRows: { message_id: string; delivery_status: string | null; delivery_status_updated_at: string | null; read_status: boolean }[] = [];

  if (uniqueIds.length > 0) {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('message_id, delivery_status, delivery_status_updated_at, read_status')
      .in('message_id', uniqueIds);

    if (error) {
      console.error('Erro ao consultar mensagens para atualização de status:', error);
      return respond({ success: false, error: 'Erro ao consultar mensagens' }, { status: 500 });
    }

    existingRows = data ?? [];
  }

  const existingMap = new Map(existingRows.map((row) => [row.message_id, row]));

  let processedCount = 0;
  let skippedCount = 0;
  const results: StatusUpdateResult[] = [];

  for (const event of preparedEvents) {
    const { messageIds, status, timestamp } = event;
    const result: StatusUpdateResult = {
      status: status ?? 'missing_status',
      updated: [],
      skipped: [],
    };

    if (!status || messageIds.length === 0) {
      messageIds.forEach((id) => {
        result.skipped.push({ id, reason: status ? 'not_found' : 'status_missing' });
        skippedCount += 1;
      });
      if (messageIds.length === 0) {
        skippedCount += 1;
      }
      results.push(result);
      continue;
    }

    const idsToUpdate: string[] = [];

    for (const rawId of messageIds) {
      const id = rawId.trim();
      const existing = existingMap.get(id);

      if (!existing) {
        result.skipped.push({ id, reason: 'not_found' });
        skippedCount += 1;
        continue;
      }

      const existingStatus = normalizeDeliveryStatus(existing.delivery_status);
      const shouldUpdate = shouldUpdateStatus(existingStatus, status, existing.delivery_status_updated_at, timestamp);

      if (!shouldUpdate) {
        result.skipped.push({ id, reason: 'stale_or_lower_precedence' });
        skippedCount += 1;
        continue;
      }

      idsToUpdate.push(id);
    }

    if (idsToUpdate.length > 0) {
      const updatePayload: Record<string, unknown> = {
        delivery_status: status,
        delivery_status_updated_at: timestamp,
      };

      if (status === 'read' || status === 'played') {
        updatePayload.read_status = true;
      }

      const { error } = await supabase
        .from('whatsapp_conversations')
        .update(updatePayload)
        .in('message_id', idsToUpdate);

      if (error) {
        console.error('Erro ao atualizar status das mensagens:', error);
        idsToUpdate.forEach((id) => {
          result.skipped.push({ id, reason: error.message || 'update_failed' });
          skippedCount += 1;
        });
      } else {
        result.updated = idsToUpdate;
        processedCount += idsToUpdate.length;
      }
    }

    results.push(result);
  }

  return respond({ success: true, processed: processedCount, skipped: skippedCount, results });
});
