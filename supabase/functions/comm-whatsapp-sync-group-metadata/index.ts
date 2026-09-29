import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  fetchWhapiGroup,
  persistWhapiGroupSnapshot,
} from '../_shared/comm-whatsapp.ts';
import { normalizeWhapiGroupSnapshot } from '../_shared/whapi-group-webhook-parser.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
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

type GroupSyncResult = {
  externalGroupId: string;
  name: string | null;
  synced: boolean;
  error?: string;
};

const syncGroup = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  channelId: string,
  token: string,
  externalGroupId: string,
): Promise<GroupSyncResult> => {
  try {
    const remoteGroup = await fetchWhapiGroup({ token, groupId: externalGroupId });
    const snapshot = normalizeWhapiGroupSnapshot(remoteGroup);
    if (!snapshot) {
      return {
        externalGroupId,
        name: null,
        synced: false,
        error: 'A Whapi nao retornou metadados validos para este grupo.',
      };
    }

    const persisted = await persistWhapiGroupSnapshot(supabaseAdmin, {
      channelId,
      snapshot,
    });

    return {
      externalGroupId,
      name: persisted.name,
      synced: true,
    };
  } catch (error) {
    return {
      externalGroupId,
      name: null,
      synced: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar metadados do grupo.',
    };
  }
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

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    if (!settings.enabled) {
      return new Response(JSON.stringify({ error: 'Integracao WhatsApp desabilitada.' }), {
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
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('comm_whatsapp_groups')
      .select('external_group_id')
      .eq('channel_id', channel.id)
      .order('external_group_id', { ascending: true });

    if (groupsError) {
      throw new Error(`Erro ao listar grupos locais: ${groupsError.message}`);
    }

    const groupIds = Array.from(new Set(
      (groups || [])
        .map((group: { external_group_id?: unknown }) => (
          typeof group.external_group_id === 'string' ? group.external_group_id.trim() : ''
        ))
        .filter(Boolean),
    ));

    const results: GroupSyncResult[] = [];
    const batchSize = 4;
    for (let offset = 0; offset < groupIds.length; offset += batchSize) {
      const batch = groupIds.slice(offset, offset + batchSize);
      results.push(...await Promise.all(
        batch.map((groupId) => syncGroup(supabaseAdmin, channel.id, settings.token, groupId)),
      ));
    }

    const synced = results.filter((result) => result.synced).length;
    const failed = results.length - synced;

    return new Response(JSON.stringify({
      success: failed === 0,
      totalGroups: groupIds.length,
      syncedGroups: synced,
      failedGroups: failed,
      groups: results,
    }), {
      status: failed === 0 ? 200 : 207,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-sync-group-metadata] erro inesperado', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro interno ao sincronizar metadados dos grupos.',
      }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
