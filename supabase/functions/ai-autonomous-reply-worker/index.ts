import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import {
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
import type { MessageRow } from '../_shared/comm-whatsapp-transcript.ts';
import {
  buildReferencePrompt,
  buildReplyUserPrompt,
  buildSystemPrompt,
  fetchQuickReplies,
  fetchSimilarSituations,
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
    const nowIso = new Date().toISOString();

    // Self-healing: jobs travados em 'processing' (funcao caiu no meio) voltam a pending.
    await supabaseAdmin
      .from('ai_autonomous_reply_jobs')
      .update({ status: 'pending', last_error: 'Job reiniciado (processamento interrompido)' })
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('ai_autonomous_reply_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (jobsError) throw new Error(`Erro ao buscar jobs pendentes: ${jobsError.message}`);
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), { status: 200, headers: jsonHeaders });
    }

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
      if (!claimed) continue;

      try {
        const { data: chat, error: chatError } = await supabaseAdmin
          .from('comm_whatsapp_chats')
          .select('id, autonomous_attendance_status, lead_id')
          .eq('id', job.chat_id)
          .maybeSingle();
        if (chatError) throw new Error(`Erro ao carregar chat: ${chatError.message}`);

        if (!chat || chat.autonomous_attendance_status !== 'active') {
          await supabaseAdmin
            .from('ai_autonomous_reply_jobs')
            .update({ status: 'cancelled', last_error: 'Atendimento autonomo nao esta mais ativo neste chat.' })
            .eq('id', job.id);
          continue;
        }

        const leadId: string | null = chat.lead_id ?? job.lead_id;
        if (!leadId) {
          await supabaseAdmin
            .from('ai_autonomous_reply_jobs')
            .update({ status: 'cancelled', last_error: 'Chat sem lead vinculado.' })
            .eq('id', job.id);
          continue;
        }

        const [historyResult, styleMessagesResult, quickReplies] = await Promise.all([
          supabaseAdmin
            .from('comm_whatsapp_messages')
            .select('direction, text_content')
            .eq('chat_id', chat.id)
            .eq('message_type', 'text')
            .neq('delivery_status', 'failed')
            .not('text_content', 'is', null)
            .order('message_at', { ascending: true })
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
        ]);

        if (historyResult.error) throw new Error(`Erro ao carregar historico: ${historyResult.error.message}`);

        const history: SandboxMessageRow[] = (historyResult.data ?? [])
          .map((row: { direction: string; text_content: string | null }) => ({
            role: row.direction === 'inbound' ? ('lead' as const) : ('ai' as const),
            content: (row.text_content ?? '').trim(),
          }))
          .filter((row) => row.content.length > 0);

        if (history.length === 0 || history[history.length - 1].role !== 'lead') {
          // Nada novo do lead pra responder (ex: a ultima mensagem ja e nossa) — nada a fazer.
          await supabaseAdmin
            .from('ai_autonomous_reply_jobs')
            .update({ status: 'cancelled', last_error: 'Sem mensagem pendente do lead para responder.' })
            .eq('id', job.id);
          continue;
        }

        const styleMessages = (styleMessagesResult.data ?? []) as MessageRow[];
        const lastLeadMessage = [...history].reverse().find((row) => row.role === 'lead')?.content ?? '';
        const similarSituations = await fetchSimilarSituations(supabaseAdmin, lastLeadMessage, 4);
        const referenceBlock = buildReferencePrompt(quickReplies, similarSituations);
        const systemPrompt = buildSystemPrompt(styleMessagesResult.error ? [] : styleMessages, referenceBlock);
        const userPrompt = buildReplyUserPrompt(history);

        const result = await generateTextWithRouting({
          supabaseAdmin,
          task: 'autonomous_attendance',
          systemPrompt,
          userPrompt,
          temperature: 0.6,
          maxTokens: 350,
        });

        const { messages, handoffCode } = splitGeneratedReply(result.text, false);
        if (messages.length === 0) throw new Error('A IA nao retornou uma resposta valida.');

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
