import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const limitArg = [...args].find((arg) => arg.startsWith('--limit='));
const chatArg = [...args].find((arg) => arg.startsWith('--chat='));
const chatLimit = limitArg ? Number(limitArg.split('=')[1]) : null;
const targetChatId = chatArg ? chatArg.split('=')[1]?.trim() || null : null;

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

const CHAT_PAGE_SIZE = 200;
const MESSAGE_PAGE_SIZE = 200;

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const toPayloadObject = (value) => (value && typeof value === 'object' ? value : null);

const normalizePreviewBody = (value) => cleanText(value).toLowerCase();

const getWhatsAppChatKind = (chatId) => {
  const normalized = cleanText(chatId).toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized.endsWith('@g.us')) return 'group';
  if (normalized === 'status@broadcast' || normalized === 'stories') return 'status';
  if (normalized.endsWith('@newsletter')) return 'newsletter';
  if (normalized.endsWith('@broadcast')) return 'broadcast';
  if (
    normalized.endsWith('@s.whatsapp.net') ||
    normalized.endsWith('@c.us') ||
    normalized.endsWith('@lid')
  ) {
    return 'direct';
  }

  if (!normalized.includes('@')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return 'direct';
    }
  }

  return 'unknown';
};

const normalizeChatId = (chatIdOrPhone) => {
  const trimmed = cleanText(chatIdOrPhone);
  if (!trimmed) return trimmed;

  if (!trimmed.includes('@')) {
    return `${trimmed.replace(/\D/g, '')}@s.whatsapp.net`;
  }

  if (/@c\.us$/i.test(trimmed)) {
    return trimmed.replace(/@c\.us$/i, '@s.whatsapp.net');
  }

  if (/@s\.whatsapp\.net$/i.test(trimmed)) {
    return trimmed.replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');
  }

  return trimmed;
};

const buildChatIdFromPhone = (phoneNumber) => {
  const digits = cleanText(phoneNumber).replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
};

const isDirectChat = (chat) => getWhatsAppChatKind(chat.id) === 'direct';

const ignoredChatPreviewBodies = new Set([
  '[evento do whatsapp]',
  '[atualizacao do whatsapp]',
  '[atualizacao do whatsapp.]',
  '[mensagem nao suportada]',
]);

const provisionalBodyMarkers = new Set([
  '[mensagem criptografada]',
  '[evento do whatsapp]',
  '[sistema: ciphertext]',
]);

const isWaitingPlaceholderText = (body) => {
  const normalized = normalizePreviewBody(body);
  if (!normalized) return false;
  return (
    normalized.includes('aguardando esta mensagem') ||
    normalized.includes('aguardando essa mensagem') ||
    normalized.includes('waiting for this message')
  );
};

const normalizeActionType = (value) => cleanText(value).toLowerCase();

const isLikelyProvisionalStoredMessage = (message) => {
  const payload = toPayloadObject(message?.payload);
  const type = normalizePreviewBody(message?.type);
  const body = normalizePreviewBody(message?.body);
  const subtype = normalizePreviewBody(payload?.subtype);
  const system = toPayloadObject(payload?.system);
  const systemBody = cleanText(system?.body);

  return (
    type === 'system' &&
    (
      provisionalBodyMarkers.has(body) ||
      subtype === 'ciphertext' ||
      isWaitingPlaceholderText(message?.body) ||
      isWaitingPlaceholderText(systemBody)
    )
  );
};

const resolveStoredChatPreview = (message) => {
  if (message?.is_deleted) {
    return 'Mensagem apagada';
  }

  const payload = toPayloadObject(message?.payload);
  const action = toPayloadObject(payload?.action);
  const actionType = normalizeActionType(action?.type);
  if (actionType === 'reaction' || actionType === 'edit' || actionType === 'edited') {
    return null;
  }

  if (isLikelyProvisionalStoredMessage(message)) {
    return null;
  }

  const body = cleanText(message?.body);
  const normalizedBody = normalizePreviewBody(body);
  if (normalizedBody) {
    if (ignoredChatPreviewBodies.has(normalizedBody)) {
      return null;
    }

    return body;
  }

  const type = normalizePreviewBody(message?.type);
  if (type === 'image') return '[Imagem]';
  if (type === 'video' || type === 'short' || type === 'gif') return '[Video]';
  if (type === 'audio' || type === 'voice' || type === 'ptt') return '[Audio]';
  if (type === 'document') return '[Documento]';
  if (type === 'contact') return '[Contato]';
  if (type === 'location' || type === 'live_location') return '[Localizacao]';
  if (message?.has_media) return '[Anexo]';
  return null;
};

const normalizeDirection = (value) => (value === 'inbound' || value === 'outbound' ? value : null);

const getChatIdVariants = (chat) => {
  const variants = new Set();
  if (chat.id) variants.add(chat.id);

  if (isDirectChat(chat)) {
    const normalized = normalizeChatId(chat.id);
    if (normalized) variants.add(normalized);
    if (normalized.endsWith('@s.whatsapp.net')) {
      variants.add(normalized.replace(/@s\.whatsapp\.net$/i, '@c.us'));
    }
    if (cleanText(chat.id).toLowerCase().endsWith('@c.us')) {
      variants.add(chat.id.replace(/@c\.us$/i, '@s.whatsapp.net'));
    }
    if (chat.phone_number) {
      variants.add(buildChatIdFromPhone(chat.phone_number));
    }
    if (chat.lid) variants.add(chat.lid);
  }

  return Array.from(variants).filter(Boolean);
};

async function listChats() {
  if (targetChatId) {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('id, is_group, phone_number, lid, last_message, last_message_direction, last_message_at')
      .eq('id', targetChatId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao carregar chat alvo: ${error.message}`);
    }

    return data ? [data] : [];
  }

  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('id, is_group, phone_number, lid, last_message, last_message_direction, last_message_at')
      .order('id', { ascending: true })
      .range(offset, offset + CHAT_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao listar chats no offset ${offset}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    if (chatLimit && rows.length >= chatLimit) {
      return rows.slice(0, chatLimit);
    }

    if (data.length < CHAT_PAGE_SIZE) {
      break;
    }

    offset += data.length;
  }

  return rows;
}

async function resolveVisibleActivityForChat(chat) {
  const variants = getChatIdVariants(chat);
  if (variants.length === 0) {
    return {
      preview: null,
      timestamp: null,
      direction: null,
      sourceChatId: null,
      sourceMessageId: null,
    };
  }

  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('id, chat_id, body, type, has_media, payload, is_deleted, direction, timestamp, created_at')
      .in('chat_id', variants)
      .order('timestamp', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + MESSAGE_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao carregar mensagens do chat ${chat.id}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const message of data) {
      const preview = resolveStoredChatPreview(message);
      if (!preview) continue;

      return {
        preview,
        timestamp: cleanText(message.timestamp) || cleanText(message.created_at) || null,
        direction: normalizeDirection(message.direction),
        sourceChatId: message.chat_id,
        sourceMessageId: message.id,
      };
    }

    if (data.length < MESSAGE_PAGE_SIZE) {
      break;
    }

    offset += data.length;
  }

  return {
    preview: null,
    timestamp: null,
    direction: null,
    sourceChatId: null,
    sourceMessageId: null,
  };
}

const hasChanged = (chat, nextState) => {
  const currentPreview = cleanText(chat.last_message) || null;
  const currentDirection = normalizeDirection(chat.last_message_direction);
  const currentTimestamp = cleanText(chat.last_message_at) || null;

  return (
    currentPreview !== nextState.preview ||
    currentDirection !== nextState.direction ||
    currentTimestamp !== nextState.timestamp
  );
};

async function main() {
  const modeLabel = dryRun ? 'DRY RUN' : 'EXECUCAO';
  console.log(`Iniciando reconciliacao de previews visiveis do WhatsApp (${modeLabel})...`);

  const chats = await listChats();
  console.log(`Chats carregados: ${chats.length}`);

  let scanned = 0;
  let updated = 0;
  const samples = [];

  for (const chat of chats) {
    scanned += 1;
    const nextState = await resolveVisibleActivityForChat(chat);
    if (!hasChanged(chat, nextState)) {
      if (scanned % 25 === 0) {
        console.log(`[progress] scanned=${scanned} updated=${updated}`);
      }
      continue;
    }

    updated += 1;

    if (samples.length < 20) {
      samples.push({
        chatId: chat.id,
        current: {
          preview: cleanText(chat.last_message) || null,
          direction: normalizeDirection(chat.last_message_direction),
          timestamp: cleanText(chat.last_message_at) || null,
        },
        next: nextState,
      });
    }

    if (!dryRun) {
      const { error } = await supabase
        .from('whatsapp_chats')
        .update({
          last_message: nextState.preview,
          last_message_direction: nextState.direction,
          last_message_at: nextState.timestamp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chat.id);

      if (error) {
        throw new Error(`Erro ao atualizar chat ${chat.id}: ${error.message}`);
      }
    }

    if (scanned % 25 === 0) {
      console.log(`[progress] scanned=${scanned} updated=${updated}`);
    }
  }

  console.log('Reconciliacao finalizada.');
  console.log(JSON.stringify({ scanned, updated, dryRun, targetChatId, samples }, null, 2));
}

main().catch((error) => {
  console.error('Falha na reconciliacao de previews visiveis:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
