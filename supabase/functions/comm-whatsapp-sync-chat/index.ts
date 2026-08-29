import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  isDirectWhapiChatId,
  normalizeWhapiChatId,
  syncWhapiDirectChatMessages,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type SyncBody = {
  chatId?: string;
  offset?: number;
  count?: number;
  timeTo?: number;
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
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
    return new Response('ok', { headers: jsonHeaders });
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

    if (!isServiceRoleRequest(req, serviceRoleKey)) {
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
          headers: jsonHeaders,
        });
      }
    }

    const body = (await req.json().catch(() => ({}))) as SyncBody;
    const externalChatId = normalizeWhapiChatId(body.chatId);
    const offset = Math.max(Math.floor(Number(body.offset) || 0), 0);
    const pageSize = Math.min(Math.max(Math.floor(Number(body.count) || 100), 1), 500);
    const requestedTimeTo = Number(body.timeTo);
    const timeTo = Number.isFinite(requestedTimeTo) && requestedTimeTo > 0
      ? Math.floor(requestedTimeTo)
      : Math.floor(Date.now() / 1000);

    if (!externalChatId || !isDirectWhapiChatId(externalChatId)) {
      return new Response(JSON.stringify({ error: 'Conversa invalida para sincronizacao.' }), {
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
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const channel = await ensurePrimaryChannel(supabaseAdmin);

    const result = await syncWhapiDirectChatMessages(supabaseAdmin, {
      channel,
      token: settings.token,
      externalChatId,
      offset,
      count: pageSize,
      timeTo,
    });

    return new Response(JSON.stringify({
      success: true,
      fetched: result.fetched,
      imported: result.inserted,
      inserted: result.inserted,
      updated: result.updated,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
      timeTo: result.timeTo,
    }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-sync-chat] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao sincronizar conversa.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
