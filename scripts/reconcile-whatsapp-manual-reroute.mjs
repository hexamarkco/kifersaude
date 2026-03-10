import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes('--dry-run');
const fromChatArg = rawArgs.find((arg) => arg.startsWith('--from-chat='));
const toChatArg = rawArgs.find((arg) => arg.startsWith('--to-chat='));
const requestedIds = Array.from(
  new Set(
    rawArgs
      .filter((arg) => arg.startsWith('--message-id='))
      .map((arg) => arg.split('=')[1])
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean),
  ),
);

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

if (!fromChatArg || !toChatArg || requestedIds.length === 0) {
  throw new Error(
    'Uso obrigatorio: --from-chat=<chatId> --to-chat=<chatId> --message-id=<id> [--message-id=<id> ...] [--dry-run]',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const getChatIdType = (chatId) => {
  const normalized = cleanText(chatId).toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized.endsWith('@g.us')) return 'group';
  if (normalized === 'status@broadcast' || normalized === 'stories') return 'status';
  if (normalized.endsWith('@newsletter')) return 'newsletter';
  if (normalized.endsWith('@broadcast')) return 'broadcast';
  if (normalized.endsWith('@c.us') || normalized.endsWith('@s.whatsapp.net')) return 'phone';
  if (normalized.endsWith('@lid')) return 'lid';

  if (!normalized.includes('@')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return 'phone';
    }
  }

  return 'unknown';
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

  if (!trimmed.includes('@')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return `${digits}@s.whatsapp.net`;
    }
  }

  return trimmed;
};

const normalizeChatId = (chatId) => {
  const trimmed = cleanText(chatId);
  if (!trimmed) return '';
  const type = getChatIdType(trimmed);
  if (type === 'phone') return normalizeDirectChatId(trimmed);
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

const pickBestName = (targetName, targetId, sourceName, sourceId) => {
  const current = cleanText(targetName);
  if (current && current !== targetId) return current;

  const fallback = cleanText(sourceName);
  if (fallback && fallback !== sourceId) return fallback;

  return current || fallback || null;
};

const isMissingRelationError = (error, relationName) => {
  if (!error || typeof error !== 'object') return false;
  const code = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const relation = relationName.toLowerCase();
  return (
    code === '42P01' ||
    message.includes(`relation "${relation}"`) ||
    message.includes(`relation '${relation}'`) ||
    message.includes(relation)
  );
};

const toMillis = (value) => {
  const parsed = new Date(value || '').getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toPayloadObject = (value) => (value && typeof value === 'object' ? value : null);

const provisionalBodyMarkers = new Set([
  '[mensagem criptografada]',
  '[evento do whatsapp]',
  '[sistema: ciphertext]',
]);

const ignoredChatPreviewBodies = new Set([
  '[evento do whatsapp]',
  '[atualizacao do whatsapp]',
  '[atualização do whatsapp]',
  '[mensagem nao suportada]',
  '[mensagem não suportada]',
]);

const normalizePreviewBody = (value) => cleanText(value).toLowerCase();

const isWaitingPlaceholderText = (body) => {
  const normalized = normalizePreviewBody(body);
  if (!normalized) return false;
  return (
    normalized.includes('aguardando esta mensagem') ||
    normalized.includes('aguardando essa mensagem') ||
    normalized.includes('waiting for this message')
  );
};

const resolveStoredChatPreview = (message) => {
  if (message?.is_deleted) {
    return 'Mensagem apagada';
  }

  const payload = toPayloadObject(message?.payload);
  const action = toPayloadObject(payload?.action);
  const actionType = normalizePreviewBody(action?.type);
  if (actionType === 'reaction' || actionType === 'edit' || actionType === 'edited') {
    return null;
  }

  const normalizedType = normalizePreviewBody(message?.type);
  const normalizedBody = normalizePreviewBody(message?.body);
  const payloadSubtype = normalizePreviewBody(payload?.subtype);
  const payloadSystem = toPayloadObject(payload?.system);
  const payloadSystemBody = cleanText(payloadSystem?.body);

  if (
    normalizedType === 'system' &&
    (
      provisionalBodyMarkers.has(normalizedBody) ||
      payloadSubtype === 'ciphertext' ||
      isWaitingPlaceholderText(message?.body) ||
      isWaitingPlaceholderText(payloadSystemBody)
    )
  ) {
    return null;
  }

  const body = cleanText(message?.body);
  if (normalizedBody) {
    if (ignoredChatPreviewBodies.has(normalizedBody)) {
      return null;
    }

    return body;
  }

  if (normalizedType === 'image') return '[Imagem]';
  if (normalizedType === 'video' || normalizedType === 'short' || normalizedType === 'gif') return '[Video]';
  if (normalizedType === 'audio' || normalizedType === 'voice' || normalizedType === 'ptt') return '[Audio]';
  if (normalizedType === 'document') return '[Documento]';
  if (normalizedType === 'contact') return '[Contato]';
  if (normalizedType === 'location' || normalizedType === 'live_location') return '[Localizacao]';
  if (message?.has_media) return '[Anexo]';
  return null;
};

const fromChatId = normalizeChatId(fromChatArg.split('=')[1] || '');
const toChatId = normalizeChatId(toChatArg.split('=')[1] || '');

if (!fromChatId || !toChatId) {
  throw new Error('Chats invalidos. Informe --from-chat e --to-chat com IDs validos.');
}

if (fromChatId === toChatId) {
  throw new Error('Os chats de origem e destino precisam ser diferentes.');
}

async function fetchChatById(chatId) {
  const { data, error } = await supabase
    .from('whatsapp_chats')
    .select('id, name, is_group, phone_number, lid, created_at, updated_at, last_message_at, last_message')
    .eq('id', chatId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao consultar chat ${chatId}: ${error.message}`);
  }

  return data;
}

async function fetchMessagesByIds(messageIds) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id, chat_id, to_number, direction, timestamp, created_at, body')
    .in('id', messageIds);

  if (error) {
    throw new Error(`Erro ao consultar mensagens: ${error.message}`);
  }

  return data || [];
}

async function countMessagesInChat(chatId) {
  const { count, error } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId);

  if (error) {
    throw new Error(`Erro ao contar mensagens do chat ${chatId}: ${error.message}`);
  }

  return count || 0;
}

async function refreshChatLastMessage(chatId) {
  const { data: recentMessages, error: latestMessageError } = await supabase
    .from('whatsapp_messages')
    .select('timestamp, created_at, body, type, payload, has_media, is_deleted')
    .eq('chat_id', chatId)
    .order('timestamp', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(25);

  if (latestMessageError) {
    throw new Error(`Erro ao recalcular ultimo horario do chat ${chatId}: ${latestMessageError.message}`);
  }

  const latestMessage = (recentMessages || [])[0];
  const nextLastMessageAt = latestMessage?.timestamp || latestMessage?.created_at || null;
  const nextLastMessage =
    (recentMessages || [])
      .map((message) => resolveStoredChatPreview(message))
      .find((preview) => typeof preview === 'string' && preview.trim() !== '') || null;
  const { error: updateError } = await supabase
    .from('whatsapp_chats')
    .update({
      last_message: nextLastMessage,
      last_message_at: nextLastMessageAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chatId);

  if (updateError) {
    throw new Error(`Erro ao atualizar chat ${chatId}: ${updateError.message}`);
  }
}

async function ensureTargetChat(targetChatId, sourceChat) {
  const existingTarget = await fetchChatById(targetChatId);
  if (existingTarget) return existingTarget;

  if (!sourceChat) {
    throw new Error(`Chat destino ${targetChatId} nao existe e nao ha chat origem para aproveitar metadados.`);
  }

  const nowIso = new Date().toISOString();
  const targetType = getChatIdType(targetChatId);
  const targetPhone =
    targetType === 'phone'
      ? extractDirectPhoneDigits(targetChatId) || cleanText(sourceChat.phone_number) || null
      : null;
  const targetLid =
    targetType === 'lid'
      ? targetChatId
      : cleanText(sourceChat.lid) || null;
  const targetName =
    pickBestName(null, targetChatId, sourceChat.name, sourceChat.id) ||
    targetPhone ||
    targetChatId;

  const { error: upsertError } = await supabase.from('whatsapp_chats').upsert(
    {
      id: targetChatId,
      name: targetName,
      is_group: targetType === 'group',
      phone_number: targetPhone,
      lid: targetLid,
      last_message: sourceChat.last_message ?? null,
      last_message_at: sourceChat.last_message_at,
      updated_at: nowIso,
      created_at: nowIso,
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    throw new Error(`Erro ao garantir chat destino ${targetChatId}: ${upsertError.message}`);
  }

  const createdTarget = await fetchChatById(targetChatId);
  if (!createdTarget) {
    throw new Error(`Chat destino ${targetChatId} nao foi encontrado apos criacao.`);
  }

  return createdTarget;
}

async function updateMessages(rows, targetChatId) {
  for (const row of rows) {
    const updates = {
      chat_id: targetChatId,
      ...(row.direction === 'outbound' ? { to_number: targetChatId } : {}),
    };

    const { error } = await supabase
      .from('whatsapp_messages')
      .update(updates)
      .eq('id', row.id);

    if (error) {
      throw new Error(`Erro ao mover mensagem ${row.id}: ${error.message}`);
    }

    console.log(`[manual-reroute] ${row.id} ${fromChatId} -> ${targetChatId}`);
  }
}

async function updateHistoryChatIds(messageIds, targetChatId) {
  const { error } = await supabase
    .from('whatsapp_message_history')
    .update({ chat_id: targetChatId })
    .in('message_id', messageIds);

  if (error && !isMissingRelationError(error, 'whatsapp_message_history')) {
    throw new Error(`Erro ao atualizar historico de mensagens: ${error.message}`);
  }
}

async function maybeDeleteSourceChat(chatId) {
  const remainingCount = await countMessagesInChat(chatId);
  if (remainingCount > 0) {
    await refreshChatLastMessage(chatId);
    return false;
  }

  const { error } = await supabase
    .from('whatsapp_chats')
    .delete()
    .eq('id', chatId);

  if (error) {
    throw new Error(`Erro ao apagar chat origem vazio ${chatId}: ${error.message}`);
  }

  return true;
}

async function reconcileManualReroute() {
  const rows = await fetchMessagesByIds(requestedIds);
  const foundById = new Map(rows.map((row) => [row.id, row]));
  const missingIds = requestedIds.filter((id) => !foundById.has(id));

  if (missingIds.length > 0) {
    throw new Error(`Mensagens nao encontradas: ${missingIds.join(', ')}`);
  }

  const sourceRows = [];
  const alreadyTargetRows = [];
  const unexpectedRows = [];

  requestedIds.forEach((id) => {
    const row = foundById.get(id);
    const currentChatId = normalizeChatId(row.chat_id || '');

    if (currentChatId === fromChatId) {
      sourceRows.push(row);
      return;
    }

    if (currentChatId === toChatId) {
      alreadyTargetRows.push(row);
      return;
    }

    unexpectedRows.push({
      id: row.id,
      chat_id: row.chat_id,
    });
  });

  if (unexpectedRows.length > 0) {
    throw new Error(
      `Mensagens fora da origem/destino esperados: ${unexpectedRows.map((row) => `${row.id}:${row.chat_id}`).join(', ')}`,
    );
  }

  if (alreadyTargetRows.length > 0 && sourceRows.length > 0) {
    throw new Error(
      `Estado parcial detectado. Algumas mensagens ja estao no destino (${alreadyTargetRows.length}) e outras ainda na origem (${sourceRows.length}).`,
    );
  }

  const sourceChat = await fetchChatById(fromChatId);
  const targetChat = await ensureTargetChat(toChatId, sourceChat);
  const sourceCountBefore = sourceChat ? await countMessagesInChat(fromChatId) : 0;
  const sourceRemainingAfterMove = Math.max(0, sourceCountBefore - sourceRows.length);
  const summary = {
    dryRun,
    fromChat: fromChatId,
    toChat: toChatId,
    requestedIds,
    validatedIds: requestedIds.filter((id) => foundById.has(id)),
    moved: 0,
    sourceChatDeleted: false,
    affectedChats: Array.from(new Set([fromChatId, toChatId])),
    status: 'validated',
    alreadyReroutedIds: alreadyTargetRows.map((row) => row.id),
  };

  if (sourceRows.length === 0 && alreadyTargetRows.length === requestedIds.length) {
    summary.status = 'already-rerouted';
    summary.sourceChatDeleted = !sourceChat;
    return summary;
  }

  if (!sourceChat) {
    throw new Error(`Chat origem ${fromChatId} nao existe no banco.`);
  }

  if (!targetChat) {
    throw new Error(`Chat destino ${toChatId} nao existe e nao foi possivel garanti-lo.`);
  }

  if (dryRun) {
    summary.status = 'dry-run';
    summary.moved = sourceRows.length;
    summary.sourceChatDeleted = sourceRemainingAfterMove === 0;
    return summary;
  }

  await updateMessages(sourceRows, toChatId);
  await updateHistoryChatIds(sourceRows.map((row) => row.id), toChatId);
  await refreshChatLastMessage(toChatId);
  summary.sourceChatDeleted = await maybeDeleteSourceChat(fromChatId);
  summary.moved = sourceRows.length;
  summary.status = 'updated';

  return summary;
}

async function main() {
  console.log(
    `Iniciando reroteamento manual de mensagens do WhatsApp (${dryRun ? 'DRY RUN' : 'EXECUCAO'})...`,
  );

  const startedAt = Date.now();
  const summary = await reconcileManualReroute();
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('Reroteamento manual finalizado.');
  console.log(JSON.stringify({ ...summary, elapsedSeconds }, null, 2));
}

main().catch((error) => {
  console.error('Falha no reroteamento manual do WhatsApp:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
