import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const confirm = (description: string) => ({ type: 'boolean', const: true, description });

const TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_edit_whatsapp_message', description: 'Edita uma mensagem outbound que ainda pode ser alterada no WhatsApp. A alteração é externa e não idempotente; exige confirm_edit=true.', inputSchema: { type: 'object', required: ['message_id', 'text', 'confirm_edit'], additionalProperties: false, properties: { message_id: { type: 'string', format: 'uuid' }, text: { type: 'string', minLength: 1, maxLength: 4096 }, confirm_edit: confirm('Confirma explicitamente a edição da mensagem real.') } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_delete_whatsapp_message', description: 'Apaga no WhatsApp uma mensagem outbound elegível; preserva o marcador de exclusão no histórico do CRM. A ação é externa e exige confirm_delete=true.', inputSchema: { type: 'object', required: ['message_id', 'confirm_delete'], additionalProperties: false, properties: { message_id: { type: 'string', format: 'uuid' }, confirm_delete: confirm('Confirma explicitamente a exclusão da mensagem real.') } }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true } },
  { name: 'kifer_set_whatsapp_message_reaction', description: 'Define ou remove a reação da conta conectada numa mensagem. Use emoji=null para remover; exige confirm_reaction=true.', inputSchema: { type: 'object', required: ['message_id', 'emoji', 'confirm_reaction'], additionalProperties: false, properties: { message_id: { type: 'string', format: 'uuid' }, emoji: { type: ['string', 'null'], maxLength: 32 }, confirm_reaction: confirm('Confirma explicitamente a alteração da reação no WhatsApp.') } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_set_whatsapp_message_starred', description: 'Marca ou desmarca a estrela de uma mensagem no WhatsApp. Exige confirm_change=true.', inputSchema: { type: 'object', required: ['message_id', 'starred', 'confirm_change'], additionalProperties: false, properties: { message_id: { type: 'string', format: 'uuid' }, starred: { type: 'boolean' }, confirm_change: confirm('Confirma explicitamente a alteração da estrela no WhatsApp.') } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_forward_whatsapp_message', description: 'Encaminha uma mensagem para uma conversa existente do Inbox. Aceita um único destino por chamada para que cada envio externo tenha resultado próprio; exige confirm_forward=true.', inputSchema: { type: 'object', required: ['message_id', 'target_chat_id', 'confirm_forward'], additionalProperties: false, properties: { message_id: { type: 'string', format: 'uuid' }, target_chat_id: { type: 'string', format: 'uuid' }, confirm_forward: confirm('Confirma explicitamente o encaminhamento de conteúdo real ao contato de destino.') } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_transcribe_whatsapp_audio', description: 'Transcreve áudio ou nota de voz e salva a transcrição no histórico do CRM. Pode enviar o áudio a um provedor de IA configurado e gerar custo; exige confirm_ai_processing=true. force=true substitui uma transcrição anterior.', inputSchema: { type: 'object', required: ['message_id', 'confirm_ai_processing'], additionalProperties: false, properties: { message_id: { type: 'string', format: 'uuid' }, force: { type: 'boolean', default: false }, confirm_ai_processing: confirm('Confirma o processamento do áudio por IA e a gravação da transcrição.') } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_retry_whatsapp_media', description: 'Tenta enviar novamente uma mídia outbound com falha usando o caminho de retry do Inbox, permissões de contato e idempotência. Pode enviar conteúdo real; exige confirm_resend=true e client_request_id estável.', inputSchema: { type: 'object', required: ['message_id', 'client_request_id', 'confirm_resend'], additionalProperties: false, properties: { message_id: { type: 'string', format: 'uuid' }, client_request_id: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[A-Za-z0-9:_-]{1,80}$' }, confirm_resend: confirm('Confirma explicitamente uma nova tentativa de envio ao contato.') } }, annotations: { readOnlyHint: false, openWorldHint: true } },
] as const;

export const MCP_WHATSAPP_MESSAGE_TOOLS = TOOLS;
export const MCP_WHATSAPP_MESSAGE_WRITE_TOOL_NAMES = TOOLS.map(({ name }) => name);
const TOOL_ARGUMENTS: Record<string, readonly string[]> = {
  kifer_edit_whatsapp_message: ['message_id', 'text', 'confirm_edit'],
  kifer_delete_whatsapp_message: ['message_id', 'confirm_delete'],
  kifer_set_whatsapp_message_reaction: ['message_id', 'emoji', 'confirm_reaction'],
  kifer_set_whatsapp_message_starred: ['message_id', 'starred', 'confirm_change'],
  kifer_forward_whatsapp_message: ['message_id', 'target_chat_id', 'confirm_forward'],
  kifer_transcribe_whatsapp_audio: ['message_id', 'force', 'confirm_ai_processing'],
  kifer_retry_whatsapp_media: ['message_id', 'client_request_id', 'confirm_resend'],
};

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
  if (error) console.error('[chatgpt-mcp] falha ao auditar ação de mensagem WhatsApp:', error.message);
};

async function invoke(supabase: SupabaseClient, functionName: string, body: Record<string, unknown>, actor: McpWriteActor) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { 'X-Kifer-MCP-Actor-Id': actor.actorId },
  });
  if (error || !isRecord(data) || data.error || data.success === false) return null;
  return data;
}

export async function executeMcpWhatsAppMessageWriteAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Record<string, unknown>;
  actor: McpWriteActor;
}): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_WHATSAPP_MESSAGE_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  const messageId = text(args.message_id);
  const request: Record<string, unknown> = { message_id: UUID.test(messageId) ? messageId : undefined };
  let result: McpWriteResult;

  if (Object.keys(args).some((key) => !TOOL_ARGUMENTS[toolName]?.includes(key))) {
    result = fail('INVALID_INPUT', 'A ação contém campos não permitidos.');
  } else if (!UUID.test(messageId)) {
    result = fail('INVALID_INPUT', 'message_id deve ser um UUID válido.');
  } else if (toolName === 'kifer_edit_whatsapp_message') {
    const message = text(args.text);
    request.text_length = message.length;
    if (!message || message.length > 4096) result = fail('INVALID_INPUT', 'text deve conter de 1 a 4096 caracteres.');
    else if (args.confirm_edit !== true) result = fail('CONFIRMATION_REQUIRED', 'confirm_edit=true é obrigatório.');
    else {
      const data = await invoke(supabase, 'comm-whatsapp-manage-message', { messageId, action: 'edit', text: message }, actor);
      result = data ? { success: true, message_id: messageId, edited_at: data.editedAt ?? null } : fail('MESSAGE_EDIT_FAILED', 'Não foi possível confirmar a edição da mensagem. Consulte o histórico antes de tentar novamente.');
    }
  } else if (toolName === 'kifer_delete_whatsapp_message') {
    if (args.confirm_delete !== true) result = fail('CONFIRMATION_REQUIRED', 'confirm_delete=true é obrigatório.');
    else {
      const data = await invoke(supabase, 'comm-whatsapp-manage-message', { messageId, action: 'delete' }, actor);
      result = data ? { success: true, message_id: messageId, deleted_at: data.deletedAt ?? null } : fail('MESSAGE_DELETE_FAILED', 'Não foi possível confirmar a exclusão da mensagem. Consulte o histórico antes de tentar novamente.');
    }
  } else if (toolName === 'kifer_set_whatsapp_message_reaction') {
    const emoji = args.emoji === null ? '' : text(args.emoji);
    request.reaction_set = Boolean(emoji);
    if (args.emoji !== null && (typeof args.emoji !== 'string' || emoji.length > 32)) result = fail('INVALID_INPUT', 'emoji deve ser texto de até 32 caracteres ou null.');
    else if (args.confirm_reaction !== true) result = fail('CONFIRMATION_REQUIRED', 'confirm_reaction=true é obrigatório.');
    else {
      const row = await supabase.from('comm_whatsapp_messages').select('external_message_id').eq('id', messageId).maybeSingle();
      if (row.error || !isRecord(row.data) || !text(row.data.external_message_id)) result = fail(row.error ? 'DATABASE_ERROR' : 'NOT_FOUND', 'Não foi possível localizar a mensagem no canal WhatsApp.');
      else {
        const data = await invoke(supabase, 'comm-whatsapp-react', { messageId: text(row.data.external_message_id), emoji }, actor);
        result = data ? { success: true, message_id: messageId, reaction_set: Boolean(emoji) } : fail('MESSAGE_REACTION_FAILED', 'Não foi possível confirmar a reação. Consulte a mensagem antes de tentar novamente.');
      }
    }
  } else if (toolName === 'kifer_set_whatsapp_message_starred') {
    request.starred = typeof args.starred === 'boolean' ? args.starred : undefined;
    if (typeof args.starred !== 'boolean') result = fail('INVALID_INPUT', 'starred deve ser booleano.');
    else if (args.confirm_change !== true) result = fail('CONFIRMATION_REQUIRED', 'confirm_change=true é obrigatório.');
    else {
      const data = await invoke(supabase, 'comm-whatsapp-manage-message', { messageId, action: 'star', starred: args.starred }, actor);
      result = data ? { success: true, message_id: messageId, starred: data.starred === true, starred_at: data.starredAt ?? null } : fail('MESSAGE_STAR_FAILED', 'Não foi possível confirmar a alteração da estrela. Consulte a mensagem antes de tentar novamente.');
    }
  } else if (toolName === 'kifer_forward_whatsapp_message') {
    const chatId = text(args.target_chat_id);
    request.target_chat_id = UUID.test(chatId) ? chatId : undefined;
    if (!UUID.test(chatId)) result = fail('INVALID_INPUT', 'target_chat_id deve ser o UUID de uma conversa do Inbox.');
    else if (args.confirm_forward !== true) result = fail('CONFIRMATION_REQUIRED', 'confirm_forward=true é obrigatório.');
    else {
      const { data: chat, error } = await supabase.from('comm_whatsapp_chats').select('external_chat_id').eq('id', chatId).maybeSingle();
      if (error || !isRecord(chat) || !text(chat.external_chat_id)) result = fail(error ? 'DATABASE_ERROR' : 'NOT_FOUND', 'Conversa de destino não encontrada.');
      else {
        const data = await invoke(supabase, 'comm-whatsapp-manage-message', { messageId, action: 'forward', targetChatId: text(chat.external_chat_id) }, actor);
        result = data ? { success: true, message_id: messageId, target_chat_id: chatId, forwarded: Array.isArray(data.forwarded) ? data.forwarded.map((item: unknown) => isRecord(item) ? { status: text(item.status), message_id: text(item.messageId) || null } : null).filter(Boolean) : [] } : fail('MESSAGE_FORWARD_FAILED', 'Não foi possível confirmar o encaminhamento. Verifique a conversa de destino antes de repetir.');
      }
    }
  } else if (toolName === 'kifer_transcribe_whatsapp_audio') {
    request.force = args.force === true;
    if (args.force !== undefined && typeof args.force !== 'boolean') result = fail('INVALID_INPUT', 'force deve ser booleano.');
    else if (args.confirm_ai_processing !== true) result = fail('CONFIRMATION_REQUIRED', 'confirm_ai_processing=true é obrigatório.');
    else {
      const data = await invoke(supabase, 'comm-whatsapp-transcribe', { messageId, force: args.force === true }, actor);
      result = data ? { success: true, message_id: messageId, transcription_text: data.transcription_text ?? '', transcription_status: data.transcription_status ?? 'completed', provider: data.transcription_provider ?? null, model: data.transcription_model ?? null } : fail('TRANSCRIPTION_FAILED', 'Não foi possível transcrever o áudio.');
    }
  } else {
    const clientRequestId = text(args.client_request_id);
    request.client_request_id = clientRequestId || undefined;
    if (!/^[A-Za-z0-9:_-]{1,80}$/.test(clientRequestId)) result = fail('INVALID_INPUT', 'client_request_id deve ter de 1 a 80 caracteres alfanuméricos, hífen, sublinhado ou dois-pontos.');
    else if (args.confirm_resend !== true) result = fail('CONFIRMATION_REQUIRED', 'confirm_resend=true é obrigatório.');
    else {
      const namespacedRequestId = `mcp:${actor.actorId}:${clientRequestId}`;
      const data = await invoke(supabase, 'comm-whatsapp-retry-message', { messageId, clientRequestId: namespacedRequestId }, actor);
      result = data ? { success: true, message_id: data.messageId ?? null, status: data.status ?? 'pending', duplicate: data.duplicate === true } : fail('MESSAGE_RETRY_FAILED', 'Não foi possível confirmar a tentativa de envio. Consulte a conversa antes de tentar novamente.');
    }
  }

  await audit(supabase, actor, toolName, result, request);
  return result;
}
