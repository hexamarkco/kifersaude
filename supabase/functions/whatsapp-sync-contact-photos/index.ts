import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
const BUCKET_NAME = 'whatsapp-contact-photos';
const DEFAULT_SYNC_LIMIT = 200;
const MAX_SYNC_LIMIT = 500;
const MAX_TARGETED_CONTACTS = 200;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type SyncRequest = {
  force?: boolean;
  limit?: number;
  contactIds?: string[];
  targets?: Array<{
    lookupId?: string;
    aliases?: string[];
  }>;
};

type NormalizedSyncTarget = {
  lookupId: string;
  aliases: string[];
};

type StoredPhotoRow = {
  contact_id: string;
  source_url?: string | null;
  storage_path?: string | null;
  public_url?: string | null;
};

type SyncedPhotoRow = {
  contact_id: string;
  public_url: string | null;
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

const sanitizeWhapiToken = (rawToken: string) => rawToken.replace(/^Bearer\s+/i, '').trim();

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

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
  const normalizedId = contactId.replace(/\D/g, '');
  if (!normalizedId) {
    throw new Error(`Contato invalido: ${contactId}`);
  }
  const response = await fetch(`${WHAPI_BASE_URL}/contacts/${encodeURIComponent(normalizedId)}/profile`, {
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

const normalizeSyncTargets = (payload: SyncRequest): NormalizedSyncTarget[] => {
  const targetsByLookupId = new Map<string, Set<string>>();

  const addTarget = (lookupId: unknown, aliases: unknown) => {
    const resolvedLookupId = toTrimmedString(lookupId);
    if (!resolvedLookupId) return;

    const nextAliases = targetsByLookupId.get(resolvedLookupId) ?? new Set<string>();
    nextAliases.add(resolvedLookupId);

    if (Array.isArray(aliases)) {
      aliases.forEach((alias) => {
        const resolvedAlias = toTrimmedString(alias);
        if (resolvedAlias) {
          nextAliases.add(resolvedAlias);
        }
      });
    }

    targetsByLookupId.set(resolvedLookupId, nextAliases);
  };

  if (Array.isArray(payload.targets)) {
    payload.targets.forEach((target) => addTarget(target.lookupId, target.aliases));
  }

  if (Array.isArray(payload.contactIds)) {
    payload.contactIds.forEach((contactId) => addTarget(contactId, [contactId]));
  }

  return Array.from(targetsByLookupId.entries()).map(([lookupId, aliases]) => ({
    lookupId,
    aliases: Array.from(aliases),
  }));
};

const collectPhotoRows = (rows: StoredPhotoRow[]): SyncedPhotoRow[] =>
  rows
    .filter((row) => toTrimmedString(row.contact_id) && toTrimmedString(row.public_url))
    .map((row) => ({
      contact_id: row.contact_id,
      public_url: row.public_url ?? null,
    }));

const upsertPhotoRows = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  rows: Array<{ contact_id: string; source_url: string; storage_path: string; public_url: string }>,
) => {
  if (rows.length === 0) return;

  const { error } = await supabaseAdmin
    .from('whatsapp_contact_photos')
    .upsert(rows, { onConflict: 'contact_id' });

  if (error) {
    throw new Error(`Erro ao salvar fotos sincronizadas: ${error.message}`);
  }
};

const syncSpecificContactPhoto = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  token: string,
  target: NormalizedSyncTarget,
  force: boolean,
): Promise<{ status: 'updated' | 'skipped' | 'error'; photos: SyncedPhotoRow[] }> => {
  try {
    const { data: existingRows, error: existingRowsError } = await supabaseAdmin
      .from('whatsapp_contact_photos')
      .select('contact_id, source_url, storage_path, public_url')
      .in('contact_id', target.aliases);

    if (existingRowsError) {
      throw new Error(`Erro ao buscar fotos existentes: ${existingRowsError.message}`);
    }

    const resolvedExistingRows = (existingRows as StoredPhotoRow[] | null) || [];
    const existingById = new Map(resolvedExistingRows.map((row) => [row.contact_id, row]));

    const profile = await fetchContactProfile(token, target.lookupId);
    const sourceUrl = profile.icon_full || profile.icon || null;
    if (!sourceUrl) {
      return {
        status: 'skipped',
        photos: collectPhotoRows(resolvedExistingRows),
      };
    }

    const reusableRow = resolvedExistingRows.find(
      (row) => row.source_url === sourceUrl && toTrimmedString(row.storage_path) && toTrimmedString(row.public_url),
    );

    if (!force && reusableRow?.storage_path && reusableRow.public_url) {
      const rowsToUpsert = target.aliases
        .filter((alias) => {
          const existing = existingById.get(alias);
          return !existing || existing.source_url !== sourceUrl || existing.public_url !== reusableRow.public_url;
        })
        .map((alias) => ({
          contact_id: alias,
          source_url: sourceUrl,
          storage_path: reusableRow.storage_path as string,
          public_url: reusableRow.public_url as string,
        }));

      if (rowsToUpsert.length > 0) {
        await upsertPhotoRows(supabaseAdmin, rowsToUpsert);
      }

      return {
        status: rowsToUpsert.length > 0 ? 'updated' : 'skipped',
        photos: target.aliases.map((alias) => ({
          contact_id: alias,
          public_url: existingById.get(alias)?.public_url ?? reusableRow.public_url ?? null,
        })),
      };
    }

    const aliasesAlreadySynced = target.aliases.every((alias) => {
      const existing = existingById.get(alias);
      return existing?.source_url === sourceUrl && Boolean(toTrimmedString(existing.public_url));
    });

    if (!force && aliasesAlreadySynced) {
      return {
        status: 'skipped',
        photos: target.aliases.map((alias) => ({
          contact_id: alias,
          public_url: existingById.get(alias)?.public_url ?? null,
        })),
      };
    }

    const photoResponse = await fetch(sourceUrl);
    if (!photoResponse.ok) {
      throw new Error(`Falha ao baixar foto: ${photoResponse.status}`);
    }

    const contentType = photoResponse.headers.get('content-type');
    const extension = getExtensionFromContentType(contentType);
    const fileName = sanitizeFileName(target.lookupId.replace(/\D/g, '') || target.lookupId);
    const filePath = `contacts/${fileName}.${extension}`;
    const fileData = new Uint8Array(await photoResponse.arrayBuffer());

    const storageBucket = supabaseAdmin.storage?.from(BUCKET_NAME);
    if (!storageBucket) {
      throw new Error('Storage bucket unavailable');
    }

    const uploadResult = await storageBucket.upload(filePath, fileData, {
      contentType: contentType ?? 'image/jpeg',
      upsert: true,
    });

    if (!uploadResult || uploadResult.error) {
      throw new Error(uploadResult?.error?.message || 'Falha ao enviar foto para o bucket');
    }

    const publicUrl = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(filePath).data.publicUrl;
    const rowsToUpsert = target.aliases.map((alias) => ({
      contact_id: alias,
      source_url: sourceUrl,
      storage_path: filePath,
      public_url: publicUrl,
    }));

    await upsertPhotoRows(supabaseAdmin, rowsToUpsert);

    return {
      status: 'updated',
      photos: rowsToUpsert.map((row) => ({
        contact_id: row.contact_id,
        public_url: row.public_url,
      })),
    };
  } catch (error) {
    console.error('[whatsapp-sync-contact-photos] Failed to sync targeted photo', {
      lookupId: target.lookupId,
      aliases: target.aliases,
      error,
    });
    return { status: 'error', photos: [] };
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao permitido' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Configuracao do servidor incompleta.' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const serviceRoleCall = isServiceRoleRequest(req, supabaseServiceRoleKey);
    if (!serviceRoleCall) {
      const authResult = await authorizeDashboardUser({
        req,
        supabaseUrl,
        supabaseAnonKey,
        supabaseAdmin,
        module: 'whatsapp',
        requiredPermission: 'view',
      });

      if (!authResult.authorized) {
        return jsonResponse(authResult.body, authResult.status);
      }
    }

    const payload = (await req.json().catch(() => ({}))) as SyncRequest;
    const force = payload.force === true;
    const normalizedLimit = typeof payload.limit === 'number' && Number.isFinite(payload.limit)
      ? Math.trunc(payload.limit)
      : DEFAULT_SYNC_LIMIT;
    const limit = Math.min(Math.max(normalizedLimit, 1), MAX_SYNC_LIMIT);
    const requestedTargets = normalizeSyncTargets(payload);

    if (requestedTargets.length > MAX_TARGETED_CONTACTS) {
      return jsonResponse({ error: `Envie no maximo ${MAX_TARGETED_CONTACTS} contatos por requisicao.` }, 400);
    }

    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'whatsapp_auto_contact')
      .maybeSingle();

    if (integrationError) {
      return jsonResponse({ error: 'Nao foi possivel acessar configuracao do WhatsApp.' }, 500);
    }

    const tokenValue = (integration?.settings as { apiKey?: string; token?: string })?.apiKey
      ?? (integration?.settings as { token?: string })?.token;
    const token = tokenValue ? sanitizeWhapiToken(tokenValue) : '';

    if (!token) {
      return jsonResponse({ error: 'Token da Whapi nao configurado.' }, 400);
    }

    let offset = 0;
    const pageSize = 200;
    let total = 0;
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const fetchLimit = limit;

    if (requestedTargets.length > 0) {
      const photos: SyncedPhotoRow[] = [];

      for (const target of requestedTargets) {
        if (processed >= fetchLimit) break;
        processed += 1;

        const result = await syncSpecificContactPhoto(supabaseAdmin, token, target, force);
        photos.push(...result.photos);

        if (result.status === 'updated') {
          updated += 1;
        } else if (result.status === 'skipped') {
          skipped += 1;
        } else {
          errors += 1;
        }
      }

      return jsonResponse({
          success: true,
          processed,
          updated,
          skipped,
          errors,
          photos,
        }, 200);
    }

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

          const storageBucket = supabaseAdmin.storage?.from(BUCKET_NAME);
          if (!storageBucket) {
            console.error('[whatsapp-sync-contact-photos] Storage bucket unavailable');
            errors += 1;
            continue;
          }

          const uploadResult = await storageBucket.upload(filePath, fileData, {
            contentType: contentType ?? 'image/jpeg',
            upsert: true,
          });

          if (!uploadResult || uploadResult.error) {
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

    return jsonResponse({
        success: true,
        processed,
        updated,
        skipped,
        errors,
      }, 200);
  } catch (error) {
    console.error('[whatsapp-sync-contact-photos] Unexpected error', error);
    return jsonResponse({ error: 'Erro interno ao sincronizar fotos.' }, 500);
  }
});
