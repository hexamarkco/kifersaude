// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  WHAPI_BASE_URL,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
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
    if (!settings.token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi não configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const channel = await ensurePrimaryChannel(supabaseAdmin);
    const { data: targetMessage, error: messageError } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .select('id, metadata')
      .eq('channel_id', channel.id)
      .eq('external_message_id', messageId)
      .maybeSingle();

    if (messageError) {
      throw new Error(`Erro ao localizar mensagem para reação: ${messageError.message}`);
    }

    const response = await fetch(`${WHAPI_BASE_URL}/messages/${encodeURIComponent(messageId)}/reaction`, {
      method: emoji ? 'PUT' : 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${settings.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emoji ? { to: chatId, emoji } : { to: chatId }),
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(parseWhapiError(payload) || 'Não foi possível atualizar a reação da mensagem.');
    }

    if (targetMessage) {
      const metadata = targetMessage.metadata && typeof targetMessage.metadata === 'object' && !Array.isArray(targetMessage.metadata)
        ? targetMessage.metadata as Record<string, unknown>
        : {};
      const reactions = Array.isArray(metadata.reactions)
        ? metadata.reactions.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
        : [];
      const withoutSelfReaction = reactions.filter((item) => toTrimmedString(item.actor_key) !== 'self');
      const nextReactions = emoji
        ? [
            ...withoutSelfReaction,
            {
              actor_key: 'self',
              emoji,
              from_me: true,
              from: channel.phone_number || null,
              from_name: channel.connected_user_name || null,
              reacted_at: new Date().toISOString(),
              target_external_message_id: messageId,
            },
          ]
        : withoutSelfReaction;

      const { error: updateError } = await supabaseAdmin
        .from('comm_whatsapp_messages')
        .update({
          metadata: {
            ...metadata,
            reactions: nextReactions,
            last_reaction_at: new Date().toISOString(),
          },
        })
        .eq('id', targetMessage.id);

      if (updateError) {
        throw new Error(`Erro ao atualizar reação da mensagem no banco: ${updateError.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[comm-whatsapp-react] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao reagir à mensagem.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
