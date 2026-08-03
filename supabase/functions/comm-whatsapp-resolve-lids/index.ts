// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  corsHeaders,
  fetchWhapiChatName,
  getWhapiToken,
  isWhapiLidChatId,
  isValidCommWhatsAppDisplayName,
  normalizeCommWhatsAppPhone,
  normalizePhoneDigits,
  resolveWhapiLidToPhone,
  resolveWhapiPhoneToLid,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

type ResolveRequest = {
  apply?: boolean;
  cursor?: string;
  limit?: number;
};

type ResolveDetail = {
  chatId: string;
  externalChatId: string;
  phone: string | null;
  reverseVerified: boolean;
  action: 'reconcile' | 'clear_invalid_phone' | 'unresolved' | 'skip_own_number' | 'conflict' | 'error';
  canonicalChatId: string | null;
  error: string | null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error || 'Erro desconhecido.');
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = getWhapiToken();

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ success: false, error: 'Supabase env missing' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  if (!isServiceRoleRequest(req, serviceRoleKey)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  if (!token) {
    return new Response(JSON.stringify({ success: false, error: 'WHAPI_TOKEN not configured' }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const body = (await req.json().catch(() => ({}))) as ResolveRequest;
  const apply = body.apply === true;
  const limit = Math.min(Math.max(Math.floor(Number(body.limit) || 50), 1), 200);
  const cursor = String(body.cursor || '').trim();
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: channel, error: channelError } = await supabase
    .from('comm_whatsapp_channels')
    .select('id, phone_number')
    .eq('slug', 'primary')
    .maybeSingle();

  if (channelError || !channel?.id) {
    return new Response(JSON.stringify({ success: false, error: channelError?.message || 'Primary channel missing' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  let chatsQuery = supabase
    .from('comm_whatsapp_chats')
    .select('id,channel_id,external_chat_id,phone_digits,push_name,display_name,lead_id,deleted_at')
    .eq('channel_id', channel.id)
    .ilike('external_chat_id', '%@lid')
    .order('id', { ascending: true })
    .limit(limit);

  if (cursor) {
    chatsQuery = chatsQuery.gt('id', cursor);
  }

  const { data: chats, error: chatsError } = await chatsQuery;
  if (chatsError) {
    return new Response(JSON.stringify({ success: false, error: chatsError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const ownNumber = normalizeCommWhatsAppPhone(channel.phone_number);
  const details: ResolveDetail[] = [];
  let resolved = 0;
  let reconciled = 0;
  let invalidPhones = 0;
  let unresolved = 0;
  let conflicts = 0;
  let errors = 0;

  for (const chat of chats ?? []) {
    const externalChatId = String(chat.external_chat_id || '').trim();
    const lidDigits = normalizePhoneDigits(externalChatId.replace(/@lid$/i, ''));
    const storedPhone = normalizePhoneDigits(chat.phone_digits);
    const detail: ResolveDetail = {
      chatId: chat.id,
      externalChatId,
      phone: null,
      reverseVerified: false,
      action: 'unresolved',
      canonicalChatId: null,
      error: null,
    };

    try {
      if (!isWhapiLidChatId(externalChatId)) {
        continue;
      }

      const phone = await resolveWhapiLidToPhone({ token, chatId: externalChatId });
      if (!phone) {
        if (storedPhone && storedPhone === lidDigits) {
          invalidPhones += 1;
          detail.action = 'clear_invalid_phone';

          if (apply) {
            const fallbackName = isValidCommWhatsAppDisplayName(chat.push_name)
              ? String(chat.push_name).trim()
              : 'Contato privado';
            const { error: clearError } = await supabase
              .from('comm_whatsapp_chats')
              .update({ phone_number: '', phone_digits: '', display_name: fallbackName })
              .eq('id', chat.id);
            if (clearError) throw clearError;

            const { error: refreshError } = await supabase.rpc('comm_whatsapp_refresh_chat_identity', {
              p_chat_id: chat.id,
            });
            if (refreshError) throw refreshError;
          }
        } else {
          unresolved += 1;
        }

        details.push(detail);
        continue;
      }

      const phoneDigits = normalizeCommWhatsAppPhone(phone);
      detail.phone = phoneDigits;
      resolved += 1;

      if (ownNumber && phoneDigits === ownNumber) {
        detail.action = 'skip_own_number';
        details.push(detail);
        continue;
      }

      const phoneChatId = `${phoneDigits}@s.whatsapp.net`;
      const reverseLid = await resolveWhapiPhoneToLid({ token, chatId: phoneChatId }).catch(() => '');
      if (reverseLid && reverseLid !== externalChatId) {
        conflicts += 1;
        detail.action = 'conflict';
        detail.error = `Reverse mapping returned ${reverseLid}`;
        details.push(detail);
        continue;
      }
      detail.reverseVerified = reverseLid === externalChatId;
      detail.action = 'reconcile';

      if (apply) {
        const { data: reconcileData, error: reconcileError } = await supabase.rpc(
          'comm_whatsapp_reconcile_lid_identifier',
          {
            p_channel_id: chat.channel_id,
            p_lid_external_chat_id: externalChatId,
            p_phone_external_chat_id: phoneChatId,
          },
        );
        if (reconcileError) throw reconcileError;

        const reconcileRow = Array.isArray(reconcileData) ? reconcileData[0] : reconcileData;
        if (!reconcileRow?.merged || !reconcileRow.chat_id) {
          conflicts += 1;
          detail.action = 'conflict';
          detail.error = String(reconcileRow?.conflict_reason || 'Reconciliation did not return a canonical chat.');
          details.push(detail);
          continue;
        }

        detail.canonicalChatId = reconcileRow.chat_id;
        reconciled += 1;

        const pushName = await fetchWhapiChatName({ token, chatId: externalChatId }).catch(() => '');
        if (isValidCommWhatsAppDisplayName(pushName)) {
          const { error: nameError } = await supabase
            .from('comm_whatsapp_chats')
            .update({ push_name: pushName })
            .eq('id', reconcileRow.chat_id);
          if (nameError) throw nameError;
        }

        const { error: refreshError } = await supabase.rpc('comm_whatsapp_refresh_chat_identity', {
          p_chat_id: reconcileRow.chat_id,
        });
        if (refreshError) throw refreshError;
      }
    } catch (error) {
      errors += 1;
      detail.action = 'error';
      detail.error = getErrorMessage(error).slice(0, 500);
    }

    details.push(detail);
  }

  const lastChat = (chats ?? []).at(-1);
  return new Response(JSON.stringify({
    success: true,
    dryRun: !apply,
    processed: (chats ?? []).length,
    resolved,
    reconciled,
    invalidPhones,
    unresolved,
    conflicts,
    errors,
    nextCursor: (chats ?? []).length === limit ? lastChat?.id ?? null : null,
    details,
  }), {
    status: 200,
    headers: jsonHeaders,
  });
});
