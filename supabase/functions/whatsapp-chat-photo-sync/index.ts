import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

type WhatsappChatRecord = {
  id: string;
  phone: string | null;
  sender_photo: string | null;
  is_group: boolean;
};

type ContactPhotoRecord = {
  phone: string;
  photo_url: string | null;
};

type ZapiCredentials = {
  instanceId: string;
  token: string;
  clientToken: string;
};

type ZapiChatMetadata = {
  phone?: string | null;
  profileThumbnail?: string | null;
};

type SyncSummary = {
  totalChats: number;
  eligibleChats: number;
  updated: number;
  unchanged: number;
  failed: number;
  missingPhoto: number;
  contactEligible: number;
  contactUpdated: number;
  contactUnchanged: number;
  contactFailed: number;
  contactMissingPhoto: number;
  errors: { chatId: string | null; phone: string; error: string }[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const CHAT_PHOTO_BUCKET = 'whatsapp-chat-photos';
const DEFAULT_PHOTO_CONTENT_TYPE = 'image/jpeg';
const MAX_CONTACT_PAGES = 10;
const CONTACTS_PAGE_SIZE = 500;
const JPEG_QUALITY = 75;
const MAX_DIMENSION = 512;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL não configurada.');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

const extractApiKey = (req: Request): string | null => {
  const bearer = req.headers.get('authorization');
  const apiKey = req.headers.get('apikey') ?? req.headers.get('x-api-key');

  if (bearer?.toLowerCase().startsWith('bearer ')) {
    return bearer.slice('bearer '.length).trim();
  }

  return apiKey?.trim() ?? null;
};

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

const fetchSavedContacts = async (credentials: ZapiCredentials): Promise<string[]> => {
  const contacts: string[] = [];

  for (let page = 1; page <= MAX_CONTACT_PAGES; page += 1) {
    const url = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/contacts?page=${page}&pageSize=${CONTACTS_PAGE_SIZE}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Client-Token': credentials.clientToken },
      });

      if (!response.ok) {
        console.error('Falha ao carregar contatos da Z-API:', response.status, response.statusText);
        break;
      }

      const pageData = (await response.json()) as unknown;

      if (!Array.isArray(pageData) || pageData.length === 0) {
        break;
      }

      for (const rawContact of pageData) {
        const contact = rawContact as { phone?: string | null };
        const normalized = normalizePhone(contact.phone);
        if (normalized) {
          contacts.push(normalized);
        }
      }

      if (pageData.length < CONTACTS_PAGE_SIZE) {
        break;
      }
    } catch (error) {
      console.error('Erro ao buscar contatos da Z-API:', error);
      break;
    }
  }

  return contacts;
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const fetchChatMetadata = async (phone: string, credentials: ZapiCredentials): Promise<ZapiChatMetadata | null> => {
  const url = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/chats/${encodeURIComponent(phone)}`;

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
        `Falha ao buscar metadata (${response.status}): ${errorDetails ? JSON.stringify(errorDetails) : response.statusText}`,
      );
    }

    return responseBody && typeof responseBody === 'object' ? responseBody as ZapiChatMetadata : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Erro ao buscar metadata do contato ${phone}: ${message}`);
  }
};

const optimizeProfilePhoto = async (arrayBuffer: ArrayBuffer): Promise<Uint8Array | null> => {
  try {
    const image = await Image.decode(arrayBuffer);
    const resizeRatio = Math.min(MAX_DIMENSION / image.width, MAX_DIMENSION / image.height, 1);

    if (resizeRatio < 1) {
      image.resize(Math.round(image.width * resizeRatio), Math.round(image.height * resizeRatio));
    }

    return image.encodeJPEG(JPEG_QUALITY);
  } catch (error) {
    console.warn('Falha ao otimizar foto de perfil, utilizando imagem original:', error);
    return null;
  }
};

const downloadAndStoreProfilePhoto = async (
  photoUrl: string,
  phone: string,
): Promise<string> => {
  const response = await fetch(photoUrl);

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha ao baixar foto de perfil (${response.status}): ${details || 'erro desconhecido'}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentTypeHeader = response.headers.get('content-type');
  const optimizedBuffer = await optimizeProfilePhoto(arrayBuffer);
  const contentType = optimizedBuffer ? DEFAULT_PHOTO_CONTENT_TYPE : contentTypeHeader?.trim() || DEFAULT_PHOTO_CONTENT_TYPE;
  const uploadBuffer = optimizedBuffer ?? new Uint8Array(arrayBuffer);
  const normalizedPhone = phone.replace(/\D+/g, '') || 'unknown';
  const timestamp = Date.now();
  const storagePath = `profiles/${normalizedPhone}-${timestamp}.jpg`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(CHAT_PHOTO_BUCKET)
    .upload(storagePath, uploadBuffer, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    });

  if (uploadError) {
    throw new Error(`Falha ao armazenar foto de perfil: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from(CHAT_PHOTO_BUCKET).getPublicUrl(storagePath);

  if (!publicUrlData?.publicUrl) {
    throw new Error('Não foi possível gerar a URL pública da foto de perfil');
  }

  return publicUrlData.publicUrl;
};

const fetchExistingContactPhotos = async (phones: string[]): Promise<Map<string, string>> => {
  const photoMap = new Map<string, string>();

  if (phones.length === 0) {
    return photoMap;
  }

  const CHUNK_SIZE = 500;
  for (let index = 0; index < phones.length; index += CHUNK_SIZE) {
    const chunk = phones.slice(index, index + CHUNK_SIZE);

    const { data, error } = await supabaseAdmin
      .from('whatsapp_contact_photos')
      .select('phone, photo_url')
      .in('phone', chunk);

    if (error) {
      throw error;
    }

    for (const record of (data ?? []) as ContactPhotoRecord[]) {
      if (record.phone && record.photo_url) {
        photoMap.set(record.phone, record.photo_url);
      }
    }
  }

  return photoMap;
};

const upsertContactPhoto = async (phone: string, photoUrl: string) => {
  const { error } = await supabaseAdmin
    .from('whatsapp_contact_photos')
    .upsert({ phone, photo_url: photoUrl, updated_at: new Date().toISOString() })
    .eq('phone', phone);

  if (error) {
    throw error;
  }
};

const syncChatPhotos = async (): Promise<SyncSummary> => {
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
  const chatByPhone = new Map<string, WhatsappChatRecord>();

  for (const chat of chats) {
    if (chat.is_group) {
      continue;
    }

    const normalizedPhone = normalizePhone(chat.phone);
    if (normalizedPhone && !chatByPhone.has(normalizedPhone)) {
      chatByPhone.set(normalizedPhone, chat);
    }
  }

  const savedContactPhones = await fetchSavedContacts(credentials);
  const contactOnlyPhones = savedContactPhones.filter(phone => !chatByPhone.has(phone));
  const uniqueContactPhones = Array.from(new Set(contactOnlyPhones));
  const photoCacheMap = await fetchExistingContactPhotos(uniqueContactPhones);

  const phonesToSync = new Set<string>([...chatByPhone.keys(), ...savedContactPhones]);
  const errors: { chatId: string | null; phone: string; error: string }[] = [];

  let eligibleChats = chatByPhone.size;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let missingPhoto = 0;

  let contactEligible = uniqueContactPhones.length;
  let contactUpdated = 0;
  let contactUnchanged = 0;
  let contactFailed = 0;
  let contactMissingPhoto = 0;

  for (const phone of phonesToSync) {
    const chat = chatByPhone.get(phone);

    try {
      const metadata = await fetchChatMetadata(phone, credentials);
      const photoLink = toNonEmptyString(metadata?.profileThumbnail ?? null);

      if (!photoLink) {
        if (chat) {
          missingPhoto += 1;
        } else {
          contactMissingPhoto += 1;
        }
        continue;
      }

      const storedPhotoUrl = await downloadAndStoreProfilePhoto(photoLink, phone);

      if (chat) {
        if (storedPhotoUrl === (chat.sender_photo ?? '')) {
          unchanged += 1;
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('whatsapp_chats')
          .update({ sender_photo: storedPhotoUrl })
          .eq('id', chat.id);

        if (updateError) {
          throw updateError;
        }

        updated += 1;
      } else {
        const previousPhoto = photoCacheMap.get(phone) ?? null;

        if (previousPhoto === storedPhotoUrl) {
          contactUnchanged += 1;
          continue;
        }

        await upsertContactPhoto(phone, storedPhotoUrl);
        contactUpdated += 1;
      }
    } catch (updateError) {
      if (chat) {
        failed += 1;
      } else {
        contactFailed += 1;
      }

      errors.push({
        chatId: chat?.id ?? null,
        phone,
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
    contactEligible,
    contactUpdated,
    contactUnchanged,
    contactFailed,
    contactMissingPhoto,
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

  const providedKey = extractApiKey(req);
  const isServiceKey = providedKey === supabaseServiceKey;
  const isAnonKey = supabaseAnonKey ? providedKey === supabaseAnonKey : false;

  if (!isServiceKey && !isAnonKey) {
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
