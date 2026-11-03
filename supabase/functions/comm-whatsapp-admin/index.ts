import { getZapiCredentials, readWhatsAppTransport, WhatsAppTransportError, type WhatsAppProvider } from '../_shared/comm-whatsapp/transport.ts';
import { switchWhatsAppProvider, verifyWhatsAppProvider } from './providers.ts';
// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { resolveMcpServiceActor } from '../_shared/mcp-internal-actor.ts';
import {
  buildWebhookUrl,
  COMM_WHATSAPP_INTEGRATION_SLUG,
  COMM_WHATSAPP_WEBHOOK_SECRET_HEADER,
  corsHeaders,
  createWhapiClient,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  getCommWhatsAppWebhookSecret,
  getHealthStatusText,
  getNowIso,
  parseWhapiError,
  readResponsePayload,
  sanitizeChannelForClient,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type AdminRequestBody = {
  action?: 'getConfig' | 'saveConfig' | 'refreshHealth' | 'switchProvider';
  provider?: WhatsAppProvider;
  revision?: number;
  transferPending?: boolean;
  enabled?: boolean;
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

async function buildAdminState(supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const channel = await ensurePrimaryChannel(supabaseAdmin);
  const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
  const webhookSecret = getCommWhatsAppWebhookSecret();
  const transport = await readWhatsAppTransport(supabaseAdmin);
  const { data: providerDiagnostics, error: diagnosticsError } = await supabaseAdmin
    .from('whatsapp_transport_diagnostics').select('provider,last_webhook_at,last_inbound_at,checked_at,phone,connected,error');
  if (diagnosticsError) throw new Error('Não foi possível carregar os diagnósticos dos provedores.');
  const zapi = providerDiagnostics?.find((row) => row.provider === 'zapi');
  const whapi = providerDiagnostics?.find((row) => row.provider === 'whapi');
  const zapiConfigured = Boolean(getZapiCredentials(transport));
  const { count: uncertainAttempts, error: attemptsError } = await supabaseAdmin
    .from('whatsapp_transport_attempts').select('id', { count: 'exact', head: true })
    .is('finished_at', null).eq('uncertain', true);
  if (attemptsError) throw new Error('Não foi possível conferir os envios sem confirmação.');
  const [messageReceiptResult, inboundMessageResult] = await Promise.all([
    supabaseAdmin
      .from('comm_whatsapp_event_receipts')
      .select('received_at')
      .eq('channel_id', channel.id)
      .eq('event_type', 'message')
      .not('event_key', 'like', 'message:zapi:%')
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('comm_whatsapp_messages')
      .select('message_at')
      .eq('channel_id', channel.id)
      .eq('direction', 'inbound')
      .or('external_message_id.is.null,external_message_id.not.like.zapi:%')
      .order('message_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (messageReceiptResult.error) {
    throw new Error(`Erro ao consultar atividade do webhook: ${messageReceiptResult.error.message}`);
  }
  if (inboundMessageResult.error) {
    throw new Error(`Erro ao consultar mensagens recebidas: ${inboundMessageResult.error.message}`);
  }

  const lastMessageWebhookAt = messageReceiptResult.data?.received_at ?? null;
  const lastInboundMessageAt = inboundMessageResult.data?.message_at ?? null;
  const hasGenericWebhookActivity = Boolean(channel.last_webhook_received_at);
  const webhookMessageStatus = channel.last_error
    ? 'error'
    : hasGenericWebhookActivity && !lastMessageWebhookAt
      ? 'message_event_missing'
      : lastMessageWebhookAt
        ? 'receiving_messages'
        : 'waiting_first_event';

  const zapiDiagnostics = {
    status: zapi?.error ? 'error' : zapi?.last_inbound_at ? 'receiving_messages'
      : zapi?.last_webhook_at ? 'message_event_missing' : 'waiting_first_event',
    lastWebhookAt: zapi?.last_webhook_at ?? null,
    lastMessageWebhookAt: zapi?.last_inbound_at ?? null,
    lastInboundMessageAt: zapi?.last_inbound_at ?? null,
    lastError: zapi?.error ?? null,
  };
  const safeChannel = sanitizeChannelForClient(channel);
  const zapiActive = transport.provider === 'zapi';
  return {
    channel: zapiActive ? {
      ...safeChannel,
      connection_status: zapi?.connected === true ? 'AUTH' : zapi?.connected === false ? 'DISCONNECTED' : 'unknown',
      health_status: zapi?.connected === true ? 'AUTH' : zapi?.connected === false ? 'DISCONNECTED' : 'unknown',
      phone_number: zapi?.phone ?? null,
      last_health_check_at: zapi?.checked_at ?? null,
      health_snapshot: {},
      limits_snapshot: {},
    } : safeChannel,
    transport: {
      activeProvider: transport.provider,
      revision: transport.revision,
      uncertainAttempts: uncertainAttempts ?? 0,
      providers: {
        whapi: { configured: Boolean(settings.token), webhookConfigured: Boolean(webhookSecret),
          checkedAt: whapi?.checked_at ?? channel.last_health_check_at, phone: whapi?.phone ?? channel.phone_number,
          connected: whapi?.connected ?? null, error: whapi?.error ?? null },
        zapi: { configured: zapiConfigured, webhookConfigured: (Deno.env.get('ZAPI_WEBHOOK_SECRET')?.trim().length ?? 0) >= 32,
          checkedAt: zapi?.checked_at ?? null, phone: zapi?.phone ?? null, connected: zapi?.connected ?? null,
          error: zapi?.error ?? null, lastWebhookAt: zapi?.last_webhook_at ?? null, lastInboundAt: zapi?.last_inbound_at ?? null,
          webhookUrl: buildWebhookUrl(supabaseUrl) + '&provider=zapi' },
      },
    },
    config: {
      enabled: settings.enabled,
      tokenConfigured: zapiActive ? zapiConfigured : Boolean(settings.token),
      webhookUrl: buildWebhookUrl(supabaseUrl) + (zapiActive ? '&provider=zapi' : ''),
      webhookAuthentication: 'legacy_query',
      webhookHeaderName: webhookSecret ? COMM_WHATSAPP_WEBHOOK_SECRET_HEADER : null,
      webhookDiagnostics: zapiActive ? zapiDiagnostics : {
        status: webhookMessageStatus,
        lastWebhookAt: channel.last_webhook_received_at,
        lastMessageWebhookAt,
        lastInboundMessageAt,
        lastError: channel.last_error,
      },
    },
  };
}

async function persistConfig(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  payload: { enabled: boolean; nonSecretSettings: Record<string, unknown> },
) {
  const { error: settingsError } = await supabaseAdmin
    .from('integration_settings')
    .update({
      settings: {
        ...payload.nonSecretSettings,
        enabled: payload.enabled,
      },
      updated_at: getNowIso(),
    })
    .eq('slug', COMM_WHATSAPP_INTEGRATION_SLUG);

  if (settingsError) {
    throw new Error(`Erro ao salvar configuracao do WhatsApp: ${settingsError.message}`);
  }

  const { error: channelError } = await supabaseAdmin
    .from('comm_whatsapp_channels')
    .update({
      enabled: payload.enabled,
      updated_at: getNowIso(),
    })
    .eq('slug', 'primary');

  if (channelError) {
    throw new Error(`Erro ao atualizar canal WhatsApp: ${channelError.message}`);
  }
}

async function refreshHealth(supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const channel = await ensurePrimaryChannel(supabaseAdmin);
  const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
  const token = settings.token;

  if (!settings.enabled) {
    throw new Error('Integração WhatsApp desabilitada.');
  }

  if (!token) {
    throw new Error('Token da Whapi nao configurado.');
  }

  const whapi = createWhapiClient(token);

  const healthResponse = await whapi.health();
  const healthPayload = await readResponsePayload(healthResponse);

  if (!healthResponse.ok) {
    throw new Error(parseWhapiError(healthPayload) || 'Falha ao consultar a saude do canal.');
  }

  let limitsPayload: unknown = null;
  try {
    const limitsResponse = await whapi.limits();
    limitsPayload = await readResponsePayload(limitsResponse);
    if (!limitsResponse.ok) {
      limitsPayload = null;
    }
  } catch {
    limitsPayload = null;
  }

  const statusText = getHealthStatusText(healthPayload);
  const { error } = await supabaseAdmin
    .from('comm_whatsapp_channels')
    .update({
      enabled: settings.enabled,
      connection_status: statusText || 'unknown',
      health_status: statusText || 'unknown',
      health_snapshot: typeof healthPayload === 'object' && healthPayload !== null ? healthPayload : {},
      limits_snapshot:
        typeof limitsPayload === 'object' && limitsPayload !== null && !Array.isArray(limitsPayload)
          ? limitsPayload
          : {},
      last_health_check_at: getNowIso(),
      last_error: null,
    })
    .eq('id', channel.id);

  if (error) {
    throw new Error(`Erro ao atualizar status do canal: ${error.message}`);
  }
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createAdminClient();

    const serviceActor = await resolveMcpServiceActor(req, supabaseAdmin, serviceRoleKey);
    let actorId = serviceActor.actorId;
    let isAdmin = serviceActor.isServiceRole && serviceActor.authorized;
    if (serviceActor.isServiceRole) {
      if (!serviceActor.actorId || !serviceActor.authorized) {
        return new Response(JSON.stringify({ error: 'A conexão interna MCP exige um administrador ativo.' }), { status: 403, headers: jsonHeaders });
      }
    } else {
      const authResult = await authorizeDashboardUser({
        req,
        supabaseUrl,
        supabaseAnonKey,
        supabaseAdmin,
        module: 'config-integrations',
        requiredPermission: 'edit',
      });

      if (!authResult.authorized) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.status,
          headers: jsonHeaders,
        });
      }
      actorId = authResult.user.profileId;
      isAdmin = authResult.user.role === 'admin';
    }

    const body = (await req.json().catch(() => ({}))) as AdminRequestBody;
    const action = body.action || 'getConfig';

    await ensurePrimaryChannel(supabaseAdmin);
    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);

    if (action === 'saveConfig') {
      await persistConfig(supabaseAdmin, {
        enabled: body.enabled === true,
        nonSecretSettings: settings.nonSecretSettings,
      });
    }

    if (action === 'refreshHealth') {
      const provider = body.provider ?? (await readWhatsAppTransport(supabaseAdmin)).provider;
      if (provider !== 'whapi' && provider !== 'zapi') {
        throw new WhatsAppTransportError('Selecione um provedor válido.', false, 400);
      }
      if (provider === 'whapi' && !body.provider) await refreshHealth(supabaseAdmin);
      else await verifyWhatsAppProvider(supabaseAdmin, provider);
    }

    if (action === 'switchProvider') {
      if (!isAdmin || !actorId) throw new WhatsAppTransportError('Somente administradores podem trocar o provedor.', false, 403);
      if ((body.provider !== 'whapi' && body.provider !== 'zapi') || typeof body.revision !== 'number' || !Number.isInteger(body.revision)) {
        throw new WhatsAppTransportError('Selecione um provedor e atualize a tela antes da troca.', false, 400);
      }
      await switchWhatsAppProvider(supabaseAdmin, {
        provider: body.provider, revision: body.revision, actorId, transferPending: body.transferPending === true,
      });
    }

    const state = await buildAdminState(supabaseAdmin);
    return new Response(JSON.stringify({ success: true, ...state }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-admin] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno no admin do WhatsApp.' }),
      {
        status: error instanceof WhatsAppTransportError ? error.status : 500,
        headers: jsonHeaders,
      },
    );
  }
});
