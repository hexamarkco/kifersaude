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

type WhapiChatMetadata = {
  id: string;
  name?: string;
};

const fetchChatMetadata = async (token: string, chatId: string): Promise<WhapiChatMetadata> => {
  const response = await fetch(`${WHAPI_BASE_URL}/chats/${encodeURIComponent(chatId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar chat ${chatId}: ${response.status} ${errorText}`);
  }

  return response.json();
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

    const token = (integration?.settings as { apiKey?: string; token?: string })?.apiKey
      ?? (integration?.settings as { token?: string })?.token;

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

    const fetchLimit = limit ?? Number.POSITIVE_INFINITY;

    while (processed < fetchLimit) {
      const { data: chats, error } = await supabaseAdmin
        .from('whatsapp_chats')
        .select('id, name')
        .eq('is_group', true)
        .order('updated_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar chats.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!chats || chats.length === 0) break;

      for (const chat of chats) {
        if (processed >= fetchLimit) break;
        processed += 1;
        try {
          const metadata = await fetchChatMetadata(token, chat.id);
          const name = metadata?.name?.trim();
          if (!name) {
            skipped += 1;
            continue;
          }

          if (chat.name === name) {
            skipped += 1;
            continue;
          }

          const { error: updateError } = await supabaseAdmin
            .from('whatsapp_chats')
            .update({ name })
            .eq('id', chat.id);

          if (updateError) {
            errors += 1;
            continue;
          }

          updated += 1;
        } catch (syncError) {
          console.error('[whatsapp-sync-group-names] Failed to sync chat name', syncError);
          errors += 1;
        }
      }

      offset += chats.length;
      if (chats.length < pageSize) break;
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
