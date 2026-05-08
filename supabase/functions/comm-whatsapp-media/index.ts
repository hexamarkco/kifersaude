// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { cacheCommWhatsAppMedia, COMM_WHATSAPP_MODULE, ensureCommWhatsAppSettings } from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      requiredPermission: 'view',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mediaId = new URL(req.url).searchParams.get('mediaId')?.trim() || '';
    if (!mediaId) {
      return new Response(JSON.stringify({ error: 'MediaID obrigatorio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    if (!settings.enabled) {
      return new Response(JSON.stringify({ error: 'Integração WhatsApp desabilitada.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings.token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: messageRows } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .select('media_url, media_mime_type, media_file_name')
      .eq('media_id', mediaId)
      .limit(1);
    const message = Array.isArray(messageRows) ? messageRows[0] : null;

    const media = await cacheCommWhatsAppMedia(supabaseAdmin, {
      token: settings.token,
      mediaId,
      mediaUrl: typeof message?.media_url === 'string' ? message.media_url : null,
      fallbackMimeType: typeof message?.media_mime_type === 'string' ? message.media_mime_type : null,
      fallbackFileName: typeof message?.media_file_name === 'string' ? message.media_file_name : null,
    });

    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', media.mimeType);
    headers.set('Content-Disposition', `inline; filename="${media.fileName.replace(/["\r\n]/g, '')}"`);
    headers.set('Cache-Control', media.cached ? 'private, max-age=86400' : 'private, max-age=3600');

    return new Response(media.blob, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[comm-whatsapp-media] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao carregar midia.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
