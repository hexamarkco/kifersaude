// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  corsHeaders,
  fetchWhapiChatName,
  fetchWhapiContactName,
  getCommWhatsAppPhoneLookupKeys,
  getWhapiToken,
  isWhapiLidChatId,
  isValidCommWhatsAppDisplayName,
  normalizeCommWhatsAppPhone,
  resolveWhapiLidToPhone,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

type Report = {
  totalLidChats: number;
  resolved: number;
  named: number;
  updated: number;
  linked: number;
  skippedOwnNumber: number;
  notFound: number;
  failed: number;
  details: Array<{ chat: string; phone: string | null; name: string | null; lead: string | null; status: string }>;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
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

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const report: Report = {
    totalLidChats: 0,
    resolved: 0,
    named: 0,
    updated: 0,
    linked: 0,
    skippedOwnNumber: 0,
    notFound: 0,
    failed: 0,
    details: [],
  };

  const { data: channel } = await supabase
    .from('comm_whatsapp_channels')
    .select('phone_number')
    .eq('slug', 'primary')
    .maybeSingle();
  const ownNumber = channel?.phone_number ? normalizeCommWhatsAppPhone(channel.phone_number) : '';

  // All @lid chats (phone may already be resolved; names may be missing)
  const { data: chats, error: chatsError } = await supabase
    .from('comm_whatsapp_chats')
    .select('id, external_chat_id, phone_number, display_name, push_name, lead_id')
    .limit(1000);

  if (chatsError) {
    return new Response(JSON.stringify({ success: false, error: chatsError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const lidChats = (chats ?? []).filter((chat) => isWhapiLidChatId(chat.external_chat_id));
  report.totalLidChats = lidChats.length;

  // Pre-build lead lookup keys map
  const leadKeys = new Map<string, string>();
  const { data: leads } = await supabase.from('leads').select('id, telefone').limit(5000);
  for (const lead of leads ?? []) {
    const keys = getCommWhatsAppPhoneLookupKeys(lead.telefone);
    for (const key of keys) {
      if (!leadKeys.has(key)) leadKeys.set(key, lead.id);
    }
  }

  for (const chat of lidChats) {
    const entry: Report['details'][number] = {
      chat: chat.external_chat_id ?? chat.id,
      phone: null,
      name: null,
      lead: null,
      status: 'pending',
    };

    try {
      // 1. Resolve the real phone number (may be empty for private contacts)
      const phone = await resolveWhapiLidToPhone({ token, chatId: chat.external_chat_id ?? '' });
      const phoneDigits = phone ? normalizeCommWhatsAppPhone(phone) : '';

      // 2. Always try to resolve a display name (saved contact, then chat/push name)
      let name = '';
      try {
        name = await fetchWhapiContactName({ token, contactId: chat.external_chat_id ?? '' });
      } catch {
        name = '';
      }
      if (!name) {
        try {
          name = await fetchWhapiChatName({ token, chatId: chat.external_chat_id ?? '' });
        } catch {
          name = '';
        }
      }
      entry.name = name || null;

      const updates: Record<string, unknown> = {};
      let shouldSkip = false;

      if (phoneDigits) {
        if (ownNumber && phoneDigits === ownNumber) {
          report.skippedOwnNumber += 1;
          entry.status = 'own_number';
          shouldSkip = true;
        } else {
          entry.phone = phoneDigits;
          updates.phone_number = phoneDigits;
          updates.phone_digits = phoneDigits;
        }
      }

      if (isValidCommWhatsAppDisplayName(name)) {
        if (!chat.push_name) {
          updates.push_name = name;
        }
        if (!isValidCommWhatsAppDisplayName(chat.display_name)) {
          updates.display_name = name;
        }
        if (name) report.named += 1;
      } else if (!phoneDigits && !isValidCommWhatsAppDisplayName(chat.display_name)) {
        updates.display_name = 'Contato privado';
      }

      if (shouldSkip) {
        report.details.push(entry);
        continue;
      }

      const { error: updateError } = await supabase
        .from('comm_whatsapp_chats')
        .update(updates)
        .eq('id', chat.id);
      if (updateError) {
        report.failed += 1;
        entry.status = 'update_error';
        report.details.push(entry);
        continue;
      }
      report.updated += 1;
      entry.status = phoneDigits ? (name ? 'resolved_named' : 'resolved') : name ? 'named' : 'noop';

      // 3. Auto-link with a CRM lead by phone lookup keys
      if (phoneDigits && !chat.lead_id) {
        const chatKeys = getCommWhatsAppPhoneLookupKeys(phoneDigits);
        let matchedLeadId: string | null = null;
        for (const key of chatKeys) {
          const candidate = leadKeys.get(key);
          if (candidate) {
            matchedLeadId = candidate;
            break;
          }
        }
        if (matchedLeadId) {
          const { error: linkError } = await supabase
            .from('comm_whatsapp_chats')
            .update({ lead_id: matchedLeadId })
            .eq('id', chat.id);
          if (!linkError) {
            report.linked += 1;
            entry.lead = matchedLeadId;
          }
        }
      }
    } catch (error) {
      report.failed += 1;
      entry.status = 'error';
    }

    report.details.push(entry);
  }

  console.log('[resolve-lids] report', JSON.stringify(report));
  return new Response(JSON.stringify({ success: true, ...report }), {
    status: 200,
    headers: jsonHeaders,
  });
});
