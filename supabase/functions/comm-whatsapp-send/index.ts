// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  WHAPI_BASE_URL,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractPhoneFromChatId,
  extractWhapiMediaId,
  extractWhapiMessageId,
  extractWhapiMessageStatus,
  extractWhapiUploadMediaId,
  formatPhoneLabel,
  getNowIso,
  isDirectWhapiChatId,
  normalizeWhapiChatId,
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

type SendMessageBody = {
  chatId?: string;
  text?: string;
  type?: string;
  caption?: string;
  durationSeconds?: number;
  waveform?: string;
  remoteUrl?: string;
  fileName?: string;
  mimeType?: string;
  clientRequestId?: string;
};

type MediaSendKind = 'image' | 'video' | 'document' | 'audio' | 'voice';

type SendRequestRow = {
  id: string;
  status: string;
  external_message_id: string | null;
  delivery_status: string | null;
  error_message: string | null;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

async function resolveChatForSend(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  channelId: string,
  externalChatId: string,
) {
  const { data: existing, error } = await supabaseAdmin
    .from('comm_whatsapp_chats')
    .select('display_name, push_name')
    .eq('channel_id', channelId)
    .eq('external_chat_id', externalChatId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao localizar conversa: ${error.message}`);
  }

  return (existing ?? null) as { display_name: string | null; push_name: string | null } | null;
}

const normalizeMediaKind = (value: string, mimeType: string): MediaSendKind => {
  const requested = value.trim().toLowerCase();
  if (requested === 'image' || requested === 'video' || requested === 'document' || requested === 'audio' || requested === 'voice') {
    return requested;
  }

  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }

  return 'document';
};

const buildMediaSummary = (kind: MediaSendKind, caption: string) => {
  if (caption) return caption;
  if (kind === 'image') return '[Imagem]';
  if (kind === 'video') return '[Video]';
  if (kind === 'audio' || kind === 'voice') return '[Audio]';
  return '[Documento]';
};

const stripMimeParameters = (value: string) => value.split(';')[0]?.trim() || 'application/octet-stream';

const sanitizeFileName = (value: string, fallback: string) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\s+/g, '_');
};

const inferRemoteFileName = (remoteUrl: string, fallback: string) => {
  try {
    const url = new URL(remoteUrl);
    const pathname = url.pathname.split('/').filter(Boolean).pop() || '';
    return sanitizeFileName(pathname, fallback);
  } catch {
    return sanitizeFileName('', fallback);
  }
};

const isAllowedRemoteMediaUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['media.tenor.com', 'media1.tenor.com'].includes(url.hostname);
  } catch {
    return false;
  }
};

const fetchRemoteMediaFile = async (params: {
  remoteUrl: string;
  mimeType?: string;
  fileName?: string;
}) => {
  if (!isAllowedRemoteMediaUrl(params.remoteUrl)) {
    throw new Error('Origem de mídia remota não permitida.');
  }

  const response = await fetch(params.remoteUrl, {
    method: 'GET',
    headers: {
      Accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error('Não foi possível baixar a mídia selecionada.');
  }

  const contentType = stripMimeParameters(params.mimeType || response.headers.get('content-type') || 'application/octet-stream');
  const extension = contentType === 'video/mp4'
    ? 'mp4'
    : contentType === 'image/webp'
      ? 'webp'
      : contentType === 'image/gif'
        ? 'gif'
        : contentType.startsWith('image/')
          ? 'png'
          : 'bin';
  const fallbackName = `remote-media.${extension}`;
  const fileName = sanitizeFileName(params.fileName || inferRemoteFileName(params.remoteUrl, fallbackName), fallbackName);
  const bytes = await response.arrayBuffer();

  return new File([bytes], fileName, { type: contentType });
};

const sanitizeClientRequestId = (value: unknown) => {
  const normalized = toTrimmedString(value).replace(/[^a-zA-Z0-9:_-]/g, '');
  return normalized.slice(0, 128);
};

async function reserveSendRequest(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: {
    channelId: string;
    clientRequestId: string;
    requestKind: string;
    payload: Record<string, unknown>;
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
      request_kind: params.requestKind,
      payload: params.payload,
      status: 'sending',
    })
    .select('id,status,external_message_id,delivery_status,error_message')
    .maybeSingle();

  if (!error) {
    return { reserved: true, row: data as SendRequestRow | null };
  }

  const errorCode = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '';
  if (errorCode !== '23505') {
    throw new Error(`Erro ao reservar envio do WhatsApp: ${error.message}`);
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('comm_whatsapp_send_requests')
    .select('id,status,external_message_id,delivery_status,error_message')
    .eq('channel_id', params.channelId)
    .eq('client_request_id', params.clientRequestId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao consultar envio duplicado do WhatsApp: ${existingError.message}`);
  }

  const existingRow = existing as SendRequestRow | null;
  if (existingRow?.status === 'failed') {
    const { data: retryRow, error: retryError } = await supabaseAdmin
      .from('comm_whatsapp_send_requests')
      .update({
        request_kind: params.requestKind,
        payload: params.payload,
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
      throw new Error(`Erro ao reabrir envio do WhatsApp: ${retryError.message}`);
    }

    return { reserved: true, row: retryRow as SendRequestRow | null };
  }

  return { reserved: false, row: existingRow };
}

async function completeSendRequest(
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

async function failSendRequest(
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

const buildDuplicateSendResponse = (row: SendRequestRow | null) => new Response(
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

const deriveVoiceFileName = (mimeType: string, originalName: string) => {
  const safeName = sanitizeFileName(originalName, 'voice-note');
  if (/\.(ogg|opus|oga|webm)$/i.test(safeName)) {
    return safeName;
  }

  if (mimeType === 'audio/ogg') {
    return `${safeName}.ogg`;
  }

  return `${safeName}.webm`;
};

const fileBytesToDataUrl = (bytes: Uint8Array, mimeType: string, fileName: string) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return `data:${mimeType};name=${fileName};base64,${btoa(binary)}`;
};

async function sendAudioLikeWhapi(params: {
  token: string;
  kind: 'audio' | 'voice';
  chatId: string;
  caption: string;
  waveform: string;
  file: File;
}): Promise<{ response: Response; payload: unknown; mediaId: string }> {
  const cleanMimeType = stripMimeParameters(params.file.type || 'audio/webm');
  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const normalizedFileName =
    params.kind === 'voice'
      ? deriveVoiceFileName(cleanMimeType, params.file.name || 'voice-note')
      : sanitizeFileName(params.file.name || 'audio-file', 'audio-file');

  const jsonPayload: Record<string, unknown> = {
    to: params.chatId,
    media: fileBytesToDataUrl(bytes, cleanMimeType, normalizedFileName),
  };

  if (params.kind !== 'voice' && params.caption) {
    jsonPayload.caption = params.caption;
  }

  if (params.kind === 'voice' && params.waveform) {
    jsonPayload.waveform = params.waveform;
  }

  let response = await fetch(`${WHAPI_BASE_URL}/messages/${params.kind}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify(jsonPayload),
  });
  let payload = await readResponsePayload(response);

  if (response.ok) {
    return {
      response,
      payload,
      mediaId: extractWhapiMediaId(payload),
    };
  }

  const freshFile = new File([bytes], normalizedFileName, { type: cleanMimeType });
  const messageForm = new FormData();
  messageForm.append('to', params.chatId);
  if (params.kind !== 'voice' && params.caption) {
    messageForm.append('caption', params.caption);
  }
  if (params.kind === 'voice' && params.waveform) {
    messageForm.append('waveform', params.waveform);
  }
  messageForm.append('media', freshFile, freshFile.name);

  response = await fetch(`${WHAPI_BASE_URL}/messages/${params.kind}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: messageForm,
  });
  payload = await readResponsePayload(response);

  if (response.ok) {
    return {
      response,
      payload,
      mediaId: extractWhapiMediaId(payload),
    };
  }

  const uploadForm = new FormData();
  uploadForm.append('media', freshFile, freshFile.name);

  const uploadResponse = await fetch(`${WHAPI_BASE_URL}/media`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: uploadForm,
  });
  const uploadPayload = await readResponsePayload(uploadResponse);

  if (!uploadResponse.ok) {
    return {
      response: uploadResponse,
      payload: uploadPayload,
      mediaId: '',
    };
  }

  const uploadedMediaId = extractWhapiUploadMediaId(uploadPayload);
  if (!uploadedMediaId) {
    return {
      response: uploadResponse,
      payload: uploadPayload,
      mediaId: '',
    };
  }

  const mediaIdPayload: Record<string, unknown> = {
    to: params.chatId,
    media: uploadedMediaId,
  };

  if (params.kind !== 'voice' && params.caption) {
    mediaIdPayload.caption = params.caption;
  }

  if (params.kind === 'voice' && params.waveform) {
    mediaIdPayload.waveform = params.waveform;
  }

  response = await fetch(`${WHAPI_BASE_URL}/messages/${params.kind}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify(mediaIdPayload),
  });
  payload = await readResponsePayload(response);

  return {
    response,
    payload,
    mediaId: uploadedMediaId,
  };
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

    const contentType = req.headers.get('content-type') || '';
    let chatId = '';
    let text = '';
    let mediaKind: MediaSendKind | null = null;
    let mediaFile: File | null = null;
    let mediaDurationSeconds: number | null = null;
    let mediaWaveform = '';
    let remoteUrl = '';
    let clientRequestId = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      chatId = normalizeWhapiChatId(form.get('chatId'));
      text = toTrimmedString(form.get('caption'));
      clientRequestId = sanitizeClientRequestId(form.get('clientRequestId'));
      const uploaded = form.get('file');

      if (!(uploaded instanceof File)) {
        return new Response(JSON.stringify({ error: 'Arquivo obrigatorio para envio de midia.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      mediaFile = uploaded;
      mediaKind = normalizeMediaKind(toTrimmedString(form.get('type')), uploaded.type);
      const durationRaw = Number(form.get('durationSeconds'));
      mediaDurationSeconds = Number.isFinite(durationRaw) ? Math.max(0, Math.round(durationRaw)) : null;
      mediaWaveform = toTrimmedString(form.get('waveform'));
    } else {
      const body = (await req.json().catch(() => ({}))) as SendMessageBody;
      chatId = normalizeWhapiChatId(body.chatId);
      text = toTrimmedString(body.text) || toTrimmedString(body.caption);
      clientRequestId = sanitizeClientRequestId(body.clientRequestId);
      remoteUrl = toTrimmedString(body.remoteUrl);
      if (remoteUrl) {
        mediaFile = await fetchRemoteMediaFile({
          remoteUrl,
          mimeType: toTrimmedString(body.mimeType) || undefined,
          fileName: toTrimmedString(body.fileName) || undefined,
        });
        mediaKind = normalizeMediaKind(toTrimmedString(body.type), mediaFile.type);
      }
    }

    if (!chatId || !isDirectWhapiChatId(chatId)) {
      return new Response(JSON.stringify({ error: 'Conversa invalida para envio.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!mediaFile && !text) {
      return new Response(JSON.stringify({ error: 'Mensagem obrigatoria.' }), {
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

    const sendRequest = await reserveSendRequest(supabaseAdmin, {
      channelId: channel.id,
      clientRequestId,
      requestKind: mediaFile ? 'media' : 'text',
      payload: {
        chatId,
        type: mediaKind || 'text',
        textLength: text.length,
        fileName: mediaFile?.name || null,
        fileSize: mediaFile?.size || null,
        remoteUrl: remoteUrl || null,
      },
    });

    if (!sendRequest.reserved) {
      return buildDuplicateSendResponse(sendRequest.row);
    }

    let whapiResponse: Response;
    let uploadedMediaId = '';

    if (mediaFile && mediaKind) {
      if (mediaKind === 'audio' || mediaKind === 'voice') {
        const audioLikeResult = await sendAudioLikeWhapi({
          token,
          kind: mediaKind,
          chatId,
          caption: text,
          waveform: mediaWaveform,
          file: mediaFile,
        });

        whapiResponse = audioLikeResult.response;
        uploadedMediaId = audioLikeResult.mediaId;
        const whapiPayload = audioLikeResult.payload;

        if (!whapiResponse.ok) {
          const errorMessage = parseWhapiError(whapiPayload);
          await failSendRequest(supabaseAdmin, sendRequest.row?.id, errorMessage || 'Falha ao enviar mensagem na Whapi.');

          return new Response(JSON.stringify({ error: errorMessage || 'Falha ao enviar mensagem na Whapi.' }), {
            status: whapiResponse.status,
            headers: jsonHeaders,
          });
        }

        const externalMessageId = extractWhapiMessageId(whapiPayload);
        const deliveryStatus = extractWhapiMessageStatus(whapiPayload) || 'pending';
        const nowIso = getNowIso();
        const existingChat = await resolveChatForSend(supabaseAdmin, channel.id, chatId);
        const phoneDigits = extractPhoneFromChatId(chatId);
        const summaryText = buildMediaSummary(mediaKind, text);

        await persistCommWhatsAppMessage(supabaseAdmin, {
          channelId: channel.id,
          externalChatId: chatId,
          phoneNumber: phoneDigits || null,
          displayName: existingChat?.display_name || formatPhoneLabel(phoneDigits),
          pushName: existingChat?.push_name || null,
          lastMessageText: summaryText,
          lastMessageDirection: 'outbound',
          lastMessageAt: nowIso,
          incrementUnread: false,
          externalMessageId: externalMessageId || null,
          direction: 'outbound',
          messageType: mediaKind,
          deliveryStatus,
          textContent: summaryText,
          createdBy: authResult.user.profileId,
          source: 'api',
          senderPhone: channel.phone_number,
          senderName: channel.connected_user_name,
          statusUpdatedAt: nowIso,
          errorMessage: null,
          mediaId: uploadedMediaId || null,
          mediaUrl: null,
          mediaMimeType: stripMimeParameters(mediaFile.type || 'application/octet-stream'),
          mediaFileName: mediaFile?.name || null,
          mediaSizeBytes: mediaFile ? mediaFile.size : null,
          mediaDurationSeconds: mediaDurationSeconds,
          mediaCaption: mediaKind === 'voice' ? null : text || null,
          metadata: {
            provider: 'whapi',
            ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
          },
        });

        await completeSendRequest(supabaseAdmin, sendRequest.row?.id, {
          externalMessageId: externalMessageId || null,
          deliveryStatus,
        });

        return new Response(
          JSON.stringify({
            success: true,
            messageId: externalMessageId || null,
            status: deliveryStatus,
          }),
          {
            status: 200,
            headers: jsonHeaders,
          },
        );
      } else {
        const messageForm = new FormData();
        messageForm.append('to', chatId);
        if (text) {
          messageForm.append('caption', text);
        }
        messageForm.append('media', mediaFile, mediaFile.name);

        whapiResponse = await fetch(`${WHAPI_BASE_URL}/messages/${mediaKind}`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: messageForm,
        });
      }
    } else {
      whapiResponse = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: chatId,
          body: text,
        }),
      });
    }

    const whapiPayload = await readResponsePayload(whapiResponse);

    if (!whapiResponse.ok) {
      const errorMessage = parseWhapiError(whapiPayload);
      await failSendRequest(supabaseAdmin, sendRequest.row?.id, errorMessage || 'Falha ao enviar mensagem na Whapi.');

      return new Response(JSON.stringify({ error: errorMessage || 'Falha ao enviar mensagem na Whapi.' }), {
        status: whapiResponse.status,
        headers: jsonHeaders,
      });
    }

    if (whapiPayload && typeof whapiPayload === 'object' && !Array.isArray(whapiPayload)) {
      const sent = (whapiPayload as Record<string, unknown>).sent;
      if (sent === false) {
        await failSendRequest(supabaseAdmin, sendRequest.row?.id, 'A Whapi nao confirmou o envio da mensagem.');
        return new Response(JSON.stringify({ error: 'A Whapi nao confirmou o envio da mensagem.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
    }

    const externalMessageId = extractWhapiMessageId(whapiPayload);
    const deliveryStatus = extractWhapiMessageStatus(whapiPayload) || 'pending';
    uploadedMediaId = uploadedMediaId || extractWhapiMediaId(whapiPayload);
    const nowIso = getNowIso();
    const existingChat = await resolveChatForSend(supabaseAdmin, channel.id, chatId);
    const phoneDigits = extractPhoneFromChatId(chatId);
    const summaryText = buildMediaSummary(mediaKind ?? 'document', text);
    const isMediaMessage = Boolean(mediaFile && mediaKind);

    await persistCommWhatsAppMessage(supabaseAdmin, {
      channelId: channel.id,
      externalChatId: chatId,
      phoneNumber: phoneDigits || null,
      displayName: existingChat?.display_name || formatPhoneLabel(phoneDigits),
      pushName: existingChat?.push_name || null,
      lastMessageText: isMediaMessage ? summaryText : text,
      lastMessageDirection: 'outbound',
      lastMessageAt: nowIso,
      incrementUnread: false,
      externalMessageId: externalMessageId || null,
      direction: 'outbound',
      messageType: mediaKind || 'text',
      deliveryStatus,
      textContent: isMediaMessage ? summaryText : text,
      createdBy: authResult.user.profileId,
      source: 'api',
      senderPhone: channel.phone_number,
      senderName: channel.connected_user_name,
      statusUpdatedAt: nowIso,
      errorMessage: null,
      mediaId: uploadedMediaId || null,
      mediaUrl: null,
      mediaMimeType: mediaFile?.type || null,
      mediaFileName: mediaFile?.name || null,
      mediaSizeBytes: mediaFile ? mediaFile.size : null,
      mediaDurationSeconds: mediaDurationSeconds,
      mediaCaption: mediaKind === 'voice' ? null : text || null,
      metadata: {
        provider: 'whapi',
        ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
      },
    });

    await completeSendRequest(supabaseAdmin, sendRequest.row?.id, {
      externalMessageId: externalMessageId || null,
      deliveryStatus,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: externalMessageId || null,
        status: deliveryStatus,
      }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  } catch (error) {
    console.error('[comm-whatsapp-send] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao enviar mensagem.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
