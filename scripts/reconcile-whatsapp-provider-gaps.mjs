import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const sinceArg = [...args].find((arg) => arg.startsWith('--since='));
const sampleArg = [...args].find((arg) => arg.startsWith('--sample='));
const syncCountArg = [...args].find((arg) => arg.startsWith('--sync-count='));
const limitArg = [...args].find((arg) => arg.startsWith('--limit='));

const sinceIso = sinceArg?.split('=')[1] || new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
const sampleSize = Math.max(1, Number(sampleArg?.split('=')[1] || 20));
const syncCount = Math.max(50, Number(syncCountArg?.split('=')[1] || 250));
const reconcileLimit = Math.max(1, Number(limitArg?.split('=')[1] || 300));

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
  return 'unknown';
};

const isSyncableChatId = (chatId) => {
  const type = getChatIdType(chatId);
  return type === 'group' || type === 'phone' || type === 'lid';
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const provisionalBodyMarkers = new Set(['[mensagem criptografada]', '[evento do whatsapp]', '[sistema: ciphertext]']);

const isLikelyProvisionalRow = (row) => {
  const type = cleanText(row.type).toLowerCase();
  if (type !== 'system') {
    return false;
  }

  const body = cleanText(row.body).toLowerCase();
  if (provisionalBodyMarkers.has(body) || body.includes('aguardando esta mensagem') || body.includes('waiting for this message')) {
    return true;
  }

  const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
  if (!payload) {
    return false;
  }

  const payloadSubtype = cleanText(payload.subtype).toLowerCase();
  if (payloadSubtype.includes('ciphertext')) {
    return true;
  }

  const payloadSystem = payload.system && typeof payload.system === 'object' ? payload.system : null;
  const payloadBody = payloadSystem ? cleanText(payloadSystem.body).toLowerCase() : '';
  return payloadBody.includes('aguardando esta mensagem') || payloadBody.includes('waiting for this message');
};

const toWhapiToken = (value) => cleanText(value).replace(/^Bearer\s+/i, '');

async function getWhapiToken() {
  const { data: settingsRow, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao consultar integration_settings: ${error.message}`);
  }

  const settings = settingsRow?.settings && typeof settingsRow.settings === 'object'
    ? settingsRow.settings
    : {};

  const token = toWhapiToken(settings.apiKey || settings.token || '');
  if (!token) {
    throw new Error('Token da Whapi não encontrado em integration_settings.whatsapp_auto_contact');
  }

  return token;
}

async function listStatusIdsSince() {
  const pageSize = 1000;
  let offset = 0;
  const ids = [];

  while (true) {
    const { data, error } = await supabase
      .from('whatsapp_webhook_events')
      .select('payload,created_at')
      .in('event', ['statuses.post', 'statuses.put'])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Erro ao buscar statuses em whatsapp_webhook_events: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const row of data) {
      const statuses = Array.isArray(row.payload?.statuses) ? row.payload.statuses : [];
      for (const status of statuses) {
        const messageId = cleanText(status?.id);
        if (messageId) {
          ids.push(messageId);
        }
      }
    }

    offset += data.length;
    if (data.length < pageSize) {
      break;
    }
  }

  return Array.from(new Set(ids));
}

async function listProvisionalMessageIdsSince() {
  const pageSize = 1000;
  let offset = 0;
  const provisionalRows = [];

  while (true) {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('id,type,body,payload,created_at')
      .eq('type', 'system')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Erro ao buscar mensagens provisórias: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const row of data) {
      if (isLikelyProvisionalRow(row)) {
        provisionalRows.push(row.id);
      }
    }

    offset += data.length;
    if (data.length < pageSize) {
      break;
    }
  }

  return Array.from(new Set(provisionalRows));
}

async function listExistingMessageIds(ids) {
  const existing = new Set();
  const idsChunks = chunk(ids, 400);

  for (const idsChunk of idsChunks) {
    if (idsChunk.length === 0) continue;

    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .in('id', idsChunk);

    if (error) {
      throw new Error(`Erro ao consultar mensagens existentes: ${error.message}`);
    }

    for (const row of data || []) {
      existing.add(row.id);
    }
  }

  return existing;
}

async function fetchWhapiMessageById(token, messageId) {
  const response = await fetch(`${whapiBaseUrl}/messages/${encodeURIComponent(messageId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return { ok: false, status: 404, message: null };
  }

  if (!response.ok) {
    const bodyText = await response.text();
    return { ok: false, status: response.status, message: bodyText.slice(0, 300) || null };
  }

  const message = await response.json();
  return { ok: true, status: response.status, message };
}

async function reconcileProviderGaps() {
  const startedAt = Date.now();

  const [statusIds, provisionalIds] = await Promise.all([
    listStatusIdsSince(),
    listProvisionalMessageIdsSince(),
  ]);

  const existingStatusIds = await listExistingMessageIds(statusIds);
  const missingStatusIds = statusIds.filter((id) => !existingStatusIds.has(id));

  const candidates = Array.from(new Set([...missingStatusIds, ...provisionalIds]));
  const selectedIds = candidates.slice(0, reconcileLimit);

  const token = await getWhapiToken();

  const chatIdsToSync = new Set();
  const fetchFailures = [];
  let fetchedFromWhapi = 0;
  let notFoundInWhapi = 0;

  for (const messageId of selectedIds) {
    const fetched = await fetchWhapiMessageById(token, messageId);
    if (!fetched.ok) {
      if (fetched.status === 404) {
        notFoundInWhapi += 1;
      } else {
        fetchFailures.push({ id: messageId, status: fetched.status, error: fetched.message || 'unknown' });
      }
      continue;
    }

    fetchedFromWhapi += 1;
    const message = fetched.message && typeof fetched.message === 'object' ? fetched.message : null;
    const chatId = normalizeDirectChatId(cleanText(message?.chat_id));
    if (!chatId || !isSyncableChatId(chatId)) {
      continue;
    }

    chatIdsToSync.add(chatId);
  }

  const sortedChatIds = Array.from(chatIdsToSync).sort();
  const syncResults = [];

  if (!dryRun) {
    for (const chatId of sortedChatIds) {
      const { data, error } = await supabase.functions.invoke('whatsapp-sync', {
        body: {
          chatId,
          count: syncCount,
        },
      });

      syncResults.push({
        chatId,
        ok: !error,
        count: typeof data?.count === 'number' ? data.count : null,
        error: error?.message || null,
      });
    }
  }

  const existingAfter = await listExistingMessageIds(selectedIds);
  const unresolvedAfter = selectedIds.filter((id) => !existingAfter.has(id));

  const summary = {
    dryRun,
    since: sinceIso,
    selectedLimit: reconcileLimit,
    statusIdsTotal: statusIds.length,
    statusIdsMissing: missingStatusIds.length,
    provisionalIds: provisionalIds.length,
    selectedCandidateIds: selectedIds.length,
    fetchedFromWhapi,
    notFoundInWhapi,
    fetchFailures: fetchFailures.length,
    chatIdsToSync: sortedChatIds.length,
    syncSuccess: syncResults.filter((item) => item.ok).length,
    syncFailures: syncResults.filter((item) => !item.ok).length,
    resolvedAfterRun: selectedIds.length - unresolvedAfter.length,
    unresolvedAfterRun: unresolvedAfter.length,
    elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (sortedChatIds.length > 0) {
    console.log('\nchats_to_sync_sample');
    sortedChatIds.slice(0, sampleSize).forEach((chatId) => {
      console.log(chatId);
    });
  }

  if (syncResults.length > 0) {
    console.log('\nsync_results_sample');
    syncResults.slice(0, sampleSize).forEach((item) => {
      console.log(JSON.stringify(item));
    });
  }

  if (unresolvedAfter.length > 0) {
    console.log('\nunresolved_message_ids_sample');
    unresolvedAfter.slice(0, sampleSize).forEach((messageId) => {
      console.log(messageId);
    });
  }

  if (fetchFailures.length > 0) {
    console.log('\nfetch_failures_sample');
    fetchFailures.slice(0, sampleSize).forEach((item) => {
      console.log(JSON.stringify(item));
    });
  }
}

reconcileProviderGaps().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
