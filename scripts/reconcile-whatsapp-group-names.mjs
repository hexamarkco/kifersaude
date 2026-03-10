import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const limitArg = [...args].find((arg) => arg.startsWith('--limit='));
const chatIdArg = [...args].find((arg) => arg.startsWith('--chat-id='));

const reconcileLimit = Math.max(1, Number(limitArg?.split('=')[1] || 200));
const targetChatId = chatIdArg?.split('=')[1]?.trim() || null;
const whapiBaseUrl = (process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud').replace(/\/+$/, '');

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

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Variaveis ausentes. Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_SERVICE_ROLE_KEY).',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const getValidGroupName = (value, chatId) => {
  const trimmed = cleanText(value);
  if (!trimmed || trimmed === chatId) {
    return null;
  }
  return trimmed;
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

  const settings = settingsRow?.settings && typeof settingsRow.settings === 'object'
    ? settingsRow.settings
    : {};

  const token = cleanText(settings.apiKey || settings.token || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Token da Whapi nao encontrado em integration_settings.whatsapp_auto_contact');
  }

  return token;
}

async function fetchChatNameFromWhapi(token, chatId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), 10_000);

  try {
    const response = await fetch(`${whapiBaseUrl}/chats/${encodeURIComponent(chatId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => ({}));
    return getValidGroupName(payload?.name, chatId);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFallbackGroupNameFromMessages(chatId) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('payload')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Erro ao buscar fallback do chat ${chatId}: ${error.message}`);
  }

  for (const row of data || []) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
    const candidate = getValidGroupName(payload?.chat_name, chatId);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function upsertCanonicalGroupName(chatId, groupName) {
  const nowIso = new Date().toISOString();

  const { error: insertError } = await supabase
    .from('whatsapp_groups')
    .upsert(
      {
        id: chatId,
        name: groupName,
        type: 'group',
        created_at: nowIso,
        created_by: 'system',
        name_at: nowIso,
        admin_add_member_mode: true,
        first_seen_at: nowIso,
        last_updated_at: nowIso,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );

  if (insertError) {
    throw new Error(`Erro ao inserir grupo ${chatId}: ${insertError.message}`);
  }

  const { error: groupUpdateError } = await supabase
    .from('whatsapp_groups')
    .update({
      name: groupName,
      type: 'group',
      name_at: nowIso,
      last_updated_at: nowIso,
    })
    .eq('id', chatId);

  if (groupUpdateError) {
    throw new Error(`Erro ao atualizar grupo ${chatId}: ${groupUpdateError.message}`);
  }

  const { error: chatUpdateError } = await supabase
    .from('whatsapp_chats')
    .update({
      name: groupName,
      is_group: true,
      updated_at: nowIso,
    })
    .eq('id', chatId);

  if (chatUpdateError) {
    throw new Error(`Erro ao atualizar chat ${chatId}: ${chatUpdateError.message}`);
  }
}

async function reconcileGroupNames() {
  const token = await getWhapiToken();

  let query = supabase
    .from('whatsapp_chats')
    .select('id,name,is_group,updated_at')
    .eq('is_group', true)
    .order('updated_at', { ascending: false })
    .limit(reconcileLimit);

  if (targetChatId) {
    query = query.eq('id', targetChatId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao buscar grupos em whatsapp_chats: ${error.message}`);
  }

  const chats = data || [];
  const changed = [];
  const unchanged = [];
  const failed = [];

  for (const chat of chats) {
    const whapiName = await fetchChatNameFromWhapi(token, chat.id);
    const fallbackName = whapiName || await fetchFallbackGroupNameFromMessages(chat.id);

    if (!fallbackName) {
      failed.push({
        id: chat.id,
        storedName: chat.name || null,
        reason: 'name_not_resolved',
      });
      continue;
    }

    if ((chat.name || '').trim() === fallbackName) {
      unchanged.push({
        id: chat.id,
        storedName: chat.name || null,
        resolvedName: fallbackName,
      });
      continue;
    }

    changed.push({
      id: chat.id,
      storedName: chat.name || null,
      resolvedName: fallbackName,
    });

    if (!dryRun) {
      await upsertCanonicalGroupName(chat.id, fallbackName);
    }
  }

  return {
    dryRun,
    processed: chats.length,
    changed,
    unchangedCount: unchanged.length,
    failed,
  };
}

reconcileGroupNames()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
