// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import {
  buildWhapiDirectChatId,
  checkWhapiContactExists,
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractWhapiContactId,
  extractWhapiContactPhone,
  extractWhapiContactSaved,
  extractWhapiContactShortName,
  fetchWhapiContacts,
  getCommWhatsAppPhoneLookupKeys,
  extractWhapiSavedContactName,
  getNowIso,
  normalizeCommWhatsAppPhone,
  toTrimmedString,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type ContactsAction = 'listContacts' | 'startChat';

type ContactsRequestBody = {
  action?: ContactsAction;
  query?: string;
  forceSync?: boolean;
  page?: number;
  pageSize?: number;
  source?: 'saved_contact' | 'crm' | 'manual';
  phoneNumber?: string;
  displayName?: string;
  contactId?: string;
  leadId?: string;
};

type SavedContactRow = {
  id: string;
  channel_id: string;
  contact_id: string;
  phone_number: string;
  phone_digits: string;
  display_name: string;
  short_name: string | null;
  saved: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
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

const isCacheStale = (lastSyncedAt: string | null) => {
  if (!lastSyncedAt) return true;
  const ageMs = Date.now() - new Date(lastSyncedAt).getTime();
  return !Number.isFinite(ageMs) || ageMs > 30 * 60 * 1000;
};

async function getLatestCacheSync(channelId: string, supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_phone_contacts_cache')
    .select('last_synced_at')
    .eq('channel_id', channelId)
    .order('last_synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao consultar cache de contatos do WhatsApp: ${error.message}`);
  }

  return (data?.last_synced_at as string | null | undefined) ?? null;
}

async function syncContactsToCache(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  channelId: string;
  token: string;
}) {
  const fetchedContacts = await fetchWhapiContacts({ token: params.token });
  const nowIso = getNowIso();

  const rows = fetchedContacts
    .map((contact) => {
      const saved = extractWhapiContactSaved(contact);
      const phoneNumber = extractWhapiContactPhone(contact);
      const contactId = extractWhapiContactId(contact);
      const displayName = saved ? extractWhapiSavedContactName(contact) : '';

      if (!saved || !phoneNumber || !contactId || !displayName) {
        return null;
      }

      return {
        channel_id: params.channelId,
        contact_id: contactId,
        phone_number: phoneNumber,
        phone_digits: phoneNumber,
        display_name: displayName,
        short_name: extractWhapiContactShortName(contact) || null,
        saved: true,
        last_synced_at: nowIso,
        updated_at: nowIso,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length > 0) {
    const { error } = await params.supabaseAdmin
      .from('comm_whatsapp_phone_contacts_cache')
      .upsert(rows, { onConflict: 'channel_id,contact_id' });

    if (error) {
      throw new Error(`Erro ao atualizar cache de contatos do WhatsApp: ${error.message}`);
    }
  }

  const syncedContactIds = rows.map((row) => row.contact_id);
  let cleanupQuery = params.supabaseAdmin
    .from('comm_whatsapp_phone_contacts_cache')
    .delete()
    .eq('channel_id', params.channelId);

  if (syncedContactIds.length > 0) {
    cleanupQuery = cleanupQuery.not('contact_id', 'in', `(${syncedContactIds.map((id) => `"${id}"`).join(',')})`);
  }

  const { error: cleanupError } = await cleanupQuery;
  if (cleanupError) {
    throw new Error(`Erro ao limpar cache obsoleto de contatos do WhatsApp: ${cleanupError.message}`);
  }

  await params.supabaseAdmin.rpc('comm_whatsapp_refresh_channel_chat_identities', {
    p_channel_id: params.channelId,
  });
}

async function listCachedContacts(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  channelId: string;
  query: string;
  page: number;
  pageSize: number;
}) {
  const from = Math.max(0, (params.page - 1) * params.pageSize);
  const to = from + params.pageSize - 1;
  let query = params.supabaseAdmin
    .from('comm_whatsapp_phone_contacts_cache')
    .select('*', { count: 'exact' })
    .eq('channel_id', params.channelId)
    .eq('saved', true)
    .order('display_name', { ascending: true })
    .range(from, to);

  const trimmedQuery = params.query.trim();
  if (trimmedQuery) {
    const digits = trimmedQuery.replace(/\D/g, '');
    const filters = [`display_name.ilike.%${trimmedQuery}%`];
    if (digits) {
      filters.push(`phone_number.ilike.%${digits}%`);
      filters.push(`phone_digits.ilike.%${digits}%`);
    }
    query = query.or(filters.join(','));
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Erro ao listar contatos salvos do WhatsApp: ${error.message}`);
  }

  return {
    contacts: (data ?? []) as SavedContactRow[],
    total: count ?? 0,
  };
}

async function findCachedContactByPhone(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  channelId: string;
  phoneNumber: string;
}) {
  const phoneLookupKeys = getCommWhatsAppPhoneLookupKeys(params.phoneNumber);
  if (phoneLookupKeys.length === 0) {
    return null;
  }

  const { data, error } = await params.supabaseAdmin
    .from('comm_whatsapp_phone_contacts_cache')
    .select('*')
    .eq('channel_id', params.channelId)
    .eq('saved', true)
    .in('phone_digits', phoneLookupKeys)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao localizar contato salvo do WhatsApp: ${error.message}`);
  }

  return (data as SavedContactRow | null | undefined) ?? null;
}

async function resolveLeadStartContext(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  leadId: string;
}) {
  const { data, error } = await params.supabaseAdmin
    .from('leads')
    .select('id, nome_completo, telefone')
    .eq('id', params.leadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar lead do CRM: ${error.message}`);
  }

  if (!data) {
    throw new Error('Lead do CRM nao encontrado para iniciar conversa.');
  }

  return data as { id: string; nome_completo: string; telefone: string };
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
    const body = (await req.json().catch(() => ({}))) as ContactsRequestBody;
    const action = body.action || 'listContacts';

    const authResult = await authorizeDashboardUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
      module: COMM_WHATSAPP_MODULE,
      requiredPermission: action === 'startChat' ? 'edit' : 'view',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: jsonHeaders,
      });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    const channel = await ensurePrimaryChannel(supabaseAdmin);

    if (!settings.token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const latestSync = await getLatestCacheSync(channel.id, supabaseAdmin);
    if (body.forceSync === true || isCacheStale(latestSync)) {
      await syncContactsToCache({
        supabaseAdmin,
        channelId: channel.id,
        token: settings.token,
      });
    }

    if (action === 'listContacts') {
      const contacts = await listCachedContacts({
        supabaseAdmin,
        channelId: channel.id,
        query: toTrimmedString(body.query),
        page: Math.max(1, Number(body.page) || 1),
        pageSize: Math.min(100, Math.max(1, Number(body.pageSize) || 50)),
      });

      const hasMore = contacts.total > Math.max(1, Number(body.page) || 1) * Math.min(100, Math.max(1, Number(body.pageSize) || 50));

      return new Response(JSON.stringify({ success: true, contacts: contacts.contacts, total: contacts.total, hasMore }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (action === 'startChat') {
      let phoneNumber = '';
      let savedContactName = '';
      const pushName = '';
      let leadId: string | null = null;

      if (body.source === 'saved_contact') {
        phoneNumber = normalizeCommWhatsAppPhone(body.phoneNumber);
        savedContactName = toTrimmedString(body.displayName);
        const cached = await findCachedContactByPhone({
          supabaseAdmin,
          channelId: channel.id,
          phoneNumber,
        });
        savedContactName = savedContactName || cached?.display_name || '';
      } else if (body.source === 'crm') {
        const lead = await resolveLeadStartContext({
          supabaseAdmin,
          leadId: toTrimmedString(body.leadId),
        });
        phoneNumber = normalizeCommWhatsAppPhone(lead.telefone);
        leadId = lead.id;
        const cached = await findCachedContactByPhone({
          supabaseAdmin,
          channelId: channel.id,
          phoneNumber,
        });
        savedContactName = cached?.display_name || '';
      } else {
        phoneNumber = normalizeCommWhatsAppPhone(body.phoneNumber);
        const cached = await findCachedContactByPhone({
          supabaseAdmin,
          channelId: channel.id,
          phoneNumber,
        });
        savedContactName = cached?.display_name || '';
      }

      if (!phoneNumber) {
        return new Response(JSON.stringify({ error: 'Numero invalido para iniciar conversa.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const exists = await checkWhapiContactExists({
        token: settings.token,
        contactId: phoneNumber,
      });

      if (!exists) {
        return new Response(JSON.stringify({ error: 'Esse numero nao existe no WhatsApp.' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const directChatId = buildWhapiDirectChatId(phoneNumber);

      const { data, error } = await supabaseUser.rpc('comm_whatsapp_open_or_create_chat', {
        p_external_chat_id: directChatId,
        p_phone_number: phoneNumber,
        p_push_name: pushName || null,
        p_saved_contact_name: savedContactName || null,
        p_lead_id: leadId,
      });

      if (error) {
        throw new Error(`Erro ao abrir conversa do WhatsApp: ${error.message}`);
      }

      const rows = Array.isArray(data) ? data : [];
      const chat = rows[0] ?? null;
      if (!chat) {
        throw new Error('Nao foi possivel iniciar a conversa no WhatsApp.');
      }

      return new Response(JSON.stringify({ success: true, chat }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Acao invalida.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-contacts] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao processar contatos do WhatsApp.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
