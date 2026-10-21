import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const confirm = { type: 'boolean', const: true, description: 'Confirma explicitamente o processamento por IA.' } as const;
const chatIdSchema = { type: 'string', format: 'uuid' } as const;

export const MCP_WHATSAPP_AI_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_list_whatsapp_attendance_critiques', description: 'Lista as últimas análises salvas de atendimento de uma conversa, sem carregar mensagens brutas. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['chat_id'], additionalProperties: false, properties: { chat_id: chatIdSchema, limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 } } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_suggest_whatsapp_reply', description: 'Gera uma sugestão de resposta com o contexto da conversa e o rascunho atual. Usa o provedor de IA configurado, pode gerar custo e não envia a mensagem; exige confirm_ai_generation=true.', inputSchema: { type: 'object', required: ['chat_id', 'confirm_ai_generation'], additionalProperties: false, properties: { chat_id: chatIdSchema, composer_draft: { type: 'string', maxLength: 1800 }, mode: { type: 'string', enum: ['suggest_reply', 'complete_draft'] }, confirm_ai_generation: confirm } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_rewrite_whatsapp_message', description: 'Reescreve um rascunho para WhatsApp no tom escolhido. Pode enviar texto e contexto ao provedor de IA configurado, gera custo potencial e não envia a mensagem; exige confirm_ai_generation=true.', inputSchema: { type: 'object', required: ['message', 'confirm_ai_generation'], additionalProperties: false, properties: { message: { type: 'string', minLength: 1, maxLength: 4000 }, chat_id: { type: ['string', 'null'], format: 'uuid' }, tone: { type: 'string', enum: ['grammar', 'professional', 'friendly', 'shorter', 'assertive', 'adapt_context'] }, custom_instructions: { type: 'string', maxLength: 2000 }, confirm_ai_generation: confirm } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_generate_whatsapp_followup', description: 'Gera um rascunho de follow-up com o contexto comercial recente. Usa IA e pode gerar custo; não cria agendamento nem envia mensagem. Exige confirm_ai_generation=true.', inputSchema: { type: 'object', required: ['chat_id', 'confirm_ai_generation'], additionalProperties: false, properties: { chat_id: chatIdSchema, custom_instructions: { type: 'string', maxLength: 2000 }, confirm_ai_generation: confirm } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_refine_whatsapp_followup', description: 'Refina um rascunho de follow-up existente segundo uma instrução. Usa IA e pode gerar custo; não envia a mensagem. Exige confirm_ai_generation=true.', inputSchema: { type: 'object', required: ['chat_id', 'current_message', 'adjustment_instruction', 'confirm_ai_generation'], additionalProperties: false, properties: { chat_id: chatIdSchema, current_message: { type: 'string', minLength: 1, maxLength: 4000 }, adjustment_instruction: { type: 'string', minLength: 1, maxLength: 2000 }, confirm_ai_generation: confirm } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_critique_whatsapp_attendance', description: 'Analisa um atendimento, salva a crítica estruturada no CRM e retorna os pontos fortes, pontos de atenção e erros. Usa IA sobre o histórico da conversa, pode gerar custo e persiste a análise; exige confirm_ai_generation=true.', inputSchema: { type: 'object', required: ['chat_id', 'confirm_ai_generation'], additionalProperties: false, properties: { chat_id: chatIdSchema, confirm_ai_generation: confirm } }, annotations: { readOnlyHint: false, openWorldHint: true } },
];

export const MCP_WHATSAPP_AI_READ_TOOL_NAMES = ['kifer_list_whatsapp_attendance_critiques'] as const;
export const MCP_WHATSAPP_AI_WRITE_TOOL_NAMES = MCP_WHATSAPP_AI_TOOLS.filter((tool) => tool.annotations?.readOnlyHint === false).map(({ name }) => name);
const TOOL_ARGUMENTS: Record<string, readonly string[]> = {
  kifer_suggest_whatsapp_reply: ['chat_id', 'composer_draft', 'mode', 'confirm_ai_generation'],
  kifer_rewrite_whatsapp_message: ['message', 'chat_id', 'tone', 'custom_instructions', 'confirm_ai_generation'],
  kifer_generate_whatsapp_followup: ['chat_id', 'custom_instructions', 'confirm_ai_generation'],
  kifer_refine_whatsapp_followup: ['chat_id', 'current_message', 'adjustment_instruction', 'confirm_ai_generation'],
  kifer_critique_whatsapp_attendance: ['chat_id', 'confirm_ai_generation'],
};

const auditWrite = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, result: McpWriteResult, request: Record<string, unknown>) => {
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
  if (error) console.error('[chatgpt-mcp] falha ao auditar operação de IA do WhatsApp:', error.message);
};

async function invoke(supabase: SupabaseClient, functionName: string, body: Record<string, unknown>, actor: McpWriteActor) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { 'X-Kifer-MCP-Actor-Id': actor.actorId },
  });
  if (error || !isRecord(data) || data.error || data.success === false) return null;
  return data;
}

const safeCritique = (value: unknown) => {
  const critique = isRecord(value) ? value : {};
  const stringList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 2000)).slice(0, 20) : [];
  return {
    resumo: text(critique.resumo).slice(0, 4000),
    avaliacao_geral: ['excelente', 'bom', 'regular', 'ruim'].includes(text(critique.avaliacao_geral)) ? text(critique.avaliacao_geral) : 'regular',
    pontos_fortes: stringList(critique.pontos_fortes),
    pontos_de_atencao: stringList(critique.pontos_de_atencao),
    erros: stringList(critique.erros),
  };
};

export async function executeMcpWhatsAppAiReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_WHATSAPP_AI_READ_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  const chatId = text(args.chat_id);
  if (!UUID.test(chatId) || Object.keys(args).some((key) => !['chat_id', 'limit'].includes(key))) return fail('INVALID_INPUT', 'chat_id ou campos de consulta inválidos.');
  const limit = Number(args.limit ?? 5);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) return fail('INVALID_INPUT', 'limit deve estar entre 1 e 20.');
  const { data, error } = await supabase.from('comm_whatsapp_attendance_critiques')
    .select('id,chat_id,generated_by,generated_at,provider,model,session_started_at,session_ended_at,message_count,critique')
    .eq('chat_id', chatId).order('generated_at', { ascending: false }).limit(limit);
  if (error) return fail('DATABASE_ERROR', 'Não foi possível consultar as análises do atendimento.');
  const { error: auditError } = await supabase.from('chatgpt_mcp_audit_log').insert({ tool_name: toolName, actor: actor.actor, resource_name: 'comm_whatsapp_attendance_critiques', request_summary: { chat_id: chatId, limit } });
  if (auditError) console.error('[chatgpt-mcp] falha ao auditar leitura de análise WhatsApp:', auditError.message);
  const critiques = Array.isArray(data) ? data.filter(isRecord).map((row) => ({
    id: text(row.id),
    chat_id: chatId,
    generated_by: text(row.generated_by) || null,
    generated_at: text(row.generated_at),
    provider: text(row.provider),
    model: text(row.model),
    session_started_at: text(row.session_started_at),
    session_ended_at: text(row.session_ended_at),
    message_count: Number(row.message_count ?? 0),
    critique: safeCritique(row.critique),
  })) : [];
  return { success: true, critiques };
}

export async function executeMcpWhatsAppAiWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_WHATSAPP_AI_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  const request: Record<string, unknown> = {};
  let result: McpWriteResult;
  const chatId = text(args.chat_id);
  if (Object.keys(args).some((key) => !TOOL_ARGUMENTS[toolName]?.includes(key))) result = fail('INVALID_INPUT', 'A ação contém campos não permitidos.');
  else if (args.confirm_ai_generation !== true) result = fail('CONFIRMATION_REQUIRED', 'confirm_ai_generation=true é obrigatório.');
  else if (toolName !== 'kifer_rewrite_whatsapp_message' && !UUID.test(chatId)) result = fail('INVALID_INPUT', 'chat_id deve ser um UUID válido.');
  else if (toolName === 'kifer_suggest_whatsapp_reply') {
    const draft = text(args.composer_draft);
    const mode = args.mode === 'complete_draft' || (args.mode === undefined && draft) ? 'complete_draft' : 'suggest_reply';
    request.chat_id = chatId;
    request.mode = mode;
    request.draft_length = draft.length;
    if (draft.length > 1800 || (args.mode !== undefined && !['suggest_reply', 'complete_draft'].includes(text(args.mode)))) result = fail('INVALID_INPUT', 'composer_draft ou mode inválido.');
    else {
      const data = await invoke(supabase, 'comm-whatsapp-suggest-reply', { chatId, composerDraft: draft, mode }, actor);
      result = data ? { success: true, chat_id: chatId, text: text(data.text), mode: text(data.mode) || mode, provider: data.provider ?? null, model: data.model ?? null } : fail('AI_GENERATION_FAILED', 'Não foi possível gerar uma sugestão de resposta.');
    }
  } else if (toolName === 'kifer_rewrite_whatsapp_message') {
    const message = text(args.message);
    const instructions = text(args.custom_instructions);
    const tone = args.tone === undefined ? 'grammar' : text(args.tone);
    request.chat_id = UUID.test(chatId) ? chatId : null;
    request.tone = tone;
    request.message_length = message.length;
    request.instructions_length = instructions.length;
    const validTones = ['grammar', 'professional', 'friendly', 'shorter', 'assertive', 'adapt_context'];
    if (!message || message.length > 4000 || instructions.length > 2000 || !validTones.includes(tone) || (args.chat_id !== undefined && args.chat_id !== null && !UUID.test(chatId))) result = fail('INVALID_INPUT', 'message, chat_id, tone ou custom_instructions inválido.');
    else {
      const data = await invoke(supabase, 'comm-whatsapp-rewrite-message', { message, chatId: UUID.test(chatId) ? chatId : null, tone, customInstructions: instructions }, actor);
      result = data ? { success: true, text: text(data.text), provider: data.provider ?? null, model: data.model ?? null } : fail('AI_GENERATION_FAILED', 'Não foi possível reescrever a mensagem.');
    }
  } else if (toolName === 'kifer_generate_whatsapp_followup') {
    const instructions = text(args.custom_instructions);
    request.chat_id = chatId;
    request.instructions_length = instructions.length;
    if (instructions.length > 2000) result = fail('INVALID_INPUT', 'custom_instructions deve ter até 2000 caracteres.');
    else {
      const data = await invoke(supabase, 'comm-whatsapp-generate-follow-up', { chatId, customInstructions: instructions, triggerSource: 'individual' }, actor);
      result = data ? { success: true, chat_id: chatId, text: text(data.text) || null, variations: Array.isArray(data.variations) ? data.variations : [], current_action: data.currentAction ?? 'send', current_action_reason: data.currentActionReason ?? null, opportunity_recommendation: data.opportunityRecommendation ?? 'continue', schedule_recommendation: data.scheduleRecommendation ?? null, next_action: data.nextAction ?? null, generation_id: data.generationId ?? null, provider: data.provider ?? null, model: data.model ?? null } : fail('AI_GENERATION_FAILED', 'Não foi possível gerar o follow-up.');
    }
  } else if (toolName === 'kifer_refine_whatsapp_followup') {
    const currentMessage = text(args.current_message);
    const instruction = text(args.adjustment_instruction);
    request.chat_id = chatId;
    request.current_message_length = currentMessage.length;
    request.instruction_length = instruction.length;
    if (!currentMessage || currentMessage.length > 4000 || !instruction || instruction.length > 2000) result = fail('INVALID_INPUT', 'current_message e adjustment_instruction válidos são obrigatórios.');
    else {
      const data = await invoke(supabase, 'comm-whatsapp-generate-follow-up', { chatId, mode: 'refine', currentMessage, adjustmentInstruction: instruction }, actor);
      result = data ? { success: true, chat_id: chatId, text: text(data.text), provider: data.provider ?? null, model: data.model ?? null } : fail('AI_GENERATION_FAILED', 'Não foi possível refinar o follow-up.');
    }
  } else {
    request.chat_id = chatId;
    const data = await invoke(supabase, 'comm-whatsapp-critique-attendance', { chatId }, actor);
    result = data && isRecord(data.critique) ? { success: true, chat_id: chatId, critique: safeCritique(data.critique), generated_at: data.critique.generatedAt ?? null, provider: data.critique.provider ?? null, model: data.critique.model ?? null } : fail('AI_GENERATION_FAILED', 'Não foi possível gerar a análise do atendimento.');
  }
  await auditWrite(supabase, actor, toolName, result, request);
  return result;
}
