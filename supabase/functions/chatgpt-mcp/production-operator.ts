import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const COMMERCIAL_WRITE = /^kifer_(?:(?:send|schedule|bulk_schedule|update_scheduled|cancel_scheduled|retry_scheduled|upload_scheduled|create_interaction|create_reminder|update_reminder|complete_reminder|cancel_reminder|reschedule_reminders|reopen_reminder|delete_reminders|set_next_follow_up|create_lead|update_lead|bulk_update_lead|bulk_assign_lead|bulk_archive_lead)|.*contract|.*opportunity)/;

export const requiresProductionOperator = (name: string) => COMMERCIAL_WRITE.test(name);

export function withProductionOperator(tools: readonly McpToolDescriptor[]): McpToolDescriptor[] {
  return tools.map((tool) => {
    if (tool.annotations?.readOnlyHint !== false || !requiresProductionOperator(tool.name)) return tool;
    const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    return {
      ...tool,
      description: `${tool.description ?? ''} Informe operator_user_id de Nick ou Luiza explicitamente identificado nesta operação. A conta ChatGPT é compartilhada: nunca infira nem reutilize silenciosamente o operador. Consulte kifer_list_production_operators; se não informado, pergunte antes de executar.`,
      inputSchema: {
        ...schema,
        required: [...(schema.required ?? []), 'operator_user_id'],
        properties: { ...schema.properties,
          ...(tool.name.includes('contract') ? { sale_operator_user_id: { type: 'string', format: 'uuid', description: 'Responsável escolhido explicitamente para o crédito da venda. Obrigatório no primeiro fechamento (Emitido/Ativo); pode ser diferente do operador.' } } : {}),
          operator_user_id: { type: 'string', format: 'uuid', description: 'Atendente declarado para esta operação ou lote explicitamente solicitado. Não concede permissões.' } },
      },
    };
  });
}

export async function validateProductionOperator(client: SupabaseClient, operator: unknown) {
  if (typeof operator !== 'string' || !UUID.test(operator)) {
    return { success: false, error_code: 'OPERATOR_REQUIRED', message: 'Identifique Nick ou Luiza nesta operação e informe operator_user_id. Consulte kifer_list_production_operators.' };
  }
  const { data, error } = await client.from('production_operators').select('user_id').eq('user_id', operator).eq('active', true).maybeSingle();
  if (error) return { success: false, error_code: 'OPERATOR_UNAVAILABLE', message: 'Não foi possível validar o atendente. Nenhuma ação foi executada.' };
  if (!data) return { success: false, error_code: 'INVALID_OPERATOR', message: 'O atendente deve ser um usuário operacional ativo cadastrado.' };
  return null;
}

export const productionHeaders = (authorizer: string, operator: string, source: 'mcp' | 'crm' = 'mcp') => ({
  'X-Kifer-Production-Authorizer': authorizer,
  'X-Kifer-Production-Operator': operator,
  'X-Kifer-Production-Source': source,
});
