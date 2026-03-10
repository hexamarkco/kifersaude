import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const limitArg = [...args].find((arg) => arg.startsWith('--limit='));
const chatLimit = limitArg ? Number(limitArg.split('=')[1]) : null;

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Variaveis ausentes. Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_SERVICE_ROLE_KEY).',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const isDirectChatId = (chatId) => {
  const normalized = cleanText(chatId).toLowerCase();
  if (!normalized) return false;
  if (normalized.endsWith('@g.us')) return false;
  if (normalized.endsWith('@newsletter')) return false;
  if (normalized.endsWith('@broadcast')) return false;
  if (normalized === 'status@broadcast' || normalized === 'stories') return false;
  return true;
};

const normalizeDirectChatId = (chatId) => {
  const trimmed = cleanText(chatId);
  if (!trimmed) return '';

  if (/@c\.us$/i.test(trimmed)) {
    return trimmed.replace(/@c\.us$/i, '@s.whatsapp.net');
  }

  if (/@s\.whatsapp\.net$/i.test(trimmed)) {
    return trimmed.replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');
  }

  return trimmed;
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

const pickBestName = (targetName, targetId, sourceName, sourceId) => {
  const current = cleanText(targetName);
  if (current && current !== targetId) return current;
  const fallback = cleanText(sourceName);
  if (fallback && fallback !== sourceId) return fallback;
  return current || fallback || null;
};

const toMillis = (value) => {
  const parsed = new Date(value || '').getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

async function listDirectChats() {
  const pageSize = 500;
  let offset = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('id, name, is_group, phone_number, lid, created_at, updated_at, last_message_at')
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Erro ao listar chats (offset ${offset}): ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data.filter((chat) => !chat.is_group && isDirectChatId(chat.id)));
    offset += data.length;
    if (data.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function fetchChatById(chatId) {
  const { data, error } = await supabase
    .from('whatsapp_chats')
    .select('id, name, is_group, phone_number, lid, created_at, updated_at, last_message_at')
    .eq('id', chatId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao consultar chat ${chatId}: ${error.message}`);
  }

  return data;
}

async function fetchRecentPeerMessages(chatId) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('from_number, to_number, direction, timestamp, created_at')
    .eq('chat_id', chatId)
    .order('timestamp', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(`Erro ao consultar mensagens do chat ${chatId}: ${error.message}`);
  }

  return data || [];
}

const resolvePhoneFromChatAndMessages = (chat, messages) => {
  for (const message of messages) {
    const rawPeer =
      message.direction === 'inbound'
        ? message.from_number
        : message.direction === 'outbound'
          ? message.to_number
          : null;
    const fromMessage = extractDirectPhoneDigits(rawPeer);
    if (fromMessage) return fromMessage;
  }

  const fromStoredPhone = extractDirectPhoneDigits(chat.phone_number);
  if (fromStoredPhone) return fromStoredPhone;

  return extractDirectPhoneDigits(chat.id);
};

async function resolveTargetChatId(sourceChatId, phoneDigits) {
  const chatIdVariants = buildDirectIdVariantsFromPhone(phoneDigits);
  if (chatIdVariants.length > 0) {
    const { data: byId, error: byIdError } = await supabase
      .from('whatsapp_chats')
      .select('id')
      .in('id', chatIdVariants)
      .neq('id', sourceChatId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byIdError && byId?.id) {
      return normalizeDirectChatId(byId.id);
    }
  }

  const phoneVariants = buildPhoneLookupVariants(phoneDigits);
  if (phoneVariants.length > 0) {
    const { data: byPhone, error: byPhoneError } = await supabase
      .from('whatsapp_chats')
      .select('id')
      .in('phone_number', phoneVariants)
      .neq('id', sourceChatId)
      .not('id', 'ilike', '%@lid')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byPhoneError && byPhone?.id) {
      return normalizeDirectChatId(byPhone.id);
    }
  }

  return `${phoneDigits}@s.whatsapp.net`;
}

async function ensureTargetChat(targetChatId, sourceChat, phoneDigits, nowIso) {
  const normalizedTargetId = normalizeDirectChatId(targetChatId);
  let targetChat = await fetchChatById(normalizedTargetId);

  if (!targetChat && !dryRun) {
    const initialName = pickBestName(null, normalizedTargetId, sourceChat.name, sourceChat.id) || sourceChat.name || null;
    const initialLid =
      sourceChat.id.toLowerCase().endsWith('@lid')
        ? sourceChat.id
        : cleanText(sourceChat.lid) || null;

    const { error: upsertError } = await supabase.from('whatsapp_chats').upsert(
      {
        id: normalizedTargetId,
        name: initialName,
        is_group: false,
        phone_number: phoneDigits,
        lid: initialLid,
        last_message_at: sourceChat.last_message_at,
        updated_at: nowIso,
      },
      { onConflict: 'id' },
    );

    if (upsertError) {
      throw new Error(`Erro ao criar chat canônico ${normalizedTargetId}: ${upsertError.message}`);
    }

    targetChat = await fetchChatById(normalizedTargetId);
  }

  if (!targetChat) {
    return {
      id: normalizedTargetId,
      name: null,
      phone_number: phoneDigits,
      lid: sourceChat.id.toLowerCase().endsWith('@lid') ? sourceChat.id : sourceChat.lid,
      last_message_at: sourceChat.last_message_at,
      updated_at: sourceChat.updated_at,
      created_at: sourceChat.created_at,
    };
  }

  const mergedLastMessageAt =
    toMillis(sourceChat.last_message_at) > toMillis(targetChat.last_message_at)
      ? sourceChat.last_message_at
      : targetChat.last_message_at;

  const mergedName = pickBestName(targetChat.name, targetChat.id, sourceChat.name, sourceChat.id);
  const mergedLid = cleanText(targetChat.lid) || (sourceChat.id.toLowerCase().endsWith('@lid') ? sourceChat.id : cleanText(sourceChat.lid));
  const mergedPhone = cleanText(targetChat.phone_number) || phoneDigits;

  if (!dryRun) {
    const { error: updateError } = await supabase
      .from('whatsapp_chats')
      .update({
        name: mergedName,
        phone_number: mergedPhone,
        lid: mergedLid || null,
        last_message_at: mergedLastMessageAt,
        updated_at: nowIso,
      })
      .eq('id', targetChat.id);

    if (updateError) {
      throw new Error(`Erro ao atualizar chat destino ${targetChat.id}: ${updateError.message}`);
    }
  }

  return {
    ...targetChat,
    name: mergedName,
    phone_number: mergedPhone,
    lid: mergedLid || null,
    last_message_at: mergedLastMessageAt,
  };
}

async function moveMessagesToTarget(sourceChatId, targetChatId) {
  if (dryRun) return;

  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ chat_id: targetChatId })
    .eq('chat_id', sourceChatId);

  if (error) {
    throw new Error(`Erro ao mover mensagens de ${sourceChatId} para ${targetChatId}: ${error.message}`);
  }
}

async function deleteChat(chatId) {
  if (dryRun) return;

  const { error } = await supabase
    .from('whatsapp_chats')
    .delete()
    .eq('id', chatId);

  if (error) {
    throw new Error(`Erro ao excluir chat ${chatId}: ${error.message}`);
  }
}

async function normalizeChatFields(chat, resolvedPhone, nowIso) {
  const normalizedLid = chat.id.toLowerCase().endsWith('@lid') ? chat.id : cleanText(chat.lid) || null;
  const normalizedPhone = chat.id.toLowerCase().endsWith('@lid') ? null : resolvedPhone || cleanText(chat.phone_number) || null;

  const hasPhoneChange = (cleanText(chat.phone_number) || null) !== normalizedPhone;
  const hasLidChange = (cleanText(chat.lid) || null) !== normalizedLid;
  if (!hasPhoneChange && !hasLidChange) return false;

  if (!dryRun) {
    const { error } = await supabase
      .from('whatsapp_chats')
      .update({
        phone_number: normalizedPhone,
        lid: normalizedLid,
        updated_at: nowIso,
      })
      .eq('id', chat.id);

    if (error) {
      throw new Error(`Erro ao normalizar chat ${chat.id}: ${error.message}`);
    }
  }

  return true;
}

async function reconcileDirectChats() {
  const allChats = await listDirectChats();
  const sourceChats = chatLimit && Number.isFinite(chatLimit) ? allChats.slice(0, Math.max(0, chatLimit)) : allChats;

  const summary = {
    dryRun,
    scanned: 0,
    normalizedOnly: 0,
    merged: 0,
    skippedNoPhone: 0,
    skippedMissingSource: 0,
  };

  for (const baseChat of sourceChats) {
    summary.scanned += 1;

    const sourceChat = await fetchChatById(baseChat.id);
    if (!sourceChat) {
      summary.skippedMissingSource += 1;
      continue;
    }

    const recentMessages = await fetchRecentPeerMessages(sourceChat.id);
    const resolvedPhone = resolvePhoneFromChatAndMessages(sourceChat, recentMessages);
    if (!resolvedPhone) {
      summary.skippedNoPhone += 1;
      continue;
    }

    const targetChatId = await resolveTargetChatId(sourceChat.id, resolvedPhone);
    const normalizedSourceId = normalizeDirectChatId(sourceChat.id);
    const normalizedTargetId = normalizeDirectChatId(targetChatId);
    const nowIso = new Date().toISOString();

    if (normalizedTargetId === normalizedSourceId) {
      const normalized = await normalizeChatFields(sourceChat, resolvedPhone, nowIso);
      if (normalized) {
        summary.normalizedOnly += 1;
      }
      continue;
    }

    await ensureTargetChat(normalizedTargetId, sourceChat, resolvedPhone, nowIso);
    await moveMessagesToTarget(sourceChat.id, normalizedTargetId);
    await deleteChat(sourceChat.id);
    summary.merged += 1;

    console.log(`[merge] ${sourceChat.id} -> ${normalizedTargetId} (${resolvedPhone})${dryRun ? ' [dry-run]' : ''}`);
  }

  return summary;
}

async function main() {
  console.log(`Iniciando reconciliacao de chats diretos do WhatsApp (${dryRun ? 'DRY RUN' : 'EXECUCAO'})...`);
  const startedAt = Date.now();
  const summary = await reconcileDirectChats();
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('Reconciliacao finalizada.');
  console.log(JSON.stringify({ ...summary, elapsedSeconds }, null, 2));
}

main().catch((error) => {
  console.error('Falha ao reconciliar chats diretos do WhatsApp:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
