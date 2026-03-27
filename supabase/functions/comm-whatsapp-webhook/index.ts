// @ts-ignore Deno npm import
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  COMM_WHATSAPP_CHANNEL_SLUG,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractPhoneFromChatId,
  fetchWhapiChatName,
  formatPhoneLabel,
  getDirectChatDisplayNameCandidate,
  getHealthStatusText,
  getNowIso,
  isDirectWhapiChatId,
  isPhoneLabelLikeDisplayName,
  isRecord,
  normalizeCommWhatsAppPhone,
  normalizeWhapiChatId,
  stringTimestampToIso,
  summarizeWhapiMessage,
  toTrimmedString,
  unixTimestampToIso,
} from '../_shared/comm-whatsapp.ts';

type ChannelRow = {
  id: string;
  slug: string;
  enabled: boolean;
  whapi_channel_id: string | null;
  phone_number: string | null;
  connected_user_name: string | null;
  webhook_secret: string;
};

type ChatRow = {
  id: string;
  unread_count: number;
  display_name: string;
  push_name: string | null;
};

type StoredMessageRow = {
  id: string;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const createServiceClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const buildMessageEventKey = (eventAction: string, message: Record<string, unknown>) => {
  const messageId = toTrimmedString(message.id);
  const timestamp = toTrimmedString(message.timestamp);
  return `message:${eventAction}:${messageId || 'no-id'}:${timestamp || 'no-ts'}`;
};

const buildStatusEventKey = (eventAction: string, status: Record<string, unknown>) => {
  const messageId = toTrimmedString(status.id);
  const statusText = toTrimmedString(status.status);
  const timestamp = toTrimmedString(status.timestamp);
  return `status:${eventAction}:${messageId || 'no-id'}:${statusText || 'no-status'}:${timestamp || 'no-ts'}`;
};

const buildChannelEventKey = (eventAction: string, payload: Record<string, unknown>) => {
  const health = isRecord(payload.health) ? payload.health : null;
  const status = isRecord(health?.status) ? health.status : null;
  const statusText = toTrimmedString(status?.text);
  const uptime = toTrimmedString(health?.uptime);
  return `channel:${eventAction}:${statusText || 'unknown'}:${uptime || 'no-uptime'}`;
};

const buildUserEventKey = (eventAction: string, payload: Record<string, unknown>) => {
  const user = isRecord(payload.user) ? payload.user : null;
  return `user:${eventAction}:${toTrimmedString(user?.id) || 'unknown'}`;
};

async function recordEventReceipt(
  supabaseAdmin: SupabaseClient,
  channelId: string,
  eventKey: string,
  eventType: string,
  resourceId: string | null,
  summary: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin
    .from('comm_whatsapp_event_receipts')
    .insert({
      channel_id: channelId,
      event_key: eventKey,
      event_type: eventType,
      resource_id: resourceId,
      summary,
    });

  if (error) {
    if (error.code === '23505') {
      return false;
    }

    throw new Error(`Erro ao registrar dedupe do webhook: ${error.message}`);
  }

  return true;
}

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
    throw new Error(`Erro ao carregar conversa existente: ${error.message}`);
  }

  return (data ?? null) as ChatRow | null;
}

async function upsertChatFromMessage(
  supabaseAdmin: SupabaseClient,
  channel: ChannelRow,
  message: Record<string, unknown>,
  whapiToken: string,
) {
  const externalChatId = normalizeWhapiChatId(message.chat_id);
  if (!externalChatId || !isDirectWhapiChatId(externalChatId)) {
    return null;
  }

  const existingChat = await findExistingChat(supabaseAdmin, channel.id, externalChatId);
  const direction = message.from_me === true ? 'outbound' : 'inbound';
  const phoneDigits = extractPhoneFromChatId(externalChatId);
  let resolvedName = getDirectChatDisplayNameCandidate(message, direction);

  if (!resolvedName && existingChat?.push_name) {
    resolvedName = existingChat.push_name;
  }

  if (!resolvedName && direction === 'outbound' && whapiToken) {
    resolvedName = await fetchWhapiChatName({ token: whapiToken, chatId: externalChatId }).catch(() => '');
  }

  const fallbackDisplayName = formatPhoneLabel(phoneDigits);
  const existingLooksLikeOwnName = Boolean(
    existingChat?.display_name &&
      channel.connected_user_name &&
      existingChat.display_name.trim().toLowerCase() === channel.connected_user_name.trim().toLowerCase(),
  );
  const displayName =
    resolvedName ||
    (!existingLooksLikeOwnName && existingChat?.display_name ? existingChat.display_name : fallbackDisplayName);
  const unreadCount = direction === 'inbound' ? (existingChat?.unread_count ?? 0) + 1 : (existingChat?.unread_count ?? 0);
  const messageAt = unixTimestampToIso(message.timestamp) || getNowIso();

  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_chats')
    .upsert(
      {
        channel_id: channel.id,
        external_chat_id: externalChatId,
        phone_number: phoneDigits,
        phone_digits: phoneDigits,
        display_name: displayName,
        push_name: resolvedName || existingChat?.push_name || null,
        last_message_text: summarizeWhapiMessage(message),
        last_message_direction: direction,
        last_message_at: messageAt,
        unread_count: unreadCount,
      },
      { onConflict: 'channel_id,external_chat_id' },
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Nao foi possivel atualizar a conversa.');
  }

  return data as { id: string };
}

async function saveMessageRecord(
  supabaseAdmin: SupabaseClient,
  payload: Record<string, unknown>,
  externalMessageId: string,
) {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('comm_whatsapp_messages')
    .select('id')
    .eq('channel_id', payload.channel_id as string)
    .eq('external_message_id', externalMessageId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Erro ao verificar mensagem existente: ${lookupError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .update(payload)
      .eq('id', (existing as StoredMessageRow).id);

    if (updateError) {
      throw new Error(`Erro ao atualizar mensagem existente: ${updateError.message}`);
    }

    return;
  }

  const { error: insertError } = await supabaseAdmin.from('comm_whatsapp_messages').insert(payload);
  if (insertError) {
    throw new Error(`Erro ao inserir mensagem: ${insertError.message}`);
  }
}

async function upsertMessageFromWebhook(
  supabaseAdmin: SupabaseClient,
  channel: ChannelRow,
  chatId: string,
  message: Record<string, unknown>,
) {
  const externalMessageId = toTrimmedString(message.id);
  const messageAt = unixTimestampToIso(message.timestamp) || getNowIso();
  const direction = message.from_me === true ? 'outbound' : 'inbound';
  const externalChatId = normalizeWhapiChatId(message.chat_id);
  const deliveryStatus = toTrimmedString(message.status) || (direction === 'inbound' ? 'received' : 'pending');
  const payload = {
    chat_id: chatId,
    channel_id: channel.id,
    external_message_id: externalMessageId || null,
    direction,
    message_type: toTrimmedString(message.type) || 'text',
    delivery_status: deliveryStatus,
    text_content: summarizeWhapiMessage(message),
    message_at: messageAt,
    source: toTrimmedString(message.source) || null,
    sender_name: getDirectChatDisplayNameCandidate(message, direction) || null,
    sender_phone: direction === 'outbound' ? channel.phone_number || null : extractPhoneFromChatId(externalChatId) || null,
    status_updated_at: messageAt,
    metadata: {
      from_me: message.from_me === true,
      chat_id: externalChatId,
      from: toTrimmedString(message.from) || null,
      from_name: toTrimmedString(message.from_name) || null,
      chat_name: toTrimmedString(message.chat_name) || null,
    },
  };

  if (externalMessageId) {
    await saveMessageRecord(supabaseAdmin, payload, externalMessageId);
    return;
  }

  const { error } = await supabaseAdmin.from('comm_whatsapp_messages').insert(payload);
  if (error) {
    throw new Error(`Erro ao inserir mensagem do webhook: ${error.message}`);
  }
}

async function applyMessageStatus(
  supabaseAdmin: SupabaseClient,
  channelId: string,
  statusItem: Record<string, unknown>,
) {
  const externalMessageId = toTrimmedString(statusItem.id);
  if (!externalMessageId) return;

  const deliveryStatus = toTrimmedString(statusItem.status) || 'pending';
  const statusUpdatedAt = stringTimestampToIso(statusItem.timestamp) || getNowIso();

  const { error } = await supabaseAdmin
    .from('comm_whatsapp_messages')
    .update({
      delivery_status: deliveryStatus,
      status_updated_at: statusUpdatedAt,
    })
    .eq('channel_id', channelId)
    .eq('external_message_id', externalMessageId);

  if (error) {
    throw new Error(`Erro ao atualizar status da mensagem: ${error.message}`);
  }
}

async function syncChannelHealth(
  supabaseAdmin: SupabaseClient,
  channel: ChannelRow,
  payload: Record<string, unknown>,
) {
  const health = isRecord(payload.health) ? payload.health : {};
  const statusText = getHealthStatusText(payload);
  const { error } = await supabaseAdmin
    .from('comm_whatsapp_channels')
    .update({
      whapi_channel_id: toTrimmedString(payload.channel_id) || channel.whapi_channel_id,
      connection_status: statusText || 'unknown',
      health_status: statusText || 'unknown',
      last_webhook_received_at: getNowIso(),
      health_snapshot: health,
      last_error: null,
    })
    .eq('id', channel.id);

  if (error) {
    throw new Error(`Erro ao sincronizar status do canal: ${error.message}`);
  }
}

async function syncChannelUser(
  supabaseAdmin: SupabaseClient,
  channel: ChannelRow,
  payload: Record<string, unknown>,
) {
  const user = isRecord(payload.user) ? payload.user : {};
  const event = isRecord(payload.event) ? payload.event : {};
  const eventAction = toTrimmedString(event.event);

  const { error } = await supabaseAdmin
    .from('comm_whatsapp_channels')
    .update({
      whapi_channel_id: toTrimmedString(payload.channel_id) || channel.whapi_channel_id,
      phone_number: normalizeCommWhatsAppPhone(user.id) || channel.phone_number,
      connected_user_name: toTrimmedString(user.name) || channel.connected_user_name,
      connection_status: eventAction === 'delete' ? 'DISCONNECTED' : 'AUTH',
      health_status: eventAction === 'delete' ? 'DISCONNECTED' : 'AUTH',
      last_webhook_received_at: getNowIso(),
      last_error: null,
    })
    .eq('id', channel.id);

  if (error) {
    throw new Error(`Erro ao sincronizar usuario do canal: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseAdmin = createServiceClient();
    const channel = (await ensurePrimaryChannel(supabaseAdmin)) as ChannelRow;
    const requestUrl = new URL(req.url);
    const channelSlug = requestUrl.searchParams.get('channel')?.trim() || COMM_WHATSAPP_CHANNEL_SLUG;
    const secret = requestUrl.searchParams.get('secret')?.trim() || '';

    if (channelSlug !== channel.slug) {
      return new Response(JSON.stringify({ error: 'Canal invalido' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    if (!secret || secret !== channel.webhook_secret) {
      return new Response(JSON.stringify({ error: 'Webhook nao autorizado' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const payload = await req.json().catch(() => null);
    if (!isRecord(payload)) {
      return new Response(JSON.stringify({ error: 'Payload invalido' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    const whapiToken = settings.token;

    const event = isRecord(payload.event) ? payload.event : {};
    const eventType = toTrimmedString(event.type).toLowerCase();
    const eventAction = toTrimmedString(event.event).toLowerCase();
    const nowIso = getNowIso();

    await supabaseAdmin
      .from('comm_whatsapp_channels')
      .update({
        whapi_channel_id: toTrimmedString(payload.channel_id) || channel.whapi_channel_id,
        last_webhook_received_at: nowIso,
        last_error: null,
      })
      .eq('id', channel.id);

    if (eventType === 'messages' && Array.isArray(payload.messages)) {
      for (const item of payload.messages) {
        if (!isRecord(item)) continue;

        const chatId = normalizeWhapiChatId(item.chat_id);
        if (!chatId || !isDirectWhapiChatId(chatId)) continue;

        const eventKey = buildMessageEventKey(eventAction, item);
        const accepted = await recordEventReceipt(
          supabaseAdmin,
          channel.id,
          eventKey,
          'message',
          toTrimmedString(item.id) || null,
          {
            event_action: eventAction,
            chat_id: chatId,
            from_me: item.from_me === true,
          },
        );

        if (!accepted) continue;

        const chat = await upsertChatFromMessage(supabaseAdmin, channel, item, whapiToken);
        if (!chat) continue;
        await upsertMessageFromWebhook(supabaseAdmin, channel, chat.id, item);
      }
    }

    if (eventType === 'statuses' && Array.isArray(payload.statuses)) {
      for (const item of payload.statuses) {
        if (!isRecord(item)) continue;

        const eventKey = buildStatusEventKey(eventAction, item);
        const accepted = await recordEventReceipt(
          supabaseAdmin,
          channel.id,
          eventKey,
          'status',
          toTrimmedString(item.id) || null,
          {
            event_action: eventAction,
            status: toTrimmedString(item.status),
            recipient_id: normalizeWhapiChatId(item.recipient_id),
          },
        );

        if (!accepted) continue;
        await applyMessageStatus(supabaseAdmin, channel.id, item);
      }
    }

    if ((eventType === 'channel' || eventType === 'channels') && isRecord(payload.health)) {
      const eventKey = buildChannelEventKey(eventAction, payload);
      const accepted = await recordEventReceipt(
        supabaseAdmin,
        channel.id,
        eventKey,
        'channel',
        toTrimmedString(payload.channel_id) || null,
        {
          event_action: eventAction,
          status: getHealthStatusText(payload),
        },
      );

      if (accepted) {
        await syncChannelHealth(supabaseAdmin, channel, payload);
      }
    }

    if (eventType === 'users' && isRecord(payload.user)) {
      const eventKey = buildUserEventKey(eventAction, payload);
      const accepted = await recordEventReceipt(
        supabaseAdmin,
        channel.id,
        eventKey,
        'user',
        toTrimmedString(payload.channel_id) || null,
        {
          event_action: eventAction,
          user_id: normalizeCommWhatsAppPhone((payload.user as Record<string, unknown>).id),
        },
      );

      if (accepted) {
        await syncChannelUser(supabaseAdmin, channel, payload);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-webhook] erro inesperado', error);

    try {
      const supabaseAdmin = createServiceClient();
      const channel = await ensurePrimaryChannel(supabaseAdmin);
      await supabaseAdmin
        .from('comm_whatsapp_channels')
        .update({
          last_error: error instanceof Error ? error.message : 'Erro inesperado no webhook.',
          last_webhook_received_at: getNowIso(),
        })
        .eq('id', channel.id);
    } catch (secondaryError) {
      console.error('[comm-whatsapp-webhook] falha ao persistir erro', secondaryError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno no webhook.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
