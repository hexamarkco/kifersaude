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
  extractWhapiMessageId,
  extractWhapiMessageStatus,
  formatPhoneLabel,
  getNowIso,
  isDirectWhapiChatId,
  normalizeCommWhatsAppPhone,
  normalizeWhapiChatId,
  parseWhapiError,
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

async function ensureChatExists(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  channelId: string,
  externalChatId: string,
) {
  const { data: existing, error } = await supabaseAdmin
    .from('comm_whatsapp_chats')
    .select('id, display_name')
    .eq('channel_id', channelId)
    .eq('external_chat_id', externalChatId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao localizar conversa: ${error.message}`);
  }

  if (existing) {
    return existing as { id: string; display_name: string };
  }

  const phoneDigits = normalizeCommWhatsAppPhone(extractPhoneFromChatId(externalChatId));
  const { data: created, error: createError } = await supabaseAdmin
    .from('comm_whatsapp_chats')
    .insert({
      channel_id: channelId,
      external_chat_id: externalChatId,
      phone_number: phoneDigits,
      phone_digits: phoneDigits,
      display_name: formatPhoneLabel(phoneDigits),
      unread_count: 0,
      last_message_direction: 'system',
    })
    .select('id, display_name')
    .single();

  if (createError || !created) {
    throw new Error(createError?.message || 'Nao foi possivel preparar a conversa para envio.');
  }

  return created as { id: string; display_name: string };
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

    const body = (await req.json().catch(() => ({}))) as SendMessageBody;
    const chatId = normalizeWhapiChatId(body.chatId);
    const text = toTrimmedString(body.text);

    if (!chatId || !isDirectWhapiChatId(chatId)) {
      return new Response(JSON.stringify({ error: 'Conversa invalida para envio.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!text) {
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

    const whapiResponse = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
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
    const chat = await ensureChatExists(supabaseAdmin, channel.id, chatId);

    const { error: chatError } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .update({
        last_message_text: text,
        last_message_direction: 'outbound',
        last_message_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', chat.id);

    if (chatError) {
      throw new Error(`Erro ao atualizar resumo da conversa: ${chatError.message}`);
    }

    const messagePayload = {
      chat_id: chat.id,
      channel_id: channel.id,
      external_message_id: externalMessageId || null,
      direction: 'outbound',
      message_type: 'text',
      delivery_status: deliveryStatus,
      text_content: text,
      message_at: nowIso,
      created_by: authResult.user.profileId,
      source: 'api',
      sender_phone: channel.phone_number,
      sender_name: channel.connected_user_name,
      status_updated_at: nowIso,
      metadata: {
        provider: 'whapi',
      },
    };

    if (externalMessageId) {
      const { error: messageError } = await supabaseAdmin
        .from('comm_whatsapp_messages')
        .upsert(messagePayload, { onConflict: 'channel_id,external_message_id' });

      if (messageError) {
        throw new Error(`Erro ao salvar mensagem enviada: ${messageError.message}`);
      }
    } else {
      const { error: messageError } = await supabaseAdmin.from('comm_whatsapp_messages').insert(messagePayload);
      if (messageError) {
        throw new Error(`Erro ao registrar mensagem enviada: ${messageError.message}`);
      }
    }

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
