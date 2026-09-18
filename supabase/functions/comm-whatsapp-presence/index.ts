import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  ensureCommWhatsAppSettings,
  fetchWhapiPresence,
  normalizeWhapiChatId,
  subscribeWhapiPresence,
  updateWhapiPresenceSubscription,
  persistWhapiPresence,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type PresenceBody = {
  chatId?: string;
};

type ChatRow = {
  id: string;
  channel_id: string;
  external_chat_id: string;
  is_group: boolean;
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

const SUBSCRIPTION_RETRY_COOLDOWN_MS = 15 * 60 * 1000;

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const response = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: jsonHeaders },
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: jsonHeaders });
  if (req.method !== 'POST') return response({ error: 'Metodo nao permitido' }, 405);

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
      if (!authResult.authorized) return response(authResult.body, authResult.status);
    }

    const body = (await req.json().catch(() => ({}))) as PresenceBody;
    const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
    if (!chatId) return response({ error: 'chatId obrigatorio.' }, 400);

    const { data: chat, error: chatError } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('id, channel_id, external_chat_id, is_group')
      .eq('id', chatId)
      .is('deleted_at', null)
      .maybeSingle<ChatRow>();
    if (chatError) throw new Error(`Nao foi possivel carregar a conversa para presenca: ${chatError.message}`);
    if (!chat) return response({ error: 'Conversa nao encontrada.' }, 404);

    const entryId = normalizeWhapiChatId(chat.external_chat_id);
    if (!entryId) return response({ error: 'Identificador Whapi invalido para presenca.' }, 400);

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    if (!settings.enabled) return response({ error: 'Integração WhatsApp desabilitada.' }, 403);
    if (!settings.token) return response({ error: 'Token da Whapi nao configurado.' }, 400);

    const { data: previous, error: previousError } = await supabaseAdmin
      .from('comm_whatsapp_presences')
      .select('status, last_seen_at, observed_at, subscription_status, subscription_attempted_at')
      .eq('channel_id', chat.channel_id)
      .eq('external_entry_id', entryId)
      .maybeSingle();
    if (previousError) throw new Error(`Nao foi possivel carregar estado de presenca: ${previousError.message}`);

    const attemptedAt = previous?.subscription_attempted_at ? Date.parse(previous.subscription_attempted_at) : 0;
    const subscriptionIsFresh = attemptedAt > 0 && Date.now() - attemptedAt < SUBSCRIPTION_RETRY_COOLDOWN_MS;
    const subscriptionWasAccepted = previous?.subscription_status === 'subscribed'
      || previous?.subscription_status === 'already_subscribed';

    let subscriptionStatus = previous?.subscription_status || 'unknown';
    let subscriptionError: string | null = null;
    if (!subscriptionWasAccepted || !subscriptionIsFresh) {
      await updateWhapiPresenceSubscription(supabaseAdmin, {
        channelId: chat.channel_id,
        entryId,
        update: { entryId, status: 'pending' },
      });

      try {
        const subscription = await subscribeWhapiPresence({ token: settings.token, entryId });
        subscriptionStatus = subscription.status;
        subscriptionError = subscription.error;
        await updateWhapiPresenceSubscription(supabaseAdmin, {
          channelId: chat.channel_id,
          entryId,
          update: {
            entryId,
            status: subscription.status,
            error: subscription.error,
          },
        });
      } catch (error) {
        subscriptionStatus = 'failed';
        subscriptionError = error instanceof Error ? error.message : 'Falha ao assinar presenca.';
        await updateWhapiPresenceSubscription(supabaseAdmin, {
          channelId: chat.channel_id,
          entryId,
          update: { entryId, status: 'failed', error: subscriptionError },
        }).catch(() => undefined);
      }
    }

    let presence = null;
    let presenceError: string | null = null;
    try {
      presence = await fetchWhapiPresence({ token: settings.token, entryId });
      if (presence) {
        await persistWhapiPresence(supabaseAdmin, { channelId: chat.channel_id, item: presence });
      }
    } catch (error) {
      presenceError = error instanceof Error ? error.message : 'Falha ao consultar presenca.';
    }

    return response({
      success: true,
      chat_id: chat.id,
      entry_id: entryId,
      is_group: chat.is_group,
      subscription: {
        status: subscriptionStatus,
        error: subscriptionError,
      },
      presence: presence
        ? {
            status: presence.status,
            last_seen_at: presence.lastSeenAt,
            observed_at: new Date().toISOString(),
          }
        : previous
          ? {
              status: previous.status,
              last_seen_at: previous.last_seen_at,
              observed_at: previous.observed_at,
            }
          : null,
      presence_error: presenceError,
    });
  } catch (error) {
    console.error('[comm-whatsapp-presence] erro inesperado', error);
    return response({ error: error instanceof Error ? error.message : 'Erro interno ao sincronizar presenca.' }, 500);
  }
});
