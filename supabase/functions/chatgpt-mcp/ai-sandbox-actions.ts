import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SCENARIO_KEY = /^[a-zA-Z0-9_-]{1,80}$/;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });

const READ_NAMES = ['kifer_list_ai_sandbox_conversations', 'kifer_get_ai_sandbox_conversation'] as const;
const WRITE_NAMES = [
  'kifer_create_ai_sandbox_conversation', 'kifer_rename_ai_sandbox_conversation', 'kifer_delete_ai_sandbox_conversation',
  'kifer_send_ai_sandbox_message', 'kifer_start_ai_sandbox_approach', 'kifer_run_ai_sandbox_scenario',
] as const;
const confirmTrue = { type: 'boolean', const: true, description: 'Confirma explicitamente a geração de IA ou exclusão.' } as const;
const conversationIdSchema = { type: 'string', format: 'uuid' } as const;

export const MCP_AI_SANDBOX_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_list_ai_sandbox_conversations', description: 'Lista simulações de atendimento da bancada de IA com paginação. Não lista nem altera conversas reais de WhatsApp.', inputSchema: { type: 'object', additionalProperties: false, properties: { page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 50, default: 20 }, automated: { type: 'boolean' } } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_get_ai_sandbox_conversation', description: 'Lê mensagens e a avaliação mais recente de uma simulação da bancada de IA. Máximo de 200 mensagens por resposta.', inputSchema: { type: 'object', required: ['conversation_id'], additionalProperties: false, properties: { conversation_id: conversationIdSchema } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_create_ai_sandbox_conversation', description: 'Cria uma conversa vazia na bancada de IA para simular um atendimento. Não cria conversa real de WhatsApp.', inputSchema: { type: 'object', required: ['title'], additionalProperties: false, properties: { title: { type: 'string', minLength: 1, maxLength: 160 } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_rename_ai_sandbox_conversation', description: 'Renomeia uma simulação usando expected_updated_at para evitar sobrescrever alteração concorrente.', inputSchema: { type: 'object', required: ['conversation_id', 'expected_updated_at', 'title'], additionalProperties: false, properties: { conversation_id: conversationIdSchema, expected_updated_at: { type: 'string', format: 'date-time' }, title: { type: 'string', minLength: 1, maxLength: 160 } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_delete_ai_sandbox_conversation', description: 'Exclui uma simulação e seu histórico da bancada. Não afeta conversas do WhatsApp. Requer expected_updated_at e confirm_delete=true.', inputSchema: { type: 'object', required: ['conversation_id', 'expected_updated_at', 'confirm_delete'], additionalProperties: false, properties: { conversation_id: conversationIdSchema, expected_updated_at: { type: 'string', format: 'date-time' }, confirm_delete: confirmTrue } }, annotations: { readOnlyHint: false, destructiveHint: true } },
  { name: 'kifer_send_ai_sandbox_message', description: 'Salva uma mensagem de lead simulada e pede uma resposta ao modelo configurado. Gera custo de IA e salva conteúdo no histórico; use somente com pedido explícito e confirm_ai_generation=true. Não envia WhatsApp.', inputSchema: { type: 'object', required: ['conversation_id', 'message', 'confirm_ai_generation'], additionalProperties: false, properties: { conversation_id: conversationIdSchema, message: { type: 'string', minLength: 1, maxLength: 4000 }, lead_name: { type: 'string', maxLength: 120 }, confirm_ai_generation: confirmTrue } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_start_ai_sandbox_approach', description: 'Gera e salva a abordagem inicial configurada para uma simulação. Não envia WhatsApp; use somente com pedido explícito e confirm_ai_generation=true.', inputSchema: { type: 'object', required: ['conversation_id', 'confirm_ai_generation'], additionalProperties: false, properties: { conversation_id: conversationIdSchema, lead_name: { type: 'string', maxLength: 120 }, confirm_ai_generation: confirmTrue } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_run_ai_sandbox_scenario', description: 'Executa cenário automatizado para testar o atendimento e a avaliação da IA. Pode fazer várias chamadas a modelos e gerar custo. Máximo de 8 turnos. Requer confirm_ai_generation=true; não envia WhatsApp.', inputSchema: { type: 'object', required: ['scenario_key', 'scenario_label', 'lead_persona_prompt', 'confirm_ai_generation'], additionalProperties: false, properties: { scenario_key: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[a-zA-Z0-9_-]{1,80}$' }, scenario_label: { type: 'string', minLength: 1, maxLength: 160 }, lead_persona_prompt: { type: 'string', minLength: 1, maxLength: 4000 }, start_mode: { type: 'string', enum: ['ai_opens', 'lead_opens'], default: 'lead_opens' }, first_lead_message: { type: 'string', maxLength: 1000 }, lead_name: { type: 'string', maxLength: 120 }, max_turns: { type: 'integer', minimum: 1, maximum: 8, default: 8 }, confirm_ai_generation: confirmTrue } }, annotations: { readOnlyHint: false, openWorldHint: true } },
] as const;

export const MCP_AI_SANDBOX_READ_TOOL_NAMES = READ_NAMES;
export const MCP_AI_SANDBOX_WRITE_TOOL_NAMES = WRITE_NAMES;

const audit = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, result: McpWriteResult, request: Record<string, unknown>) => {
  const { error } = await supabase.from('mcp_action_audit_log').insert({
    tool_name: toolName,
    action_type: toolName.replace(/^kifer_/, '').replaceAll('_', '-'),
    actor: actor.actor,
    actor_id: actor.actorId,
    request_payload: request,
    result_payload: { success: result.success, error_code: result.error_code ?? null },
    success: result.success,
    error_message: result.success ? null : text(result.message) || null,
    source: 'chatgpt_mcp',
  });
  if (error) console.error('[chatgpt-mcp] falha ao auditar bancada de IA:', error.message);
};

const bounds = (args: Record<string, unknown>) => {
  const page = Number(args.page ?? 1);
  const pageSize = Number(args.page_size ?? 20);
  return Number.isInteger(page) && page >= 1 && page <= 10000 && Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 50
    ? { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 }
    : null;
};

export async function executeMcpAiSandboxReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown> }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args } = params;
  if (!READ_NAMES.includes(toolName as (typeof READ_NAMES)[number])) return null;
  if (toolName === 'kifer_list_ai_sandbox_conversations') {
    const page = bounds(args);
    if (!page) return fail('INVALID_INPUT', 'Paginação inválida.');
    let query = supabase.from('ai_sandbox_conversations').select('id,title,created_by,is_automated,created_at,updated_at', { count: 'exact' });
    if (typeof args.automated === 'boolean') query = query.eq('is_automated', args.automated);
    const { data, count, error } = await query.order('updated_at', { ascending: false }).range(page.from, page.to);
    return error ? fail('DATABASE_ERROR', 'Não foi possível consultar as simulações.') : { success: true, conversations: data ?? [], page: page.page, page_size: page.pageSize, total: count ?? 0 };
  }
  const conversationId = text(args.conversation_id);
  if (!UUID.test(conversationId)) return fail('INVALID_INPUT', 'conversation_id inválido.');
  const { data: conversation, error: conversationError } = await supabase.from('ai_sandbox_conversations').select('id,title,created_by,is_automated,created_at,updated_at').eq('id', conversationId).maybeSingle();
  if (conversationError) return fail('DATABASE_ERROR', 'Não foi possível consultar a simulação.');
  if (!conversation) return fail('NOT_FOUND', 'Simulação não encontrada.');
  const [messagesResult, runResult] = await Promise.all([
    supabase.from('ai_sandbox_messages').select('id,conversation_id,role,content,handoff_reason,handoff_code,provider,model,created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(200),
    supabase.from('ai_sandbox_test_runs').select('id,conversation_id,scenario_key,scenario_label,turns,handoff_triggered,handoff_code,passed,verdict,provider,model,created_at').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (messagesResult.error || runResult.error) return fail('DATABASE_ERROR', 'Não foi possível carregar o histórico da simulação.');
  return { success: true, conversation, messages: messagesResult.data ?? [], latest_test_run: runResult.data ?? null, messages_truncated: (messagesResult.data?.length ?? 0) === 200 };
}

export async function executeMcpAiSandboxWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!WRITE_NAMES.includes(toolName as (typeof WRITE_NAMES)[number])) return null;
  const conversationId = text(args.conversation_id);
  const request: Record<string, unknown> = {
    conversation_id: UUID.test(conversationId) ? conversationId : undefined,
    argument_keys: Object.keys(args).sort(),
  };
  let result: McpWriteResult;

  if (toolName === 'kifer_create_ai_sandbox_conversation') {
    const title = text(args.title);
    request.title_length = title.length;
    if (!title || title.length > 160) result = fail('INVALID_INPUT', 'title é obrigatório e deve ter até 160 caracteres.');
    else {
      const { data, error } = await supabase.from('ai_sandbox_conversations').insert({ title, created_by: actor.actorId, is_automated: false }).select('id,title,created_by,is_automated,created_at,updated_at').single();
      result = error ? fail('DATABASE_ERROR', 'Não foi possível criar a simulação.') : { success: true, conversation: data };
    }
  } else if (toolName === 'kifer_rename_ai_sandbox_conversation') {
    const title = text(args.title);
    const expected = text(args.expected_updated_at);
    request.title_length = title.length;
    if (!UUID.test(conversationId) || !title || title.length > 160 || !Number.isFinite(Date.parse(expected))) result = fail('INVALID_INPUT', 'conversation_id, title e expected_updated_at válidos são obrigatórios.');
    else {
      const { data, error } = await supabase.from('ai_sandbox_conversations').update({ title, updated_at: new Date().toISOString() }).eq('id', conversationId).eq('updated_at', expected).select('id,title,created_by,is_automated,created_at,updated_at').maybeSingle();
      result = error ? fail('DATABASE_ERROR', 'Não foi possível renomear a simulação.') : data ? { success: true, conversation: data } : fail('CONFLICT', 'A simulação mudou desde a consulta.');
    }
  } else if (toolName === 'kifer_delete_ai_sandbox_conversation') {
    const expected = text(args.expected_updated_at);
    if (!UUID.test(conversationId) || !Number.isFinite(Date.parse(expected)) || args.confirm_delete !== true) result = fail('CONFIRMATION_REQUIRED', 'conversation_id, expected_updated_at e confirm_delete=true são obrigatórios.');
    else {
      const { data, error } = await supabase.from('ai_sandbox_conversations').delete().eq('id', conversationId).eq('updated_at', expected).select('id').maybeSingle();
      result = error ? fail('DATABASE_ERROR', 'Não foi possível excluir a simulação.') : data ? { success: true, conversation_id: conversationId, deleted: true } : fail('CONFLICT', 'A simulação mudou desde a consulta.');
    }
  } else if (toolName === 'kifer_send_ai_sandbox_message') {
    const message = typeof args.message === 'string' ? args.message.trim() : '';
    const leadName = text(args.lead_name).slice(0, 120);
    request.message_length = message.length;
    request.lead_name_provided = Boolean(leadName);
    if (!UUID.test(conversationId) || !message || message.length > 4000 || args.confirm_ai_generation !== true) result = fail('CONFIRMATION_REQUIRED', 'conversation_id, message válida e confirm_ai_generation=true são obrigatórios.');
    else {
      const conversation = await getConversation(supabase, conversationId);
      if (conversation.error) result = fail('DATABASE_ERROR', 'Não foi possível consultar a simulação.');
      else if (!conversation.data) result = fail('NOT_FOUND', 'Simulação não encontrada.');
      else if (conversation.data.is_automated === true) result = fail('AUTOMATED_CONVERSATION', 'Envie mensagens somente para simulações manuais.');
      else {
        const { error: insertError } = await supabase.from('ai_sandbox_messages').insert({ conversation_id: conversationId, role: 'lead', content: message });
        if (insertError) result = fail('DATABASE_ERROR', 'Não foi possível registrar a mensagem na simulação.');
        else {
          const { data, error } = await supabase.functions.invoke('ai-sandbox-chat', { body: { conversationId, leadName }, headers: { 'X-Kifer-MCP-Actor-Id': actor.actorId } });
          if (error || !isRecord(data) || data.error) result = { ...fail('AI_GENERATION_FAILED', 'A mensagem de simulação foi salva, mas a geração não terminou. Consulte o histórico antes de tentar novamente.'), conversation_id: conversationId, message_recorded: true };
          else result = { success: true, conversation_id: conversationId, messages: data.messages ?? [], handoff_code: data.handoffCode ?? null, handoff_reason: data.handoffReason ?? null, provider: data.provider ?? null, model: data.model ?? null };
        }
      }
    }
  } else if (toolName === 'kifer_start_ai_sandbox_approach') {
    const leadName = text(args.lead_name).slice(0, 120);
    request.lead_name_provided = Boolean(leadName);
    if (!UUID.test(conversationId) || args.confirm_ai_generation !== true) result = fail('CONFIRMATION_REQUIRED', 'conversation_id e confirm_ai_generation=true são obrigatórios.');
    else {
      const conversation = await getConversation(supabase, conversationId);
      if (conversation.error) result = fail('DATABASE_ERROR', 'Não foi possível consultar a simulação.');
      else if (!conversation.data) result = fail('NOT_FOUND', 'Simulação não encontrada.');
      else if (conversation.data.is_automated === true) result = fail('AUTOMATED_CONVERSATION', 'A abordagem inicial manual não é aceita em conversas automatizadas.');
      else {
        const { data, error } = await supabase.functions.invoke('ai-sandbox-chat', { body: { conversationId, leadName, startWithApproach: true }, headers: { 'X-Kifer-MCP-Actor-Id': actor.actorId } });
        result = error || !isRecord(data) || data.error ? fail('AI_GENERATION_FAILED', 'Não foi possível gerar a abordagem inicial.') : { success: true, conversation_id: conversationId, messages: data.messages ?? [], provider: data.provider ?? null, model: data.model ?? null };
      }
    }
  } else {
    const scenarioKey = text(args.scenario_key);
    const scenarioLabel = text(args.scenario_label);
    const personaPrompt = typeof args.lead_persona_prompt === 'string' ? args.lead_persona_prompt.trim() : '';
    const maxTurns = Number(args.max_turns ?? 8);
    request.scenario_key = SCENARIO_KEY.test(scenarioKey) ? scenarioKey : undefined;
    request.persona_prompt_length = personaPrompt.length;
    request.max_turns = maxTurns;
    if (!SCENARIO_KEY.test(scenarioKey) || !scenarioLabel || scenarioLabel.length > 160 || !personaPrompt || personaPrompt.length > 4000 || !Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 8 || args.confirm_ai_generation !== true) result = fail('INVALID_INPUT', 'Cenário inválido, limite máximo de 8 turnos ou confirmação de geração ausente.');
    else {
      const { data, error } = await supabase.functions.invoke('ai-sandbox-run-scenario', {
        body: { scenarioKey, scenarioLabel, leadPersonaPrompt: personaPrompt, startMode: args.start_mode === 'ai_opens' ? 'ai_opens' : 'lead_opens', firstLeadMessage: text(args.first_lead_message), leadName: text(args.lead_name).slice(0, 120), maxTurns },
        headers: { 'X-Kifer-MCP-Actor-Id': actor.actorId },
      });
      result = error || !isRecord(data) || data.error ? fail('AI_SCENARIO_FAILED', 'Não foi possível concluir a simulação. Consulte o histórico antes de executar novamente.') : { success: true, ...data };
    }
  }

  await audit(supabase, actor, toolName, result, request);
  return result;
}

async function getConversation(supabase: SupabaseClient, conversationId: string) {
  return supabase.from('ai_sandbox_conversations').select('id,title,created_by,is_automated,created_at,updated_at').eq('id', conversationId).maybeSingle();
}
