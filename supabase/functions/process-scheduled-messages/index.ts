import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractWhapiMessageId,
  fetchWhapiWithTimeout,
  getNowIso,
  normalizeWhapiChatId,
  parseWhapiError,
  persistCommWhatsAppMessage,
  readResponsePayload,
  resolveCommWhatsAppCanonicalChatRoute,
  resolveWhapiOutboundDeliveryStatus,
  sanitizeWhapiToken,
  WHAPI_BASE_URL,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type ScheduledMessageRow = {
  message_id: string;
  channel_id: string;
  chat_id: string | null;
  phone_digits: string;
  phone_number: string | null;
  display_name: string | null;
  message_type: string;
  text_content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_file_name: string | null;
  scheduled_at: string;
  recurrence: string;
  recurrence_config: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

type ProcessRequestBody = {
  action?: 'process';
  limit?: number;
  source?: 'cron' | 'manual';
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const MAX_BATCH_SIZE = 10;

function splitMessageSegments(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  return normalized
    .split(/\n\s*---\s*\n/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase não configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

async function sendTextMessage(
  admin: ReturnType<typeof createAdminClient>,
  channelRow: { id: string; phone_number: string | null },
  msg: ScheduledMessageRow,
  token: string,
): Promise<{ externalMessageId: string; deliveryStatus: string }> {
  const chatId = normalizeWhapiChatId(msg.phone_digits);

  const body = {
    to: chatId,
    body: msg.text_content ?? '',
    clientRequestId: `scheduled:${msg.message_id}`,
  };

  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/messages/text`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[process-scheduled] Whapi text error ${response.status}: ${body}`);
    throw new Error(`Whapi text send failed: ${parseWhapiError(body)}`);
  }

  const payload = await readResponsePayload(response);
  const externalMessageId = extractWhapiMessageId(payload) ?? '';
  const deliveryStatus = resolveWhapiOutboundDeliveryStatus(payload);

  const route = await resolveCommWhatsAppCanonicalChatRoute(admin, {
    channelId: channelRow.id,
    phoneDigits: msg.phone_digits,
    externalChatId: chatId,
    leadId: null,
  });

  await persistCommWhatsAppMessage(admin, {
    channelId: channelRow.id,
    externalChatId: chatId,
    phoneNumber: msg.phone_digits,
    displayName: msg.display_name ?? msg.phone_digits,
    pushName: null,
    lastMessageText: msg.text_content ?? null,
    lastMessageDirection: 'outbound',
    lastMessageAt: getNowIso(),
    incrementUnread: false,
    externalMessageId,
    direction: 'outbound',
    messageType: 'text',
    deliveryStatus,
    textContent: msg.text_content ?? null,
    createdBy: null,
    source: 'scheduled',
    senderName: null,
    senderPhone: null,
    statusUpdatedAt: null,
    errorMessage: null,
    mediaId: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFileName: null,
    mediaSizeBytes: null,
    mediaDurationSeconds: null,
    mediaCaption: null,
    metadata: {},
  });

  return { externalMessageId, deliveryStatus };
}

async function sendMediaMessage(
  admin: ReturnType<typeof createAdminClient>,
  channelRow: { id: string; phone_number: string | null },
  msg: ScheduledMessageRow,
  token: string,
): Promise<{ externalMessageId: string; deliveryStatus: string }> {
  const chatId = normalizeWhapiChatId(msg.phone_digits);

  const mediaKind = (msg.message_type === 'voice' ? 'audio' : msg.message_type) as 'image' | 'video' | 'document' | 'audio';

  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/messages/${mediaKind}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: chatId,
      mediaUrl: msg.media_url,
      caption: msg.text_content ?? undefined,
      fileName: msg.media_file_name ?? undefined,
      mimeType: msg.media_mime_type ?? undefined,
      clientRequestId: `scheduled:${msg.message_id}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[process-scheduled] Whapi media error ${response.status}: ${body}`);
    throw new Error(`Whapi media send failed: ${parseWhapiError(body)}`);
  }

  const payload = await readResponsePayload(response);
  const externalMessageId = extractWhapiMessageId(payload) ?? '';
  const deliveryStatus = resolveWhapiOutboundDeliveryStatus(payload);

  const route = await resolveCommWhatsAppCanonicalChatRoute(admin, {
    channelId: channelRow.id,
    phoneDigits: msg.phone_digits,
    externalChatId: chatId,
    leadId: null,
  });

  await persistCommWhatsAppMessage(admin, {
    channelId: channelRow.id,
    externalChatId: chatId,
    phoneNumber: msg.phone_digits,
    displayName: msg.display_name ?? msg.phone_digits,
    pushName: null,
    lastMessageText: msg.text_content ?? null,
    lastMessageDirection: 'outbound',
    lastMessageAt: getNowIso(),
    incrementUnread: false,
    externalMessageId,
    direction: 'outbound',
    messageType: msg.message_type,
    deliveryStatus,
    textContent: msg.text_content ?? null,
    createdBy: null,
    source: 'scheduled',
    senderName: null,
    senderPhone: null,
    statusUpdatedAt: null,
    errorMessage: null,
    mediaId: null,
    mediaUrl: msg.media_url ?? null,
    mediaMimeType: msg.media_mime_type ?? null,
    mediaFileName: msg.media_file_name ?? null,
    mediaSizeBytes: null,
    mediaDurationSeconds: null,
    mediaCaption: msg.text_content ?? null,
    metadata: {},
  });

  return { externalMessageId, deliveryStatus };
}

async function processBatch(
  admin: ReturnType<typeof createAdminClient>,
  limit: number,
): Promise<{ processed: number; sent: number; failed: number; errors: string[] }> {
  const { data: messages, error: pollError } = await admin.rpc('poll_scheduled_messages', {
    p_batch_size: Math.min(limit, MAX_BATCH_SIZE),
  });

  if (pollError) {
    throw new Error(`Poll failed: ${pollError.message}`);
  }

  if (!messages || messages.length === 0) {
    return { processed: 0, sent: 0, failed: 0, errors: [] };
  }

  const channelCache = new Map<string, { id: string; phone_number: string | null }>();
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  const settings = await ensureCommWhatsAppSettings(admin);
  const rawToken = Deno.env.get('WHAPI_TOKEN') || '';
  const token = sanitizeWhapiToken(rawToken);
  if (!token) {
    throw new Error('Token do WhatsApp não configurado.');
  }

  for (const msg of messages) {
    try {
      const { error: advanceSendingErr } = await admin.rpc('advance_scheduled_message', {
        p_message_id: msg.message_id,
        p_new_status: 'sending',
      });
      if (advanceSendingErr) {
        throw new Error(`advance_scheduled_message(sending) failed: ${advanceSendingErr.message}`);
      }

      let channelRow = channelCache.get(msg.channel_id);
      if (!channelRow) {
        const { data: ch } = await admin
          .from('comm_whatsapp_channels')
          .select('id, phone_number')
          .eq('id', msg.channel_id)
          .single();

        channelRow = ch;
        if (channelRow) {
          channelCache.set(msg.channel_id, channelRow);
        }
      }

      if (!channelRow) {
        throw new Error(`Channel ${msg.channel_id} not found`);
      }

      let result: { externalMessageId: string; deliveryStatus: string };

      if (msg.message_type === 'text') {
        const segments = splitMessageSegments(msg.text_content ?? '');
        if (segments.length <= 1) {
          result = await sendTextMessage(admin, channelRow, msg, token);
        } else {
          let lastResult = { externalMessageId: '', deliveryStatus: '' };
          for (const segment of segments) {
            lastResult = await sendTextMessage(admin, channelRow, { ...msg, text_content: segment }, token);
          }
          result = lastResult;
        }
      } else {
        result = await sendMediaMessage(admin, channelRow, msg, token);
      }

      const { error: advanceSentErr } = await admin.rpc('advance_scheduled_message', {
        p_message_id: msg.message_id,
        p_new_status: 'sent',
        p_external_message_id: result.externalMessageId,
        p_delivery_status: result.deliveryStatus,
      });
      if (advanceSentErr) {
        throw new Error(`advance_scheduled_message(sent) failed: ${advanceSentErr.message}`);
      }

      sent++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push(`Message ${msg.message_id}: ${errorMessage}`);

      const nextRetryAt = msg.attempts < msg.max_attempts - 1
        ? new Date(Date.now() + Math.pow(2, msg.attempts) * 60000).toISOString()
        : null;

      const { error: advanceFailedErr } = await admin.rpc('advance_scheduled_message', {
        p_message_id: msg.message_id,
        p_new_status: 'failed',
        p_error_message: errorMessage,
        p_next_retry_at: nextRetryAt,
      });
      if (advanceFailedErr) {
        console.error(`[process-scheduled] advance_scheduled_message(failed) error: ${advanceFailedErr.message}`);
      }

      failed++;
    }
  }

  return { processed: messages.length, sent, failed, errors };
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!isServiceRoleRequest(req, serviceRoleKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const body: ProcessRequestBody = await req.json().catch(() => ({}));
    const action = body.action ?? 'process';
    const limit = body.limit ?? MAX_BATCH_SIZE;

    if (action !== 'process') {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const admin = createAdminClient();
    const result = await processBatch(admin, limit);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('process-scheduled-messages error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});