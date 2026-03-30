// @ts-ignore Deno npm import
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractPhoneFromChatId,
  extractWhapiMediaMeta,
  fetchWhapiChatMessages,
  fetchWhapiChatName,
  formatPhoneLabel,
  getDirectChatDisplayNameCandidate,
  getNowIso,
  isDirectWhapiChatId,
  isPhoneLabelLikeDisplayName,
  normalizeWhapiChatId,
  persistCommWhatsAppMessage,
  summarizeWhapiMessage,
  toTrimmedString,
  unixTimestampToIso,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type SyncBody = {
  chatId?: string;
};

type ChatRow = {
  id: string;
  unread_count: number;
  display_name: string;
  push_name: string | null;
};

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type': 'application/json',
};

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

async function findExistingChat(
  supabaseAdmin: SupabaseClient,
  channelId: string,
  externalChatId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_chats')
    .select('id, unread_count, display_name, push_name')
    .eq('channel_id', channelId)
    .eq('external_chat_id', externalChatId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao localizar conversa existente: ${error.message}`);
  }

  return (data ?? null) as ChatRow | null;
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

    const body = (await req.json().catch(() => ({}))) as SyncBody;
    const externalChatId = normalizeWhapiChatId(body.chatId);

    if (!externalChatId || !isDirectWhapiChatId(externalChatId)) {
      return new Response(JSON.stringify({ error: 'Conversa invalida para sincronizacao.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    if (!settings.token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const channel = await ensurePrimaryChannel(supabaseAdmin);
    const phoneDigits = extractPhoneFromChatId(externalChatId);
    const existingChat = await findExistingChat(supabaseAdmin, channel.id, externalChatId);
    let whapiName = await fetchWhapiChatName({ token: settings.token, chatId: externalChatId }).catch(() => '');
    if (
      whapiName &&
      channel.connected_user_name &&
      whapiName.trim().toLowerCase() === channel.connected_user_name.trim().toLowerCase()
    ) {
      whapiName = '';
    }
    if (whapiName && isPhoneLabelLikeDisplayName(whapiName)) {
      whapiName = '';
    }
    const existingLooksLikeOwnName = Boolean(
      existingChat?.display_name &&
        channel.connected_user_name &&
        existingChat.display_name.trim().toLowerCase() === channel.connected_user_name.trim().toLowerCase(),
    );
    const displayName =
      whapiName ||
      (!existingLooksLikeOwnName && existingChat?.display_name && !isPhoneLabelLikeDisplayName(existingChat.display_name)
        ? existingChat.display_name
        : formatPhoneLabel(phoneDigits));

    const { data: chat, error: chatError } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .upsert(
        {
          channel_id: channel.id,
          external_chat_id: externalChatId,
          phone_number: phoneDigits,
          phone_digits: phoneDigits,
          display_name: displayName,
          push_name: whapiName || existingChat?.push_name || null,
        },
        { onConflict: 'channel_id,external_chat_id' },
      )
      .select('id, unread_count, display_name, push_name')
      .single();

    if (chatError || !chat) {
      throw new Error(chatError?.message || 'Nao foi possivel preparar a conversa para sincronizacao.');
    }

    const messages = await fetchWhapiChatMessages({ token: settings.token, chatId: externalChatId });
    const orderedMessages = [...messages].sort((a, b) => {
      const aTime = Number(a.timestamp ?? 0);
      const bTime = Number(b.timestamp ?? 0);
      return aTime - bTime;
    });

    for (const message of orderedMessages) {
      const direction = message.from_me === true ? 'outbound' : 'inbound';
      const messageAt = unixTimestampToIso(message.timestamp) || getNowIso();
      const externalMessageId = toTrimmedString(message.id);
      const mediaMeta = extractWhapiMediaMeta(message);
      const summaryText = summarizeWhapiMessage(message);
      await persistCommWhatsAppMessage(supabaseAdmin, {
        channelId: channel.id,
        externalChatId,
        phoneNumber: phoneDigits,
        displayName,
        pushName: whapiName || existingChat?.push_name || null,
        lastMessageText: summaryText,
        lastMessageDirection: direction,
        lastMessageAt: messageAt,
        incrementUnread: false,
        externalMessageId: externalMessageId || null,
        direction,
        messageType: toTrimmedString(message.type) || 'text',
        deliveryStatus: toTrimmedString(message.status) || (direction === 'inbound' ? 'received' : 'pending'),
        textContent: summaryText,
        createdBy: null,
        source: toTrimmedString(message.source) || null,
        senderName: getDirectChatDisplayNameCandidate(message, direction) || (direction === 'outbound' ? displayName : whapiName) || null,
        senderPhone: direction === 'outbound' ? channel.phone_number || null : phoneDigits,
        statusUpdatedAt: messageAt,
        errorMessage: null,
        mediaId: mediaMeta.mediaId,
        mediaUrl: mediaMeta.mediaUrl,
        mediaMimeType: mediaMeta.mediaMimeType,
        mediaFileName: mediaMeta.mediaFileName,
        mediaSizeBytes: mediaMeta.mediaSizeBytes,
        mediaDurationSeconds: mediaMeta.mediaDurationSeconds,
        mediaCaption: mediaMeta.mediaCaption,
        metadata: {
          from_me: message.from_me === true,
          chat_id: externalChatId,
          from: toTrimmedString(message.from) || null,
          from_name: toTrimmedString(message.from_name) || null,
          chat_name: toTrimmedString(message.chat_name) || null,
        },
      });
    }

    return new Response(JSON.stringify({ success: true, imported: orderedMessages.length }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-sync-chat] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao sincronizar conversa.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
