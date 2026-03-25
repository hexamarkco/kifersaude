import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  normalizeCampaignSourcePayload,
  normalizeCsvHeader,
  normalizePhoneForCampaign,
  parseCampaignCsvText,
} from '../../../src/lib/whatsappCampaignUtils.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const WHATSAPP_CAMPAIGN_IMPORT_LEASE_MS = 10 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_JOB_LIMIT = 1;
const MAX_JOB_LIMIT = 3;

type ImportJobStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'cancelled';
type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
type CampaignImportStatus = 'ready' | 'queued' | 'processing' | 'failed' | 'cancelled';

type ImportJobRecord = {
  id: string;
  campaign_id: string;
  status: ImportJobStatus;
  storage_bucket: string;
  storage_path: string;
  file_name: string | null;
  delimiter: string;
  mapping: Record<string, unknown> | null;
  crm_defaults: Record<string, unknown> | null;
  total_rows: number | null;
  processed_rows: number | null;
  failed_rows: number | null;
  created_leads: number | null;
  created_targets: number | null;
  next_row_offset: number | null;
  last_error: string | null;
  processing_started_at: string | null;
  processing_expires_at: string | null;
  campaign: {
    id: string;
    status: CampaignStatus;
    import_status: CampaignImportStatus;
    import_total_rows: number | null;
    import_processed_rows: number | null;
    import_failed_rows: number | null;
    import_started_at: string | null;
    total_targets: number | null;
  } | null;
};

type BatchTargetInput = {
  normalized_phone: string;
  raw_phone: string | null;
  display_name: string | null;
  chat_id: string | null;
  source_payload: Record<string, string>;
  existing_lead_id: null;
  needs_lead_creation: boolean;
};

type BatchAppendResult = {
  input_rows: number;
  invalid_phone_rows: number;
  duplicate_rows: number;
  created_leads: number;
  unresolved_rows: number;
  conflict_rows: number;
  inserted_targets: number;
};

type ProcessSummary = {
  jobsClaimed: number;
  jobsCompleted: number;
  jobsFailed: number;
  rowsProcessed: number;
  createdLeads: number;
  createdTargets: number;
};

type JobProgressUpdate = {
  actualTotalRows: number;
  processedRows: number;
  failedRows: number;
  createdLeads: number;
  createdTargets: number;
  nextRowOffset: number;
  ready: boolean;
  failed: boolean;
  errorMessage?: string | null;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return String(error);
};

const getTimestampMs = (value: string | null | undefined): number => {
  if (!value) {
    return Number.NaN;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const getProcessingLeaseExpiryIso = (baseDate: Date = new Date()): string =>
  new Date(baseDate.getTime() + WHATSAPP_CAMPAIGN_IMPORT_LEASE_MS).toISOString();

const isJobReadyForClaim = (job: ImportJobRecord, now: Date = new Date()): boolean => {
  if (job.status === 'queued') {
    return true;
  }

  if (job.status !== 'processing') {
    return false;
  }

  const expiresAtMs = getTimestampMs(job.processing_expires_at);
  return Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime();
};

const toNonNegativeInt = (value: number | null | undefined): number =>
  Number.isFinite(value) && Number(value) > 0 ? Math.trunc(Number(value)) : 0;

const getMappingKey = (mapping: Record<string, unknown> | null | undefined, key: string): string => {
  const value = typeof mapping?.[key] === 'string' ? String(mapping[key]).trim() : '';
  return normalizeCsvHeader(value);
};

const pickDisplayName = (payload: Record<string, string>, explicitNameKey: string | null): string => {
  const candidates = [
    explicitNameKey ? payload[explicitNameKey] : '',
    payload.nome,
    payload.nome_completo,
    payload.name,
    payload.cliente,
    payload.contato,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() ?? '';
};

const buildBatchTargets = (
  rows: Array<{ values: Record<string, string> }>,
  mapping: Record<string, unknown> | null,
): BatchTargetInput[] => {
  const phoneColumnKey = getMappingKey(mapping, 'phone_column_key');
  const nameColumnKey = getMappingKey(mapping, 'name_column_key') || null;

  if (!phoneColumnKey) {
    throw new Error('Mapeamento da coluna de telefone ausente na importacao.');
  }

  return rows.map((row) => {
    const payload = normalizeCampaignSourcePayload(row.values);
    const rawPhone = payload[phoneColumnKey] ?? '';
    const normalizedPhone = normalizePhoneForCampaign(rawPhone);
    const displayName = pickDisplayName(payload, nameColumnKey) || null;

    return {
      normalized_phone: normalizedPhone,
      raw_phone: rawPhone.trim() || null,
      display_name: displayName,
      chat_id: normalizedPhone ? `${normalizedPhone}@s.whatsapp.net` : null,
      source_payload: payload,
      existing_lead_id: null,
      needs_lead_creation: Boolean(displayName),
    };
  });
};

const loadCandidateJobs = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  campaignId: string | null,
  limit: number,
): Promise<ImportJobRecord[]> => {
  let query = supabaseAdmin
    .from('whatsapp_campaign_import_jobs')
    .select('id, campaign_id, status, storage_bucket, storage_path, file_name, delimiter, mapping, crm_defaults, total_rows, processed_rows, failed_rows, created_leads, created_targets, next_row_offset, last_error, processing_started_at, processing_expires_at, campaign:whatsapp_campaigns!inner(id, status, import_status, import_total_rows, import_processed_rows, import_failed_rows, import_started_at, total_targets)')
    .in('status', ['queued', 'processing'])
    .order('created_at', { ascending: true })
    .limit(Math.max(limit * 4, 8));

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao carregar jobs de importacao: ${error.message}`);
  }

  return ((data ?? []) as ImportJobRecord[])
    .filter((job) => isJobReadyForClaim(job));
};

const claimJob = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  job: ImportJobRecord,
): Promise<boolean> => {
  const now = new Date();
  const nowIso = now.toISOString();
  const processingExpiresAt = getProcessingLeaseExpiryIso(now);
  const payload = {
    status: 'processing',
    processing_started_at: nowIso,
    processing_expires_at: processingExpiresAt,
    last_error: null,
  };

  if (job.status === 'queued') {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_campaign_import_jobs')
      .update(payload)
      .eq('id', job.id)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao bloquear job de importacao: ${error.message}`);
    }

    return Boolean(data?.id);
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_campaign_import_jobs')
    .update(payload)
    .eq('id', job.id)
    .eq('status', 'processing')
    .lte('processing_expires_at', nowIso)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao recuperar job travado de importacao: ${error.message}`);
  }

  if (data?.id) {
    return true;
  }

  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from('whatsapp_campaign_import_jobs')
    .update(payload)
    .eq('id', job.id)
    .eq('status', 'processing')
    .is('processing_expires_at', null)
    .select('id')
    .maybeSingle();

  if (fallbackError) {
    throw new Error(`Erro ao recuperar job sem lease de importacao: ${fallbackError.message}`);
  }

  return Boolean(fallbackData?.id);
};

const downloadCsvText = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
): Promise<string> => {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || 'Nao foi possivel baixar o CSV da importacao.');
  }

  return await data.text();
};

const appendBatch = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  campaignId: string,
  csvTargets: BatchTargetInput[],
  crmDefaults: Record<string, unknown> | null,
): Promise<BatchAppendResult> => {
  const { data, error } = await supabaseAdmin.rpc('append_whatsapp_campaign_csv_targets_batch', {
    p_campaign_id: campaignId,
    p_csv_targets: csvTargets,
    p_crm_defaults: crmDefaults ?? {},
  });

  if (error) {
    throw new Error(`Erro ao anexar lote da campanha: ${error.message}`);
  }

  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!payload) {
    throw new Error('Resposta invalida ao anexar lote da campanha.');
  }

  return {
    input_rows: Number(payload.input_rows ?? 0) || 0,
    invalid_phone_rows: Number(payload.invalid_phone_rows ?? 0) || 0,
    duplicate_rows: Number(payload.duplicate_rows ?? 0) || 0,
    created_leads: Number(payload.created_leads ?? 0) || 0,
    unresolved_rows: Number(payload.unresolved_rows ?? 0) || 0,
    conflict_rows: Number(payload.conflict_rows ?? 0) || 0,
    inserted_targets: Number(payload.inserted_targets ?? 0) || 0,
  };
};

const updateJobAndCampaignProgress = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  job: ImportJobRecord,
  progress: JobProgressUpdate,
): Promise<void> => {
  const nowIso = new Date().toISOString();
  const nextJobStatus: ImportJobStatus = progress.failed
    ? 'failed'
    : progress.ready
      ? 'ready'
      : 'queued';
  const nextCampaignStatus: CampaignImportStatus = progress.failed
    ? 'failed'
    : progress.ready
      ? 'ready'
      : 'processing';

  const jobUpdate = {
    status: nextJobStatus,
    total_rows: progress.actualTotalRows,
    processed_rows: progress.processedRows,
    failed_rows: progress.failedRows,
    created_leads: progress.createdLeads,
    created_targets: progress.createdTargets,
    next_row_offset: progress.nextRowOffset,
    last_error: progress.errorMessage ?? null,
    processing_started_at: null,
    processing_expires_at: null,
  };

  const campaignUpdate = {
    import_status: nextCampaignStatus,
    import_total_rows: progress.actualTotalRows,
    import_processed_rows: progress.processedRows,
    import_failed_rows: progress.failedRows,
    import_started_at: job.campaign?.import_started_at ?? nowIso,
    import_completed_at: progress.ready || progress.failed ? nowIso : null,
    import_error: progress.errorMessage ?? null,
  };

  const { error: jobError } = await supabaseAdmin
    .from('whatsapp_campaign_import_jobs')
    .update(jobUpdate)
    .eq('id', job.id);

  if (jobError) {
    throw new Error(`Erro ao salvar progresso do job de importacao: ${jobError.message}`);
  }

  const { error: campaignError } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .update(campaignUpdate)
    .eq('id', job.campaign_id);

  if (campaignError) {
    throw new Error(`Erro ao salvar progresso da campanha: ${campaignError.message}`);
  }
};

const cancelJob = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  job: ImportJobRecord,
  reason: string,
): Promise<void> => {
  const nowIso = new Date().toISOString();

  const { error: jobError } = await supabaseAdmin
    .from('whatsapp_campaign_import_jobs')
    .update({
      status: 'cancelled',
      last_error: reason,
      processing_started_at: null,
      processing_expires_at: null,
    })
    .eq('id', job.id);

  if (jobError) {
    throw new Error(`Erro ao cancelar job de importacao: ${jobError.message}`);
  }

  const { error: campaignError } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .update({
      import_status: 'cancelled',
      import_error: reason,
      import_completed_at: nowIso,
    })
    .eq('id', job.campaign_id);

  if (campaignError) {
    throw new Error(`Erro ao cancelar importacao da campanha: ${campaignError.message}`);
  }
};

const processSingleJob = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  job: ImportJobRecord,
): Promise<{ rowsProcessed: number; createdLeads: number; createdTargets: number; completed: boolean }> => {
  if (job.campaign?.status === 'cancelled') {
    await cancelJob(supabaseAdmin, job, 'Campanha cancelada durante a importacao.');
    return { rowsProcessed: 0, createdLeads: 0, createdTargets: 0, completed: false };
  }

  const csvText = await downloadCsvText(supabaseAdmin, job.storage_bucket, job.storage_path);
  const parsed = parseCampaignCsvText(csvText);
  const actualTotalRows = parsed.rows.length;

  if (actualTotalRows === 0) {
    await updateJobAndCampaignProgress(supabaseAdmin, job, {
      actualTotalRows: 0,
      processedRows: 0,
      failedRows: 0,
      createdLeads: 0,
      createdTargets: 0,
      nextRowOffset: 0,
      ready: false,
      failed: true,
      errorMessage: 'O arquivo CSV nao possui linhas de dados para importar.',
    });
    return { rowsProcessed: 0, createdLeads: 0, createdTargets: 0, completed: false };
  }

  const currentOffset = Math.min(toNonNegativeInt(job.next_row_offset), actualTotalRows);
  const batchRows = parsed.rows.slice(currentOffset, currentOffset + DEFAULT_BATCH_SIZE);

  if (batchRows.length === 0) {
    const totalCreatedTargets = toNonNegativeInt(job.created_targets);
    const failed = totalCreatedTargets === 0;
    await updateJobAndCampaignProgress(supabaseAdmin, job, {
      actualTotalRows,
      processedRows: Math.min(toNonNegativeInt(job.processed_rows), actualTotalRows),
      failedRows: toNonNegativeInt(job.failed_rows),
      createdLeads: toNonNegativeInt(job.created_leads),
      createdTargets: totalCreatedTargets,
      nextRowOffset: actualTotalRows,
      ready: !failed,
      failed,
      errorMessage: failed ? 'Nenhum alvo valido foi importado para a campanha.' : null,
    });
    return { rowsProcessed: 0, createdLeads: 0, createdTargets: 0, completed: !failed };
  }

  const batchTargets = buildBatchTargets(batchRows, job.mapping);
  const batchResult = await appendBatch(supabaseAdmin, job.campaign_id, batchTargets, job.crm_defaults);
  const nextRowOffset = Math.min(currentOffset + batchRows.length, actualTotalRows);
  const nextProcessedRows = Math.min(toNonNegativeInt(job.processed_rows) + batchRows.length, actualTotalRows);
  const nextFailedRows = toNonNegativeInt(job.failed_rows)
    + batchResult.invalid_phone_rows
    + batchResult.duplicate_rows
    + batchResult.unresolved_rows
    + batchResult.conflict_rows;
  const nextCreatedLeads = toNonNegativeInt(job.created_leads) + batchResult.created_leads;
  const nextCreatedTargets = toNonNegativeInt(job.created_targets) + batchResult.inserted_targets;
  const ready = nextRowOffset >= actualTotalRows && nextCreatedTargets > 0;
  const failed = nextRowOffset >= actualTotalRows && nextCreatedTargets === 0;

  await updateJobAndCampaignProgress(supabaseAdmin, job, {
    actualTotalRows,
    processedRows: nextProcessedRows,
    failedRows: nextFailedRows,
    createdLeads: nextCreatedLeads,
    createdTargets: nextCreatedTargets,
    nextRowOffset,
    ready,
    failed,
    errorMessage: failed ? 'Nenhum alvo valido foi importado para a campanha.' : null,
  });

  return {
    rowsProcessed: batchRows.length,
    createdLeads: batchResult.created_leads,
    createdTargets: batchResult.inserted_targets,
    completed: ready,
  };
};

const failJob = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  job: ImportJobRecord,
  errorMessage: string,
): Promise<void> => {
  await updateJobAndCampaignProgress(supabaseAdmin, job, {
    actualTotalRows: Math.max(toNonNegativeInt(job.total_rows), toNonNegativeInt(job.campaign?.import_total_rows)),
    processedRows: toNonNegativeInt(job.processed_rows),
    failedRows: toNonNegativeInt(job.failed_rows),
    createdLeads: toNonNegativeInt(job.created_leads),
    createdTargets: toNonNegativeInt(job.created_targets),
    nextRowOffset: toNonNegativeInt(job.next_row_offset),
    ready: false,
    failed: true,
    errorMessage,
  });
};

const processImportJobs = async ({
  supabaseAdmin,
  campaignId,
  limit,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  campaignId: string | null;
  limit: number;
}): Promise<ProcessSummary> => {
  const summary: ProcessSummary = {
    jobsClaimed: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    rowsProcessed: 0,
    createdLeads: 0,
    createdTargets: 0,
  };

  const candidates = await loadCandidateJobs(supabaseAdmin, campaignId, limit);
  if (candidates.length === 0) {
    return summary;
  }

  for (const candidate of candidates) {
    if (summary.jobsClaimed >= limit) {
      break;
    }

    const claimed = await claimJob(supabaseAdmin, candidate);
    if (!claimed) {
      continue;
    }

    summary.jobsClaimed += 1;

    try {
      const result = await processSingleJob(supabaseAdmin, candidate);
      summary.rowsProcessed += result.rowsProcessed;
      summary.createdLeads += result.createdLeads;
      summary.createdTargets += result.createdTargets;
      if (result.completed) {
        summary.jobsCompleted += 1;
      }
    } catch (error) {
      summary.jobsFailed += 1;
      await failJob(supabaseAdmin, candidate, toErrorMessage(error));
    }
  }

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
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ success: false, error: 'Variaveis de ambiente ausentes no servidor' }, 500);
  }

  if (!isServiceRoleRequest(req, supabaseServiceRoleKey)) {
    return jsonResponse({ success: false, error: 'Nao autorizado' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const bodyText = await req.text();
    const payload = (bodyText ? JSON.parse(bodyText) : {}) as Record<string, unknown>;
    const action =
      (typeof payload.action === 'string' ? payload.action : null)
      || new URL(req.url).searchParams.get('action')
      || 'process';

    if (action !== 'process') {
      return jsonResponse({ success: false, error: 'Acao nao suportada' }, 400);
    }

    const rawLimit = typeof payload.limit === 'number' ? payload.limit : Number(payload.limit);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_JOB_LIMIT)
      : DEFAULT_JOB_LIMIT;
    const campaignId = typeof payload.campaignId === 'string' && payload.campaignId.trim()
      ? payload.campaignId.trim()
      : null;

    const summary = await processImportJobs({
      supabaseAdmin,
      campaignId,
      limit,
    });

    return jsonResponse({
      success: true,
      jobsClaimed: summary.jobsClaimed,
      jobsCompleted: summary.jobsCompleted,
      jobsFailed: summary.jobsFailed,
      rowsProcessed: summary.rowsProcessed,
      createdLeads: summary.createdLeads,
      createdTargets: summary.createdTargets,
    });
  } catch (error) {
    console.error('[whatsapp-campaign-import] erro:', error);
    return jsonResponse({ success: false, error: toErrorMessage(error) }, 500);
  }
});
