import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
const BUCKET_NAME = 'whatsapp-contact-photos';

type SyncRequest = {
  force?: boolean;
  limit?: number;
};

type WhapiContact = {
  id: string;
  name?: string;
  pushname?: string;
};

type WhapiContactListResponse = {
  contacts: WhapiContact[];
  count: number;
  total: number;
  offset: number;
};

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const getExtensionFromContentType = (contentType: string | null) => {
  if (!contentType) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
};

const fetchContactsPage = async (token: string, offset: number, count: number) => {
  const response = await fetch(`${WHAPI_BASE_URL}/contacts?count=${count}&offset=${offset}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar contatos: ${response.status} ${errorText}`);
  }

  return (await response.json()) as WhapiContactListResponse;
};

const fetchContactProfile = async (token: string, contactId: string) => {
  const response = await fetch(`${WHAPI_BASE_URL}/contacts/${encodeURIComponent(contactId)}/profile`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar perfil do contato ${contactId}: ${response.status} ${errorText}`);
  }

  return (await response.json()) as { icon?: string | null; icon_full?: string | null };
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
    const force = payload.force === true;
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
    const pageSize = 200;
    let total = 0;
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const fetchLimit = limit ?? Number.POSITIVE_INFINITY;

    do {
      const response = await fetchContactsPage(token, offset, pageSize);
      total = response.total;
      const contacts = response.contacts || [];
      const ids = contacts.map((contact) => contact.id);

      const { data: existingRows } = await supabaseAdmin
        .from('whatsapp_contact_photos')
        .select('contact_id, source_url, storage_path, public_url')
        .in('contact_id', ids);

      const existingMap = new Map(
        ((existingRows as Array<{ contact_id: string; source_url?: string | null }> | null) || []).map((row) => [
          row.contact_id,
          row,
        ]),
      );

      for (const contact of contacts) {
        if (processed >= fetchLimit) break;
        processed += 1;

        try {
          const profile = await fetchContactProfile(token, contact.id);
          const sourceUrl = profile.icon_full || profile.icon || null;
          if (!sourceUrl) {
            skipped += 1;
            continue;
          }

          const existing = existingMap.get(contact.id);
          if (!force && existing?.source_url === sourceUrl) {
            skipped += 1;
            continue;
          }

          const photoResponse = await fetch(sourceUrl);
          if (!photoResponse.ok) {
            errors += 1;
            continue;
          }

          const contentType = photoResponse.headers.get('content-type');
          const extension = getExtensionFromContentType(contentType);
          const fileName = sanitizeFileName(contact.id);
          const filePath = `contacts/${fileName}.${extension}`;
          const fileData = new Uint8Array(await photoResponse.arrayBuffer());

          const uploadResult = await supabaseAdmin
            .storage
            .from(BUCKET_NAME)
            .upload(filePath, fileData, {
              contentType: contentType ?? 'image/jpeg',
              upsert: true,
            });

          if (uploadResult.error) {
            errors += 1;
            continue;
          }

          const publicUrl = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(filePath).data.publicUrl;

          await supabaseAdmin
            .from('whatsapp_contact_photos')
            .upsert({
              contact_id: contact.id,
              source_url: sourceUrl,
              storage_path: filePath,
              public_url: publicUrl,
            });

          updated += 1;
        } catch (error) {
          console.error('[whatsapp-sync-contact-photos] Failed to sync photo', error);
          errors += 1;
        }
      }

      offset += response.count;
      if (response.count === 0 || processed >= fetchLimit) break;
    } while (offset < total);

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
    console.error('[whatsapp-sync-contact-photos] Unexpected error', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao sincronizar fotos.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
