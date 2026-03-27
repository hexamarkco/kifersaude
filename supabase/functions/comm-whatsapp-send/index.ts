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
};

type MediaSendKind = 'image' | 'document' | 'audio' | 'voice';

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
  if (requested === 'image' || requested === 'document' || requested === 'audio' || requested === 'voice') {
    return requested;
  }

  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }

  return 'document';
};

const buildMediaSummary = (kind: MediaSendKind, caption: string) => {
  if (caption) return caption;
  if (kind === 'image') return '[Imagem]';
  if (kind === 'audio' || kind === 'voice') return '[Audio]';
  return '[Documento]';
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

    const contentType = req.headers.get('content-type') || '';
    let chatId = '';
    let text = '';
    let mediaKind: MediaSendKind | null = null;
    let mediaFile: File | null = null;

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
      const uploadForm = new FormData();
      uploadForm.append('media', mediaFile, mediaFile.name);

      const uploadResponse = await fetch(`${WHAPI_BASE_URL}/media`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: uploadForm,
      });

      const uploadPayload = await readResponsePayload(uploadResponse);
      if (!uploadResponse.ok) {
        const errorMessage = parseWhapiError(uploadPayload);
        return new Response(JSON.stringify({ error: errorMessage || 'Falha ao enviar arquivo para a Whapi.' }), {
          status: uploadResponse.status,
          headers: jsonHeaders,
        });
      }

      uploadedMediaId = extractWhapiMediaId(uploadPayload);
      if (!uploadedMediaId) {
        return new Response(JSON.stringify({ error: 'A Whapi nao retornou MediaID para o arquivo enviado.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      whapiResponse = await fetch(`${WHAPI_BASE_URL}/messages/${mediaKind}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: chatId,
          media: uploadedMediaId,
          caption: text || undefined,
        }),
      });
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

      await supabaseAdmin
        .from('comm_whatsapp_channels')
        .update({ last_error: errorMessage })
        .eq('id', channel.id);

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
      mediaDurationSeconds: null,
      mediaCaption: text || null,
      metadata: {
        provider: 'whapi',
      },
    });

    await supabaseAdmin
      .from('comm_whatsapp_channels')
      .update({ last_error: null })
      .eq('id', channel.id);

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
