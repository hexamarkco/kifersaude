import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import { AI_FEATURES } from '../_shared/ai-feature-registry.ts';
import { loadFeatureConfig } from '../_shared/ai-config-resolver.ts';
import { corsHeaders, toTrimmedString } from '../_shared/comm-whatsapp.ts';
import type { MessageRow } from '../_shared/comm-whatsapp-transcript.ts';
import {
  buildOpeningUserPrompt,
  buildReferencePrompt,
  buildReplyUserPrompt,
  buildStylePrompt,
  fetchQuickReplies,
  fetchSimilarSituations,
  splitGeneratedReply,
  type SandboxMessageRow,
} from '../_shared/ai-sandbox-playbook.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type RequestBody = {
  conversationId?: string;
  leadName?: string;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const SANDBOX_HISTORY_LIMIT = 100;

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Credenciais do Supabase nao configuradas.');
  return createClient(supabaseUrl, serviceRoleKey);
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), { status: 405, headers: jsonHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAdmin = createAdminClient();

    const authResult = await authorizeDashboardUser({ req, supabaseUrl, supabaseAnonKey, supabaseAdmin });
    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), { status: authResult.status, headers: jsonHeaders });
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const conversationId = toTrimmedString(body.conversationId);
    const leadName = toTrimmedString(body.leadName).slice(0, 120);

    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'Conversa obrigatoria.' }), { status: 400, headers: jsonHeaders });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('ai_sandbox_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    if (existingError) throw new Error(`Erro ao carregar conversa: ${existingError.message}`);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Conversa nao encontrada.' }), { status: 404, headers: jsonHeaders });
    }

    // ---- Load full sandbox history + real style examples in parallel ----

    const [historyResult, styleMessagesResult, quickReplies] = await Promise.all([
      supabaseAdmin
        .from('ai_sandbox_messages')
        .select('role, content, handoff_reason, handoff_code')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(SANDBOX_HISTORY_LIMIT),
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

    const history = (historyResult.data ?? []) as (SandboxMessageRow & { handoff_reason: string | null; handoff_code: string | null })[];
    const isOpeningMode = history.length === 0;

    // Depois do handoff, a Luiza (IA) nao responde mais nessa conversa —
    // mesmo que o lead mande agradecimento ou qualquer outra mensagem. A
    // partir daqui e atendimento humano.
    const alreadyHandedOff = history.some((row) => row.role === 'ai' && Boolean(row.handoff_code));
    if (alreadyHandedOff) {
      return new Response(JSON.stringify({
        success: true,
        conversationId,
        messages: [],
        handoffCode: null,
        handoffReason: null,
        alreadyHandedOff: true,
      }), { status: 200, headers: jsonHeaders });
    }

    if (!isOpeningMode && history[history.length - 1].role !== 'lead') {
      return new Response(JSON.stringify({ error: 'A ultima mensagem ja foi respondida.' }), { status: 400, headers: jsonHeaders });
    }

    const styleMessages = (styleMessagesResult.data ?? []) as MessageRow[];

    const lastLeadMessage = isOpeningMode ? '' : [...history].reverse().find((row) => row.role === 'lead')?.content ?? '';
    const similarSituations = isOpeningMode ? [] : await fetchSimilarSituations(supabaseAdmin, lastLeadMessage, 4);
    const referenceBlock = buildReferencePrompt(quickReplies, similarSituations);

    const autonomousConfig = await loadFeatureConfig(supabaseAdmin, AI_FEATURES.AUTONOMOUS_REPLY).catch(() => null);
    const systemPrompt = [
      autonomousConfig?.featurePrompt,
      '',
      buildStylePrompt(styleMessagesResult.error ? [] : styleMessages),
      referenceBlock ? `\n${referenceBlock}` : '',
    ].filter(Boolean).join('\n');
    const userPrompt = isOpeningMode ? buildOpeningUserPrompt(leadName) : buildReplyUserPrompt(history);

    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'autonomous_attendance',
      systemPrompt,
      userPrompt,
      temperature: autonomousConfig?.temperature || 0.6,
      maxTokens: isOpeningMode ? (autonomousConfig?.maxOutputTokens || 450) : (autonomousConfig?.maxOutputTokens || 350),
    });

    const { messages: finalMessages, handoffCode, handoffNote } = splitGeneratedReply(result.text, isOpeningMode);
    if (finalMessages.length === 0) throw new Error('A IA nao retornou uma resposta valida.');

    const rowsToInsert = finalMessages.map((content, index) => ({
      conversation_id: conversationId,
      role: 'ai' as const,
      content,
      handoff_reason: index === finalMessages.length - 1 ? handoffNote : null,
      handoff_code: index === finalMessages.length - 1 ? handoffCode : null,
      provider: result.provider,
      model: result.model,
    }));

    const { error: insertAiError } = await supabaseAdmin
      .from('ai_sandbox_messages')
      .insert(rowsToInsert);
    if (insertAiError) throw new Error(`Erro ao salvar resposta da IA: ${insertAiError.message}`);

    await supabaseAdmin
      .from('ai_sandbox_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(JSON.stringify({
      success: true,
      conversationId,
      messages: finalMessages,
      handoffCode,
      handoffReason: handoffNote,
      provider: result.provider,
      model: result.model,
      fallbackUsed: result.fallbackUsed,
    }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[ai-sandbox-chat] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao gerar resposta.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
