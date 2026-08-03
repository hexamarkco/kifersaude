// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  applyCommWhatsAppMessageMutation,
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractWhapiContactCardMeta,
  extractWhapiDeletedMessageEvent,
  extractWhapiEditedMessageEvent,
  extractWhapiLinkPreviewMeta,
  extractWhapiQuotedMessageMeta,
  extractWhapiMessageId,
  extractWhapiReactionEvent,
  extractPhoneFromChatId,
  extractWhapiMediaMeta,
  fetchWhapiChatMessagesPage,
  fetchWhapiChatName,
  getDirectChatDisplayNameCandidate,
  getNowIso,
  isDirectWhapiChatId,
  isWhapiLidChatId,
  isPhoneLabelLikeDisplayName,
  isValidCommWhatsAppDisplayName,
  normalizeWhapiChatId,
  persistCommWhatsAppMessage,
  summarizeWhapiMessage,
  toTrimmedString,
  unixTimestampToIso,
  resolveVerifiedWhapiDirectIdentity,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type SyncBody = {
  chatId?: string;
  offset?: number;
  count?: number;
  timeTo?: number;
};

const isOwnChannelName = (value: string | null | undefined, connectedUserName: string | null | undefined) => {
  const normalizedValue = toTrimmedString(value).toLowerCase();
  const normalizedChannelUser = toTrimmedString(connectedUserName).toLowerCase();
  return Boolean(normalizedValue && normalizedChannelUser && normalizedValue === normalizedChannelUser);
};

const jsonHeaders = {
  ...corsHeaders,
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

const normalizeSemanticText = (value: unknown) => toTrimmedString(value).replace(/\s+/g, ' ').toLowerCase();

const buildWhapiHistoryMessageKey = (message: Record<string, unknown>) => {
  const externalMessageId = extractWhapiMessageId(message);
  if (externalMessageId) {
    return `external:${externalMessageId}`;
  }

  const direction = message.from_me === true ? 'outbound' : 'inbound';
  const messageAt = unixTimestampToIso(message.timestamp) || '';
  const messageType = toTrimmedString(message.type) || 'text';
  const text = normalizeSemanticText(summarizeWhapiMessage(message));
  const mediaId = extractWhapiMediaMeta(message).mediaId || '';
  const sender = toTrimmedString(message.from) || toTrimmedString(message.from_name) || '';

  if (!mediaId && text.length < 12) {
    return '';
  }

  return `semantic:${direction}:${messageType}:${messageAt}:${sender}:${mediaId}:${text}`;
};

const dedupeWhapiHistoryMessages = (messages: Array<Record<string, unknown>>) => {
  const byKey = new Map<string, Record<string, unknown>>();
  const passthrough: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    const key = buildWhapiHistoryMessageKey(message);
    if (!key) {
      passthrough.push(message);
      continue;
    }

    if (byKey.has(key)) {
      continue;
    }

    byKey.set(key, message);
  }

  return [...passthrough, ...byKey.values()];
};

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

    if (!isServiceRoleRequest(req, serviceRoleKey)) {
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

    const body = (await req.json().catch(() => ({}))) as SyncBody;
    const externalChatId = normalizeWhapiChatId(body.chatId);
    const offset = Math.max(Math.floor(Number(body.offset) || 0), 0);
    const pageSize = Math.min(Math.max(Math.floor(Number(body.count) || 100), 1), 500);
    const requestedTimeTo = Number(body.timeTo);
    const timeTo = Number.isFinite(requestedTimeTo) && requestedTimeTo > 0
      ? Math.floor(requestedTimeTo)
      : Math.floor(Date.now() / 1000);

    if (!externalChatId || !isDirectWhapiChatId(externalChatId)) {
      return new Response(JSON.stringify({ error: 'Conversa invalida para sincronizacao.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    if (!settings.enabled) {
      return new Response(JSON.stringify({ error: 'Integração WhatsApp desabilitada.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    if (!settings.token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const channel = await ensurePrimaryChannel(supabaseAdmin);
    let phoneDigits = extractPhoneFromChatId(externalChatId);
    let canonicalExternalChatId = externalChatId;
    const identity = await resolveVerifiedWhapiDirectIdentity({
      token: settings.token,
      chatId: externalChatId,
    }).catch(() => null);

    if (identity?.verified) {
      const { data: reconcileData, error: reconcileError } = await supabaseAdmin.rpc('comm_whatsapp_reconcile_lid_identifier', {
        p_channel_id: channel.id,
        p_lid_external_chat_id: identity.lidChatId,
        p_phone_external_chat_id: identity.phoneChatId,
        p_mapping_evidence: {
          round_trip_verified: true,
          source: 'comm-whatsapp-sync-chat',
        },
      });
      if (reconcileError) throw new Error(`Erro ao reconciliar identidade da conversa: ${reconcileError.message}`);

      const reconcileRow = Array.isArray(reconcileData) ? reconcileData[0] : reconcileData;
      if (!reconcileRow?.merged || !reconcileRow.external_chat_id) {
        throw new Error(`Identidade nao reconciliada: ${reconcileRow?.conflict_reason || 'sem chat canonico'}.`);
      }

      canonicalExternalChatId = reconcileRow.external_chat_id;
      phoneDigits = identity.phone;
    } else if (isWhapiLidChatId(externalChatId)) {
      phoneDigits = '';
    }

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

    const { data: ensuredData, error: ensureError } = await supabaseAdmin.rpc('comm_whatsapp_ensure_observed_chat', {
      p_channel_id: channel.id,
      p_external_chat_id: canonicalExternalChatId,
      p_phone_number: phoneDigits || null,
      p_push_name: isValidCommWhatsAppDisplayName(whapiName) ? whapiName : null,
    });
    if (ensureError) throw new Error(`Nao foi possivel preparar a conversa para sincronizacao: ${ensureError.message}`);

    const chat = (Array.isArray(ensuredData) ? ensuredData[0] : ensuredData) as {
      id: string;
      unread_count: number;
      display_name: string;
      push_name: string | null;
    } | null;
    if (!chat?.id) throw new Error('A conversa canonica nao foi retornada pela preparacao da sincronizacao.');

    if (identity?.reason === 'reverse_mismatch') {
      const dedupeKey = `reverse:${channel.id}:${identity.lidChatId || externalChatId}:${identity.phoneChatId || 'unknown'}`;
      const { error: conflictError } = await supabaseAdmin
        .from('comm_whatsapp_identity_conflicts')
        .upsert({
          dedupe_key: dedupeKey,
          channel_id: channel.id,
          chat_id: chat.id,
          conflict_type: 'reverse_mapping_conflict',
          status: 'open',
          details: {
            observed_chat_id: externalChatId,
            lid_chat_id: identity.lidChatId || null,
            phone_chat_id: identity.phoneChatId || null,
            source: 'comm-whatsapp-sync-chat',
          },
          updated_at: getNowIso(),
          resolved_at: null,
          resolved_by: null,
        }, { onConflict: 'dedupe_key' });
      if (conflictError) throw new Error(`Erro ao registrar conflito de identidade: ${conflictError.message}`);

      const { error: flagError } = await supabaseAdmin
        .from('comm_whatsapp_chats')
        .update({ identity_conflict: true, updated_at: getNowIso() })
        .eq('id', chat.id);
      if (flagError) throw new Error(`Erro ao sinalizar conflito de identidade: ${flagError.message}`);
    }

    const displayName = chat.display_name;
    const pushName = whapiName || (!isOwnChannelName(chat.push_name, channel.connected_user_name) ? chat.push_name : null);

    const messagePage = await fetchWhapiChatMessagesPage({
      token: settings.token,
      chatId: externalChatId,
      count: pageSize,
      offset,
      timeTo,
      sort: 'asc',
    });
    const messages = dedupeWhapiHistoryMessages(messagePage.messages);
    const orderedMessages = [...messages].sort((a, b) => {
      const aTime = Number(a.timestamp ?? 0);
      const bTime = Number(b.timestamp ?? 0);
      return aTime - bTime;
    });

    let insertedCount = 0;
    let updatedCount = 0;

    for (const message of orderedMessages) {
      const reactionEvent = extractWhapiReactionEvent(message, 'messages');
      if (reactionEvent?.targetExternalMessageId) {
        await applyCommWhatsAppMessageMutation(supabaseAdmin, {
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
            || `history-reaction:${reactionEvent.targetExternalMessageId}:${reactionEvent.actorKey}:${reactionEvent.reactedAt}`,
        });
        continue;
      }

      const deletedEvent = extractWhapiDeletedMessageEvent(message, 'messages');
      if (deletedEvent?.targetExternalMessageId) {
        await applyCommWhatsAppMessageMutation(supabaseAdmin, {
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
            || `history-delete:${deletedEvent.targetExternalMessageId}:${deletedEvent.deletedAt}`,
        });
        continue;
      }

      const editedEvent = extractWhapiEditedMessageEvent(message, 'messages');
      if (editedEvent?.targetExternalMessageId && editedEvent.editedText) {
        const editedAt = editedEvent.editedAt || getNowIso();
        await applyCommWhatsAppMessageMutation(supabaseAdmin, {
          channelId: channel.id,
          targetExternalMessageId: editedEvent.targetExternalMessageId,
          mutationType: 'edit',
          eventExternalMessageId: editedEvent.eventExternalMessageId,
          occurredAt: editedAt,
          payload: {
            edited_text: editedEvent.editedText,
            original_text: editedEvent.originalText,
            action_type: editedEvent.actionType,
          },
          dedupeKey: editedEvent.eventExternalMessageId
            || `history-edit:${editedEvent.targetExternalMessageId}:${editedAt}`,
        });
        continue;
      }

      const direction = message.from_me === true ? 'outbound' : 'inbound';
      const messageAt = unixTimestampToIso(message.timestamp) || getNowIso();
      const externalMessageId = extractWhapiMessageId(message);
      const mediaMeta = extractWhapiMediaMeta(message);
      const linkPreviewMeta = extractWhapiLinkPreviewMeta(message);
      const quoteMeta = extractWhapiQuotedMessageMeta(message);
      const contactCardMeta = extractWhapiContactCardMeta(message);
      const summaryText = summarizeWhapiMessage(message);

      if (!externalMessageId) {
        const normalizedSummaryText = normalizeSemanticText(summaryText);
        const canCheckSemanticDuplicate = Boolean(mediaMeta.mediaId || normalizedSummaryText.length >= 12);

        if (canCheckSemanticDuplicate) {
          let existingMessageQuery = supabaseAdmin
            .from('comm_whatsapp_messages')
            .select('id')
            .eq('chat_id', chat.id)
            .eq('direction', direction)
            .eq('message_type', toTrimmedString(message.type) || 'text')
            .eq('message_at', messageAt);

          if (mediaMeta.mediaId) {
            existingMessageQuery = existingMessageQuery.eq('media_id', mediaMeta.mediaId);
          } else {
            existingMessageQuery = existingMessageQuery.eq('text_content', summaryText);
          }

          const { data: existingMessage, error: existingMessageError } = await existingMessageQuery
            .limit(1)
            .maybeSingle();

          if (existingMessageError) {
            throw new Error(`Erro ao verificar duplicata sem ID externo: ${existingMessageError.message}`);
          }

          if (existingMessage) {
            updatedCount += 1;
            continue;
          }
        }
      }

      const persisted = await persistCommWhatsAppMessage(supabaseAdmin, {
        channelId: channel.id,
        externalChatId,
        phoneNumber: phoneDigits,
        displayName,
        pushName,
        lastMessageText: summaryText,
        lastMessageDirection: direction,
        lastMessageAt: messageAt,
        incrementUnread: false,
        externalMessageId: externalMessageId || null,
        direction,
        messageType: toTrimmedString(message.type) || 'text',
        deliveryStatus: toTrimmedString(message.status) || (direction === 'inbound' ? 'received' : 'sent'),
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
          link_preview: linkPreviewMeta,
          ...(quoteMeta ? { quote: quoteMeta } : {}),
          ...(contactCardMeta ? { contact_card: contactCardMeta } : {}),
        },
      });

      if (persisted.inserted) {
        insertedCount += 1;
      } else {
        updatedCount += 1;
      }
    }

    const hasMore = messagePage.hasMore && messagePage.nextOffset > offset;
    return new Response(JSON.stringify({
      success: true,
      fetched: orderedMessages.length,
      imported: insertedCount,
      inserted: insertedCount,
      updated: updatedCount,
      hasMore,
      nextOffset: hasMore ? messagePage.nextOffset : null,
      timeTo,
    }), {
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
