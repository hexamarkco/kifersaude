// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  archiveCommWhatsAppMediaFromWhapi,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  fetchWhapiChatName,
  getNowIso,
  isDirectWhapiChatId,
  isPhoneLabelLikeDisplayName,
  isValidCommWhatsAppDisplayName,
  isWhapiLidChatId,
  isWhapiPhoneDirectChatId,
  normalizeWhapiPhoneChatId,
  resolveWhapiLidToPhone,
  resolveWhapiPhoneToLid,
  toTrimmedString,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type EnrichmentJob = {
  id: string;
  kind: 'chat_identity' | 'media_archive';
  channel_id: string;
  chat_id: string | null;
  message_id: string | null;
  payload: Record<string, unknown> | null;
  attempts: number;
  lock_token: string | null;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const MAX_JOB_ATTEMPTS = 8;
const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720, 1_440, 10_080];

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Credenciais do Supabase nao configuradas.');
  return createClient(supabaseUrl, serviceRoleKey);
};

const createLockToken = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `comm-enrichment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const getRetryAt = (attempts: number) => {
  const minutes = RETRY_BACKOFF_MINUTES[Math.min(Math.max(attempts - 1, 0), RETRY_BACKOFF_MINUTES.length - 1)] ?? 240;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
};

async function claimJobs(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  limit: number,
): Promise<EnrichmentJob[]> {
  const { data, error } = await supabaseAdmin.rpc('claim_comm_whatsapp_enrichment_jobs', {
    p_limit: limit,
    p_lock_token: createLockToken(),
  });

  if (error) throw new Error(`Erro ao reservar jobs de enriquecimento: ${error.message}`);
  return (data ?? []) as EnrichmentJob[];
}

async function completeJob(supabaseAdmin: ReturnType<typeof createAdminClient>, job: EnrichmentJob) {
  const lockToken = toTrimmedString(job.lock_token);
  if (!lockToken) throw new Error('Job de enriquecimento sem lock token.');

  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_enrichment_jobs')
    .update({
      status: 'completed',
      completed_at: getNowIso(),
      locked_at: null,
      lock_token: null,
      last_error: null,
    })
    .eq('id', job.id)
    .eq('status', 'processing')
    .eq('lock_token', lockToken)
    .select('id')
    .maybeSingle();

  if (error || !data) throw new Error(error?.message || 'O lock do job de enriquecimento foi perdido.');
}

async function failJob(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  job: EnrichmentJob,
  errorMessage: string,
) {
  const lockToken = toTrimmedString(job.lock_token);
  if (!lockToken) return;

  const retry = Math.max(Number(job.attempts) || 0, 0) < MAX_JOB_ATTEMPTS;
  const { error } = await supabaseAdmin
    .from('comm_whatsapp_enrichment_jobs')
    .update({
      status: retry ? 'retrying' : 'failed',
      next_attempt_at: retry ? getRetryAt(job.attempts) : getNowIso(),
      locked_at: null,
      lock_token: null,
      last_error: errorMessage.slice(0, 2000),
    })
    .eq('id', job.id)
    .eq('status', 'processing')
    .eq('lock_token', lockToken);

  if (error) {
    console.error('[comm-whatsapp-enrichment-worker] falha ao registrar erro do job', {
      jobId: job.id,
      error: error.message,
    });
  }
}

async function processIdentityJob(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  job: EnrichmentJob;
  token: string;
  ownChannelName: string | null;
}) {
  const chatId = toTrimmedString(params.job.chat_id);
  if (!chatId) return;

  const { data: chat, error } = await params.supabaseAdmin
    .from('comm_whatsapp_chats')
    .select('id,channel_id,external_chat_id,phone_digits,push_name')
    .eq('id', chatId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao carregar chat para enriquecimento: ${error.message}`);
  if (!chat || !isDirectWhapiChatId(chat.external_chat_id)) return;

  let lidChatId = '';
  let phoneChatId = '';

  if (isWhapiLidChatId(chat.external_chat_id)) {
    const resolvedPhone = await resolveWhapiLidToPhone({ token: params.token, chatId: chat.external_chat_id });
    if (!resolvedPhone) {
      throw new Error('LID ainda nao possui mapeamento telefonico confirmado na Whapi.');
    }
    lidChatId = chat.external_chat_id;
    phoneChatId = normalizeWhapiPhoneChatId(resolvedPhone);
  } else if (isWhapiPhoneDirectChatId(chat.external_chat_id)) {
    const resolvedLid = await resolveWhapiPhoneToLid({ token: params.token, chatId: chat.external_chat_id });
    if (resolvedLid) {
      lidChatId = resolvedLid;
      phoneChatId = normalizeWhapiPhoneChatId(chat.external_chat_id);
    }
  }

  if (lidChatId && phoneChatId) {
    const { data: reconcileData, error: reconcileError } = await params.supabaseAdmin.rpc('comm_whatsapp_reconcile_lid_identifier', {
      p_channel_id: chat.channel_id,
      p_lid_external_chat_id: lidChatId,
      p_phone_external_chat_id: phoneChatId,
    });
    if (reconcileError) {
      throw new Error(`Erro ao reconciliar identidade do chat: ${reconcileError.message}`);
    }

    const reconcileRow = Array.isArray(reconcileData) ? reconcileData[0] : reconcileData;
    if (!reconcileRow?.merged || !reconcileRow.chat_id) {
      throw new Error(`Identidade nao reconciliada: ${reconcileRow?.conflict_reason || 'sem chat canonico'}.`);
    }

    const { data: canonicalChat, error: canonicalError } = await params.supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('id,channel_id,external_chat_id,phone_digits,push_name')
      .eq('id', reconcileRow.chat_id)
      .maybeSingle();
    if (canonicalError) throw new Error(`Erro ao recarregar chat canonico: ${canonicalError.message}`);
    if (canonicalChat) chat = canonicalChat;
  }

  let displayName = await fetchWhapiChatName({ token: params.token, chatId: chat.external_chat_id });
  if (
    displayName
    && params.ownChannelName
    && displayName.toLowerCase() === params.ownChannelName.toLowerCase()
  ) {
    displayName = '';
  }
  if (displayName && isPhoneLabelLikeDisplayName(displayName)) displayName = '';

  if (!isValidCommWhatsAppDisplayName(displayName)) {
    const { error: refreshError } = await params.supabaseAdmin.rpc('comm_whatsapp_refresh_chat_identity', {
      p_chat_id: chat.id,
    });
    if (refreshError) throw new Error(`Erro ao atualizar identidade do chat: ${refreshError.message}`);
    return;
  }

  const { error: updateError } = await params.supabaseAdmin
    .from('comm_whatsapp_chats')
    .update({ push_name: displayName, updated_at: getNowIso() })
    .eq('id', chat.id);
  if (updateError) throw new Error(`Erro ao atualizar nome do chat: ${updateError.message}`);

  const { error: refreshError } = await params.supabaseAdmin.rpc('comm_whatsapp_refresh_chat_identity', {
    p_chat_id: chat.id,
  });
  if (refreshError) throw new Error(`Erro ao atualizar identidade do chat: ${refreshError.message}`);
}

async function processMediaJob(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  job: EnrichmentJob;
  token: string;
}) {
  const payload = toRecord(params.job.payload);
  const mediaId = toTrimmedString(payload.media_id);
  if (!mediaId) return;

  await archiveCommWhatsAppMediaFromWhapi(params.supabaseAdmin, {
    token: params.token,
    mediaId,
    mediaUrl: toTrimmedString(payload.media_url) || null,
    fallbackMimeType: toTrimmedString(payload.media_mime_type) || null,
    fallbackFileName: toTrimmedString(payload.media_file_name) || null,
  });
}

async function processJobs(supabaseAdmin: ReturnType<typeof createAdminClient>, limit: number) {
  const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
  if (!settings.enabled || !settings.token) return { processed: 0, completed: 0, failed: 0, skipped: true };

  const channel = await ensurePrimaryChannel(supabaseAdmin);
  const jobs = await claimJobs(supabaseAdmin, limit);
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      if (job.kind === 'chat_identity') {
        await processIdentityJob({
          supabaseAdmin,
          job,
          token: settings.token,
          ownChannelName: channel.connected_user_name,
        });
      } else {
        await processMediaJob({ supabaseAdmin, job, token: settings.token });
      }
      await completeJob(supabaseAdmin, job);
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao enriquecer dados do WhatsApp.';
      await failJob(supabaseAdmin, job, message);
      failed += 1;
      console.error('[comm-whatsapp-enrichment-worker] falha ao processar job', { jobId: job.id, kind: job.kind, error: message });
    }
  }

  return { processed: jobs.length, completed, failed, skipped: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Metodo nao permitido.' }), { status: 405, headers: jsonHeaders });

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!isServiceRoleRequest(req, serviceRoleKey)) {
      return new Response(JSON.stringify({ error: 'Nao autorizado.' }), { status: 401, headers: jsonHeaders });
    }

    const body = await req.json().catch(() => ({})) as { limit?: unknown };
    const limit = Math.min(Math.max(Math.floor(Number(body.limit) || 25), 1), 100);
    const result = await processJobs(createAdminClient(), limit);
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[comm-whatsapp-enrichment-worker] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno no worker de enriquecimento.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
