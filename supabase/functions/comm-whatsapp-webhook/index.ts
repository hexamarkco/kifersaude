// @ts-expect-error Deno npm import
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  applyCommWhatsAppMessageMutation,
  COMM_WHATSAPP_CHANNEL_SLUG,
  COMM_WHATSAPP_WEBHOOK_SECRET_HEADER,
  corsHeaders,
  extractWhapiDeletedMessageEvent,
  ensurePrimaryChannel,
  extractWhapiContactCardMeta,
  extractWhapiEditedMessageEvent,
  extractWhapiLinkPreviewMeta,
  extractWhapiQuotedMessageMeta,
  extractWhapiReactionEvent,
  extractWhapiStarEvent,
  extractPhoneFromChatId,
  extractWhapiMediaMeta,
  formatPhoneLabel,
  getCommWhatsAppWebhookSecret,
  getDirectChatDisplayNameCandidate,
  getHealthStatusText,
  getNowIso,
  isDirectWhapiChatId,
  isPhoneLabelLikeDisplayName,
  isRecord,
  normalizeCommWhatsAppPhone,
  normalizeWhapiChatId,
  persistCommWhatsAppMessage,
  stringTimestampToIso,
  summarizeWhapiMessage,
  toTrimmedString,
  unixTimestampToIso,
  updateCommWhatsAppMessageStatus,
} from '../_shared/comm-whatsapp.ts';
import {
  buildWhapiWebhookMessageReceiptKey,
  extractWhapiWebhookMessageItems,
  hasWhapiPatchTextChange,
  type WhapiWebhookMessagePatch,
} from '../_shared/whapi-webhook-parser.ts';

type ChannelRow = {
  id: string;
  slug: string;
  enabled: boolean;
  whapi_channel_id: string | null;
  phone_number: string | null;
  connected_user_name: string | null;
};

type ChatRow = {
  id: string;
  unread_count: number;
  display_name: string;
  push_name: string | null;
};

const isOwnChannelName = (value: string | null | undefined, connectedUserName: string | null | undefined) => {
  const normalizedValue = toTrimmedString(value).toLowerCase();
  const normalizedChannelUser = toTrimmedString(connectedUserName).toLowerCase();
  return Boolean(normalizedValue && normalizedChannelUser && normalizedValue === normalizedChannelUser);
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

async function archiveRawPayload(
  supabaseAdmin: SupabaseClient,
  correlationId: string,
  rawText: string,
  eventType: string,
  eventAction: string,
): Promise<string | null> {
  try {
    const dateStr = getNowIso().slice(0, 10);
    const path = `${dateStr}/${correlationId}_${eventType}_${eventAction}.json`;

    const { error } = await supabaseAdmin.storage
      .from('whapi-webhook-archive')
      .upload(path, rawText, {
        contentType: 'application/json',
        upsert: false,
      });

    if (error) {
      console.error(`[${correlationId}] erro ao arquivar payload bruto: ${error.message}`);
      return null;
    }

    return path;
  } catch (e) {
    console.error(`[${correlationId}] erro ao arquivar payload bruto: ${e instanceof Error ? e.message : 'desconhecido'}`);
    return null;
  }
}

async function recordEventReceipt(
  supabaseAdmin: SupabaseClient,
  channelId: string,
  eventKey: string,
  eventType: string,
  resourceId: string | null,
  summary: Record<string, unknown>,
  payloadArchivePath?: string | null,
) {
  const { error } = await supabaseAdmin
    .from('comm_whatsapp_event_receipts')
    .insert({
      channel_id: channelId,
      event_key: eventKey,
      event_type: eventType,
      resource_id: resourceId,
      summary,
      payload_archive_path: payloadArchivePath || null,
    });

  if (error) {
    if (error.code === '23505') {
      return false;
    }

    throw new Error(`Erro ao registrar dedupe do webhook: ${error.message}`);
  }

  return true;
}

async function hasEventReceipt(
  supabaseAdmin: SupabaseClient,
  eventKey: string,
) {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_event_receipts')
    .select('id')
    .eq('event_key', eventKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao verificar dedupe do webhook: ${error.message}`);
  }

  return Boolean(data);
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

const resolveMessageChatId = (message: Record<string, unknown>): string => {
  const directChatId = normalizeWhapiChatId(message.chat_id);
  if (directChatId) return directChatId;

  const nestedChat = isRecord(message.chat) ? message.chat : null;
  const nestedChatId = normalizeWhapiChatId(nestedChat?.id ?? nestedChat?.chat_id);
  if (nestedChatId) return nestedChatId;

  const candidate = message.from_me === true
    ? message.to ?? message.recipient_id ?? message.from
    : message.from ?? message.sender ?? message.author ?? message.to;

  return normalizeWhapiChatId(candidate);
};

const withResolvedMessageChatId = (message: Record<string, unknown>): Record<string, unknown> => {
  const chatId = resolveMessageChatId(message);
  return chatId ? { ...message, chat_id: chatId } : message;
};

async function persistMessageFromWebhook(
  supabaseAdmin: SupabaseClient,
  channel: ChannelRow,
  message: Record<string, unknown>,
  eventAction: string,
  patch: WhapiWebhookMessagePatch | null,
) {
  const externalChatId = resolveMessageChatId(message);
  if (!externalChatId || !isDirectWhapiChatId(externalChatId)) {
    return null;
  }

  const mutationSource = patch?.trigger ?? message;
  const summaryText = summarizeWhapiMessage(message);
  const reactionEvent = extractWhapiReactionEvent(mutationSource, eventAction);
  if (reactionEvent?.targetExternalMessageId) {
    const mutation = await applyCommWhatsAppMessageMutation(supabaseAdmin, {
      channelId: channel.id,
      targetExternalMessageId: reactionEvent.targetExternalMessageId,
      mutationType: 'reaction',
      eventExternalMessageId: reactionEvent.eventExternalMessageId,
      occurredAt: reactionEvent.reactedAt,
      payload: {
        actor_key: reactionEvent.actorKey,
        emoji: reactionEvent.emoji,
        from_me: reactionEvent.fromMe,
        from: reactionEvent.from,
        from_name: reactionEvent.fromName,
      },
      dedupeKey: reactionEvent.eventExternalMessageId
        || `reaction:${reactionEvent.targetExternalMessageId}:${reactionEvent.actorKey}:${reactionEvent.reactedAt}`,
    });

    // A reaction action is never a standalone Inbox message. A durable pending
    // mutation preserves it until the base message arrives.
    return { id: mutation.chatId || '' };
  }

  const starEvent = extractWhapiStarEvent(mutationSource, eventAction);
  if (starEvent?.targetExternalMessageId) {
    const mutation = await applyCommWhatsAppMessageMutation(supabaseAdmin, {
      channelId: channel.id,
      targetExternalMessageId: starEvent.targetExternalMessageId,
      mutationType: 'star',
      eventExternalMessageId: starEvent.eventExternalMessageId,
      occurredAt: starEvent.starredAt,
      payload: {
        starred: starEvent.starred,
      },
      dedupeKey: starEvent.eventExternalMessageId
        || `star:${starEvent.targetExternalMessageId}:${starEvent.starredAt}`,
    });

    return { id: mutation.chatId || '' };
  }

  const deletedEvent = extractWhapiDeletedMessageEvent(mutationSource, eventAction);
  if (deletedEvent?.targetExternalMessageId) {
    const mutation = await applyCommWhatsAppMessageMutation(supabaseAdmin, {
      channelId: channel.id,
      targetExternalMessageId: deletedEvent.targetExternalMessageId,
      mutationType: 'delete',
      eventExternalMessageId: deletedEvent.eventExternalMessageId,
      occurredAt: deletedEvent.deletedAt,
      payload: {
        original_text: deletedEvent.originalText,
        action_type: deletedEvent.actionType,
        deleted_by: deletedEvent.deletedBy,
      },
      dedupeKey: deletedEvent.eventExternalMessageId
        || `delete:${deletedEvent.targetExternalMessageId}:${deletedEvent.deletedAt}`,
    });

    return { id: mutation.chatId || '' };
  }

  const explicitEditedEvent = extractWhapiEditedMessageEvent(mutationSource, eventAction);
  const patchEditedEvent = !explicitEditedEvent?.editedText
    && hasWhapiPatchTextChange(patch)
    && toTrimmedString(message.id)
    && summaryText !== '[Mensagem]'
    ? {
        eventExternalMessageId: null,
        targetExternalMessageId: toTrimmedString(message.id),
        editedText: summaryText,
        originalText: null,
        editedAt: unixTimestampToIso(patch?.trigger?.timestamp) || getNowIso(),
        actionType: 'patch',
      }
    : null;
  const editedEvent = explicitEditedEvent?.editedText ? explicitEditedEvent : patchEditedEvent;
  if (editedEvent?.targetExternalMessageId && editedEvent.editedText) {
    const mutation = await applyCommWhatsAppMessageMutation(supabaseAdmin, {
      channelId: channel.id,
      targetExternalMessageId: editedEvent.targetExternalMessageId,
      mutationType: 'edit',
      eventExternalMessageId: editedEvent.eventExternalMessageId,
      occurredAt: editedEvent.editedAt || getNowIso(),
      payload: {
        edited_text: editedEvent.editedText,
        original_text: editedEvent.originalText,
        action_type: editedEvent.actionType,
      },
      dedupeKey: editedEvent.eventExternalMessageId
        || `edit:${editedEvent.targetExternalMessageId}:${editedEvent.editedAt || message.id || getNowIso()}`,
    });

    if (explicitEditedEvent || mutation.applied) {
      return { id: mutation.chatId || '' };
    }
  }

  const existingChat = await findExistingChat(supabaseAdmin, channel.id, externalChatId);
  const direction = message.from_me === true ? 'outbound' : 'inbound';
  const phoneDigits = extractPhoneFromChatId(externalChatId);
  const messageName = getDirectChatDisplayNameCandidate(message, direction);
  let resolvedName = messageName;

  if (
    resolvedName &&
    channel.connected_user_name &&
    resolvedName.trim().toLowerCase() === channel.connected_user_name.trim().toLowerCase()
  ) {
    resolvedName = '';
  }

  if (resolvedName && isPhoneLabelLikeDisplayName(resolvedName)) {
    resolvedName = '';
  }

  if (!resolvedName && existingChat?.push_name && !isOwnChannelName(existingChat.push_name, channel.connected_user_name)) {
    resolvedName = existingChat.push_name;
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
  const messageAt = unixTimestampToIso(message.timestamp) || getNowIso();
  const externalMessageId = toTrimmedString(message.id);
  const deliveryStatus = toTrimmedString(message.status) || (direction === 'inbound' ? 'received' : 'sent');
  const mediaMeta = extractWhapiMediaMeta(message);
  const linkPreviewMeta = extractWhapiLinkPreviewMeta(message);
  const quoteMeta = extractWhapiQuotedMessageMeta(message);
  const contactCardMeta = extractWhapiContactCardMeta(message);
  const patchStatusUpdatedAt = patch
    ? unixTimestampToIso(patch.trigger?.timestamp) || messageAt
    : messageAt;
  const result = await persistCommWhatsAppMessage(supabaseAdmin, {
    channelId: channel.id,
    externalChatId,
    phoneNumber: phoneDigits || null,
    displayName,
    pushName: resolvedName || (!isOwnChannelName(existingChat?.push_name, channel.connected_user_name) ? existingChat?.push_name || null : null),
    lastMessageText: summaryText,
    lastMessageDirection: direction,
    lastMessageAt: messageAt,
    incrementUnread: !patch && direction === 'inbound',
    externalMessageId: externalMessageId || null,
    direction,
    messageType: toTrimmedString(message.type) || 'text',
    deliveryStatus,
    textContent: summaryText,
    createdBy: null,
    source: toTrimmedString(message.source) || null,
    senderName: getDirectChatDisplayNameCandidate(message, direction) || null,
    senderPhone: direction === 'outbound' ? channel.phone_number || null : phoneDigits || null,
    statusUpdatedAt: patchStatusUpdatedAt,
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
      link_preview: linkPreviewMeta,
      ...(quoteMeta ? { quote: quoteMeta } : {}),
      ...(contactCardMeta ? { contact_card: contactCardMeta } : {}),
      ...(patch ? {
        whapi_patch: {
          changes: patch.changes,
          trigger_id: toTrimmedString(patch.trigger?.id) || null,
          ...(isRecord(message.poll) ? { poll: message.poll } : {}),
          ...(Array.isArray(message.reactions) ? { reactions: message.reactions } : {}),
        },
      } : {}),
      edited: editedEvent ? true : false,
      edited_at: editedEvent?.editedAt ?? null,
      original_text_content: editedEvent?.originalText ?? null,
      edit_action_type: editedEvent?.actionType ?? null,
    },
  });

  if (direction === 'inbound' && !patch) {
    try {
      await supabaseAdmin.rpc('resolve_comm_whatsapp_campaign_stop_on_reply', {
        p_external_chat_id: externalChatId,
        p_message_at: messageAt,
      });
    } catch {
      // Non-critical: stop_on_reply is best-effort. Failure does not
      // affect message persistence.
    }
  }

  return { id: result.chatId };
}

async function applyMessageStatus(
  supabaseAdmin: SupabaseClient,
  channelId: string,
  statusItem: Record<string, unknown>,
) {
  const externalMessageId = toTrimmedString(statusItem.id);
  if (!externalMessageId) return;

  const deliveryStatus = toTrimmedString(statusItem.status);
  if (!deliveryStatus) return;
  const statusUpdatedAt = stringTimestampToIso(statusItem.timestamp) || getNowIso();

  if (deliveryStatus === 'deleted') {
    await applyCommWhatsAppMessageMutation(supabaseAdmin, {
      channelId,
      targetExternalMessageId: externalMessageId,
      mutationType: 'delete',
      occurredAt: statusUpdatedAt,
      payload: { action_type: 'deleted', deleted_by: null },
      dedupeKey: `status-delete:${externalMessageId}:${statusUpdatedAt}`,
    });
    return;
  }

  await updateCommWhatsAppMessageStatus(supabaseAdmin, {
    channelId,
    externalMessageId,
    deliveryStatus,
    statusUpdatedAt,
    errorMessage: toTrimmedString(statusItem.error) || toTrimmedString(statusItem.details) || null,
  });
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
  const correlationId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  let startedAt = 0;

  try {
    const supabaseAdmin = createServiceClient();
    const channel = (await ensurePrimaryChannel(supabaseAdmin)) as ChannelRow;
    const requestUrl = new URL(req.url);
    const channelSlug = requestUrl.searchParams.get('channel')?.trim() || COMM_WHATSAPP_CHANNEL_SLUG;
    const webhookSecret = getCommWhatsAppWebhookSecret();

    if (!webhookSecret) {
      console.error(`[${correlationId}] segredo do webhook nao configurado via env COMM_WHATSAPP_WEBHOOK_SECRET`);
      return new Response(JSON.stringify({ error: 'Webhook nao configurado' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    if (channelSlug !== channel.slug) {
      return new Response(JSON.stringify({ error: 'Canal invalido' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const providedSecret = req.headers.get(COMM_WHATSAPP_WEBHOOK_SECRET_HEADER)?.trim() || '';
    if (!providedSecret || providedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Webhook nao autorizado' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const rawPayloadText = await req.text().catch(() => null);
    if (!rawPayloadText) {
      return new Response(JSON.stringify({ error: 'Payload vazio' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const payload = JSON.parse(rawPayloadText);
    if (!isRecord(payload)) {
      return new Response(JSON.stringify({ error: 'Payload invalido' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const event = isRecord(payload.event) ? payload.event : {};
    const eventType = toTrimmedString(event.type).toLowerCase();
    const eventAction = toTrimmedString(event.event).toLowerCase();
    const nowIso = getNowIso();

    console.log(`[${correlationId}] entry event_type=${eventType} event_action=${eventAction} method=${req.method}`);

    startedAt = Date.now();

    const archivePath = await archiveRawPayload(supabaseAdmin, correlationId, rawPayloadText, eventType, eventAction);
    if (!archivePath) {
      console.warn(`[${correlationId}] payload bruto nao arquivado (nao critico)`);
    }

    await supabaseAdmin
      .from('comm_whatsapp_channels')
      .update({
        whapi_channel_id: toTrimmedString(payload.channel_id) || channel.whapi_channel_id,
        last_webhook_received_at: nowIso,
        last_error: null,
      })
      .eq('id', channel.id);

    const messageItems = eventType === 'messages' || eventType === 'message'
      ? extractWhapiWebhookMessageItems(payload)
      : [];

    if (messageItems.length > 0) {
      for (const rawItem of messageItems) {
        const item = {
          ...rawItem,
          message: withResolvedMessageChatId(rawItem.message),
        };

        const chatId = resolveMessageChatId(item.message);
        if (!chatId || !isDirectWhapiChatId(chatId)) continue;

        const eventKey = buildWhapiWebhookMessageReceiptKey(eventAction, item);
        if (await hasEventReceipt(supabaseAdmin, eventKey)) continue;

        const chat = await persistMessageFromWebhook(
          supabaseAdmin,
          channel,
          item.message,
          eventAction,
          item.patch,
        );
        if (!chat) continue;

        await recordEventReceipt(
          supabaseAdmin,
          channel.id,
          eventKey,
          'message',
          toTrimmedString(item.receipt.id) || toTrimmedString(item.message.id) || null,
          {
            event_action: eventAction,
            chat_id: chatId,
            from_me: item.message.from_me === true,
          },
          archivePath,
        );
      }
    }

    if (eventType === 'statuses' && Array.isArray(payload.statuses)) {
      for (const item of payload.statuses) {
        if (!isRecord(item)) continue;

        const eventKey = buildStatusEventKey(eventAction, item);
        if (await hasEventReceipt(supabaseAdmin, eventKey)) continue;

        await applyMessageStatus(supabaseAdmin, channel.id, item);

        await recordEventReceipt(
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
          archivePath,
        );
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
        archivePath,
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
        archivePath,
      );

      if (accepted) {
        await syncChannelUser(supabaseAdmin, channel, payload);
      }
    }

    const elapsed = Date.now() - startedAt;
    console.log(`[${correlationId}] complete elapsed=${elapsed}ms success=true`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    const elapsed = Date.now() - (startedAt || 0);
    console.error(`[${correlationId}] error elapsed=${elapsed}ms`, error);

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
      console.error(`[${correlationId}] falha ao persistir erro`, secondaryError);
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
