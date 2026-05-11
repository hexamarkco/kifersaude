// @ts-expect-error Deno npm import
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractWhapiMessageId,
  extractWhapiMessageStatus,
  fetchWhapiChatMessages,
  fetchWhapiMessage,
  getNowIso,
  isDirectWhapiChatId,
  isRecord,
  normalizeWhapiChatId,
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
};

type MessageRow = {
  id: string;
  chat_id: string;
  external_message_id: string;
  delivery_status: string;
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
  updated: boolean;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const REFRESHABLE_STATUSES = ['pending', 'queued', 'sending'];

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

async function findChatByExternalId(
  supabaseAdmin: SupabaseClient,
  channelId: string,
  externalChatId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_chats')
    .select('id,external_chat_id')
    .eq('channel_id', channelId)
    .eq('external_chat_id', externalChatId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao localizar conversa: ${error.message}`);
  }

  return (data ?? null) as ChatRow | null;
}

async function loadRefreshableMessages(
  supabaseAdmin: SupabaseClient,
  params: {
    channelId: string;
    chatId?: string | null;
    externalMessageIds: string[];
    limit: number;
  },
) {
  let query = supabaseAdmin
    .from('comm_whatsapp_messages')
    .select('id,chat_id,external_message_id,delivery_status')
    .eq('channel_id', params.channelId)
    .eq('direction', 'outbound')
    .not('external_message_id', 'is', null)
    .order('message_at', { ascending: false })
    .limit(params.limit);

  if (params.chatId) {
    query = query.eq('chat_id', params.chatId);
  }

  if (params.externalMessageIds.length > 0) {
    query = query.in('external_message_id', params.externalMessageIds);
  } else {
    query = query.in('delivery_status', REFRESHABLE_STATUSES);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao carregar mensagens para atualizar status: ${error.message}`);
  }

  return (data ?? []) as MessageRow[];
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
    const supabaseAdmin = createAdminClient();

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

    const body = (await req.json().catch(() => ({}))) as RefreshBody;
    const externalMessageIds = normalizeExternalMessageIds(body.externalMessageIds);
    const externalChatId = normalizeWhapiChatId(body.chatId);
    const limit = Math.max(1, Math.min(20, Math.floor(Number(body.limit) || 10)));

    if (externalChatId && !isDirectWhapiChatId(externalChatId)) {
      return new Response(JSON.stringify({ error: 'Conversa invalida para atualizar status.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!externalChatId && externalMessageIds.length === 0) {
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
    const chat = externalChatId ? await findChatByExternalId(supabaseAdmin, channel.id, externalChatId) : null;
    const rows = await loadRefreshableMessages(supabaseAdmin, {
      channelId: channel.id,
      chatId: chat?.id ?? null,
      externalMessageIds,
      limit,
    });

    if (rows.length === 0) {
      return new Response(JSON.stringify({ refreshed: [], checked: 0, updated: 0 }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const chatsById = await loadChatsById(supabaseAdmin, rows.map((row) => row.chat_id));
    const chatMessagesCache = new Map<string, Array<Record<string, unknown>>>();
    const refreshed: RefreshedStatus[] = [];

    for (const row of rows) {
      const externalMessageId = toTrimmedString(row.external_message_id);
      if (!externalMessageId) continue;

      const rowChat = chatsById.get(row.chat_id);
      let whapiMessage = await fetchWhapiMessage({ token, messageId: externalMessageId }).catch(() => null);

      if (!whapiMessage && rowChat?.external_chat_id) {
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

      if (!whapiMessage || !isRecord(whapiMessage)) continue;

      const deliveryStatus = extractWhapiMessageStatus(whapiMessage);
      if (!deliveryStatus) continue;

      const updated = await updateCommWhatsAppMessageStatus(supabaseAdmin, {
        channelId: channel.id,
        externalMessageId,
        deliveryStatus,
        statusUpdatedAt: getStatusTimestamp(whapiMessage),
        errorMessage: toTrimmedString(whapiMessage.error) || toTrimmedString(whapiMessage.details) || null,
      });

      refreshed.push({
        id: row.id,
        external_message_id: externalMessageId,
        previous_status: row.delivery_status,
        delivery_status: deliveryStatus,
        updated,
      });
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
