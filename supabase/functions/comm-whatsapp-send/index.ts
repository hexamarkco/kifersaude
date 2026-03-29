// @ts-ignore Deno npm import
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
};

type MediaSendKind = 'image' | 'video' | 'document' | 'audio' | 'voice';

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

  const uploadedMediaId = extractWhapiMediaId(uploadPayload);
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

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      chatId = normalizeWhapiChatId(form.get('chatId'));
      text = toTrimmedString(form.get('caption'));
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
      text = toTrimmedString(body.text);
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
          },
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

      return new Response(JSON.stringify({ error: errorMessage || 'Falha ao enviar mensagem na Whapi.' }), {
        status: whapiResponse.status,
        headers: jsonHeaders,
      });
    }

    if (whapiPayload && typeof whapiPayload === 'object' && !Array.isArray(whapiPayload)) {
      const sent = (whapiPayload as Record<string, unknown>).sent;
      if (sent === false) {
        return new Response(JSON.stringify({ error: 'A Whapi nao confirmou o envio da mensagem.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
    }

    const externalMessageId = extractWhapiMessageId(whapiPayload);
    const deliveryStatus = extractWhapiMessageStatus(whapiPayload) || 'pending';
    uploadedMediaId = extractWhapiMediaId(whapiPayload);
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
      },
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
