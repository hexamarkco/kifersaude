import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
type TargetStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'invalid' | 'cancelled';

type CampaignRecord = {
  id: string;
  status: CampaignStatus;
  message: string;
};

type TargetRecord = {
  id: string;
  campaign_id: string;
  phone: string;
  chat_id: string | null;
  attempts: number | null;
  campaign: CampaignRecord | null;
};

type ProcessSummary = {
  processed: number;
  sent: number;
  failed: number;
  invalid: number;
  skipped: number;
  campaignsTouched: number;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const getBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const getUserManagementId = (user: Record<string, unknown> | null | undefined): string | null => {
  if (!user) return null;

  const userMetadata =
    user.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : null;
  const appMetadata =
    user.app_metadata && typeof user.app_metadata === 'object'
      ? (user.app_metadata as Record<string, unknown>)
      : null;

  const candidates: unknown[] = [
    userMetadata?.user_management_id,
    userMetadata?.user_management_user_id,
    userMetadata?.user_id,
    appMetadata?.user_management_id,
    appMetadata?.user_id,
    user.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

const sanitizeWhapiToken = (rawToken: string): string => rawToken.replace(/^Bearer\s+/i, '').trim();

const normalizeChatId = (value: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/\@c\.us$/i.test(trimmed)) {
    return trimmed.replace(/@c\.us$/i, '@s.whatsapp.net');
  }

  return trimmed;
};

const normalizePhoneForWhapi = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }

  return digits;
};

const parseWhapiError = (payload: unknown): string => {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (typeof record.error === 'string') {
      return record.error;
    }

    if (record.error && typeof record.error === 'object') {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        return nested.message;
      }
    }

    if (typeof record.message === 'string') {
      return record.message;
    }

    if (typeof record.details === 'string') {
      return record.details;
    }
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return 'Erro ao processar resposta da Whapi.';
  }
};

const isInvalidRecipientError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('nao possui whatsapp') ||
    normalized.includes('não possui whatsapp') ||
    normalized.includes('recipient not found') ||
    normalized.includes('recipient does not exist') ||
    normalized.includes('invalid') ||
    normalized.includes('invalido') ||
    normalized.includes('inválido') ||
    normalized.includes('does not exist') ||
    normalized.includes('not on whatsapp') ||
    normalized.includes('chat not found') ||
    normalized.includes('invalid chatid')
  );
};

const isServiceRoleRequest = (req: Request, serviceRoleKey: string): boolean => {
  const expected = serviceRoleKey.trim();
  if (!expected) {
    return false;
  }

  const bearerToken = getBearerToken(req.headers.get('Authorization'));
  if (bearerToken && bearerToken.trim() === expected) {
    return true;
  }

  const apikey = req.headers.get('apikey')?.trim() || req.headers.get('x-api-key')?.trim() || '';
  return apikey === expected;
};

const authorizeAdminUser = async ({
  req,
  supabaseUrl,
  supabaseAnonKey,
  supabaseAdmin,
}: {
  req: Request;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseAdmin: ReturnType<typeof createClient>;
}): Promise<{ authorized: true } | { authorized: false; response: Response }> => {
  const bearerToken = getBearerToken(req.headers.get('Authorization'));

  if (!bearerToken) {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Nao autenticado' }, 401),
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Token de autenticacao invalido' }, 401),
    };
  }

  const profileId = getUserManagementId(user as unknown as Record<string, unknown>);
  if (!profileId) {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Perfil do usuario nao encontrado' }, 403),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError) {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Erro ao validar permissao de usuario' }, 500),
    };
  }

  if (!profile || profile.role !== 'admin') {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Permissao insuficiente' }, 403),
    };
  }

  return { authorized: true };
};

const loadWhapiToken = async (supabaseAdmin: ReturnType<typeof createClient>): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar configuracao do WhatsApp: ${error.message}`);
  }

  const settings = data?.settings && typeof data.settings === 'object' ? (data.settings as Record<string, unknown>) : {};
  const tokenValue =
    typeof settings.apiKey === 'string'
      ? settings.apiKey
      : typeof settings.token === 'string'
        ? settings.token
        : '';
  const token = sanitizeWhapiToken(tokenValue);

  if (!token) {
    throw new Error('Token da Whapi Cloud nao configurado.');
  }

  return token;
};

const resolveWhapiRecipient = async ({
  token,
  chatId,
  phone,
}: {
  token: string;
  chatId: string | null;
  phone: string;
}): Promise<string> => {
  const normalizedChatId = chatId ? normalizeChatId(chatId) : '';
  if (normalizedChatId && normalizedChatId.includes('@')) {
    return normalizedChatId;
  }

  const normalizedPhone = normalizePhoneForWhapi(phone);
  if (!normalizedPhone) {
    throw new Error('Numero de telefone ausente ou invalido.');
  }

  const response = await fetch(`${WHAPI_BASE_URL}/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      contacts: [normalizedPhone],
      force_check: false,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(parseWhapiError(payload));
  }

  const payload = (await response.json().catch(() => ({}))) as {
    contacts?: Array<{ status?: string; wa_id?: string }>;
  };

  const contact = payload.contacts?.[0];
  if (!contact || contact.status !== 'valid' || !contact.wa_id) {
    throw new Error('Numero nao possui WhatsApp ou esta invalido.');
  }

  return normalizeChatId(contact.wa_id);
};

const sendTextMessage = async ({ token, to, body }: { token: string; to: string; body: string }): Promise<void> => {
  const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({ to, body }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(parseWhapiError(payload));
  }
};

const claimTarget = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  target: TargetRecord,
): Promise<boolean> => {
  const nowIso = new Date().toISOString();
  const currentAttempts = Number.isFinite(target.attempts) ? Number(target.attempts) : 0;

  const { data, error } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .update({
      status: 'processing',
      attempts: currentAttempts + 1,
      last_attempt_at: nowIso,
    })
    .eq('id', target.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao bloquear alvo para processamento: ${error.message}`);
  }

  return Boolean(data?.id);
};

const updateTargetResult = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  targetId: string,
  status: TargetStatus,
  errorMessage: string | null,
  markAsSent = false,
) => {
  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .update({
      status,
      error_message: errorMessage,
      last_attempt_at: nowIso,
      sent_at: markAsSent ? nowIso : null,
    })
    .eq('id', targetId);

  if (error) {
    throw new Error(`Erro ao atualizar status do alvo: ${error.message}`);
  }
};

const recomputeCampaignCounters = async (supabaseAdmin: ReturnType<typeof createClient>, campaignId: string): Promise<void> => {
  const { data: targetRows, error: targetError } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .select('status')
    .eq('campaign_id', campaignId);

  if (targetError) {
    throw new Error(`Erro ao recalcular contadores da campanha: ${targetError.message}`);
  }

  const rows = (targetRows ?? []) as Array<{ status: TargetStatus }>;
  const totalTargets = rows.length;
  const pendingTargets = rows.filter((row) => row.status === 'pending' || row.status === 'processing').length;
  const sentTargets = rows.filter((row) => row.status === 'sent').length;
  const failedTargets = rows.filter((row) => row.status === 'failed').length;
  const invalidTargets = rows.filter((row) => row.status === 'invalid').length;

  const { data: campaignData, error: campaignError } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('status')
    .eq('id', campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(`Erro ao consultar campanha para atualizar contadores: ${campaignError.message}`);
  }

  const updates: Record<string, unknown> = {
    total_targets: totalTargets,
    pending_targets: pendingTargets,
    sent_targets: sentTargets,
    failed_targets: failedTargets,
    invalid_targets: invalidTargets,
  };

  const campaignStatus = campaignData?.status as CampaignStatus | undefined;
  if (pendingTargets === 0 && campaignStatus === 'running') {
    updates.status = 'completed';
    updates.completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .update(updates)
    .eq('id', campaignId);

  if (updateError) {
    throw new Error(`Erro ao atualizar campanha com novos contadores: ${updateError.message}`);
  }
};

const loadPendingTargets = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  campaignId: string | null,
  limit: number,
): Promise<TargetRecord[]> => {
  let query = supabaseAdmin
    .from('whatsapp_campaign_targets')
    .select('id, campaign_id, phone, chat_id, attempts, campaign:whatsapp_campaigns!inner(id, status, message)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao carregar alvos pendentes da campanha: ${error.message}`);
  }

  const rows = (data ?? []) as TargetRecord[];
  return rows.filter((row) => row.campaign?.status === 'running');
};

const processCampaignTargets = async ({
  supabaseAdmin,
  token,
  campaignId,
  limit,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  token: string;
  campaignId: string | null;
  limit: number;
}): Promise<ProcessSummary> => {
  const summary: ProcessSummary = {
    processed: 0,
    sent: 0,
    failed: 0,
    invalid: 0,
    skipped: 0,
    campaignsTouched: 0,
  };

  const targets = await loadPendingTargets(supabaseAdmin, campaignId, limit);
  if (targets.length === 0) {
    return summary;
  }

  const touchedCampaignIds = new Set<string>();

  for (const target of targets) {
    touchedCampaignIds.add(target.campaign_id);

    const claimed = await claimTarget(supabaseAdmin, target);
    if (!claimed) {
      summary.skipped += 1;
      continue;
    }

    const campaignMessage = target.campaign?.message?.trim() || '';
    if (!campaignMessage) {
      await updateTargetResult(supabaseAdmin, target.id, 'failed', 'Mensagem da campanha vazia.', false);
      summary.failed += 1;
      summary.processed += 1;
      continue;
    }

    try {
      const recipient = await resolveWhapiRecipient({
        token,
        chatId: target.chat_id,
        phone: target.phone,
      });

      await sendTextMessage({ token, to: recipient, body: campaignMessage });

      await updateTargetResult(supabaseAdmin, target.id, 'sent', null, true);
      summary.sent += 1;
      summary.processed += 1;
    } catch (error) {
      const message = toErrorMessage(error);
      const isInvalid = isInvalidRecipientError(message);

      await updateTargetResult(
        supabaseAdmin,
        target.id,
        isInvalid ? 'invalid' : 'failed',
        message,
        false,
      );

      if (isInvalid) {
        summary.invalid += 1;
      } else {
        summary.failed += 1;
      }
      summary.processed += 1;
    }
  }

  for (const touchedCampaignId of touchedCampaignIds) {
    await recomputeCampaignCounters(supabaseAdmin, touchedCampaignId);
  }

  summary.campaignsTouched = touchedCampaignIds.size;
  return summary;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Metodo nao permitido' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ success: false, error: 'Variaveis de ambiente ausentes no servidor' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const serviceRoleCall = isServiceRoleRequest(req, supabaseServiceRoleKey);
  if (!serviceRoleCall) {
    const authResult = await authorizeAdminUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
    });

    if (!authResult.authorized) {
      return authResult.response;
    }
  }

  try {
    const bodyText = await req.text();
    const payload = (bodyText ? JSON.parse(bodyText) : {}) as Record<string, unknown>;

    const action =
      (typeof payload.action === 'string' ? payload.action : null) ||
      new URL(req.url).searchParams.get('action') ||
      'process';

    if (action !== 'process') {
      return jsonResponse({ success: false, error: 'Acao nao suportada' }, 400);
    }

    const rawLimit = typeof payload.limit === 'number' ? payload.limit : Number(payload.limit);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 40;
    const campaignId = typeof payload.campaignId === 'string' && payload.campaignId.trim() ? payload.campaignId.trim() : null;

    const token = await loadWhapiToken(supabaseAdmin);
    const summary = await processCampaignTargets({
      supabaseAdmin,
      token,
      campaignId,
      limit,
    });

    return jsonResponse({
      success: true,
      processed: summary.processed,
      sent: summary.sent,
      failed: summary.failed,
      invalid: summary.invalid,
      skipped: summary.skipped,
      campaignsTouched: summary.campaignsTouched,
    });
  } catch (error) {
    const message = toErrorMessage(error);
    console.error('[whatsapp-broadcast] erro:', error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
