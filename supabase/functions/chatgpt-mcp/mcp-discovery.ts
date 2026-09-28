export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema?: unknown;
  securitySchemes?: readonly McpToolSecurityScheme[];
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    openWorldHint?: boolean;
  };
};

export type McpToolSecurityScheme = {
  type: 'oauth2';
  scopes: readonly string[];
};

export const attachMcpOAuthSecuritySchemes = (
  tools: readonly McpToolDescriptor[],
): McpToolDescriptor[] => tools.map((tool) => ({
  ...tool,
  securitySchemes: [{ type: 'oauth2', scopes: ['kifer.read'] }],
}));

export type McpResourceDescriptor = {
  uri: string;
  name: string;
  title?: string;
  description: string;
  mimeType: string;
};

export type McpPromptArgument = {
  name: string;
  description: string;
  required?: boolean;
};

export type McpPromptDescriptor = {
  name: string;
  title: string;
  description: string;
  arguments?: readonly McpPromptArgument[];
};

export type McpTextResourceContents = {
  uri: string;
  mimeType: string;
  text: string;
};

export type McpPromptMessage = {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
};

export type McpPromptResult = {
  description: string;
  messages: readonly McpPromptMessage[];
};

export type McpDiscoveryFailure = {
  ok: false;
  code: 'NOT_FOUND' | 'INVALID_ARGUMENTS';
  message: string;
};

export type McpResourceReadResult =
  | { ok: true; contents: readonly McpTextResourceContents[] }
  | McpDiscoveryFailure;

export type McpPromptGetResult =
  | { ok: true; prompt: McpPromptResult }
  | McpDiscoveryFailure;

const RESOURCE_CATALOG_URI = 'kifer://capabilities/catalog';
const RESOURCE_AGENT_SAFETY_URI = 'kifer://guides/agent-safety';
const RESOURCE_WORKFLOWS_URI = 'kifer://guides/composable-workflows';

export const MCP_RESOURCES: readonly McpResourceDescriptor[] = [
  {
    uri: RESOURCE_CATALOG_URI,
    name: 'capabilities-catalog',
    title: 'Catálogo de capacidades do Kifer Saúde',
    description: 'Catálogo seguro e derivado do registry MCP: domínios, modos de interação e contagem de ferramentas.',
    mimeType: 'application/json',
  },
  {
    uri: RESOURCE_AGENT_SAFETY_URI,
    name: 'agent-safety-guide',
    title: 'Guia de operação segura para agentes',
    description: 'Regras operacionais que agentes devem seguir antes de consultar ou alterar o CRM.',
    mimeType: 'text/markdown',
  },
  {
    uri: RESOURCE_WORKFLOWS_URI,
    name: 'composable-workflows',
    title: 'Padrões de workflows compostos',
    description: 'Receitas para combinar descoberta, contexto, decisão e execução sem contornar as fronteiras do CRM.',
    mimeType: 'text/markdown',
  },
] as const;

export const MCP_PROMPTS: readonly McpPromptDescriptor[] = [
  {
    name: 'kifer_operational_triage',
    title: 'Triagem operacional do CRM',
    description: 'Orienta uma investigação operacional somente leitura antes de qualquer ação comercial.',
    arguments: [
      {
        name: 'focus',
        description: 'Área ou pergunta que deve orientar a triagem.',
        required: false,
      },
    ],
  },
  {
    name: 'kifer_lead_context_brief',
    title: 'Briefing de contexto de lead',
    description: 'Orienta a coleta e a síntese do contexto 360 de um lead sem alterar seus dados.',
    arguments: [
      {
        name: 'lead_id',
        description: 'Identificador do lead que deve ser consultado.',
        required: true,
      },
    ],
  },
  {
    name: 'kifer_safe_action_plan',
    title: 'Plano de ação seguro',
    description: 'Transforma um objetivo comercial em um plano verificável, separando leitura, confirmação e escrita.',
    arguments: [
      {
        name: 'objective',
        description: 'Objetivo comercial ou operacional que o agente deve planejar.',
        required: true,
      },
    ],
  },
  {
    name: 'kifer_followup_review',
    title: 'Revisão de follow-up',
    description: 'Orienta a revisão de contexto, consentimento e próximo passo antes de propor uma comunicação.',
    arguments: [
      {
        name: 'lead_id',
        description: 'Identificador do lead cujo follow-up será revisado.',
        required: true,
      },
    ],
  },
] as const;

const RESOURCE_BY_URI = new Map(MCP_RESOURCES.map((resource) => [resource.uri, resource]));
const PROMPT_BY_NAME = new Map(MCP_PROMPTS.map((prompt) => [prompt.name, prompt]));

const CATEGORY_RULES = [
  { key: 'communication', label: 'Comunicação e Inbox', pattern: /whatsapp|chat|message|media|identity|contact/i },
  { key: 'automation', label: 'Automações e follow-up', pattern: /automation|followup|scheduled|reminder|sequence/i },
  { key: 'commercial', label: 'CRM comercial', pattern: /lead|opportunity|contract|holder|dependent|document|commission|adjustment/i },
  { key: 'analytics', label: 'Consultas e analytics', pattern: /overview|audit|search|records|resources|360/i },
] as const;

const fallbackCategory = { key: 'governance', label: 'Governança e segurança' } as const;

const getCategory = (toolName: string) =>
  CATEGORY_RULES.find(({ pattern }) => pattern.test(toolName)) ?? fallbackCategory;

const isReadOnly = (tool: McpToolDescriptor): boolean => tool.annotations?.readOnlyHint === true;

const buildCapabilityCatalog = (tools: readonly McpToolDescriptor[]) => {
  const sortedTools = [...tools].sort((left, right) => left.name.localeCompare(right.name));
  const categories = new Map<string, { key: string; label: string; tool_names: string[] }>();

  for (const tool of sortedTools) {
    const category = getCategory(tool.name);
    const existing = categories.get(category.key) ?? { ...category, tool_names: [] };
    existing.tool_names.push(tool.name);
    categories.set(category.key, existing);
  }

  return {
    schema_version: 1,
    server: 'kifer-saude-crm',
    protocol: {
      modes: ['tools', 'resources', 'prompts'],
      tools: {
        total: sortedTools.length,
        read_only: sortedTools.filter(isReadOnly).length,
        write: sortedTools.filter((tool) => !isReadOnly(tool)).length,
      },
    },
    interaction_contract: {
      writes_require_explicit_user_intent: true,
      writes_require_active_admin_oauth: true,
      writes_are_audited: true,
      generic_sql_and_rpc_are_not_exposed: true,
      pii_and_credentials_are_not_discovered_through_this_catalog: true,
    },
    domains: [...categories.values()].map(({ key, label, tool_names }) => ({ key, label, tool_count: tool_names.length, tool_names })),
  };
};

const AGENT_SAFETY_GUIDE = `# Operação segura para agentes no Kifer Saúde

O MCP é uma fronteira de capacidades, não um túnel para o banco.

- Comece por "resources/list", "prompts/list" e "tools/list" para descobrir capacidades disponíveis.
- Use recursos e prompts para ganhar contexto e escolher um workflow; use ferramentas para consultas e ações concretas.
- Nunca invente SQL, RPC, tabela, identificador, URL assinada ou referência de Storage.
- Toda escrita exige intenção explícita do usuário. Ler contexto não autoriza enviar mensagens, criar registros ou alterar status.
- Antes de uma atualização, consulte o registro atual e use "expected_updated_at" quando a ferramenta exigir concorrência otimista.
- Use "client_request_id" estável em operações com risco de retry e trate resultados ambíguos como necessidade de consulta, não como autorização para repetir.
- Respeite consentimento, escopo de contato, limites comerciais e bloqueios de identidade; uma falha de validação deve parar o workflow.
- Não solicite nem tente descobrir credenciais, tokens, payloads brutos de webhook ou dados fora das projeções publicadas.
`;

const COMPOSABLE_WORKFLOWS_GUIDE = `# Workflows compostos

O agente pode combinar as primitivas MCP em ciclos pequenos e verificáveis:

1. **Descobrir** — leia o catálogo de capacidades e escolha um prompt ou ferramenta compatível com o objetivo.
2. **Contextualizar** — use um prompt para estruturar a pergunta e as ferramentas de leitura para buscar somente o contexto necessário.
3. **Planejar** — se houver mudança real, separe fatos observados, proposta de alteração, risco e confirmação necessária.
4. **Executar** — chame uma ferramenta de escrita estreita, com os identificadores e versões retornados pela leitura.
5. **Verificar** — leia o resultado ou o recurso correspondente e comunique sucesso, conflito, ambiguidade ou ação pendente.

Combinações úteis incluem triagem operacional + resumo 360, contexto de lead + revisão de follow-up, e leitura de contrato + ação administrativa explicitamente confirmada. A composição não amplia permissões: cada ferramenta mantém sua própria autorização, validação e auditoria.
`;

const normalizePromptArguments = (rawArguments: unknown): Record<string, string> => {
  if (rawArguments === undefined) return {};
  if (!rawArguments || typeof rawArguments !== 'object' || Array.isArray(rawArguments)) throw new Error('Os argumentos do prompt devem ser um objeto.');

  const argumentsRecord: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawArguments as Record<string, unknown>)) {
    if (typeof value !== 'string') throw new Error(`O argumento ${key} deve ser texto.`);
    argumentsRecord[key] = value.trim();
  }
  return argumentsRecord;
};

const requiredArgument = (argumentsRecord: Record<string, string>, name: string): string => {
  const value = argumentsRecord[name];
  if (!value) throw new Error(`O argumento obrigatório ${name} não foi informado.`);
  if (value.length > 4000) throw new Error(`O argumento ${name} excede o limite permitido.`);
  return value;
};

export const readMcpResource = (uriValue: unknown, tools: readonly McpToolDescriptor[]): McpResourceReadResult => {
  if (typeof uriValue !== 'string' || !uriValue.trim()) {
    return { ok: false, code: 'INVALID_ARGUMENTS', message: 'resources/read exige uma URI de recurso.' };
  }

  const uri = uriValue.trim();
  const resource = RESOURCE_BY_URI.get(uri);
  if (!resource) return { ok: false, code: 'NOT_FOUND', message: 'Recurso MCP não encontrado.' };

  if (uri === RESOURCE_CATALOG_URI) {
    return {
      ok: true,
      contents: [{ uri, mimeType: resource.mimeType, text: JSON.stringify(buildCapabilityCatalog(tools), null, 2) }],
    };
  }

  const text = uri === RESOURCE_AGENT_SAFETY_URI ? AGENT_SAFETY_GUIDE : COMPOSABLE_WORKFLOWS_GUIDE;
  return { ok: true, contents: [{ uri, mimeType: resource.mimeType, text }] };
};

export const getMcpPrompt = (nameValue: unknown, rawArguments: unknown): McpPromptGetResult => {
  if (typeof nameValue !== 'string' || !nameValue.trim()) {
    return { ok: false, code: 'INVALID_ARGUMENTS', message: 'prompts/get exige o nome de um prompt.' };
  }

  const name = nameValue.trim();
  const descriptor = PROMPT_BY_NAME.get(name);
  if (!descriptor) return { ok: false, code: 'NOT_FOUND', message: 'Prompt MCP não encontrado.' };

  let argumentsRecord: Record<string, string>;
  try {
    argumentsRecord = normalizePromptArguments(rawArguments);
    for (const argument of descriptor.arguments ?? []) {
      if (argument.required) requiredArgument(argumentsRecord, argument.name);
    }
  } catch (error) {
    return { ok: false, code: 'INVALID_ARGUMENTS', message: error instanceof Error ? error.message : 'Argumentos de prompt inválidos.' };
  }

  const focus = argumentsRecord.focus || 'a situação operacional apresentada pelo usuário';
  const leadId = argumentsRecord.lead_id || '<lead_id>';
  const objective = argumentsRecord.objective || '<objetivo informado pelo usuário>';

  const prompts: Record<string, McpPromptResult> = {
    kifer_operational_triage: {
      description: 'Fluxo de triagem operacional somente leitura.',
      messages: [{ role: 'user', content: { type: 'text', text: `Faça uma triagem operacional do Kifer Saúde com foco em: ${focus}. Comece lendo kifer://guides/agent-safety e kifer://capabilities/catalog. Depois use kifer_get_operational_overview e, se necessário, outras ferramentas de leitura. Não faça nenhuma escrita; apresente fatos, lacunas e próximos passos seguros.` } }],
    },
    kifer_lead_context_brief: {
      description: 'Fluxo de briefing 360 somente leitura.',
      messages: [{ role: 'user', content: { type: 'text', text: `Prepare um briefing do lead ${leadId}. Use kifer_get_lead_360 para buscar o contexto permitido e organize resumo comercial, estado atual, próximos retornos, riscos e perguntas em aberto. Não altere o lead, não envie mensagens e não exponha dados além do retorno autorizado pela ferramenta.` } }],
    },
    kifer_safe_action_plan: {
      description: 'Fluxo de planejamento com confirmação antes de escrita.',
      messages: [{ role: 'user', content: { type: 'text', text: `Planeje como atender ao objetivo: ${objective}. Primeiro identifique quais leituras são necessárias; depois descreva a alteração mínima, os identificadores, versões e riscos. Só execute ferramentas de escrita se o usuário confirmar explicitamente a ação concreta. Nunca use SQL, RPC arbitrária ou atualização genérica.` } }],
    },
    kifer_followup_review: {
      description: 'Fluxo de revisão de follow-up sem envio automático.',
      messages: [{ role: 'user', content: { type: 'text', text: `Revise o próximo follow-up do lead ${leadId}. Consulte o contexto 360, o próximo retorno e as permissões de contato aplicáveis antes de propor qualquer mensagem. Diferencie rascunho de envio: não envie, agende ou altere nada sem pedido explícito do usuário e sem revalidar as regras do CRM.` } }],
    },
  };

  return { ok: true, prompt: prompts[name] };
};
