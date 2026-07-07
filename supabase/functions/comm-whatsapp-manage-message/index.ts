// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import {
  applyCommWhatsAppMessageEdit,
  COMM_WHATSAPP_MODULE,
  WHAPI_BASE_URL,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractPhoneFromChatId,
  extractWhapiMessageId,
  formatPhoneLabel,
  getNowIso,
  isDirectWhapiChatId,
  markCommWhatsAppMessageDeleted,
  normalizeWhapiChatId,
  persistCommWhatsAppMessage,
  parseWhapiError,
  readResponsePayload,
  resolveWhapiOutboundDeliveryStatus,
  sanitizeWhapiToken,
  toTrimmedString,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type ManageMessageBody = {
  messageId?: string;
  action?: string;
  text?: string;
  targetChatId?: string;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const EDITABLE_MESSAGE_TYPES = new Set(['text', 'image', 'video', 'gif', 'short', 'document']);
const MEDIA_EDIT_MESSAGE_TYPES = new Set(['image', 'video', 'gif', 'short', 'document']);

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAdmin = createAdminClient();

    const authResult = await authorizeDashboardUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
      module: COMM_WHATSAPP_MODULE,
      requiredPermission: 'edit',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json().catch(() => ({}))) as ManageMessageBody;
    const messageId = toTrimmedString(body.messageId);
    const action = toTrimmedString(body.action).toLowerCase();
    const nextText = toTrimmedString(body.text);

    if (!messageId) {
      return new Response(JSON.stringify({ error: 'Mensagem obrigatoria.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (action !== 'edit' && action !== 'delete' && action !== 'forward') {
      return new Response(JSON.stringify({ error: 'Acao invalida para a mensagem.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    const channel = await ensurePrimaryChannel(supabaseAdmin);
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

    const { data: message, error: messageError } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .select('id, chat_id, channel_id, external_message_id, direction, message_type, delivery_status, text_content, media_id, media_url, media_file_name, media_caption, metadata')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) {
      throw new Error(`Erro ao localizar mensagem: ${messageError.message}`);
    }

    if (!message) {
      return new Response(JSON.stringify({ error: 'Mensagem nao encontrada.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    if (message.channel_id !== channel.id) {
      return new Response(JSON.stringify({ error: 'Mensagem fora do canal principal configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if ((action === 'edit' || action === 'delete') && toTrimmedString(message.direction).toLowerCase() !== 'outbound') {
      return new Response(JSON.stringify({ error: 'Somente mensagens enviadas por voce podem ser alteradas aqui.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const externalMessageId = toTrimmedString(message.external_message_id);
    if (!externalMessageId) {
      return new Response(JSON.stringify({ error: 'Mensagem ainda nao possui identificador externo para gerenciar na Whapi.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (toTrimmedString(message.delivery_status).toLowerCase() === 'deleted') {
      return new Response(JSON.stringify({ error: 'Esta mensagem ja foi apagada.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: chat, error: chatError } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('id, external_chat_id')
      .eq('id', message.chat_id)
      .maybeSingle();

    if (chatError) {
      throw new Error(`Erro ao localizar conversa da mensagem: ${chatError.message}`);
    }

    const externalChatId = toTrimmedString(chat?.external_chat_id);
    if (!externalChatId) {
      return new Response(JSON.stringify({ error: 'Conversa da mensagem nao encontrada.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    if (action === 'edit') {
      const messageType = toTrimmedString(message.message_type).toLowerCase();
      if (!EDITABLE_MESSAGE_TYPES.has(messageType)) {
        return new Response(JSON.stringify({ error: 'Este tipo de mensagem nao pode ser editado no momento.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      if (!nextText) {
        return new Response(JSON.stringify({ error: 'Digite o novo texto da mensagem.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const isMediaEdit = MEDIA_EDIT_MESSAGE_TYPES.has(messageType);
      const mediaReference = isMediaEdit
        ? toTrimmedString(message.media_id) || toTrimmedString(message.media_url)
        : '';

      if (isMediaEdit && !mediaReference) {
        return new Response(JSON.stringify({ error: 'Esta mensagem nao possui midia reutilizavel para editar a legenda na Whapi.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const editPayload: Record<string, unknown> = isMediaEdit
        ? {
            to: externalChatId,
            media: mediaReference,
            caption: nextText,
            edit: externalMessageId,
          }
        : {
            to: externalChatId,
            body: nextText,
            edit: externalMessageId,
          };

      const mediaFileName = toTrimmedString(message.media_file_name);
      if (isMediaEdit && messageType === 'document' && mediaFileName) {
        editPayload.filename = mediaFileName;
      }

      const response = await fetch(`${WHAPI_BASE_URL}/messages/${isMediaEdit ? messageType : 'text'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editPayload),
      });
      const payload = await readResponsePayload(response);

      if (!response.ok) {
        return new Response(JSON.stringify({ error: parseWhapiError(payload) || 'Falha ao editar mensagem na Whapi.' }), {
          status: response.status,
          headers: jsonHeaders,
        });
      }

      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const sent = (payload as Record<string, unknown>).sent;
        if (sent === false) {
          return new Response(JSON.stringify({ error: parseWhapiError(payload) || 'A Whapi nao confirmou a edicao da mensagem.' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
      }

      const editedAt = getNowIso();
      const editResult = await applyCommWhatsAppMessageEdit(supabaseAdmin, {
        channelId: channel.id,
        targetExternalMessageId: externalMessageId,
        editedText: nextText,
        editedAt,
        originalText: toTrimmedString(message.media_caption) || toTrimmedString(message.text_content) || null,
        actionType: 'manual_edit',
      });

      if (!editResult) {
        return new Response(JSON.stringify({ error: 'Mensagem editada na Whapi, mas nao encontrada para atualizar no inbox.' }), {
          status: 404,
          headers: jsonHeaders,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'edit',
        editedText: nextText,
        editedAt,
      }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (action === 'forward') {
      const targetChatId = normalizeWhapiChatId(body.targetChatId);
      if (!targetChatId || !isDirectWhapiChatId(targetChatId)) {
        return new Response(JSON.stringify({ error: 'Conversa de destino invalida para encaminhar.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const response = await fetch(`${WHAPI_BASE_URL}/messages/${encodeURIComponent(externalMessageId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: targetChatId,
          force: true,
        }),
      });
      const payload = await readResponsePayload(response);

      if (!response.ok) {
        return new Response(JSON.stringify({ error: parseWhapiError(payload) || 'Falha ao encaminhar mensagem na Whapi.' }), {
          status: response.status,
          headers: jsonHeaders,
        });
      }

      const forwardedMessageId = extractWhapiMessageId(payload);
      const deliveryStatus = resolveWhapiOutboundDeliveryStatus(payload, forwardedMessageId);
      const nowIso = getNowIso();
      const { data: targetChat } = await supabaseAdmin
        .from('comm_whatsapp_chats')
        .select('display_name, push_name')
        .eq('channel_id', channel.id)
        .eq('external_chat_id', targetChatId)
        .maybeSingle();
      const phoneDigits = extractPhoneFromChatId(targetChatId);
      const summaryText = toTrimmedString(message.media_caption) || toTrimmedString(message.text_content) || '[Mensagem encaminhada]';

      await persistCommWhatsAppMessage(supabaseAdmin, {
        channelId: channel.id,
        externalChatId: targetChatId,
        phoneNumber: phoneDigits || null,
        displayName: toTrimmedString(targetChat?.display_name) || formatPhoneLabel(phoneDigits),
        pushName: toTrimmedString(targetChat?.push_name) || null,
        lastMessageText: summaryText,
        lastMessageDirection: 'outbound',
        lastMessageAt: nowIso,
        incrementUnread: false,
        externalMessageId: forwardedMessageId || null,
        direction: 'outbound',
        messageType: toTrimmedString(message.message_type) || 'text',
        deliveryStatus,
        textContent: summaryText,
        createdBy: authResult.user.profileId,
        source: 'api',
        senderPhone: channel.phone_number,
        senderName: channel.connected_user_name,
        statusUpdatedAt: nowIso,
        errorMessage: null,
        mediaId: null,
        mediaUrl: null,
        mediaMimeType: null,
        mediaFileName: null,
        mediaSizeBytes: null,
        mediaDurationSeconds: null,
        mediaCaption: null,
        metadata: {
          provider: 'whapi',
          forwarded: true,
          forwarded_from_external_message_id: externalMessageId,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        action: 'forward',
        messageId: forwardedMessageId || null,
        status: deliveryStatus,
      }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const response = await fetch(`${WHAPI_BASE_URL}/messages/${encodeURIComponent(externalMessageId)}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: parseWhapiError(payload) || 'Falha ao apagar mensagem na Whapi.' }), {
        status: response.status,
        headers: jsonHeaders,
      });
    }

    const deletedAt = getNowIso();
    await markCommWhatsAppMessageDeleted(supabaseAdmin, {
      channelId: channel.id,
      targetExternalMessageId: externalMessageId,
      deletedAt,
      originalText: toTrimmedString(message.media_caption) || toTrimmedString(message.text_content) || null,
      actionType: 'manual_delete',
      deletedBy: 'self',
    });

    return new Response(JSON.stringify({
      success: true,
      action: 'delete',
      deletedAt,
    }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-manage-message] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao gerenciar mensagem.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
