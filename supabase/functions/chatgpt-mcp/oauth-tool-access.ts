import type { McpToolDescriptor } from './mcp-discovery.ts';
import { toMcpToolResult } from './tool-result.ts';

export const MCP_FULL_ACCESS_SCOPES = ['kifer.read', 'kifer.write'] as const;

export const buildMcpOAuthChallenge = (resource: string, scopes: readonly string[] = MCP_FULL_ACCESS_SCOPES, insufficientScope = false): string =>
  `Bearer realm="Kifer Saude MCP", resource_metadata="${resource}/.well-known/oauth-protected-resource", scope="${[...new Set([...scopes, 'offline_access'])].join(' ')}"${insufficientScope ? ', error="insufficient_scope", error_description="Authorize read and write access to Kifer Saude"' : ''}`;

// Discovery describes capabilities, not the current token's permissions. Hiding
// a write here prevents the client from discovering its OAuth scope requirement.
export const getMcpDiscoverableTools = (tools: readonly McpToolDescriptor[]) => [...tools];

export function getMcpToolScopeError(tool: McpToolDescriptor | undefined, grantedScopes: ReadonlySet<string>, challenge: string) {
  if (!tool) return null;
  const requiredScopes = tool.securitySchemes?.flatMap((scheme) => scheme.scopes)
    ?? (tool.annotations?.readOnlyHint === true ? ['kifer.read'] : MCP_FULL_ACCESS_SCOPES);
  if (requiredScopes.every((scope) => grantedScopes.has(scope))) return null;
  return {
    ...toMcpToolResult({ success: false, error_code: 'INSUFFICIENT_SCOPE', reconnect_required: true, required_scopes: requiredScopes, message: 'A ação existe no CRM. Autorize leitura e escrita na conexão Kifer Saúde para executá-la; nenhuma alteração foi realizada.' }),
    isError: true,
    _meta: { 'mcp/www_authenticate': [challenge] },
  };
}

export const MCP_CONNECTION_ACCESS_TOOL: McpToolDescriptor = {
  name: 'kifer_get_connection_access',
  description: 'Diagnostica a autorização desta conexão: escopos concedidos, permissão de escrita e quantidade de ações disponíveis. Use quando uma ação parecer ausente ou bloqueada. O catálogo contém todas as ações; uma escrita sem escopo inicia o fluxo de autorização.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  annotations: { readOnlyHint: true },
};

export function getMcpConnectionAccess(grantedScopes: ReadonlySet<string>, tools: readonly McpToolDescriptor[], hasAdminOAuth: boolean) {
  const canWrite = hasAdminOAuth && MCP_FULL_ACCESS_SCOPES.every((scope) => grantedScopes.has(scope));
  return {
    success: true,
    authentication: hasAdminOAuth ? 'admin_oauth' : 'legacy_read_only',
    granted_scopes: [...grantedScopes].sort(),
    can_write: canWrite,
    reconnect_required_for_writes: !canWrite,
    required_write_scopes: MCP_FULL_ACCESS_SCOPES,
    tools: { total: tools.length, read: tools.filter((tool) => tool.annotations?.readOnlyHint === true).length, write: tools.filter((tool) => tool.annotations?.readOnlyHint !== true).length },
    next_step: canWrite ? 'Execute as ações solicitadas pelo usuário, individualmente ou em lote.' : 'A ferramenta de escrita retorna um desafio OAuth para autorizar leitura e escrita. Se o cliente ainda mostrar um catálogo antigo, atualize as ferramentas da conexão Kifer Saúde e reconecte com esses escopos.',
  };
}
