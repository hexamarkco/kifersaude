// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import {
  applyCommWhatsAppMessageMutation,
  COMM_WHATSAPP_MODULE,
  WHAPI_BASE_URL,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  fetchWhapiWithTimeout,
  getNowIso,
  parseWhapiError,
  readResponsePayload,
  toTrimmedString,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type ReactBody = {
  chatId?: string;
  messageId?: string;
  emoji?: string | null;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase não configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405, headers: jsonHeaders });
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

    const body = (await req.json().catch(() => ({}))) as ReactBody;
    const chatId = toTrimmedString(body.chatId);
    const messageId = toTrimmedString(body.messageId);
    const emoji = toTrimmedString(body.emoji);

    if (!chatId || !messageId) {
      return new Response(JSON.stringify({ error: 'Conversa e mensagem são obrigatórias para reagir.' }), {
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
      return new Response(JSON.stringify({ error: 'Token da Whapi não configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const channel = await ensurePrimaryChannel(supabaseAdmin);
    const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/messages/${encodeURIComponent(messageId)}/reaction`, {
      method: emoji ? 'PUT' : 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${settings.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emoji ? { to: chatId, emoji } : { to: chatId }),
    }, 15_000);

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(parseWhapiError(payload) || 'Não foi possível atualizar a reação da mensagem.');
    }

    const reactedAt = getNowIso();
    await applyCommWhatsAppMessageMutation(supabaseAdmin, {
      channelId: channel.id,
      targetExternalMessageId: messageId,
      mutationType: 'reaction',
      occurredAt: reactedAt,
      payload: {
        actor_key: 'self',
        emoji: emoji || null,
        from_me: true,
        from: channel.phone_number || null,
        from_name: channel.connected_user_name || null,
      },
      dedupeKey: `manual-reaction:${messageId}:${reactedAt}`,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[comm-whatsapp-react] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao reagir à mensagem.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
