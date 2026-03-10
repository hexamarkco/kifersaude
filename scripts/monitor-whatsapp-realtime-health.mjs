import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const sinceArg = [...args].find((arg) => arg.startsWith('--since='));
const sampleLimitArg = [...args].find((arg) => arg.startsWith('--sample='));

const sampleLimit = Number(sampleLimitArg?.split('=')[1] || 20);
const sinceIso = sinceArg?.split('=')[1] || new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

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
  return trimmed;
};

const isDirectChat = (chatId) => {
  const chatType = getChatIdType(chatId);
  return chatType === 'phone' || chatType === 'lid';
};

const toMillis = (value) => {
  const parsed = new Date(value || '').getTime();
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
};

const buildStats = (values) => {
  if (values.length === 0) return null;
  return {
    count: values.length,
    min: Number(Math.min(...values).toFixed(1)),
    p50: Number(percentile(values, 50).toFixed(1)),
    p90: Number(percentile(values, 90).toFixed(1)),
    p95: Number(percentile(values, 95).toFixed(1)),
    p99: Number(percentile(values, 99).toFixed(1)),
    max: Number(Math.max(...values).toFixed(1)),
  };
};

const chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

async function run() {
  const [{ data: messageRows, error: messageError }, { data: statusEvents, error: statusEventsError }] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .select('id, chat_id, direction, type, body, timestamp, created_at, payload')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(8000),
    supabase
      .from('whatsapp_webhook_events')
      .select('event, created_at, payload')
      .in('event', ['statuses.post', 'statuses.put'])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(2500),
  ]);

  if (messageError) {
    throw new Error(`Erro ao consultar whatsapp_messages: ${messageError.message}`);
  }

  if (statusEventsError) {
    throw new Error(`Erro ao consultar whatsapp_webhook_events: ${statusEventsError.message}`);
  }

  const messages = messageRows || [];
  const sinceMillis = toMillis(sinceIso);
  const directInboundLatency = [];
  const highLatencySamples = [];
  const skippedBackfillSamples = [];
  const negativeDelaySamples = [];
  const suspiciousSelfChats = [];
  const provisionalSamples = [];

  for (const row of messages) {
    const chatId = cleanText(row.chat_id);
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const payloadSource = cleanText(payload.source).toLowerCase();

    const type = cleanText(row.type).toLowerCase();
    const body = cleanText(row.body).toLowerCase();
    const subtype = cleanText(payload.subtype).toLowerCase();
    const payloadSystemBody = cleanText(payload?.system?.body).toLowerCase();
    const isProvisional =
      type === 'system' &&
      (
        subtype.includes('ciphertext') ||
        body === '[mensagem criptografada]' ||
        body.includes('aguardando esta mensagem') ||
        payloadSystemBody.includes('aguardando esta mensagem') ||
        payloadSystemBody.includes('waiting for this message')
      );

    if (isProvisional && provisionalSamples.length < sampleLimit) {
      provisionalSamples.push({
        id: row.id,
        chat_id: row.chat_id,
        type: row.type,
        body: row.body,
        timestamp: row.timestamp,
        created_at: row.created_at,
      });
    }

    if (row.direction === 'inbound' && isDirectChat(chatId)) {
      const timestampMs = toMillis(row.timestamp);
      const createdAtMs = toMillis(row.created_at);
      if (!Number.isNaN(timestampMs) && !Number.isNaN(createdAtMs)) {
        if (!Number.isNaN(sinceMillis) && timestampMs < sinceMillis - 10 * 60 * 1000) {
          if (skippedBackfillSamples.length < sampleLimit) {
            skippedBackfillSamples.push({
              id: row.id,
              chat_id: row.chat_id,
              timestamp: row.timestamp,
              created_at: row.created_at,
              reason: 'timestamp_older_than_window',
            });
          }
          continue;
        }

        const rawDelaySec = (createdAtMs - timestampMs) / 1000;
        if (rawDelaySec < -5) {
          if (negativeDelaySamples.length < sampleLimit) {
            negativeDelaySamples.push({
              id: row.id,
              chat_id: row.chat_id,
              delay_sec: Number(rawDelaySec.toFixed(1)),
              timestamp: row.timestamp,
              created_at: row.created_at,
              source: payloadSource || null,
            });
          }
          continue;
        }

        const delaySec = Math.max(0, rawDelaySec);
        if (delaySec > 12 * 60 * 60) {
          if (skippedBackfillSamples.length < sampleLimit) {
            skippedBackfillSamples.push({
              id: row.id,
              chat_id: row.chat_id,
              delay_sec: Number(delaySec.toFixed(1)),
              timestamp: row.timestamp,
              created_at: row.created_at,
              reason: 'delay_outlier_backfill',
            });
          }
          continue;
        }

        directInboundLatency.push(delaySec);
        if (delaySec > 30 && highLatencySamples.length < sampleLimit) {
          highLatencySamples.push({
            id: row.id,
            chat_id: row.chat_id,
            delay_sec: Number(delaySec.toFixed(1)),
            timestamp: row.timestamp,
            created_at: row.created_at,
            source: payloadSource || null,
          });
        }
      }
    }

    if (row.direction === 'outbound' && ['web', 'mobile'].includes(payloadSource)) {
      const normalizedFrom = normalizeDirectChatId(cleanText(payload.from));
      const normalizedPayloadChat = normalizeDirectChatId(cleanText(payload.chat_id));
      const normalizedStoredChat = normalizeDirectChatId(chatId);
      const chatType = getChatIdType(normalizedStoredChat);

      if ((chatType === 'phone' || chatType === 'lid') && normalizedFrom) {
        const looksSelfChat =
          normalizedFrom === normalizedStoredChat ||
          (normalizedPayloadChat && normalizedFrom === normalizedPayloadChat);

        if (looksSelfChat && suspiciousSelfChats.length < sampleLimit) {
          suspiciousSelfChats.push({
            id: row.id,
            chat_id: row.chat_id,
            timestamp: row.timestamp,
            created_at: row.created_at,
            payload_chat_id: cleanText(payload.chat_id) || null,
            payload_from: cleanText(payload.from) || null,
            source: payloadSource,
          });
        }
      }
    }
  }

  const statusRows = statusEvents || [];
  const statusIds = [];
  for (const event of statusRows) {
    const statuses = Array.isArray(event.payload?.statuses) ? event.payload.statuses : [];
    for (const status of statuses) {
      const messageId = cleanText(status?.id);
      if (messageId) {
        statusIds.push(messageId);
      }
    }
  }

  const uniqueStatusIds = Array.from(new Set(statusIds));
  const existingStatusMessageIds = new Set();
  for (const idsChunk of chunk(uniqueStatusIds, 400)) {
    if (idsChunk.length === 0) continue;
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .in('id', idsChunk);

    if (error) {
      throw new Error(`Erro ao validar IDs de status: ${error.message}`);
    }

    for (const row of data || []) {
      existingStatusMessageIds.add(row.id);
    }
  }

  const missingStatusIds = uniqueStatusIds.filter((id) => !existingStatusMessageIds.has(id));

  const summary = {
    since: sinceIso,
    messages_scanned: messages.length,
    statuses_scanned: statusIds.length,
    unique_status_message_ids: uniqueStatusIds.length,
    status_ids_missing_message: missingStatusIds.length,
    direct_inbound_delay_seconds: buildStats(directInboundLatency),
    direct_inbound_delay_negative_count: negativeDelaySamples.length,
    direct_inbound_delay_skipped_backfill_count: skippedBackfillSamples.length,
    provisional_messages_count: provisionalSamples.length,
    suspicious_outbound_self_chat_count: suspiciousSelfChats.length,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (missingStatusIds.length > 0) {
    console.log('\nstatus_ids_missing_message_sample');
    missingStatusIds.slice(0, sampleLimit).forEach((id) => {
      console.log(id);
    });
  }

  if (highLatencySamples.length > 0) {
    console.log('\nhigh_latency_inbound_sample');
    highLatencySamples.forEach((row) => {
      console.log(JSON.stringify(row));
    });
  }

  if (negativeDelaySamples.length > 0) {
    console.log('\nnegative_delay_sample');
    negativeDelaySamples.forEach((row) => {
      console.log(JSON.stringify(row));
    });
  }

  if (skippedBackfillSamples.length > 0) {
    console.log('\nskipped_backfill_sample');
    skippedBackfillSamples.forEach((row) => {
      console.log(JSON.stringify(row));
    });
  }

  if (suspiciousSelfChats.length > 0) {
    console.log('\nsuspicious_outbound_self_chat_sample');
    suspiciousSelfChats.forEach((row) => {
      console.log(JSON.stringify(row));
    });
  }

  if (provisionalSamples.length > 0) {
    console.log('\nprovisional_messages_sample');
    provisionalSamples.forEach((row) => {
      console.log(JSON.stringify(row));
    });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
