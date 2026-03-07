import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const runMessages = !args.has('--chats-only');
const runChats = !args.has('--messages-only');

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
    'Variaveis ausentes. Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_SERVICE_ROLE_KEY) para executar o backfill.',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const isPlaceholderBody = (body, type) => {
  const normalized = cleanText(body).toLowerCase();
  if (!normalized) return false;
  if (normalized === '[hsm]' || normalized === '[interactive]' || normalized === '[reply]') return true;
  return Boolean(type) && normalized === `[${type}]`;
};

const extractReplyBody = (payload) => {
  const buttonTitle = cleanText(payload?.reply?.buttons_reply?.title);
  if (buttonTitle) return `Resposta: ${buttonTitle}`;

  const listTitle = cleanText(payload?.reply?.list_reply?.title);
  const listDescription = cleanText(payload?.reply?.list_reply?.description);
  if (listTitle && listDescription) return `Resposta: ${listTitle} - ${listDescription}`;
  if (listTitle) return `Resposta: ${listTitle}`;

  return null;
};

const extractInteractiveBody = (payload) => {
  const interactive =
    payload?.interactive && typeof payload.interactive === 'object'
      ? payload.interactive
      : payload?.type === 'interactive'
        ? payload
        : null;

  if (!interactive) return null;

  const bodyText = cleanText(interactive?.body?.text ?? interactive?.body);
  if (bodyText) return bodyText;

  const headerText = cleanText(interactive?.header?.text ?? interactive?.header);
  const footerText = cleanText(interactive?.footer?.text ?? interactive?.footer);
  const buttonTitles = (Array.isArray(interactive?.action?.buttons) ? interactive.action.buttons : [])
    .map((button) => cleanText(button?.title ?? button?.text))
    .filter(Boolean);
  const listLabel = cleanText(interactive?.action?.list?.label ?? interactive?.action?.list?.button);
  const listRows = (Array.isArray(interactive?.action?.list?.sections) ? interactive.action.list.sections : [])
    .flatMap((section) => (Array.isArray(section?.rows) ? section.rows : []))
    .map((row) => cleanText(row?.title))
    .filter(Boolean);

  const summary = [headerText, footerText, listLabel, ...buttonTitles.slice(0, 2), ...listRows.slice(0, 2)].filter(Boolean);
  return summary.length > 0 ? `Interativo: ${summary.join(' - ')}` : null;
};

const extractHsmBody = (payload) => {
  const hsm =
    payload?.hsm && typeof payload.hsm === 'object'
      ? payload.hsm
      : payload?.context?.quoted_type === 'hsm' && payload?.context?.quoted_content
        ? payload.context.quoted_content
        : null;

  if (!hsm) return null;

  const bodyText = cleanText(hsm?.body ?? hsm?.description);
  if (bodyText) return bodyText;

  const headerText = cleanText(hsm?.header?.text ?? hsm?.header ?? hsm?.title);
  const footerText = cleanText(hsm?.footer);
  const buttonTexts = (Array.isArray(hsm?.buttons) ? hsm.buttons : [])
    .map((button) => cleanText(button?.text ?? button?.title))
    .filter(Boolean);

  const summary = [headerText, footerText, ...buttonTexts.slice(0, 2)].filter(Boolean);
  return summary.length > 0 ? `Template: ${summary.join(' - ')}` : null;
};

const resolveBodyFromPayload = (row) => {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};

  const replyBody = extractReplyBody(payload);
  if (replyBody) return replyBody;

  const interactiveBody = extractInteractiveBody(payload);
  if (interactiveBody) return interactiveBody;

  const hsmBody = extractHsmBody(payload);
  if (hsmBody) return hsmBody;

  const type = cleanText(row?.type).toLowerCase();
  if (type === 'interactive') return '[Mensagem interativa]';
  if (type === 'hsm') return '[Template WhatsApp]';

  return null;
};

const shouldUpdateBody = (row, nextBody) => {
  const currentBody = cleanText(row?.body);
  const type = cleanText(row?.type).toLowerCase();
  if (!nextBody) return false;
  if (currentBody === nextBody) return false;

  if (!currentBody) return true;
  if (isPlaceholderBody(currentBody, type)) return true;
  if (type === 'hsm' || type === 'interactive' || type === 'reply') return true;

  return false;
};

const extractDirectPhone = (chatId) => {
  const normalized = cleanText(chatId);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();

  if (lower.endsWith('@g.us') || lower.endsWith('@newsletter') || lower.endsWith('@broadcast') || lower === 'status@broadcast') {
    return null;
  }

  if (lower.endsWith('@lid')) {
    return null;
  }

  if (lower.endsWith('@c.us') || lower.endsWith('@s.whatsapp.net')) {
    const digits = normalized.replace(/@c\.us$|@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
    return digits || null;
  }

  if (!normalized.includes('@')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return digits;
    }
  }

  return null;
};

const extractLid = (chatId) => {
  const normalized = cleanText(chatId);
  if (!normalized) return null;
  return normalized.toLowerCase().endsWith('@lid') ? normalized : null;
};

async function backfillMessages() {
  const pageSize = Number(process.env.WHATSAPP_BACKFILL_BATCH_SIZE || 500);
  let offset = 0;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('id, type, body, original_body, payload')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Erro ao carregar mensagens no offset ${offset}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    scanned += data.length;
    const updates = [];

    data.forEach((row) => {
      const nextBody = resolveBodyFromPayload(row);
      if (!shouldUpdateBody(row, nextBody)) return;

      const type = cleanText(row.type).toLowerCase();
      const currentOriginal = cleanText(row.original_body);
      const update = { id: row.id, body: nextBody };

      if (!currentOriginal || isPlaceholderBody(currentOriginal, type)) {
        update.original_body = nextBody;
      }

      updates.push(update);
    });

    if (updates.length > 0 && !dryRun) {
      for (const update of updates) {
        const { id, ...fields } = update;
        const { error: updateError } = await supabase.from('whatsapp_messages').update(fields).eq('id', id);
        if (updateError) {
          throw new Error(`Erro ao atualizar mensagem ${id} no offset ${offset}: ${updateError.message}`);
        }
      }
    }

    updated += updates.length;
    console.log(
      `[messages] offset=${offset} page=${data.length} scanned=${scanned} updated_lote=${updates.length} updated_total=${updated}`,
    );

    offset += data.length;
    if (data.length < pageSize) {
      break;
    }
  }

  return { scanned, updated };
}

async function backfillChats() {
  const pageSize = Number(process.env.WHATSAPP_BACKFILL_BATCH_SIZE || 500);
  let offset = 0;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('id, phone_number, lid')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Erro ao carregar chats no offset ${offset}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    scanned += data.length;
    const updates = [];

    data.forEach((row) => {
      const nextPhone = extractDirectPhone(row.id);
      const nextLid = extractLid(row.id);
      const currentPhone = cleanText(row.phone_number);
      const currentLid = cleanText(row.lid);

      const update = { id: row.id };

      if (nextPhone && nextPhone !== currentPhone) {
        update.phone_number = nextPhone;
      }

      if (nextLid && nextLid !== currentLid) {
        update.lid = nextLid;
      }

      if ('phone_number' in update || 'lid' in update) {
        updates.push(update);
      }
    });

    if (updates.length > 0 && !dryRun) {
      for (const update of updates) {
        const { id, ...fields } = update;
        const { error: updateError } = await supabase.from('whatsapp_chats').update(fields).eq('id', id);
        if (updateError) {
          throw new Error(`Erro ao atualizar chat ${id} no offset ${offset}: ${updateError.message}`);
        }
      }
    }

    updated += updates.length;
    console.log(`[chats] offset=${offset} page=${data.length} scanned=${scanned} updated_lote=${updates.length} updated_total=${updated}`);

    offset += data.length;
    if (data.length < pageSize) {
      break;
    }
  }

  return { scanned, updated };
}

async function main() {
  const modeLabel = dryRun ? 'DRY RUN' : 'EXECUCAO';
  console.log(`Iniciando backfill global WhatsApp (${modeLabel})...`);

  const startedAt = Date.now();
  const summary = {
    messages: null,
    chats: null,
  };

  if (runMessages) {
    summary.messages = await backfillMessages();
  }

  if (runChats) {
    summary.chats = await backfillChats();
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('Backfill finalizado.');
  console.log(JSON.stringify({ ...summary, elapsedSeconds, dryRun }, null, 2));
}

main().catch((error) => {
  console.error('Falha no backfill global WhatsApp:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
