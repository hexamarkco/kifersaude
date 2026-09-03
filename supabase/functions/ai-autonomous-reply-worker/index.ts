import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting, transcribeAudioWithRouting } from '../_shared/ai-router.ts';
import { AI_FEATURES } from '../_shared/ai-feature-registry.ts';
import { loadFeatureConfig } from '../_shared/ai-config-resolver.ts';
import {
  cacheCommWhatsAppMedia,
  corsHeaders,
  extractPhoneFromChatId,
  extractWhapiMessageId,
  ensurePrimaryChannel,
  fetchWhapiWithTimeout,
  formatPhoneLabel,
  getNowIso,
  getWhapiToken,
  parseWhapiError,
  persistCommWhatsAppMessage,
  readResponsePayload,
  resolveCommWhatsAppCanonicalChatRouteByUuid,
  resolveWhapiOutboundDeliveryStatus,
  WHAPI_BASE_URL,
  type CommWhatsAppCanonicalChatRoute,
} from '../_shared/comm-whatsapp.ts';
import { getMessageContent, type MessageRow } from '../_shared/comm-whatsapp-transcript.ts';
import {
  buildReferencePrompt,
  buildReplyUserPrompt,
  buildStylePrompt,
  fetchQuickReplies,
  fetchSimilarSituations,
  getReliableLeadFirstName,
  splitGeneratedReply,
  type HandoffCode,
  type SandboxMessageRow,
} from '../_shared/ai-sandbox-playbook.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const MAX_JOBS_PER_RUN = 10;
const CONVERSATION_HISTORY_LIMIT = 100;
const MESSAGE_SEND_DELAY_MS = 1200;
const INLINE_DUE_WAIT_LIMIT_MS = 20_000;

type WorkerRequestBody = {
  source?: string;
  chatId?: string;
  waitUntilDue?: boolean;
};

type AutonomousHistoryMessageRow = MessageRow & {
  media_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_file_name: string | null;
  transcription_status: string | null;
  transcription_error: string | null;
};

// Handoff -> status do lead no CRM. QUALIFICACAO_COMPLETA e RECUSOU_COTACAO
// mudam o status; FORA_DE_ESCOPO e PRECISA_HUMANO deixam como esta (nao e
// venda nem perda, so exige um humano assumir a conversa dali pra frente).
const HANDOFF_STATUS_TARGET: Record<HandoffCode, string | null> = {
  QUALIFICACAO_COMPLETA: 'Aguardando cotação',
  RECUSOU_COTACAO: 'Perdido',
  FORA_DE_ESCOPO: null,
  PRECISA_HUMANO: null,
};

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Credenciais do Supabase nao configuradas.');
  return createClient(supabaseUrl, serviceRoleKey);
};

const DIACRITICS_REGEX = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .replace(/\s+/g, ' ');
}

const isAudioMessage = (messageType: string | null | undefined) => {
  const kind = (messageType ?? '').trim().toLowerCase();
  return kind === 'audio' || kind === 'voice';
};

async function ensureAudioTranscriptionForAutonomousReply(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  row: AutonomousHistoryMessageRow;
  jobId: string;
  chatId: string;
  leadId: string;
}): Promise<AutonomousHistoryMessageRow> {
  const { supabaseAdmin, row, jobId, chatId, leadId } = params;
  if (row.direction !== 'inbound' || !isAudioMessage(row.message_type) || row.transcription_text?.trim()) {
    return row;
  }

  const token = getWhapiToken();
  if (!token) {
    throw new Error('WHAPI_TOKEN nao configurado para transcrever audio do atendimento autonomo.');
  }

  console.log('[ai-autonomous-reply-worker] transcricao automatica de audio iniciada', {
    jobId,
    chatId,
    leadId,
    messageId: row.id,
    messageType: row.message_type,
    transcriptionStatus: row.transcription_status ?? null,
  });

  await supabaseAdmin
    .from('comm_whatsapp_messages')
    .update({
      transcription_status: 'processing',
      transcription_error: null,
      transcription_updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  try {
    const media = await cacheCommWhatsAppMedia(supabaseAdmin, {
      token,
      mediaId: row.media_id,
      mediaUrl: row.media_url,
      fallbackFileName: row.media_file_name,
      fallbackMimeType: row.media_mime_type,
    });

    const transcription = await transcribeAudioWithRouting({
      supabaseAdmin,
      audioBlob: media.blob,
      fileName: media.fileName,
      mimeType: media.mimeType,
      prompt: 'Transcreva o audio do WhatsApp em portugues do Brasil, preservando nomes, numeros e contexto comercial.',
    });

    await supabaseAdmin
      .from('comm_whatsapp_messages')
      .update({
        transcription_text: transcription.text,
        transcription_status: 'completed',
        transcription_provider: transcription.provider,
        transcription_model: transcription.model,
        transcription_error: null,
        transcription_updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    console.log('[ai-autonomous-reply-worker] transcricao automatica de audio concluida', {
      jobId,
      chatId,
      leadId,
      messageId: row.id,
      provider: transcription.provider,
      model: transcription.model,
      fallbackUsed: transcription.fallbackUsed,
      transcriptionPreview: transcription.text.slice(0, 120),
    });

    return {
      ...row,
      transcription_text: transcription.text,
      transcription_status: 'completed',
      transcription_error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabaseAdmin
      .from('comm_whatsapp_messages')
      .update({
        transcription_status: 'failed',
        transcription_error: message,
        transcription_updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    console.error('[ai-autonomous-reply-worker] falha na transcricao automatica de audio', {
      jobId,
      chatId,
      leadId,
      messageId: row.id,
      error: message,
    });

    throw new Error(`Falha ao transcrever audio para resposta autonoma: ${message}`);
  }
}

async function sendAutonomousWhatsAppText(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  channelId: string;
  chatRoute: CommWhatsAppCanonicalChatRoute;
  text: string;
  channelPhone: string | null;
  channelName: string | null;
}): Promise<void> {
  const { supabaseAdmin, chatRoute, text, channelId, channelPhone, channelName } = params;

  const token = getWhapiToken();
  if (!token) throw new Error('WHAPI_TOKEN nao configurado.');

  const chatId = chatRoute.externalChatId;
  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/messages/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to: chatId, body: text }),
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(parseWhapiError(payload) || `Whapi retornou erro HTTP ${response.status}.`);
  }

  const externalMessageId = extractWhapiMessageId(payload);
  if (!externalMessageId) {
    throw new Error('Whapi nao retornou o ID da mensagem enviada.');
  }

  const deliveryStatus = resolveWhapiOutboundDeliveryStatus(payload, externalMessageId);
  const nowIso = getNowIso();
  const phoneDigits = chatRoute.phoneNumber || extractPhoneFromChatId(chatId);

  await persistCommWhatsAppMessage(supabaseAdmin, {
    channelId,
    externalChatId: chatId,
    phoneNumber: phoneDigits || null,
    displayName: chatRoute.displayName || formatPhoneLabel(phoneDigits),
    pushName: chatRoute.pushName,
    lastMessageText: text,
    lastMessageDirection: 'outbound',
    lastMessageAt: nowIso,
    incrementUnread: false,
    externalMessageId: externalMessageId || null,
    direction: 'outbound',
    messageType: 'text',
    deliveryStatus,
    textContent: text,
    createdBy: null,
    source: 'ai_autonomous',
    senderPhone: channelPhone,
    senderName: channelName,
    statusUpdatedAt: nowIso,
    errorMessage: null,
    mediaId: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFileName: null,
    mediaSizeBytes: null,
    mediaDurationSeconds: null,
    mediaCaption: null,
    metadata: { provider: 'ai_autonomous' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), { status: 405, headers: jsonHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!isServiceRoleRequest(req, serviceRoleKey)) {
      return new Response(JSON.stringify({ error: 'Acesso restrito.' }), { status: 401, headers: jsonHeaders });
    }

    const supabaseAdmin = createAdminClient();
    const body = await req.json().catch(() => ({})) as WorkerRequestBody;
    const requestedChatId = typeof body.chatId === 'string' && body.chatId.trim() ? body.chatId.trim() : null;
    let nowIso = new Date().toISOString();
    console.log('[ai-autonomous-reply-worker] run iniciado', {
      nowIso,
      source: body.source ?? null,
      requestedChatId,
      waitUntilDue: body.waitUntilDue === true,
    });

    if (requestedChatId && body.waitUntilDue === true) {
      const { data: pendingJob, error: pendingJobError } = await supabaseAdmin
        .from('ai_autonomous_reply_jobs')
        .select('id, scheduled_at')
        .eq('chat_id', requestedChatId)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingJobError) throw new Error(`Erro ao buscar job do chat para debounce: ${pendingJobError.message}`);

      const scheduledAtMs = pendingJob?.scheduled_at ? new Date(pendingJob.scheduled_at).getTime() : 0;
      const waitMs = Math.max(0, scheduledAtMs - Date.now());

      if (pendingJob && waitMs > 0 && waitMs <= INLINE_DUE_WAIT_LIMIT_MS) {
        console.log('[ai-autonomous-reply-worker] aguardando debounce curto do chat', {
          chatId: requestedChatId,
          jobId: pendingJob.id,
          scheduledAt: pendingJob.scheduled_at,
          waitMs,
        });
        await new Promise((resolve) => setTimeout(resolve, waitMs + 250));
        nowIso = new Date().toISOString();
      }
    }

    // Self-healing: jobs travados em 'processing' (funcao caiu no meio) voltam a pending.
    await supabaseAdmin
      .from('ai_autonomous_reply_jobs')
      .update({ status: 'pending', last_error: 'Job reiniciado (processamento interrompido)' })
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    let jobsQuery = supabaseAdmin
      .from('ai_autonomous_reply_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(requestedChatId ? 1 : MAX_JOBS_PER_RUN);

    if (requestedChatId) {
      jobsQuery = jobsQuery.eq('chat_id', requestedChatId);
    }

    const { data: jobs, error: jobsError } = await jobsQuery;

    if (jobsError) throw new Error(`Erro ao buscar jobs pendentes: ${jobsError.message}`);
    if (!jobs || jobs.length === 0) {
      console.log('[ai-autonomous-reply-worker] nenhum job pendente vencido', { nowIso });
      return new Response(JSON.stringify({ success: true, processed: 0 }), { status: 200, headers: jsonHeaders });
    }
    console.log('[ai-autonomous-reply-worker] jobs pendentes encontrados', {
      count: jobs.length,
      jobIds: jobs.map((job: { id: string }) => job.id),
    });

    const channel = await ensurePrimaryChannel(supabaseAdmin);
    let processed = 0;

    for (const job of jobs) {
      const { data: claimed } = await supabaseAdmin
        .from('ai_autonomous_reply_jobs')
        .update({ status: 'processing', attempts: (job.attempts ?? 0) + 1 })
        .eq('id', job.id)
        .eq('status', 'pending')
        .lte('scheduled_at', nowIso)
        .select('id')
        .maybeSingle();

      // Reagendado (nova mensagem inbound empurrou scheduled_at) entre a
      // busca e a tentativa de captura deste job — pula, o job seguinte
      // (com o novo scheduled_at) sera pego numa proxima execucao do cron.
      if (!claimed) {
        console.log('[ai-autonomous-reply-worker] job nao capturado; possivelmente reagendado', {
          jobId: job.id,
          chatId: job.chat_id,
          scheduledAt: job.scheduled_at,
        });
        continue;
      }

      console.log('[ai-autonomous-reply-worker] job capturado', {
        jobId: job.id,
        chatId: job.chat_id,
        leadId: job.lead_id ?? null,
        scheduledAt: job.scheduled_at,
        attempts: (job.attempts ?? 0) + 1,
      });

      try {
        const { data: chat, error: chatError } = await supabaseAdmin
          .from('comm_whatsapp_chats')
          .select('id, autonomous_attendance_status, lead_id')
          .eq('id', job.chat_id)
          .maybeSingle();
        if (chatError) throw new Error(`Erro ao carregar chat: ${chatError.message}`);

        if (!chat || chat.autonomous_attendance_status !== 'active') {
          console.warn('[ai-autonomous-reply-worker] job cancelado: atendimento autonomo inativo', {
            jobId: job.id,
            chatId: job.chat_id,
            chatFound: Boolean(chat),
            autonomousAttendanceStatus: chat?.autonomous_attendance_status ?? null,
          });
          await supabaseAdmin
            .from('ai_autonomous_reply_jobs')
            .update({ status: 'cancelled', last_error: 'Atendimento autonomo nao esta mais ativo neste chat.' })
            .eq('id', job.id);
          continue;
        }

        const leadId: string | null = chat.lead_id ?? job.lead_id;
        if (!leadId) {
          console.warn('[ai-autonomous-reply-worker] job cancelado: chat sem lead vinculado', {
            jobId: job.id,
            chatId: chat.id,
          });
          await supabaseAdmin
            .from('ai_autonomous_reply_jobs')
            .update({ status: 'cancelled', last_error: 'Chat sem lead vinculado.' })
            .eq('id', job.id);
          continue;
        }

        const [historyResult, styleMessagesResult, quickReplies, leadResult] = await Promise.all([
          supabaseAdmin
            .from('comm_whatsapp_messages')
            .select('id, direction, message_type, delivery_status, text_content, message_at, media_caption, transcription_text, transcription_status, transcription_error, media_id, media_url, media_mime_type, media_file_name')
            .eq('chat_id', chat.id)
            .neq('delivery_status', 'failed')
            .neq('direction', 'system')
            .order('message_at', { ascending: false })
            .limit(CONVERSATION_HISTORY_LIMIT),
          supabaseAdmin
            .from('comm_whatsapp_messages')
            .select('id, direction, message_type, delivery_status, text_content, message_at, media_caption, transcription_text')
            .eq('direction', 'outbound')
            .eq('message_type', 'text')
            .neq('delivery_status', 'failed')
            .not('text_content', 'is', null)
            .order('message_at', { ascending: false })
            .limit(120),
          fetchQuickReplies(supabaseAdmin),
          supabaseAdmin
            .from('leads')
            .select('nome_completo')
            .eq('id', leadId)
            .maybeSingle(),
        ]);

        if (historyResult.error) throw new Error(`Erro ao carregar historico: ${historyResult.error.message}`);

        const fetchedHistoryRows = (historyResult.data ?? []) as AutonomousHistoryMessageRow[];
        if (fetchedHistoryRows[0]) {
          fetchedHistoryRows[0] = await ensureAudioTranscriptionForAutonomousReply({
            supabaseAdmin,
            row: fetchedHistoryRows[0],
            jobId: job.id,
            chatId: chat.id,
            leadId,
          });
        }

        const recentHistoryRows = [...fetchedHistoryRows].reverse();
        const history: SandboxMessageRow[] = recentHistoryRows
          .map((row) => ({
            role: row.direction === 'inbound' ? ('lead' as const) : ('ai' as const),
            content: getMessageContent(row),
          }))
          .filter((row) => row.content.length > 0);

        if (history.length === 0 || history[history.length - 1].role !== 'lead') {
          const latestFetched = fetchedHistoryRows[0];
          console.warn('[ai-autonomous-reply-worker] job cancelado: sem mensagem pendente do lead no historico recente', {
            jobId: job.id,
            chatId: chat.id,
            leadId,
            fetchedRows: fetchedHistoryRows.length,
            usableHistoryRows: history.length,
            latestFetchedDirection: latestFetched?.direction ?? null,
            latestFetchedAt: latestFetched?.message_at ?? null,
            latestFetchedType: latestFetched?.message_type ?? null,
            latestFetchedTranscriptionStatus: latestFetched?.transcription_status ?? null,
            latestFetchedPreview: latestFetched ? getMessageContent(latestFetched).slice(0, 80) : null,
            latestUsableRole: history.at(-1)?.role ?? null,
          });
          // Nada novo do lead pra responder (ex: a ultima mensagem ja e nossa) — nada a fazer.
          await supabaseAdmin
            .from('ai_autonomous_reply_jobs')
            .update({ status: 'cancelled', last_error: 'Sem mensagem pendente do lead para responder.' })
            .eq('id', job.id);
          continue;
        }

        const styleMessages = (styleMessagesResult.data ?? []) as MessageRow[];
        const lastLeadMessage = [...history].reverse().find((row) => row.role === 'lead')?.content ?? '';
        console.log('[ai-autonomous-reply-worker] contexto pronto para gerar resposta', {
          jobId: job.id,
          chatId: chat.id,
          leadId,
          historyRows: history.length,
          styleRows: styleMessages.length,
          quickReplies: quickReplies.length,
          lastLeadMessagePreview: lastLeadMessage.slice(0, 120),
        });
        const similarSituations = await fetchSimilarSituations(supabaseAdmin, lastLeadMessage, 4);
        const referenceBlock = buildReferencePrompt(quickReplies, similarSituations);
        const autonomousConfig = await loadFeatureConfig(supabaseAdmin, AI_FEATURES.AUTONOMOUS_REPLY);
        const styleMessagesForPrompt = styleMessagesResult.error ? [] : styleMessages;
        const systemPrompt = [
          autonomousConfig.featurePrompt,
          '',
          buildStylePrompt(styleMessagesForPrompt),
          referenceBlock ? `\n${referenceBlock}` : '',
        ].filter(Boolean).join('\n');
        const leadFirstName = getReliableLeadFirstName(leadResult.data?.nome_completo);
        const userPrompt = buildReplyUserPrompt(history, {
          isFirstLeadReplyAfterApproach: history.filter((row) => row.role === 'lead').length === 1,
          leadFirstName: leadFirstName ?? undefined,
        });

        const result = await generateTextWithRouting({
          supabaseAdmin,
          task: 'autonomous_attendance',
          systemPrompt,
          userPrompt,
          temperature: autonomousConfig.temperature || 0.6,
          maxTokens: autonomousConfig.maxOutputTokens || 350,
        });

        const { messages, handoffCode } = splitGeneratedReply(result.text, false);
        if (messages.length === 0) throw new Error('A IA nao retornou uma resposta valida.');
        console.log('[ai-autonomous-reply-worker] resposta gerada', {
          jobId: job.id,
          chatId: chat.id,
          leadId,
          messageCount: messages.length,
          handoffCode: handoffCode ?? null,
        });

        const chatRoute = await resolveCommWhatsAppCanonicalChatRouteByUuid(supabaseAdmin, chat.id);
        if (!chatRoute || chatRoute.identityConflict) {
          throw new Error('Identidade do WhatsApp exige revisao manual antes do envio automatico.');
        }
        if (chatRoute.leadId && chatRoute.leadId !== leadId) {
          throw new Error('A identidade WhatsApp esta vinculada a outro lead.');
        }

        for (let i = 0; i < messages.length; i++) {
          await sendAutonomousWhatsAppText({
            supabaseAdmin,
            channelId: channel.id,
            chatRoute,
            text: messages[i],
            channelPhone: channel.phone_number,
            channelName: channel.connected_user_name,
          });
          if (i < messages.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, MESSAGE_SEND_DELAY_MS));
          }
        }

        if (handoffCode) {
          await supabaseAdmin
            .from('comm_whatsapp_chats')
            .update({ autonomous_attendance_status: 'handed_off' })
            .eq('id', chat.id);

          const targetStatusName = HANDOFF_STATUS_TARGET[handoffCode];
          if (targetStatusName) {
            const { data: statuses } = await supabaseAdmin.from('lead_status_config').select('id, nome');
            const normalizedTarget = normalizeText(targetStatusName);
            const statusRow = (statuses ?? []).find(
              (s: { id: string; nome: string }) => normalizeText(s.nome) === normalizedTarget,
            );
            if (statusRow) {
              await supabaseAdmin.from('leads').update({ status_id: statusRow.id }).eq('id', leadId);
            } else {
              console.error('[ai-autonomous-reply-worker] status de handoff nao encontrado', {
                leadId,
                handoffCode,
                targetStatusName,
              });
            }
          }
        }

        await supabaseAdmin
          .from('ai_autonomous_reply_jobs')
          .update({ status: 'completed', last_error: null })
          .eq('id', job.id);

        processed += 1;
        console.log('[ai-autonomous-reply-worker] job concluido', {
          jobId: job.id,
          chatId: chat.id,
          leadId,
          sentMessages: messages.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[ai-autonomous-reply-worker] erro ao processar job', { jobId: job.id, error: message });
        await supabaseAdmin
          .from('ai_autonomous_reply_jobs')
          .update({ status: 'failed', last_error: message })
          .eq('id', job.id);
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[ai-autonomous-reply-worker] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao processar respostas autonomas.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
