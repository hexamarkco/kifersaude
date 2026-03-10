import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const sinceArg = [...args].find((arg) => arg.startsWith('--since='));
const limitArg = [...args].find((arg) => arg.startsWith('--limit='));
const rowLimit = limitArg ? Number(limitArg.split('=')[1]) : null;
const sinceIso = sinceArg ? sinceArg.split('=')[1] : null;

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

const normalizeMaybeDirectId = (value) => {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  return getChatIdType(cleaned) === 'phone' ? normalizeDirectChatId(cleaned) : cleaned;
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

const toEpochMillis = (value) => {
  const parsed = new Date(value || '').getTime();
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const extractConversationKey = (messageId) => {
  const cleaned = cleanText(messageId);
  if (!cleaned || cleaned.length < 6) return null;
  return cleaned.slice(-8);
};

const isDirectChat = (chatId) => {
  const type = getChatIdType(chatId);
  return type === 'phone' || type === 'lid';
};

const isSuspiciousOutboundSelfMessage = (row) => {
  if (row.direction !== 'outbound') return false;

  const chatId = normalizeDirectChatId(row.chat_id);
  if (getChatIdType(chatId) !== 'phone') {
    return false;
  }

  const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
  if (!payload) return false;

  const source = cleanText(payload.source).toLowerCase();
  if (source !== 'web' && source !== 'mobile') {
    return false;
  }

  if (payload.from_me !== true) {
    return false;
  }

  const payloadChatId = normalizeDirectChatId(payload.chat_id || '');
  const normalizedFrom = normalizeMaybeDirectId(payload.from);

  if (!normalizedFrom || getChatIdType(normalizedFrom) !== 'phone') {
    return false;
  }

  if (payloadChatId && payloadChatId !== chatId) {
    return false;
  }

  return normalizeDirectChatId(normalizedFrom) === chatId;
};

const scoreCandidate = (referenceMillis, candidate) => {
  let score = candidate.direction === 'inbound' ? 8 : 2;
  const candidateMillis = toEpochMillis(candidate.timestamp || candidate.created_at);

  if (!Number.isNaN(referenceMillis) && !Number.isNaN(candidateMillis)) {
    const diff = Math.abs(candidateMillis - referenceMillis);
    if (diff <= 2 * 60 * 60 * 1000) {
      score += 8;
    } else if (diff <= 12 * 60 * 60 * 1000) {
      score += 5;
    } else if (diff <= 48 * 60 * 60 * 1000) {
      score += 3;
    } else if (diff <= 7 * 24 * 60 * 60 * 1000) {
      score += 1;
    }
  }

  return { score, candidateMillis };
};

const inferTargetChatId = (row, tailMap) => {
  const conversationKey = extractConversationKey(row.id);
  if (!conversationKey) {
    return null;
  }

  const candidates = tailMap.get(conversationKey) || [];
  if (candidates.length === 0) {
    return null;
  }

  const sourceChatId = normalizeDirectChatId(row.chat_id || '');
  const referenceMillis = toEpochMillis(row.timestamp || row.created_at);

  const byChat = new Map();
  for (const candidate of candidates) {
    if (candidate.id === row.id) continue;

    const candidateChatId = normalizeDirectChatId(candidate.chat_id || '');
    if (!candidateChatId || candidateChatId === sourceChatId || !isDirectChat(candidateChatId)) {
      continue;
    }

    const { score, candidateMillis } = scoreCandidate(referenceMillis, candidate);
    const previous = byChat.get(candidateChatId) || {
      chatId: candidateChatId,
      score: 0,
      inboundHits: 0,
      latestAt: Number.NaN,
    };

    byChat.set(candidateChatId, {
      chatId: candidateChatId,
      score: previous.score + score,
      inboundHits: previous.inboundHits + (candidate.direction === 'inbound' ? 1 : 0),
      latestAt: Number.isNaN(previous.latestAt)
        ? candidateMillis
        : Number.isNaN(candidateMillis)
          ? previous.latestAt
          : Math.max(previous.latestAt, candidateMillis),
    });
  }

  const ranked = Array.from(byChat.values()).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.inboundHits !== left.inboundHits) return right.inboundHits - left.inboundHits;
    return (right.latestAt || 0) - (left.latestAt || 0);
  });

  if (ranked.length === 0) return null;

  const [best, secondBest] = ranked;
  if (best.inboundHits === 0) return null;

  if (secondBest) {
    const scoreDelta = best.score - secondBest.score;
    if (scoreDelta <= 0 && best.inboundHits === secondBest.inboundHits) {
      return null;
    }
    if (scoreDelta < 2 && best.inboundHits <= secondBest.inboundHits) {
      return null;
    }
  }

  return best.chatId;
};

async function listCandidateMessages() {
  const pageSize = 1000;
  let offset = 0;
  const rows = [];

  while (true) {
    let query = supabase
      .from('whatsapp_messages')
      .select('id, chat_id, direction, timestamp, created_at, payload, to_number')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (sinceIso) {
      query = query.gte('created_at', sinceIso);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao carregar mensagens (offset ${offset}): ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);
    offset += data.length;

    if (rowLimit && rows.length >= rowLimit) {
      return rows.slice(0, rowLimit);
    }

    if (data.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function refreshChatLastMessage(chatId) {
  const normalizedChatId = cleanText(chatId);
  if (!normalizedChatId) return;

  const { data: recentMessages, error: latestMessageError } = await supabase
    .from('whatsapp_messages')
    .select('timestamp, created_at, body, type, payload, has_media, is_deleted')
    .eq('chat_id', normalizedChatId)
    .order('timestamp', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(25);

  if (latestMessageError) {
    throw new Error(`Erro ao recalcular último horário do chat ${normalizedChatId}: ${latestMessageError.message}`);
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
    .eq('id', normalizedChatId);

  if (updateError) {
    throw new Error(`Erro ao atualizar chat ${normalizedChatId}: ${updateError.message}`);
  }
}

async function reconcileOutboundRouting() {
  const rows = await listCandidateMessages();
  const directRows = rows.filter((row) => isDirectChat(row.chat_id));

  const tailMap = new Map();
  directRows.forEach((row) => {
    const key = extractConversationKey(row.id);
    if (!key) return;
    if (!tailMap.has(key)) {
      tailMap.set(key, []);
    }
    tailMap.get(key).push(row);
  });

  const suspiciousRows = directRows.filter(isSuspiciousOutboundSelfMessage);

  const summary = {
    dryRun,
    since: sinceIso,
    scannedRows: rows.length,
    scannedDirectRows: directRows.length,
    suspiciousRows: suspiciousRows.length,
    resolved: 0,
    unresolved: 0,
    updated: 0,
  };

  const affectedChats = new Set();

  for (const row of suspiciousRows) {
    const sourceChatId = normalizeDirectChatId(row.chat_id || '');
    const targetChatId = inferTargetChatId(row, tailMap);

    if (!targetChatId || targetChatId === sourceChatId) {
      summary.unresolved += 1;
      continue;
    }

    summary.resolved += 1;
    affectedChats.add(sourceChatId);
    affectedChats.add(targetChatId);

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('whatsapp_messages')
        .update({
          chat_id: targetChatId,
          to_number: targetChatId,
        })
        .eq('id', row.id);

      if (updateError) {
        throw new Error(`Erro ao mover mensagem ${row.id} para ${targetChatId}: ${updateError.message}`);
      }

      summary.updated += 1;
    }

    console.log(
      `[reroute] ${row.id} ${sourceChatId} -> ${targetChatId}${dryRun ? ' [dry-run]' : ''}`,
    );
  }

  if (!dryRun) {
    for (const chatId of affectedChats) {
      await refreshChatLastMessage(chatId);
    }
  }

  return summary;
}

async function main() {
  console.log(
    `Iniciando reconciliacao de outbound web/mobile com chat incorreto (${dryRun ? 'DRY RUN' : 'EXECUCAO'})...`,
  );

  const startedAt = Date.now();
  const summary = await reconcileOutboundRouting();
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('Reconciliacao finalizada.');
  console.log(JSON.stringify({ ...summary, elapsedSeconds }, null, 2));
}

main().catch((error) => {
  console.error('Falha na reconciliacao de outbound web/mobile:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
