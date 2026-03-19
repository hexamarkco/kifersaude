import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const helpRequested = args.has('--help') || args.has('-h');
const dryRun = args.has('--dry-run');
const runNames = !args.has('--photos-only');
const runPhotos = !args.has('--names-only');
const forceNames = args.has('--force-names');
const forcePhotos = args.has('--force-photos');
const limitArg = [...args].find((arg) => arg.startsWith('--limit='));
const chatIdArg = [...args].find((arg) => arg.startsWith('--chat-id='));
const sampleArg = [...args].find((arg) => arg.startsWith('--sample='));

const reconcileLimit = Math.max(1, Number(limitArg?.split('=')[1] || 300));
const sampleSize = Math.max(1, Number(sampleArg?.split('=')[1] || 20));
const targetChatId = chatIdArg?.split('=')[1]?.trim() || null;
const photoBucketName = 'whatsapp-contact-photos';

function printHelpAndExit() {
  console.log(`Uso:\n  node scripts/backfill-whatsapp-direct-metadata.mjs [opcoes]\n\nOpcoes:\n  --dry-run         Simula sem gravar alteracoes\n  --limit=300       Limita a quantidade de chats diretos analisados\n  --chat-id=<id>    Processa apenas um chat especifico\n  --names-only      Executa apenas o backfill de nomes\n  --photos-only     Executa apenas o backfill de fotos\n  --force-names     Reconsulta nomes mesmo quando o chat atual ja tem nome util\n  --force-photos    Reconsulta foto mesmo quando ja existe foto sincronizada\n  --sample=20       Quantidade de itens exibidos nos exemplos finais\n`);
  process.exit(0);
}

if (helpRequested) {
  printHelpAndExit();
}

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const raw = readFileSync(filePath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return;

    const key = match[1];
    if (process.env[key] !== undefined) return;

    let value = match[2] || '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const whapiBaseUrl = (process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud').replace(/\/+$/, '');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Variaveis ausentes. Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_SERVICE_ROLE_KEY).',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeDirectChatId = (chatId) => {
  const trimmed = cleanText(chatId);
  if (!trimmed) return trimmed;

  if (/@c\.us$/i.test(trimmed)) {
    return trimmed.replace(/@c\.us$/i, '@s.whatsapp.net');
  }

  if (/@s\.whatsapp\.net$/i.test(trimmed)) {
    return trimmed.replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');
  }

  if (!trimmed.includes('@')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return `${digits}@s.whatsapp.net`;
    }
  }

  return trimmed;
};

const getChatIdType = (chatId) => {
  const normalized = cleanText(chatId).toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized.endsWith('@g.us')) return 'group';
  if (normalized === 'status@broadcast' || normalized === 'stories') return 'status';
  if (normalized.endsWith('@newsletter')) return 'newsletter';
  if (normalized.endsWith('@broadcast')) return 'broadcast';
  if (normalized.endsWith('@lid')) return 'lid';
  if (normalized.endsWith('@s.whatsapp.net') || normalized.endsWith('@c.us')) return 'phone';

  if (!normalized.includes('@')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return 'phone';
    }
  }

  return 'unknown';
};

const isDirectChatId = (chatId) => {
  const type = getChatIdType(chatId);
  return type === 'phone' || type === 'lid';
};

const extractDirectPhoneDigits = (value) => {
  const trimmed = cleanText(value);
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.endsWith('@lid')) return null;

  if (/@(?:c\.us|s\.whatsapp\.net)$/i.test(trimmed)) {
    const digits = trimmed.replace(/@c\.us$|@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) return digits;
    return null;
  }

  if (!trimmed.includes('@')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) return digits;
  }

  return null;
};

const buildPhoneLookupVariants = (phoneNumber) => {
  const rawDigits = cleanText(phoneNumber).replace(/\D/g, '');
  if (!rawDigits) return [];

  const variants = new Set();
  const push = (value) => {
    const digits = cleanText(value).replace(/\D/g, '');
    if (!digits) return;
    variants.add(digits);

    if (digits.startsWith('55') && digits.length > 11) {
      variants.add(digits.slice(2));
    }

    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
      variants.add(`55${digits}`);
    }
  };

  push(rawDigits);

  const snapshot = Array.from(variants);
  snapshot.forEach((value) => {
    const local = value.startsWith('55') && (value.length === 12 || value.length === 13) ? value.slice(2) : value;

    if (local.length === 11 && local[2] === '9') {
      const withoutNinthDigit = `${local.slice(0, 2)}${local.slice(3)}`;
      push(withoutNinthDigit);
      push(`55${withoutNinthDigit}`);
    }

    if (local.length === 10) {
      const withNinthDigit = `${local.slice(0, 2)}9${local.slice(2)}`;
      push(withNinthDigit);
      push(`55${withNinthDigit}`);
    }
  });

  return Array.from(variants);
};

const buildDirectIdVariantsFromPhone = (phoneNumber) => {
  const variants = new Set();
  buildPhoneLookupVariants(phoneNumber).forEach((digits) => {
    variants.add(`${digits}@s.whatsapp.net`);
    variants.add(`${digits}@c.us`);
  });
  return Array.from(variants);
};

const isPhoneLikeDirectName = (value, chatId, phoneNumber) => {
  const trimmed = cleanText(value);
  if (!trimmed) return false;
  if (!/^[+\d\s().-]+$/.test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) return false;

  const directPhone = cleanText(phoneNumber) || extractDirectPhoneDigits(chatId) || null;
  if (!directPhone) {
    return true;
  }

  const variants = new Set(buildPhoneLookupVariants(directPhone));
  return variants.size > 0 ? variants.has(digits) : true;
};

const getMeaningfulDirectName = (value, chatId, phoneNumber) => {
  const trimmed = cleanText(value);
  if (!trimmed || trimmed === chatId) return null;
  if (isPhoneLikeDirectName(trimmed, chatId, phoneNumber)) return null;
  return trimmed;
};

const sanitizeFileName = (value) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const getExtensionFromContentType = (contentType) => {
  if (!contentType) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
};

async function getWhapiToken() {
  const { data: settingsRow, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao consultar integration_settings: ${error.message}`);
  }

  const settings = settingsRow?.settings && typeof settingsRow.settings === 'object' ? settingsRow.settings : {};
  const token = cleanText(settings.apiKey || settings.token || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Token da Whapi nao encontrado em integration_settings.whatsapp_auto_contact');
  }

  return token;
}

async function fetchWhapiChatMetadata(token, chatId) {
  const response = await fetch(`${whapiBaseUrl}/chats/${encodeURIComponent(chatId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Erro ao buscar metadata do chat ${chatId}: ${response.status} ${bodyText.slice(0, 240)}`);
  }

  return response.json().catch(() => ({}));
}

async function fetchWhapiContactProfile(token, contactId) {
  const normalizedId = cleanText(contactId).replace(/\D/g, '');
  if (!normalizedId) {
    return null;
  }

  const response = await fetch(`${whapiBaseUrl}/contacts/${encodeURIComponent(normalizedId)}/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Erro ao buscar perfil do contato ${contactId}: ${response.status} ${bodyText.slice(0, 240)}`);
  }

  return response.json().catch(() => ({}));
}

async function fetchRecentPeerMessages(chatId) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('from_number,to_number,direction')
    .eq('chat_id', chatId)
    .order('timestamp', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(`Erro ao consultar mensagens do chat ${chatId}: ${error.message}`);
  }

  return data || [];
}

async function resolveChatPhone(chat) {
  const storedPhone = extractDirectPhoneDigits(chat.phone_number);
  if (storedPhone) return storedPhone;

  const fromId = extractDirectPhoneDigits(chat.id);
  if (fromId) return fromId;

  const recentMessages = await fetchRecentPeerMessages(chat.id);
  for (const message of recentMessages) {
    const rawPeer =
      message.direction === 'inbound'
        ? message.from_number
        : message.direction === 'outbound'
          ? message.to_number
          : null;
    const digits = extractDirectPhoneDigits(rawPeer);
    if (digits) return digits;
  }

  return null;
}

function buildDirectChatAliasBundle(chat, resolvedPhone) {
  const aliases = new Set();
  const lookupIds = new Set();

  const addAlias = (value) => {
    const trimmed = cleanText(value);
    if (!trimmed) return;
    aliases.add(trimmed);
    aliases.add(normalizeDirectChatId(trimmed));
  };

  addAlias(chat.id);
  addAlias(chat.lid);
  addAlias(chat.phone_number);

  if (resolvedPhone) {
    aliases.add(resolvedPhone);
    buildDirectIdVariantsFromPhone(resolvedPhone).forEach((variant) => aliases.add(variant));
    buildPhoneLookupVariants(resolvedPhone).forEach((variant) => lookupIds.add(variant));
  }

  const normalizedChatId = normalizeDirectChatId(chat.id);
  if (getChatIdType(normalizedChatId) === 'phone') {
    lookupIds.add(normalizedChatId);
  }

  return {
    aliases: Array.from(aliases).filter(Boolean),
    lookupIds: Array.from(lookupIds).filter(Boolean),
    resolvedPhone: resolvedPhone || null,
  };
}

async function fetchFallbackDirectNameFromMessages(chat, aliasBundle) {
  const directIdAliases = aliasBundle.aliases.filter((alias) => alias.includes('@'));
  const lookupIds = directIdAliases.length > 0 ? directIdAliases : [chat.id];
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('payload')
    .in('chat_id', lookupIds)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Erro ao buscar fallback de nome do chat ${chat.id}: ${error.message}`);
  }

  for (const row of data || []) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
    if (!payload) continue;

    const candidates = [payload.chat_name, payload.from_name, payload.chatName, payload.contactName];
    for (const candidate of candidates) {
      const resolved = getMeaningfulDirectName(candidate, chat.id, aliasBundle.resolvedPhone);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

async function listEquivalentDirectChats(chat, aliasBundle) {
  const collected = new Map();

  const directIdAliases = Array.from(new Set(aliasBundle.aliases.filter((alias) => alias.includes('@'))));
  if (directIdAliases.length > 0) {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('id,name,phone_number,lid,is_group')
      .in('id', directIdAliases);

    if (error) {
      throw new Error(`Erro ao consultar chats equivalentes por id (${chat.id}): ${error.message}`);
    }

    (data || []).forEach((row) => collected.set(row.id, row));
  }

  if (aliasBundle.resolvedPhone) {
    const phoneVariants = buildPhoneLookupVariants(aliasBundle.resolvedPhone);
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('id,name,phone_number,lid,is_group')
      .in('phone_number', phoneVariants);

    if (error) {
      throw new Error(`Erro ao consultar chats equivalentes por telefone (${chat.id}): ${error.message}`);
    }

    (data || []).forEach((row) => collected.set(row.id, row));
  }

  const lid = cleanText(chat.lid || (getChatIdType(chat.id) === 'lid' ? chat.id : ''));
  if (lid) {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('id,name,phone_number,lid,is_group')
      .eq('lid', lid);

    if (error) {
      throw new Error(`Erro ao consultar chats equivalentes por lid (${chat.id}): ${error.message}`);
    }

    (data || []).forEach((row) => collected.set(row.id, row));
  }

  return Array.from(collected.values()).filter((row) => !row.is_group && isDirectChatId(row.id));
}

async function listExistingPhotoRows(aliases) {
  const uniqueAliases = Array.from(new Set(aliases.filter(Boolean)));
  if (uniqueAliases.length === 0) return [];

  const { data, error } = await supabase
    .from('whatsapp_contact_photos')
    .select('contact_id,source_url,storage_path,public_url')
    .in('contact_id', uniqueAliases);

  if (error) {
    throw new Error(`Erro ao consultar fotos existentes: ${error.message}`);
  }

  return data || [];
}

async function upsertPhotoRows(rows) {
  if (rows.length === 0) return;

  const { error } = await supabase.from('whatsapp_contact_photos').upsert(rows, { onConflict: 'contact_id' });
  if (error) {
    throw new Error(`Erro ao salvar whatsapp_contact_photos: ${error.message}`);
  }
}

async function syncPhotoMetadata(chat, token, aliasBundle) {
  const existingRows = await listExistingPhotoRows(aliasBundle.aliases);
  const existingById = new Map(existingRows.map((row) => [row.contact_id, row]));
  const reusableRow = existingRows.find((row) => cleanText(row.storage_path) && cleanText(row.public_url) && cleanText(row.source_url));
  const missingAliases = aliasBundle.aliases.filter((alias) => !cleanText(existingById.get(alias)?.public_url));

  if (!forcePhotos && reusableRow && missingAliases.length === 0) {
    return { status: 'skipped', detail: 'already_synced' };
  }

  if (!forcePhotos && reusableRow && missingAliases.length > 0) {
    const rowsToUpsert = missingAliases.map((alias) => ({
      contact_id: alias,
      source_url: reusableRow.source_url,
      storage_path: reusableRow.storage_path,
      public_url: reusableRow.public_url,
    }));

    if (!dryRun) {
      await upsertPhotoRows(rowsToUpsert);
    }

    return {
      status: 'updated',
      detail: 'aliases_completed',
      count: rowsToUpsert.length,
      publicUrl: reusableRow.public_url,
    };
  }

  if (aliasBundle.lookupIds.length === 0) {
    return { status: 'not_found', detail: 'no_lookup_id' };
  }

  let profile = null;
  let resolvedLookupId = null;
  for (const lookupId of aliasBundle.lookupIds) {
    const candidateProfile = await fetchWhapiContactProfile(token, lookupId);
    if (!candidateProfile?.icon && !candidateProfile?.icon_full) {
      continue;
    }
    profile = candidateProfile;
    resolvedLookupId = lookupId;
    break;
  }

  const sourceUrl = cleanText(profile?.icon_full || profile?.icon || '');
  if (!sourceUrl) {
    return { status: 'not_found', detail: 'profile_without_photo' };
  }

  if (!forcePhotos && reusableRow && cleanText(reusableRow.source_url) === sourceUrl) {
    const rowsToUpsert = aliasBundle.aliases
      .filter((alias) => {
        const existing = existingById.get(alias);
        return !existing || cleanText(existing.public_url) !== cleanText(reusableRow.public_url);
      })
      .map((alias) => ({
        contact_id: alias,
        source_url: reusableRow.source_url,
        storage_path: reusableRow.storage_path,
        public_url: reusableRow.public_url,
      }));

    if (rowsToUpsert.length === 0) {
      return { status: 'skipped', detail: 'same_source' };
    }

    if (!dryRun) {
      await upsertPhotoRows(rowsToUpsert);
    }

    return {
      status: 'updated',
      detail: 'same_source_completed',
      count: rowsToUpsert.length,
      publicUrl: reusableRow.public_url,
    };
  }

  const photoResponse = await fetch(sourceUrl);
  if (!photoResponse.ok) {
    throw new Error(`Erro ao baixar foto ${chat.id}: ${photoResponse.status}`);
  }

  const contentType = photoResponse.headers.get('content-type');
  const extension = getExtensionFromContentType(contentType);
  const fileName = sanitizeFileName(cleanText(resolvedLookupId).replace(/\D/g, '') || cleanText(resolvedLookupId));
  const filePath = `contacts/${fileName}.${extension}`;
  const fileData = new Uint8Array(await photoResponse.arrayBuffer());

  if (!dryRun) {
    const uploadResult = await supabase.storage.from(photoBucketName).upload(filePath, fileData, {
      contentType: contentType || 'image/jpeg',
      upsert: true,
    });

    if (uploadResult.error) {
      throw new Error(`Erro ao subir foto ${chat.id}: ${uploadResult.error.message}`);
    }
  }

  const publicUrl = supabase.storage.from(photoBucketName).getPublicUrl(filePath).data.publicUrl;
  const rowsToUpsert = aliasBundle.aliases.map((alias) => ({
    contact_id: alias,
    source_url: sourceUrl,
    storage_path: filePath,
    public_url: publicUrl,
  }));

  if (!dryRun) {
    await upsertPhotoRows(rowsToUpsert);
  }

  return {
    status: 'updated',
    detail: 'uploaded',
    count: rowsToUpsert.length,
    publicUrl,
  };
}

async function backfillDirectName(chat, token, aliasBundle) {
  const currentMeaningfulName = getMeaningfulDirectName(chat.name, chat.id, aliasBundle.resolvedPhone);
  let resolvedName = currentMeaningfulName;

  if (!resolvedName || forceNames) {
    const metadata = await fetchWhapiChatMetadata(token, chat.id);
    const whapiName = getMeaningfulDirectName(metadata?.name, chat.id, aliasBundle.resolvedPhone);
    if (!resolvedName && whapiName) {
      resolvedName = whapiName;
    }
  }

  if (!resolvedName) {
    resolvedName = await fetchFallbackDirectNameFromMessages(chat, aliasBundle);
  }

  if (!resolvedName) {
    return { status: 'not_found', detail: 'no_meaningful_name' };
  }

  const equivalentChats = await listEquivalentDirectChats(chat, aliasBundle);
  const rowsToUpdate = equivalentChats.filter(
    (row) => !getMeaningfulDirectName(row.name, row.id, cleanText(row.phone_number) || aliasBundle.resolvedPhone),
  );

  if (rowsToUpdate.length === 0) {
    return { status: 'skipped', detail: 'equivalents_already_named', name: resolvedName };
  }

  if (!dryRun) {
    const { error } = await supabase
      .from('whatsapp_chats')
      .update({
        name: resolvedName,
        updated_at: new Date().toISOString(),
      })
      .in('id', rowsToUpdate.map((row) => row.id));

    if (error) {
      throw new Error(`Erro ao atualizar nome do chat ${chat.id}: ${error.message}`);
    }
  }

  return {
    status: 'updated',
    name: resolvedName,
    count: rowsToUpdate.length,
    chatIds: rowsToUpdate.map((row) => row.id),
  };
}

async function listTargetChats() {
  if (targetChatId) {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('id,name,is_group,phone_number,lid,updated_at')
      .eq('id', targetChatId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao consultar chat ${targetChatId}: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    if (data.is_group || !isDirectChatId(data.id)) {
      throw new Error(`O chat ${targetChatId} nao e um chat direto suportado para este backfill.`);
    }

    return [data];
  }

  const pageSize = 200;
  let offset = 0;
  const chats = [];

  while (chats.length < reconcileLimit) {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('id,name,is_group,phone_number,lid,updated_at')
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Erro ao listar whatsapp_chats no offset ${offset}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const chat of data) {
      if (chat.is_group) continue;
      if (!isDirectChatId(chat.id)) continue;
      chats.push(chat);
      if (chats.length >= reconcileLimit) break;
    }

    offset += data.length;
    if (data.length < pageSize) {
      break;
    }
  }

  return chats;
}

async function main() {
  const token = await getWhapiToken();
  const chats = await listTargetChats();
  const processedNameKeys = new Set();
  const processedPhotoKeys = new Set();
  const summary = {
    dryRun,
    runNames,
    runPhotos,
    forceNames,
    forcePhotos,
    limit: targetChatId ? 1 : reconcileLimit,
    targetChatId,
    scanned: chats.length,
    names: {
      updated: 0,
      skipped: 0,
      notFound: 0,
      failed: 0,
      samples: [],
    },
    photos: {
      updated: 0,
      skipped: 0,
      notFound: 0,
      failed: 0,
      samples: [],
    },
  };

  for (const chat of chats) {
    const resolvedPhone = await resolveChatPhone(chat);
    const aliasBundle = buildDirectChatAliasBundle(chat, resolvedPhone);
    const canonicalKey = aliasBundle.resolvedPhone || normalizeDirectChatId(chat.id);

    if (runNames && !processedNameKeys.has(canonicalKey)) {
      try {
        const result = await backfillDirectName(chat, token, aliasBundle);
        if (result.status === 'updated') {
          summary.names.updated += 1;
          if (summary.names.samples.length < sampleSize) {
            summary.names.samples.push({
              chatId: chat.id,
              resolvedName: result.name,
              updatedRows: result.count,
              affectedChatIds: result.chatIds || [chat.id],
            });
          }
        } else if (result.status === 'not_found') {
          summary.names.notFound += 1;
        } else {
          summary.names.skipped += 1;
        }
      } catch (error) {
        summary.names.failed += 1;
        if (summary.names.samples.length < sampleSize) {
          summary.names.samples.push({
            chatId: chat.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      processedNameKeys.add(canonicalKey);
    }

    if (runPhotos && !processedPhotoKeys.has(canonicalKey)) {
      try {
        const result = await syncPhotoMetadata(chat, token, aliasBundle);
        if (result.status === 'updated') {
          summary.photos.updated += 1;
          if (summary.photos.samples.length < sampleSize) {
            summary.photos.samples.push({
              chatId: chat.id,
              detail: result.detail,
              touchedRows: result.count || 0,
              publicUrl: result.publicUrl || null,
            });
          }
        } else if (result.status === 'not_found') {
          summary.photos.notFound += 1;
        } else {
          summary.photos.skipped += 1;
        }
      } catch (error) {
        summary.photos.failed += 1;
        if (summary.photos.samples.length < sampleSize) {
          summary.photos.samples.push({
            chatId: chat.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      processedPhotoKeys.add(canonicalKey);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('Falha ao executar backfill de metadata dos chats diretos do WhatsApp:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
