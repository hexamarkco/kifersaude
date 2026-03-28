// @ts-ignore Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  WHAPI_BASE_URL,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractWhapiMessageId,
  extractWhapiMessageStatus,
  formatPhoneLabel,
  getNowIso,
  parseWhapiError,
  persistCommWhatsAppMessage,
  readResponsePayload,
  sanitizeWhapiToken,
  toTrimmedString,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type RetryBody = {
  messageId?: string;
};

type RetryTargetRow = {
  id: string;
  external_chat_id: string;
  phone_number: string;
  display_name: string;
  push_name: string | null;
  message_type: string;
  media_id: string | null;
  media_caption: string | null;
  text_content: string | null;
  media_file_name: string | null;
  media_mime_type: string | null;
  media_size_bytes: number | null;
  media_duration_seconds: number | null;
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

const buildMediaSummary = (kind: string, caption: string) => {
  if (caption) return caption;
  if (kind === 'image') return '[Imagem]';
  if (kind === 'audio' || kind === 'voice') return '[Audio]';
  return '[Documento]';
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

    const body = (await req.json().catch(() => ({}))) as RetryBody;
    const messageId = toTrimmedString(body.messageId);

    if (!messageId) {
      return new Response(JSON.stringify({ error: 'Mensagem obrigatoria para reenvio.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .select(
        `
          id,
          message_type,
          media_id,
          media_caption,
          text_content,
          media_file_name,
          media_mime_type,
          media_size_bytes,
          media_duration_seconds,
          comm_whatsapp_chats!inner (
            external_chat_id,
            phone_number,
            display_name,
            push_name
          )
        `,
      )
      .eq('id', messageId)
      .eq('direction', 'outbound')
      .single();

    if (targetError || !target) {
      return new Response(JSON.stringify({ error: 'Mensagem de midia nao encontrada para reenvio.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const chat = Array.isArray((target as Record<string, unknown>).comm_whatsapp_chats)
      ? ((target as Record<string, unknown>).comm_whatsapp_chats as Array<Record<string, unknown>>)[0]
      : ((target as Record<string, unknown>).comm_whatsapp_chats as Record<string, unknown> | null);

    const retryTarget: RetryTargetRow = {
      id: toTrimmedString((target as Record<string, unknown>).id),
      external_chat_id: toTrimmedString(chat?.external_chat_id),
      phone_number: toTrimmedString(chat?.phone_number),
      display_name: toTrimmedString(chat?.display_name),
      push_name: toTrimmedString(chat?.push_name) || null,
      message_type: toTrimmedString((target as Record<string, unknown>).message_type),
      media_id: toTrimmedString((target as Record<string, unknown>).media_id) || null,
      media_caption: toTrimmedString((target as Record<string, unknown>).media_caption) || null,
      text_content: toTrimmedString((target as Record<string, unknown>).text_content) || null,
      media_file_name: toTrimmedString((target as Record<string, unknown>).media_file_name) || null,
      media_mime_type: toTrimmedString((target as Record<string, unknown>).media_mime_type) || null,
      media_size_bytes: Number((target as Record<string, unknown>).media_size_bytes) || null,
      media_duration_seconds: Number((target as Record<string, unknown>).media_duration_seconds) || null,
    };

    if (!retryTarget.external_chat_id || !retryTarget.media_id) {
      return new Response(JSON.stringify({ error: 'A mensagem nao possui midia reutilizavel para retry.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!['image', 'video', 'document', 'audio', 'voice'].includes(retryTarget.message_type)) {
      return new Response(JSON.stringify({ error: 'Retry disponivel apenas para midias outbound.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    const channel = await ensurePrimaryChannel(supabaseAdmin);
    const token = sanitizeWhapiToken(settings.token);

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const caption = retryTarget.media_caption || (retryTarget.text_content?.startsWith('[') ? '' : retryTarget.text_content || '');
    const response = await fetch(`${WHAPI_BASE_URL}/messages/${retryTarget.message_type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: retryTarget.external_chat_id,
        media: retryTarget.media_id,
        caption: retryTarget.message_type === 'voice' ? undefined : caption || undefined,
      }),
    });

    const whapiPayload = await readResponsePayload(response);

    if (!response.ok) {
      const errorMessage = parseWhapiError(whapiPayload);
      await supabaseAdmin.from('comm_whatsapp_channels').update({ last_error: errorMessage }).eq('id', channel.id);

      return new Response(JSON.stringify({ error: errorMessage || 'Nao foi possivel reenviar a midia.' }), {
        status: response.status,
        headers: jsonHeaders,
      });
    }

    const externalMessageId = extractWhapiMessageId(whapiPayload);
    const deliveryStatus = extractWhapiMessageStatus(whapiPayload) || 'pending';
    const nowIso = getNowIso();
    const summaryText = buildMediaSummary(retryTarget.message_type, caption);

    await persistCommWhatsAppMessage(supabaseAdmin, {
      channelId: channel.id,
      externalChatId: retryTarget.external_chat_id,
      phoneNumber: retryTarget.phone_number || null,
      displayName: retryTarget.display_name || formatPhoneLabel(retryTarget.phone_number),
      pushName: retryTarget.push_name,
      lastMessageText: summaryText,
      lastMessageDirection: 'outbound',
      lastMessageAt: nowIso,
      incrementUnread: false,
      externalMessageId: externalMessageId || null,
      direction: 'outbound',
      messageType: retryTarget.message_type,
      deliveryStatus,
      textContent: summaryText,
      createdBy: authResult.user.profileId,
      source: 'retry',
      senderName: channel.connected_user_name,
      senderPhone: channel.phone_number,
      statusUpdatedAt: nowIso,
      errorMessage: null,
      mediaId: retryTarget.media_id,
      mediaUrl: null,
      mediaMimeType: retryTarget.media_mime_type,
      mediaFileName: retryTarget.media_file_name,
      mediaSizeBytes: retryTarget.media_size_bytes,
      mediaDurationSeconds: retryTarget.media_duration_seconds,
      mediaCaption: retryTarget.message_type === 'voice' ? null : caption || null,
      metadata: {
        provider: 'whapi',
        retry_of: retryTarget.id,
      },
    });

    await supabaseAdmin.from('comm_whatsapp_channels').update({ last_error: null }).eq('id', channel.id);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: externalMessageId || null,
        status: deliveryStatus,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    console.error('[comm-whatsapp-retry-message] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao reenviar midia.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
