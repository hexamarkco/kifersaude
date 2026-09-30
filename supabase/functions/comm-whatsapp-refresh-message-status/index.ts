import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractWhapiMessageId,
  extractWhapiMessageStatus,
  fetchWhapiChatMessages,
  fetchWhapiMessage,
  fetchWhapiMessageStatuses,
  getNowIso,
  isInboxWhapiChatId,
  isWhapiGroupChatId,
  isRecord,
  normalizeWhapiChatId,
  resolveCommWhatsAppCanonicalChatRoute,
  sanitizeWhapiToken,
  stringTimestampToIso,
  toTrimmedString,
  unixTimestampToIso,
  updateCommWhatsAppMessageStatus,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type RefreshBody = {
  chatId?: string;
  externalMessageIds?: string[];
  limit?: number;
  source?: string;
};

type MessageRow = {
  id: string;
  chat_id: string;
  external_message_id: string;
  delivery_status: string;
  delivery_status_checked_at: string | null;
};

type ChatRow = {
  id: string;
  external_chat_id: string;
};

type RefreshedStatus = {
  id: string;
  external_message_id: string;
  previous_status: string;
  delivery_status: string;
  whapi_delivery_status: string;
  updated: boolean;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const REFRESHABLE_STATUSES = ['pending', 'queued', 'sending', 'sent', 'delivered'];
const normalizeStatus = (value: unknown) => toTrimmedString(value).toLowerCase();
const STATUS_RANKS: Record<string, number> = {
  pending: 0,
  queued: 0,
  sending: 0,
  sent: 1,
  received: 1,
  failed: 2,
  error: 2,
  delivered: 3,
  read: 4,
  seen: 4,
  viewed: 4,
  played: 5,
  deleted: 6,
};
const CRON_REFRESH_BATCH_LIMIT = 12;
const CRON_REFRESH_STALE_AFTER_MS = 5 * 60 * 1000;
const CRON_REFRESH_CONCURRENCY = 4;

const resolveHighestStatus = (statuses: Array<Record<string, unknown>>) => statuses.reduce<{
  status: string;
  rank: number;
  timestamp: number;
  statusUpdatedAt: string | null;
}>((best, item) => {
  const status = toTrimmedString(item.status);
  const rank = STATUS_RANKS[normalizeStatus(status)];
  if (!status || rank === undefined) return best;

  const rawTimestamp = item.timestamp;
  const statusUpdatedAt = unixTimestampToIso(rawTimestamp) ?? stringTimestampToIso(rawTimestamp);
  const timestampValue = statusUpdatedAt ? Date.parse(statusUpdatedAt) : Number.NaN;
  const timestamp = Number.isFinite(timestampValue) ? timestampValue : Number.NEGATIVE_INFINITY;
  if (rank > best.rank || (rank === best.rank && timestamp > best.timestamp)) {
    return { status, rank, timestamp, statusUpdatedAt };
  }

  return best;
}, { status: '', rank: -1, timestamp: Number.NEGATIVE_INFINITY, statusUpdatedAt: null });

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const normalizeExternalMessageIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(toTrimmedString).filter(Boolean))).slice(0, 20);
};

const getStatusTimestamp = (message: Record<string, unknown>) => {
  const candidates = [message.status_timestamp, message.timestamp, message.time];
  for (const candidate of candidates) {
    const unixTimestamp = unixTimestampToIso(candidate);
    if (unixTimestamp) return unixTimestamp;

    const stringTimestamp = stringTimestampToIso(candidate);
    if (stringTimestamp) return stringTimestamp;
  }

  return getNowIso();
};

async function loadRefreshableMessages(
  supabaseAdmin: SupabaseClient,
  params: {
    channelId: string;
    chatId?: string | null;
    externalMessageIds: string[];
    limit: number;
    staleBefore?: string | null;
    messageAtAfter?: string | null;
    statuses?: string[];
  },
) {
  let query = supabaseAdmin
    .from('comm_whatsapp_messages')
    .select('id,chat_id,external_message_id,delivery_status,delivery_status_checked_at')
    .eq('channel_id', params.channelId)
    .eq('direction', 'outbound')
    .not('external_message_id', 'is', null)
    .order(params.staleBefore ? 'delivery_status_checked_at' : 'message_at', {
      ascending: Boolean(params.staleBefore),
      nullsFirst: Boolean(params.staleBefore),
    })
    .limit(params.limit);

  if (params.chatId) {
    query = query.eq('chat_id', params.chatId);
  }

  if (params.externalMessageIds.length > 0) {
    query = query.in('external_message_id', params.externalMessageIds);
  } else {
    query = query.in('delivery_status', params.statuses ?? REFRESHABLE_STATUSES);
  }

  if (params.staleBefore) {
    query = query.or(`delivery_status_checked_at.is.null,delivery_status_checked_at.lt.${params.staleBefore}`);
  }
  if (params.messageAtAfter) {
    query = query.gte('message_at', params.messageAtAfter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao carregar mensagens para atualizar status: ${error.message}`);
  }

  return (data ?? []) as MessageRow[];
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      if (item !== undefined) await worker(item);
    }
  }));
}

async function loadMessageStatusById(
  supabaseAdmin: SupabaseClient,
  messageId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_messages')
    .select('delivery_status')
    .eq('id', messageId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar status persistido da mensagem: ${error.message}`);
  }

  return toTrimmedString(data?.delivery_status);
}

async function markMessageStatusChecked(
  supabaseAdmin: SupabaseClient,
  messageId: string,
  checkedAt: string,
) {
  const { error } = await supabaseAdmin
    .from('comm_whatsapp_messages')
    .update({ delivery_status_checked_at: checkedAt })
    .eq('id', messageId);

  if (error) {
    throw new Error(`Erro ao registrar consulta do status da mensagem: ${error.message}`);
  }
}

async function loadChatsById(
  supabaseAdmin: SupabaseClient,
  chatIds: string[],
) {
  if (chatIds.length === 0) {
    return new Map<string, ChatRow>();
  }

  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_chats')
    .select('id,external_chat_id')
    .in('id', Array.from(new Set(chatIds)));

  if (error) {
    throw new Error(`Erro ao carregar conversas das mensagens: ${error.message}`);
  }

  return new Map(((data ?? []) as ChatRow[]).map((chat) => [chat.id, chat]));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createAdminClient();
    const isServiceRequest = isServiceRoleRequest(req, serviceRoleKey);

    if (!isServiceRequest) {
      const authResult = await authorizeDashboardUser({
        req,
        supabaseUrl,
        supabaseAnonKey,
        supabaseAdmin,
        module: COMM_WHATSAPP_MODULE,
        requiredPermission: 'view',
      });

      if (!authResult.authorized) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.status,
          headers: jsonHeaders,
        });
      }
    }

    const body = (await req.json().catch(() => ({}))) as RefreshBody;
    if (body.source === 'cron' && !isServiceRequest) {
      return new Response(JSON.stringify({ error: 'Origem nao autorizada para reconciliacao global.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }
    const isCronRefresh = isServiceRequest && body.source === 'cron';
    const externalMessageIds = normalizeExternalMessageIds(body.externalMessageIds);
    const externalChatId = normalizeWhapiChatId(body.chatId);
    const requestedLimit = Math.max(1, Math.min(20, Math.floor(Number(body.limit) || 10)));
    const limit = isCronRefresh ? Math.min(CRON_REFRESH_BATCH_LIMIT, requestedLimit) : requestedLimit;

    if (externalChatId && !isInboxWhapiChatId(externalChatId)) {
      return new Response(JSON.stringify({ error: 'Conversa invalida para atualizar status.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!isCronRefresh && !externalChatId && externalMessageIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Informe a conversa ou mensagens para atualizar status.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    const token = sanitizeWhapiToken(settings.token);

    if (!settings.enabled) {
      return new Response(JSON.stringify({ error: 'Integração WhatsApp desabilitada.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const channel = await ensurePrimaryChannel(supabaseAdmin);
    const chatRoute = externalChatId
      ? await resolveCommWhatsAppCanonicalChatRoute(supabaseAdmin, {
          channelId: channel.id,
          externalChatId,
        })
      : null;

    if (externalChatId && !chatRoute?.chatId && externalMessageIds.length === 0) {
      return new Response(JSON.stringify({ refreshed: [], checked: 0, updated: 0 }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const staleBefore = isCronRefresh
      ? new Date(Date.now() - CRON_REFRESH_STALE_AFTER_MS).toISOString()
      : null;
    let rows = await loadRefreshableMessages(supabaseAdmin, {
      channelId: channel.id,
      chatId: chatRoute?.chatId ?? null,
      externalMessageIds,
      limit,
      staleBefore,
      statuses: isCronRefresh ? ['pending', 'queued', 'sending'] : undefined,
    });

    if (isCronRefresh && rows.length < limit) {
      const recentlyDeliveredRows = await loadRefreshableMessages(supabaseAdmin, {
        channelId: channel.id,
        externalMessageIds: [],
        limit: limit - rows.length,
        staleBefore,
        messageAtAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        statuses: ['sent', 'delivered'],
      });
      const alreadySelectedIds = new Set(rows.map((row) => row.id));
      rows = [...rows, ...recentlyDeliveredRows.filter((row) => !alreadySelectedIds.has(row.id))];
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ refreshed: [], checked: 0, updated: 0 }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const chatsById = await loadChatsById(supabaseAdmin, rows.map((row) => row.chat_id));
    const chatMessagesCache = new Map<string, Array<Record<string, unknown>>>();
    const refreshed: RefreshedStatus[] = [];

    const refreshRow = async (row: MessageRow) => {
      const externalMessageId = toTrimmedString(row.external_message_id);
      if (!externalMessageId) return;

      const rowChat = chatsById.get(row.chat_id);
      let whapiMessage = await fetchWhapiMessage({
        token,
        messageId: externalMessageId,
        resync: isCronRefresh,
      }).catch(() => null);

      if (!isCronRefresh && !whapiMessage && rowChat?.external_chat_id) {
        let chatMessages = chatMessagesCache.get(rowChat.external_chat_id);
        if (!chatMessages) {
          chatMessages = await fetchWhapiChatMessages({ token, chatId: rowChat.external_chat_id }).catch(() => []);
          chatMessagesCache.set(rowChat.external_chat_id, chatMessages);
        }

        whapiMessage = chatMessages.find((message) => {
          const messageId = extractWhapiMessageId(message) || toTrimmedString(message.id) || toTrimmedString(message.message_id);
          return messageId === externalMessageId;
        }) ?? null;
      }

      let deliveryStatus = whapiMessage && isRecord(whapiMessage) ? extractWhapiMessageStatus(whapiMessage) : '';
      let statusUpdatedAt = whapiMessage && isRecord(whapiMessage) ? getStatusTimestamp(whapiMessage) : getNowIso();

      if (!deliveryStatus && rowChat?.external_chat_id && isWhapiGroupChatId(rowChat.external_chat_id)) {
        const statuses = await fetchWhapiMessageStatuses({ token, messageId: externalMessageId }).catch(() => []);
        const highest = resolveHighestStatus(statuses);
        if (highest.status) {
          deliveryStatus = highest.status;
          statusUpdatedAt = highest.statusUpdatedAt ?? getNowIso();
        }
      }

      if (deliveryStatus) {
        await updateCommWhatsAppMessageStatus(supabaseAdmin, {
          channelId: channel.id,
          externalMessageId,
          deliveryStatus,
          statusUpdatedAt,
          errorMessage: whapiMessage && isRecord(whapiMessage) ? (toTrimmedString(whapiMessage.error) || toTrimmedString(whapiMessage.details) || null) : null,
        });

        const persistedStatus = await loadMessageStatusById(supabaseAdmin, row.id) || deliveryStatus;

        refreshed.push({
          id: row.id,
          external_message_id: externalMessageId,
          previous_status: row.delivery_status,
          delivery_status: persistedStatus,
          whapi_delivery_status: deliveryStatus,
          updated: normalizeStatus(persistedStatus) !== normalizeStatus(row.delivery_status),
        });
      }

      if (isCronRefresh) {
        await markMessageStatusChecked(supabaseAdmin, row.id, getNowIso());
      }
    };

    if (isCronRefresh) {
      await mapWithConcurrency(rows, CRON_REFRESH_CONCURRENCY, refreshRow);
    } else {
      for (const row of rows) await refreshRow(row);
    }

    return new Response(
      JSON.stringify({
        refreshed,
        checked: rows.length,
        updated: refreshed.filter((item) => item.updated).length,
      }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  } catch (error) {
    console.error('[comm-whatsapp-refresh-message-status] erro inesperado', error);
    const message = error instanceof Error ? error.message : 'Erro inesperado ao atualizar status das mensagens.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
