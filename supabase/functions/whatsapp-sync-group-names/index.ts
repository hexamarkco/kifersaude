import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

type SyncRequest = {
  limit?: number;
};

type WhapiGroup = {
  id: string;
  name?: string;
  type?: string;
  created_at?: number;
  created_by?: string;
  name_at?: number;
  chat_pic?: string;
  chat_pic_full?: string;
  adminAddMemberMode?: boolean;
};

type WhapiGroupListPayload = {
  groups?: WhapiGroup[];
  count?: number;
  total?: number;
  offset?: number;
};

const sanitizeWhapiToken = (rawToken: string): string => rawToken.replace(/^Bearer\s+/i, '').trim();

const normalizeGroupsPayload = (payload: unknown): WhapiGroup[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is WhapiGroup => Boolean(item && typeof item === 'object' && 'id' in item));
  }

  if (payload && typeof payload === 'object') {
    const typed = payload as WhapiGroupListPayload;
    if (Array.isArray(typed.groups)) {
      return typed.groups.filter((item): item is WhapiGroup => Boolean(item && typeof item === 'object' && item.id));
    }

    if ('id' in typed && typeof (typed as WhapiGroup).id === 'string') {
      return [typed as WhapiGroup];
    }
  }

  return [];
};

const toIsoString = (timestamp?: number): string | null => {
  if (!timestamp || Number.isNaN(timestamp)) return null;
  return new Date(timestamp * 1000).toISOString();
};

const fetchGroupsPage = async (token: string, count: number, offset: number): Promise<WhapiGroup[]> => {
  const query = new URLSearchParams({
    count: String(count),
    offset: String(offset),
    resync: 'false',
  });

  const response = await fetch(`${WHAPI_BASE_URL}/groups?${query.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar grupos: ${response.status} ${errorText}`);
  }

  const payload = await response.json().catch(() => []);
  return normalizeGroupsPayload(payload);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as SyncRequest;
    const pageSize = 200;
    const limit = typeof payload.limit === 'number' && payload.limit > 0 ? payload.limit : null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Configuracao do servidor incompleta.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'whatsapp_auto_contact')
      .maybeSingle();

    if (integrationError) {
      return new Response(JSON.stringify({ error: 'Nao foi possivel acessar configuracao do WhatsApp.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenValue = (integration?.settings as { apiKey?: string; token?: string })?.apiKey
      ?? (integration?.settings as { token?: string })?.token;
    const token = tokenValue ? sanitizeWhapiToken(tokenValue) : '';

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let offset = 0;
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let page = 0;

    const fetchLimit = limit ?? Number.POSITIVE_INFINITY;

    while (processed < fetchLimit && page < 50) {
      page += 1;
      let groups: WhapiGroup[] = [];
      try {
        groups = await fetchGroupsPage(token, pageSize, offset);
      } catch (syncError) {
        console.error('[whatsapp-sync-group-names] Failed to fetch groups page', syncError);
        errors += 1;
        break;
      }

      if (groups.length === 0) {
        break;
      }

      for (const group of groups) {
        if (processed >= fetchLimit) break;
        processed += 1;

        const groupName = group.name?.trim();
        if (!groupName || groupName === group.id) {
          skipped += 1;
          continue;
        }

        const now = new Date().toISOString();

        const { data: existingGroup, error: existingGroupError } = await supabaseAdmin
          .from('whatsapp_groups')
          .select('id')
          .eq('id', group.id)
          .maybeSingle();

        if (existingGroupError) {
          console.error('[whatsapp-sync-group-names] Failed to load group snapshot', {
            groupId: group.id,
            error: existingGroupError,
          });
          errors += 1;
          continue;
        }

        if (existingGroup?.id) {
          const { error: groupUpdateError } = await supabaseAdmin
            .from('whatsapp_groups')
            .update({
              name: groupName,
              type: group.type || 'group',
              chat_pic: group.chat_pic || null,
              chat_pic_full: group.chat_pic_full || null,
              name_at: toIsoString(group.name_at),
              last_updated_at: now,
            })
            .eq('id', group.id);

          if (groupUpdateError) {
            console.error('[whatsapp-sync-group-names] Failed to update group metadata', {
              groupId: group.id,
              error: groupUpdateError,
            });
            errors += 1;
            continue;
          }
        } else {
          const { error: groupInsertError } = await supabaseAdmin.from('whatsapp_groups').insert({
            id: group.id,
            name: groupName,
            type: group.type || 'group',
            chat_pic: group.chat_pic || null,
            chat_pic_full: group.chat_pic_full || null,
            created_at: toIsoString(group.created_at) || now,
            created_by: group.created_by || 'system',
            name_at: toIsoString(group.name_at),
            admin_add_member_mode: group.adminAddMemberMode ?? true,
            first_seen_at: now,
            last_updated_at: now,
          });

          if (groupInsertError) {
            console.error('[whatsapp-sync-group-names] Failed to insert group metadata', {
              groupId: group.id,
              error: groupInsertError,
            });
            errors += 1;
            continue;
          }
        }

        const { data: chatSnapshot, error: chatSnapshotError } = await supabaseAdmin
          .from('whatsapp_chats')
          .select('name')
          .eq('id', group.id)
          .maybeSingle();

        if (chatSnapshotError) {
          console.error('[whatsapp-sync-group-names] Failed to load chat snapshot', {
            groupId: group.id,
            error: chatSnapshotError,
          });
          errors += 1;
          continue;
        }

        const { error: chatUpsertError } = await supabaseAdmin.from('whatsapp_chats').upsert(
          {
            id: group.id,
            name: groupName,
            is_group: true,
            updated_at: now,
          },
          { onConflict: 'id' },
        );

        if (chatUpsertError) {
          console.error('[whatsapp-sync-group-names] Failed to upsert chat name', {
            groupId: group.id,
            error: chatUpsertError,
          });
          errors += 1;
          continue;
        }

        const previousChatName = chatSnapshot?.name?.trim() || null;
        if (previousChatName === groupName) {
          skipped += 1;
        } else {
          updated += 1;
        }
      }

      offset += groups.length;
      if (groups.length < pageSize) break;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        updated,
        skipped,
        errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[whatsapp-sync-group-names] Unexpected error', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao sincronizar grupos.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
