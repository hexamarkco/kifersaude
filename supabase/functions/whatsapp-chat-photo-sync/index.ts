import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type WhatsappChatRecord = {
  id: string;
  phone: string | null;
  sender_photo: string | null;
  is_group: boolean;
};

type ZapiCredentials = {
  instanceId: string;
  token: string;
  clientToken: string;
};

type SyncSummary = {
  totalChats: number;
  eligibleChats: number;
  updated: number;
  unchanged: number;
  failed: number;
  missingPhoto: number;
  errors: { chatId: string; phone: string; error: string }[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.');
}

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

const normalizePhone = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withoutAt = trimmed.includes('@') ? trimmed.slice(0, trimmed.indexOf('@')) : trimmed;
  if (withoutAt.endsWith('-group')) {
    return null;
  }

  const digitsOnly = withoutAt.replace(/\D+/g, '');
  return digitsOnly.length >= 5 ? digitsOnly : null;
};

const getZapiCredentials = (): ZapiCredentials | null => {
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const token = Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

  if (!instanceId || !token || !clientToken) {
    return null;
  }

  return { instanceId, token, clientToken };
};

const extractProfileLink = (payload: unknown): string | null => {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const link = extractProfileLink(entry);
      if (link) {
        return link;
      }
    }
    return null;
  }

  const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : null;
  if (!record) {
    return null;
  }

  const link = record.link;
  return typeof link === 'string' && link.trim() ? link.trim() : null;
};

const fetchProfilePictureLink = async (phone: string, credentials: ZapiCredentials): Promise<string | null> => {
  const url = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/profile-picture?phone=${encodeURIComponent(phone)}`;

  let responseBody: unknown = null;

  try {
    const response = await fetch(url, { method: 'GET', headers: { 'Client-Token': credentials.clientToken } });
    try {
      responseBody = await response.json();
    } catch (_error) {
      responseBody = null;
    }

    if (!response.ok) {
      const errorDetails = responseBody && typeof responseBody === 'object' ? responseBody : null;
      throw new Error(
        `Falha ao buscar foto (${response.status}): ${errorDetails ? JSON.stringify(errorDetails) : response.statusText}`,
      );
    }

    return extractProfileLink(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Erro ao buscar foto do contato ${phone}: ${message}`);
  }
};

const syncChatPhotos = async (): Promise<SyncSummary> => {
  if (!supabaseAdmin) {
    throw new Error('Supabase client não configurado');
  }

  const credentials = getZapiCredentials();
  if (!credentials) {
    throw new Error('Credenciais da Z-API não configuradas');
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_chats')
    .select('id, phone, sender_photo, is_group');

  if (error) {
    throw error;
  }

  const chats = (data ?? []) as WhatsappChatRecord[];
  const errors: { chatId: string; phone: string; error: string }[] = [];

  let eligibleChats = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let missingPhoto = 0;

  for (const chat of chats) {
    if (chat.is_group) {
      continue;
    }

    const normalizedPhone = normalizePhone(chat.phone);
    if (!normalizedPhone) {
      continue;
    }

    eligibleChats += 1;

    try {
      const photoLink = await fetchProfilePictureLink(normalizedPhone, credentials);

      if (!photoLink) {
        missingPhoto += 1;
        continue;
      }

      if (photoLink === (chat.sender_photo ?? '')) {
        unchanged += 1;
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('whatsapp_chats')
        .update({ sender_photo: photoLink })
        .eq('id', chat.id);

      if (updateError) {
        throw updateError;
      }

      updated += 1;
    } catch (updateError) {
      failed += 1;
      errors.push({
        chatId: chat.id,
        phone: normalizedPhone,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }
  }

  return {
    totalChats: chats.length,
    eligibleChats,
    updated,
    unchanged,
    failed,
    missingPhoto,
    errors,
  };
};

const runAndLogSync = async () => {
  try {
    const summary = await syncChatPhotos();
    console.log('[whatsapp-chat-photo-sync] execução concluída', summary);
  } catch (error) {
    console.error('[whatsapp-chat-photo-sync] falha na sincronização', error);
  }
};

if (typeof Deno.cron === 'function') {
  Deno.cron('refresh-whatsapp-chat-photos', '*/30 * * * *', runAndLogSync);
} else {
  console.warn('Deno.cron não está disponível; a sincronização automática de fotos não será agendada.');
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), { headers: corsHeaders, status: 405 });
  }

  if (!supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Chave de serviço do Supabase ausente' }), {
      headers: corsHeaders,
      status: 500,
    });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${supabaseServiceKey}`) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { headers: corsHeaders, status: 401 });
  }

  try {
    const summary = await syncChatPhotos();
    return new Response(JSON.stringify({ success: true, ...summary }), { headers: corsHeaders, status: 200 });
  } catch (error) {
    console.error('Erro ao atualizar fotos dos chats:', error);
    return new Response(JSON.stringify({ error: 'Falha ao atualizar fotos dos chats' }), { headers: corsHeaders, status: 500 });
  }
});
