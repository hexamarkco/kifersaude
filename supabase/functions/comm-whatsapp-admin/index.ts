// @ts-ignore Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import {
  buildWebhookUrl,
  COMM_WHATSAPP_INTEGRATION_SLUG,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  getHealthStatusText,
  getNowIso,
  parseWhapiError,
  readResponsePayload,
  sanitizeChannelForClient,
  sanitizeWhapiToken,
  toTrimmedString,
  WHAPI_BASE_URL,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type AdminRequestBody = {
  action?: 'getConfig' | 'saveConfig' | 'refreshHealth';
  token?: string;
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

  return {
    channel: sanitizeChannelForClient(channel),
    config: {
      enabled: settings.enabled,
      token: settings.token,
      tokenConfigured: Boolean(settings.token),
      webhookUrl: buildWebhookUrl(supabaseUrl, channel.webhook_secret),
    },
  };
}

async function persistConfig(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  payload: { enabled: boolean; token: string },
) {
  const sanitizedToken = sanitizeWhapiToken(payload.token);

  const { error: settingsError } = await supabaseAdmin
    .from('integration_settings')
    .update({
      settings: {
        enabled: payload.enabled,
        token: sanitizedToken,
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
  const token = sanitizeWhapiToken(settings.token);

  if (!token) {
    throw new Error('Token da Whapi nao configurado.');
  }

  const healthResponse = await fetch(`${WHAPI_BASE_URL}/health`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const healthPayload = await readResponsePayload(healthResponse);

  if (!healthResponse.ok) {
    throw new Error(parseWhapiError(healthPayload) || 'Falha ao consultar a saude do canal.');
  }

  let limitsPayload: unknown = null;
  try {
    const limitsResponse = await fetch(`${WHAPI_BASE_URL}/limits`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

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
    const supabaseAdmin = createAdminClient();

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

    const body = (await req.json().catch(() => ({}))) as AdminRequestBody;
    const action = body.action || 'getConfig';

    await ensurePrimaryChannel(supabaseAdmin);
    await ensureCommWhatsAppSettings(supabaseAdmin);

    if (action === 'saveConfig') {
      await persistConfig(supabaseAdmin, {
        enabled: body.enabled === true,
        token: toTrimmedString(body.token),
      });
    }

    if (action === 'refreshHealth') {
      await refreshHealth(supabaseAdmin);
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
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
