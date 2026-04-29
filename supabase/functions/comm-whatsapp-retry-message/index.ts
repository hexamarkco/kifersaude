// @ts-expect-error Deno npm import
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
  clientRequestId?: string;
};

type SendRequestRow = {
  id: string;
  status: string;
  external_message_id: string | null;
  delivery_status: string | null;
  error_message: string | null;
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

const sanitizeClientRequestId = (value: unknown) => {
  const normalized = toTrimmedString(value).replace(/[^a-zA-Z0-9:_-]/g, '');
  return normalized.slice(0, 128);
};

async function reserveRetryRequest(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: {
    channelId: string;
    clientRequestId: string;
    messageId: string;
  },
): Promise<{ reserved: boolean; row: SendRequestRow | null }> {
  if (!params.clientRequestId) {
    return { reserved: true, row: null };
  }

  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_send_requests')
    .insert({
      channel_id: params.channelId,
      client_request_id: params.clientRequestId,
      request_kind: 'retry',
      payload: { messageId: params.messageId },
      status: 'sending',
    })
    .select('id,status,external_message_id,delivery_status,error_message')
    .maybeSingle();

  if (!error) {
    return { reserved: true, row: data as SendRequestRow | null };
  }

  const errorCode = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '';
  if (errorCode !== '23505') {
    throw new Error(`Erro ao reservar retry do WhatsApp: ${error.message}`);
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('comm_whatsapp_send_requests')
    .select('id,status,external_message_id,delivery_status,error_message')
    .eq('channel_id', params.channelId)
    .eq('client_request_id', params.clientRequestId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao consultar retry duplicado do WhatsApp: ${existingError.message}`);
  }

  const existingRow = existing as SendRequestRow | null;
  if (existingRow?.status === 'failed') {
    const { data: retryRow, error: retryError } = await supabaseAdmin
      .from('comm_whatsapp_send_requests')
      .update({
        request_kind: 'retry',
        payload: { messageId: params.messageId },
        status: 'sending',
        external_message_id: null,
        delivery_status: null,
        error_message: null,
        updated_at: getNowIso(),
      })
      .eq('id', existingRow.id)
      .select('id,status,external_message_id,delivery_status,error_message')
      .maybeSingle();

    if (retryError) {
      throw new Error(`Erro ao reabrir retry do WhatsApp: ${retryError.message}`);
    }

    return { reserved: true, row: retryRow as SendRequestRow | null };
  }

  return { reserved: false, row: existingRow };
}

async function completeRetryRequest(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  requestId: string | null | undefined,
  params: { externalMessageId: string | null; deliveryStatus: string },
) {
  if (!requestId) {
    return;
  }

  await supabaseAdmin
    .from('comm_whatsapp_send_requests')
    .update({
      status: 'completed',
      external_message_id: params.externalMessageId,
      delivery_status: params.deliveryStatus,
      error_message: null,
      updated_at: getNowIso(),
    })
    .eq('id', requestId);
}

async function failRetryRequest(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  requestId: string | null | undefined,
  errorMessage: string,
) {
  if (!requestId) {
    return;
  }

  await supabaseAdmin
    .from('comm_whatsapp_send_requests')
    .update({
      status: 'failed',
      error_message: errorMessage,
      updated_at: getNowIso(),
    })
    .eq('id', requestId);
}

const buildDuplicateRetryResponse = (row: SendRequestRow | null) => new Response(
  JSON.stringify({
    success: true,
    duplicate: true,
    messageId: row?.external_message_id ?? null,
    status: row?.delivery_status || row?.status || 'pending',
    error: row?.status === 'failed' ? row.error_message : undefined,
  }),
  {
    status: row?.status === 'failed' ? 409 : 202,
    headers: jsonHeaders,
  },
);

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
    const clientRequestId = sanitizeClientRequestId(body.clientRequestId);

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

    const retryRequest = await reserveRetryRequest(supabaseAdmin, {
      channelId: channel.id,
      clientRequestId,
      messageId,
    });

    if (!retryRequest.reserved) {
      return buildDuplicateRetryResponse(retryRequest.row);
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
      await failRetryRequest(supabaseAdmin, retryRequest.row?.id, errorMessage || 'Nao foi possivel reenviar a midia.');
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
        ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
      },
    });

    await completeRetryRequest(supabaseAdmin, retryRequest.row?.id, {
      externalMessageId: externalMessageId || null,
      deliveryStatus,
    });

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
