import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import { assertContactPermissionForSend, ContactPermissionBlockedError } from '../_shared/contact-permissions.ts';
import {
  corsHeaders,
  ensureCommWhatsAppSettings,
  extractWhapiMessageId,
  fetchWhapiWithTimeout,
  getNowIso,
  isWhapiGroupChatId,
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

type ScheduledSequenceActionClaim = {
  action_id: string | null;
  action_index: number | null;
  action_type: string | null;
  action_config: Record<string, unknown> | null;
  action_status: string | null;
};

type ScheduledSequenceStepClaim = {
  step_id: string;
  sequence_id: string;
  step_index: number;
  delay_seconds: number;
  attempts: number;
  due_at: string;
  reminder_id: string | null;
  sequence_reminder_id: string | null;
  channel_id: string;
  chat_id: string | null;
  phone_digits: string;
  phone_number: string | null;
  display_name: string | null;
  lead_id: string | null;
  contract_id: string | null;
  label: string | null;
  cancel_on_inbound_message: boolean;
  message_type: string | null;
  text_content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_file_name: string | null;
} & ScheduledSequenceActionClaim;

type ScheduledSequenceAction = {
  id: string;
  action_index: number;
  action_type: string;
  config: Record<string, unknown>;
  status: string;
};

type ProcessRequestBody = {
  action?: 'process';
  limit?: number;
  source?: 'cron' | 'manual';
};

type ScheduledDestination = {
  chatId: string;
  phoneDigits: string;
  displayName: string;
  isGroup: boolean;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const MAX_BATCH_SIZE = 10;
const SCHEDULED_MEDIA_BUCKET = 'comm-whatsapp-scheduled-media';
const SCHEDULED_MEDIA_URL_PREFIX = `storage://${SCHEDULED_MEDIA_BUCKET}/`;

function splitMessageSegments(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  return normalized
    .split(/\n\s*---\s*\n/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeComparable(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function readActionString(config: Record<string, unknown>, key: string, fallback = ''): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : fallback;
}

function readActionNumber(config: Record<string, unknown>, key: string, fallback = 0): number {
  const value = Number(config[key]);
  return Number.isFinite(value) ? value : fallback;
}

function groupSequenceClaims(rows: ScheduledSequenceStepClaim[]): Map<string, {
  step: ScheduledSequenceStepClaim;
  actions: ScheduledSequenceAction[];
}> {
  const grouped = new Map<string, { step: ScheduledSequenceStepClaim; actions: ScheduledSequenceAction[] }>();
  for (const row of rows) {
    const current = grouped.get(row.step_id) ?? {
      step: row,
      actions: [],
    };
    if (row.action_id && row.action_type && row.action_config) {
      current.actions.push({
        id: row.action_id,
        action_index: row.action_index ?? 0,
        action_type: row.action_type,
        config: row.action_config,
        status: row.action_status ?? 'pending',
      });
    }
    grouped.set(row.step_id, current);
  }
  return grouped;
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

async function secureTokenEquals(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;

  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = providedBytes.length ^ expectedBytes.length;

  for (let index = 0; index < Math.min(providedBytes.length, expectedBytes.length); index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }

  return difference === 0;
}

async function isScheduledWorkerRequest(
  req: Request,
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  const providedToken = req.headers.get('x-scheduled-worker-token')?.trim() ?? '';
  if (!providedToken) return false;

  const { data, error } = await admin
    .from('comm_whatsapp_worker_tokens')
    .select('token')
    .eq('purpose', 'process-scheduled-messages')
    .maybeSingle();

  if (error || !data?.token) {
    console.error('[process-scheduled] could not validate cron token', error?.message ?? 'token missing');
    return false;
  }

  return secureTokenEquals(providedToken, data.token);
}

async function resolveScheduledDestination(
  admin: ReturnType<typeof createAdminClient>,
  msg: ScheduledMessageRow,
): Promise<ScheduledDestination> {
  if (msg.chat_id) {
    const { data: chat, error } = await admin
      .from('comm_whatsapp_chats')
      .select('external_chat_id,phone_digits,display_name,is_group')
      .eq('id', msg.chat_id)
      .maybeSingle();
    if (error) throw new Error(`Nao foi possivel resolver o destino agendado: ${error.message}`);
    const externalChatId = normalizeWhapiChatId(chat?.external_chat_id);
    if (externalChatId) {
      const isGroup = chat?.is_group === true || isWhapiGroupChatId(externalChatId);
      return {
        chatId: externalChatId,
        phoneDigits: isGroup ? '' : (chat?.phone_digits || msg.phone_digits),
        displayName: chat?.display_name || (isGroup ? 'Grupo' : msg.display_name || msg.phone_digits),
        isGroup,
      };
    }
  }

  const chatId = normalizeWhapiChatId(msg.phone_digits);
  return {
    chatId,
    phoneDigits: msg.phone_digits,
    displayName: msg.display_name ?? msg.phone_digits,
    isGroup: isWhapiGroupChatId(chatId),
  };
}

async function sendTextMessage(
  admin: ReturnType<typeof createAdminClient>,
  channelRow: { id: string; phone_number: string | null },
  msg: ScheduledMessageRow,
  token: string,
): Promise<{ externalMessageId: string; deliveryStatus: string }> {
  const destination = await resolveScheduledDestination(admin, msg);
  if (!destination.isGroup) await assertContactPermissionForSend(admin, destination.phoneDigits, 'commercial');
  const chatId = destination.chatId;

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

  await resolveCommWhatsAppCanonicalChatRoute(admin, {
    channelId: channelRow.id,
    externalChatId: chatId,
  });

  await persistCommWhatsAppMessage(admin, {
    channelId: channelRow.id,
    externalChatId: chatId,
    phoneNumber: destination.isGroup ? null : destination.phoneDigits,
    displayName: destination.displayName,
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
    metadata: destination.isGroup ? { is_group: true } : {},
  });

  return { externalMessageId, deliveryStatus };
}

async function sendMediaMessage(
  admin: ReturnType<typeof createAdminClient>,
  channelRow: { id: string; phone_number: string | null },
  msg: ScheduledMessageRow,
  token: string,
): Promise<{ externalMessageId: string; deliveryStatus: string }> {
  const destination = await resolveScheduledDestination(admin, msg);
  if (!destination.isGroup) await assertContactPermissionForSend(admin, destination.phoneDigits, 'commercial');
  const chatId = destination.chatId;
  let mediaUrl = msg.media_url;
  const storagePath = mediaUrl?.startsWith(SCHEDULED_MEDIA_URL_PREFIX)
    ? mediaUrl.slice(SCHEDULED_MEDIA_URL_PREFIX.length)
    : '';
  if (storagePath) {
    const { data: signedMedia, error: signedMediaError } = await admin.storage
      .from(SCHEDULED_MEDIA_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (signedMediaError || !signedMedia?.signedUrl) throw new Error('O anexo agendado não está disponível.');
    mediaUrl = signedMedia.signedUrl;
  }
  if (!mediaUrl) throw new Error('A mensagem agendada não possui mídia disponível.');

  const mediaKind = (msg.message_type === 'voice' ? 'audio' : msg.message_type) as 'image' | 'video' | 'document' | 'audio';

  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/messages/${mediaKind}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: chatId,
      mediaUrl,
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

  await resolveCommWhatsAppCanonicalChatRoute(admin, {
    channelId: channelRow.id,
    externalChatId: chatId,
  });

  await persistCommWhatsAppMessage(admin, {
    channelId: channelRow.id,
    externalChatId: chatId,
    phoneNumber: destination.isGroup ? null : destination.phoneDigits,
    displayName: destination.displayName,
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
    metadata: destination.isGroup ? { is_group: true } : {},
  });

  return { externalMessageId, deliveryStatus };
}

async function refreshLeadNextReturn(
  admin: ReturnType<typeof createAdminClient>,
  leadId: string,
): Promise<void> {
  const { data: nextReminder, error: reminderError } = await admin
    .from('reminders')
    .select('data_lembrete')
    .eq('lead_id', leadId)
    .eq('lido', false)
    .order('data_lembrete', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (reminderError) throw new Error(`Não foi possível atualizar o próximo retorno: ${reminderError.message}`);

  const { error } = await admin
    .from('leads')
    .update({ proximo_retorno: nextReminder?.data_lembrete ?? null })
    .eq('id', leadId);
  if (error) throw new Error(`Não foi possível sincronizar o próximo retorno: ${error.message}`);
}

async function executeSequenceAction(
  admin: ReturnType<typeof createAdminClient>,
  step: ScheduledSequenceStepClaim,
  action: ScheduledSequenceAction,
): Promise<void> {
  if (action.status === 'completed') return;

  const { error: processingError } = await admin
    .from('comm_whatsapp_scheduled_sequence_actions')
    .update({ status: 'processing', error_message: null })
    .eq('id', action.id)
    .eq('status', 'pending');
  if (processingError) throw new Error(`Não foi possível iniciar a ação: ${processingError.message}`);

  try {
    let config = action.config;

    if (action.action_type === 'update_status') {
      if (!step.lead_id) throw new Error('Ação de status exige um lead vinculado.');
      const targetStatusId = readActionString(config, 'status_id');
      const targetStatusName = readActionString(config, 'status_name');
      if (!targetStatusId && !targetStatusName) throw new Error('Status alvo não configurado.');

      const [{ data: statuses, error: statusError }, { data: lead, error: leadError }] = await Promise.all([
        admin.from('lead_status_config').select('id,nome').eq('ativo', true),
        admin.from('leads').select('id,status_id,status,responsavel').eq('id', step.lead_id).maybeSingle(),
      ]);
      if (statusError) throw new Error(`Não foi possível carregar os status: ${statusError.message}`);
      if (leadError || !lead) throw new Error('Lead não encontrado para a ação de status.');

      const target = (statuses ?? []).find((status) => targetStatusId
        ? status.id === targetStatusId
        : normalizeComparable(status.nome) === normalizeComparable(targetStatusName));
      if (!target?.id) throw new Error(`Status "${targetStatusName || targetStatusId}" não encontrado.`);

      if (lead.status_id !== target.id) {
        const { error } = await admin.from('leads').update({ status_id: target.id }).eq('id', step.lead_id);
        if (error) throw new Error(`Não foi possível alterar o status: ${error.message}`);
        const previousStatus = (statuses ?? []).find((status) => status.id === lead.status_id)?.nome
          ?? lead.status
          ?? 'Não informado';
        const { error: historyError } = await admin.from('lead_status_history').insert({
          lead_id: step.lead_id,
          status_anterior: previousStatus,
          status_novo: target.nome,
          responsavel: lead.responsavel ?? 'Automação de mensagens agendadas',
          observacao: `Alteração executada pela sequência ${step.sequence_id}.`,
        });
        if (historyError) throw new Error(`Não foi possível registrar o histórico de status: ${historyError.message}`);
      }
    } else if (action.action_type === 'complete_reminder') {
      if (!step.lead_id) throw new Error('Ação de lembrete exige um lead vinculado.');
      const reminderId = readActionString(config, 'reminder_id') || step.reminder_id || step.sequence_reminder_id;
      if (!reminderId) throw new Error('Nenhum lembrete foi vinculado à ação.');

      const { data: reminder, error: reminderError } = await admin
        .from('reminders')
        .select('id,lead_id,lido')
        .eq('id', reminderId)
        .maybeSingle();
      if (reminderError || !reminder) throw new Error('Lembrete vinculado não foi encontrado.');
      if (reminder.lead_id !== step.lead_id) throw new Error('O lembrete não pertence ao lead da sequência.');
      if (!reminder.lido) {
        const { error } = await admin
          .from('reminders')
          .update({ lido: true, concluido_em: new Date().toISOString() })
          .eq('id', reminderId)
          .eq('lead_id', step.lead_id);
        if (error) throw new Error(`Não foi possível concluir o lembrete: ${error.message}`);
      }
      await refreshLeadNextReturn(admin, step.lead_id);
    } else if (action.action_type === 'create_reminder') {
      if (!step.lead_id) throw new Error('Ação de lembrete exige um lead vinculado.');
      const title = readActionString(config, 'title');
      if (!title) throw new Error('O próximo lembrete precisa de um título.');
      const dueSeconds = Math.max(readActionNumber(config, 'due_seconds', 0), 0);
      const priority = ['baixa', 'normal', 'alta'].includes(readActionString(config, 'priority'))
        ? readActionString(config, 'priority')
        : 'normal';
      let createdReminderId = readActionString(config, 'created_reminder_id');
      if (!createdReminderId) {
        createdReminderId = crypto.randomUUID();
        config = { ...config, created_reminder_id: createdReminderId };
        const { error: configError } = await admin
          .from('comm_whatsapp_scheduled_sequence_actions')
          .update({ config })
          .eq('id', action.id);
        if (configError) throw new Error(`Não foi possível preparar o próximo lembrete: ${configError.message}`);
      }

      const { data: existingReminder, error: existingReminderError } = await admin
        .from('reminders')
        .select('id')
        .eq('id', createdReminderId)
        .maybeSingle();
      if (existingReminderError) throw new Error(`Não foi possível verificar o próximo lembrete: ${existingReminderError.message}`);
      if (!existingReminder) {
        const { error } = await admin.from('reminders').insert({
          id: createdReminderId,
          lead_id: step.lead_id,
          contract_id: step.contract_id,
          tipo: readActionString(config, 'type', 'Follow-up'),
          titulo: title,
          descricao: readActionString(config, 'description') || null,
          data_lembrete: new Date(Date.now() + dueSeconds * 1000).toISOString(),
          lido: false,
          prioridade: priority,
        });
        if (error) throw new Error(`Não foi possível criar o próximo lembrete: ${error.message}`);
      }
      await refreshLeadNextReturn(admin, step.lead_id);
    } else if (action.action_type === 'cancel_sequence') {
      const { error: sequenceError } = await admin
        .from('comm_whatsapp_scheduled_sequences')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          last_error: 'Cancelada pela ação configurada na sequência.',
        })
        .eq('id', step.sequence_id)
        .in('status', ['scheduled', 'running']);
      if (sequenceError) throw new Error(`Não foi possível cancelar a sequência: ${sequenceError.message}`);
      await admin
        .from('comm_whatsapp_scheduled_sequence_steps')
        .update({ status: 'cancelled', last_error: 'Cancelada pela ação da sequência.' })
        .eq('sequence_id', step.sequence_id)
        .eq('status', 'pending');
    }

    const { error: completedError } = await admin
      .from('comm_whatsapp_scheduled_sequence_actions')
      .update({ status: 'completed', executed_at: new Date().toISOString(), error_message: null })
      .eq('id', action.id);
    if (completedError) throw new Error(`Não foi possível concluir a ação: ${completedError.message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from('comm_whatsapp_scheduled_sequence_actions')
      .update({ status: 'failed', error_message: message })
      .eq('id', action.id);
    throw new Error(message);
  }
}

async function finishSequenceStep(
  admin: ReturnType<typeof createAdminClient>,
  step: ScheduledSequenceStepClaim,
  actions: ScheduledSequenceAction[],
): Promise<void> {
  for (const action of actions.sort((left, right) => left.action_index - right.action_index)) {
    await executeSequenceAction(admin, step, action);
  }

  const { error: stepError } = await admin
    .from('comm_whatsapp_scheduled_sequence_steps')
    .update({ status: 'completed', completed_at: new Date().toISOString(), last_error: null })
    .eq('id', step.step_id)
    .eq('status', 'processing');
  if (stepError) throw new Error(`Não foi possível concluir a etapa: ${stepError.message}`);

  const { data: nextStep, error: nextStepError } = await admin
    .from('comm_whatsapp_scheduled_sequence_steps')
    .select('id,step_index,delay_seconds')
    .eq('sequence_id', step.sequence_id)
    .eq('step_index', step.step_index + 1)
    .maybeSingle();
  if (nextStepError) throw new Error(`Não foi possível carregar a próxima etapa: ${nextStepError.message}`);

  if (!nextStep) {
    await admin.from('comm_whatsapp_scheduled_sequences').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      current_step_index: step.step_index,
      last_error: null,
    }).eq('id', step.sequence_id);
    return;
  }

  const { data: sequence, error: sequenceError } = await admin
    .from('comm_whatsapp_scheduled_sequences')
    .select('status')
    .eq('id', step.sequence_id)
    .maybeSingle();
  if (sequenceError || !sequence) throw new Error('Sequência não encontrada ao avançar etapa.');
  if (sequence.status === 'cancelled') return;

  const dueAt = new Date(Date.now() + Math.max(nextStep.delay_seconds ?? 0, 0) * 1000).toISOString();
  const { error: nextUpdateError } = await admin
    .from('comm_whatsapp_scheduled_sequence_steps')
    .update({ status: 'pending', due_at: dueAt, next_retry_at: null, last_error: null })
    .eq('id', nextStep.id)
    .eq('status', 'pending');
  if (nextUpdateError) throw new Error(`Não foi possível agendar a próxima etapa: ${nextUpdateError.message}`);
  await admin.from('comm_whatsapp_scheduled_sequences').update({
    status: 'scheduled',
    current_step_index: nextStep.step_index,
    last_error: null,
  }).eq('id', step.sequence_id);
}

async function processSequenceBatch(
  admin: ReturnType<typeof createAdminClient>,
  limit: number,
  channelCache: Map<string, { id: string; phone_number: string | null }>,
): Promise<{ processed: number; sent: number; failed: number; errors: string[] }> {
  const { data, error } = await admin.rpc('claim_scheduled_message_sequence_steps', {
    p_batch_size: Math.min(limit, MAX_BATCH_SIZE),
  });
  if (error) throw new Error(`Sequence claim failed: ${error.message}`);
  const groups = groupSequenceClaims((data ?? []) as ScheduledSequenceStepClaim[]);
  if (groups.size === 0) return { processed: 0, sent: 0, failed: 0, errors: [] };

  let token: string | null = null;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const { step, actions } of groups.values()) {
    let scheduledMessageId: string | null = null;
    let messageSent = false;
    try {
      if (step.message_type) {
        const { data: previousMessage, error: previousMessageError } = await admin
          .from('comm_whatsapp_scheduled_messages')
          .select('id,status')
          .eq('sequence_step_id', step.step_id)
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (previousMessageError) throw new Error(`Não foi possível verificar o envio anterior: ${previousMessageError.message}`);
        if (previousMessage?.status === 'sent') {
          scheduledMessageId = previousMessage.id;
          messageSent = true;
        }

        if (!messageSent) {
        let channelRow = channelCache.get(step.channel_id);
        if (!channelRow) {
          const { data: channel, error: channelError } = await admin
            .from('comm_whatsapp_channels')
            .select('id,phone_number')
            .eq('id', step.channel_id)
            .single();
          if (channelError || !channel) throw new Error(`Canal ${step.channel_id} não encontrado.`);
          channelRow = channel;
          channelCache.set(step.channel_id, channel);
        }
        if (!token) {
          token = sanitizeWhapiToken(Deno.env.get('WHAPI_TOKEN') || '');
          if (!token) throw new Error('Token do WhatsApp não configurado.');
        }

        const { data: scheduledMessage, error: scheduledMessageError } = await admin
          .from('comm_whatsapp_scheduled_messages')
          .insert({
            channel_id: step.channel_id,
            chat_id: step.chat_id,
            phone_digits: step.phone_digits,
            phone_number: step.phone_number,
            display_name: step.display_name,
            message_type: step.message_type,
            text_content: step.text_content,
            media_url: step.media_url,
            media_mime_type: step.media_mime_type,
            media_file_name: step.media_file_name,
            scheduled_at: step.due_at,
            recurrence: 'none',
            recurrence_config: {},
            status: 'sending',
            attempts: 1,
            max_attempts: 3,
            lead_id: step.lead_id,
            contract_id: step.contract_id,
            reminder_id: step.reminder_id ?? step.sequence_reminder_id,
            sequence_id: step.sequence_id,
            sequence_step_id: step.step_id,
            label: step.label,
            cancel_on_inbound_message: step.cancel_on_inbound_message,
          })
          .select('id')
          .single();
        if (scheduledMessageError || !scheduledMessage) throw new Error(`Não foi possível registrar o envio: ${scheduledMessageError?.message ?? 'registro ausente'}`);
        scheduledMessageId = scheduledMessage.id;

        const message: ScheduledMessageRow = {
          message_id: scheduledMessage.id,
          channel_id: step.channel_id,
          chat_id: step.chat_id,
          phone_digits: step.phone_digits,
          phone_number: step.phone_number,
          display_name: step.display_name,
          message_type: step.message_type,
          text_content: step.text_content,
          media_url: step.media_url,
          media_mime_type: step.media_mime_type,
          media_file_name: step.media_file_name,
          scheduled_at: step.due_at,
          recurrence: 'none',
          recurrence_config: {},
          attempts: 1,
          max_attempts: 3,
        };

        let result: { externalMessageId: string; deliveryStatus: string };
        if (message.message_type === 'text') {
          const segments = splitMessageSegments(message.text_content ?? '');
          if (segments.length <= 1) {
            result = await sendTextMessage(admin, channelRow, message, token);
          } else {
            let lastResult = { externalMessageId: '', deliveryStatus: '' };
            for (const segment of segments) {
              lastResult = await sendTextMessage(admin, channelRow, { ...message, text_content: segment }, token);
            }
            result = lastResult;
          }
        } else {
          result = await sendMediaMessage(admin, channelRow, message, token);
        }

        const { error: sentError } = await admin.from('comm_whatsapp_scheduled_messages').update({
          status: 'sent',
          external_message_id: result.externalMessageId,
          delivery_status: result.deliveryStatus,
          sent_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
          error_message: null,
        }).eq('id', scheduledMessage.id).eq('status', 'sending');
        if (sentError) throw new Error(`Não foi possível finalizar o envio: ${sentError.message}`);
        messageSent = true;
        }
      }

      await finishSequenceStep(admin, step, actions);
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Sequence step ${step.step_id}: ${message}`);
      failed++;

      if (scheduledMessageId) {
        await admin.from('comm_whatsapp_scheduled_messages').update({
          status: 'failed',
          error_message: message,
          last_attempt_at: new Date().toISOString(),
          next_retry_at: step.attempts < 3 ? new Date(Date.now() + Math.pow(2, step.attempts - 1) * 60000).toISOString() : null,
        }).eq('id', scheduledMessageId).eq('status', 'sending');
      }

      if (messageSent || !scheduledMessageId || step.attempts >= 3) {
        await admin.from('comm_whatsapp_scheduled_sequence_steps').update({
          status: 'failed',
          last_error: message,
          next_retry_at: null,
        }).eq('id', step.step_id).eq('status', 'processing');
        await admin.from('comm_whatsapp_scheduled_sequences').update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          last_error: message,
        }).eq('id', step.sequence_id).in('status', ['scheduled', 'running']);
      } else {
        await admin.from('comm_whatsapp_scheduled_sequence_steps').update({
          status: 'pending',
          next_retry_at: new Date(Date.now() + Math.pow(2, step.attempts - 1) * 60000).toISOString(),
          last_error: message,
        }).eq('id', step.step_id).eq('status', 'processing');
      }
    }
  }

  return { processed: groups.size, sent, failed, errors };
}

async function processBatch(
  admin: ReturnType<typeof createAdminClient>,
  limit: number,
): Promise<{ processed: number; sent: number; failed: number; errors: string[] }> {
  const channelCache = new Map<string, { id: string; phone_number: string | null }>();
  const sequenceResult = await processSequenceBatch(admin, limit, channelCache);
  const { data: messages, error: pollError } = await admin.rpc('poll_scheduled_messages', {
    p_batch_size: Math.min(limit, MAX_BATCH_SIZE),
  });

  if (pollError) {
    throw new Error(`Poll failed: ${pollError.message}`);
  }

  if (!messages || messages.length === 0) {
    return sequenceResult;
  }

  let sent = sequenceResult.sent;
  let failed = sequenceResult.failed;
  const errors: string[] = [...sequenceResult.errors];

  await ensureCommWhatsAppSettings(admin);
  const rawToken = Deno.env.get('WHAPI_TOKEN') || '';
  const token = sanitizeWhapiToken(rawToken);
  if (!token) {
    throw new Error('Token do WhatsApp não configurado.');
  }

  for (const msg of messages) {
    try {
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

      if (err instanceof ContactPermissionBlockedError) {
        const { error: cancelError } = await admin.rpc('advance_scheduled_message', {
          p_message_id: msg.message_id,
          p_new_status: 'cancelled',
          p_error_message: errorMessage,
        });
        if (cancelError) {
          console.error(`[process-scheduled] advance_scheduled_message(cancelled) error: ${cancelError.message}`);
        }
        failed++;
        continue;
      }

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

  return { processed: sequenceResult.processed + messages.length, sent, failed, errors };
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const admin = createAdminClient();
    const isAuthorized = isServiceRoleRequest(req, serviceRoleKey)
      || await isScheduledWorkerRequest(req, admin);
    if (!isAuthorized) {
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
