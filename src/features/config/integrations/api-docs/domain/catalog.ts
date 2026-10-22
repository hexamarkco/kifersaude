export type ApiParameter = {
  name: string;
  description: string;
  required?: boolean;
  example?: string;
};

export type ApiEndpoint = {
  id: string;
  title: string;
  group: 'Consultas' | 'Leads' | 'Automações' | 'Rotinas do servidor';
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  action?: string;
  access: 'public' | 'reader' | 'admin' | 'server';
  description: string;
  impact?: string;
  parameters: ApiParameter[];
  fields: ApiParameter[];
  body?: unknown;
  response: unknown;
  notes?: string[];
};

const leadFields: ApiParameter[] = [
  { name: 'nome_completo', description: 'Nome do contato.', required: true },
  { name: 'telefone', description: 'Telefone com DDD, normalizado para dígitos.', required: true },
  { name: 'origem_id ou origem', description: 'ID ou nome de uma origem cadastrada e válida.', required: true },
  { name: 'tipo_contratacao_id ou tipo_contratacao', description: 'ID ou nome de um tipo cadastrado e válido.', required: true },
  { name: 'responsavel_id ou responsavel', description: 'ID ou nome de um responsável cadastrado e válido.', required: true },
  { name: 'status_id ou status', description: 'ID ou nome de status. Na criação, usa o padrão quando omitido.' },
  { name: 'email', description: 'E-mail válido do contato.' },
  { name: 'data_criacao', description: 'Data ISO válida. Na criação, assume a data atual.' },
  { name: 'proximo_retorno', description: 'Data ou instante ISO válido; aceita null para limpar.' },
  { name: 'observacoes', description: 'Anotações comerciais.' },
  { name: 'blackout_dates', description: 'Lista de datas sem envio, no formato AAAA-MM-DD.' },
  { name: 'daily_send_limit', description: 'Limite diário de envios do lead.' },
  { name: 'skip_automation', description: 'true impede a entrada nas automações.' },
];

const leadExample = {
  nome_completo: 'Contato de teste', telefone: '11999999999',
  origem_id: 'PREENCHA_O_ID_DA_ORIGEM',
  tipo_contratacao_id: 'PREENCHA_O_ID_DO_TIPO',
  responsavel_id: 'PREENCHA_O_ID_DO_RESPONSAVEL',
  skip_automation: true,
};

const actionEndpoint = (
  endpoint: Omit<ApiEndpoint, 'method' | 'path' | 'parameters'>,
): ApiEndpoint => ({ ...endpoint, method: 'POST', path: '', parameters: [] });

export const apiEndpoints: ApiEndpoint[] = [
  {
    id: 'health', title: 'Verificar conexão', group: 'Consultas', method: 'GET', path: '/health', access: 'public',
    description: 'Confere se o serviço está respondendo, sem consultar dados de clientes.', parameters: [], fields: [],
    response: { status: 'ok', timestamp: '2026-10-22T12:00:00.000Z', service: 'leads-api' },
  },
  {
    id: 'list-leads', title: 'Consultar leads', group: 'Consultas', method: 'GET', path: '/leads', access: 'reader',
    description: 'Lista leads não arquivados, do mais recente para o mais antigo. Combine os filtros para localizar contatos.',
    parameters: [
      { name: 'limit', description: 'Quantidade máxima de resultados. Padrão: 100.', example: '25' },
      { name: 'status', description: 'Nome do status; também aceita status_id.' },
      { name: 'responsavel', description: 'Nome do responsável; também aceita responsavel_id.' },
      { name: 'origem', description: 'Nome da origem; também aceita origem_id.' },
      { name: 'tipo_contratacao', description: 'Nome do tipo; também aceita tipo_contratacao_id.' },
      { name: 'telefone', description: 'Telefone com DDD, comparado somente por dígitos.' },
      { name: 'email', description: 'E-mail do contato, sem diferenciar maiúsculas.' },
    ], fields: [], response: { success: true, count: 1, data: [{ id: 'UUID_DO_LEAD', nome_completo: 'Contato de exemplo', arquivado: false }] },
    notes: ['Filtros por nome precisam corresponder aos cadastros do CRM. Valores desconhecidos retornam HTTP 400.'],
  },
  {
    id: 'create-lead', title: 'Criar lead', group: 'Leads', method: 'POST', path: '/leads', access: 'admin',
    description: 'Cadastra um contato e resolve origem, tipo, responsável e status pelos cadastros do CRM.',
    impact: 'Cria um registro real. Se skip_automation estiver desativado, pode iniciar mensagens automáticas.',
    parameters: [], fields: leadFields, body: leadExample,
    response: { success: true, message: 'Lead criado com sucesso', data: { id: 'UUID_DO_LEAD' } },
    notes: ['Preencha os IDs com valores do seu ambiente. O exemplo mantém as automações desativadas.', 'Telefone ou e-mail já cadastrados podem levar o contato ao status Duplicado.'],
  },
  {
    id: 'update-lead', title: 'Atualizar lead', group: 'Leads', method: 'PUT', path: '/leads/{id}', access: 'admin',
    description: 'Atualiza somente os campos enviados de um lead existente.', impact: 'Altera o contato real e pode acionar regras de mudança de status.',
    parameters: [], fields: leadFields.map((field) => ({ ...field, required: false })),
    body: { observacoes: 'Anotação de teste', skip_automation: true },
    response: { success: true, message: 'Lead atualizado com sucesso', data: { id: 'UUID_DO_LEAD' } },
  },
  {
    id: 'batch-create', title: 'Criar leads em lote', group: 'Leads', method: 'POST', path: '/leads/batch', access: 'admin',
    description: 'Recebe uma lista de leads. Cada item é validado individualmente; uma falha não impede os demais.',
    impact: 'Cria vários registros reais. Cada contato pode iniciar automações se skip_automation estiver desativado.',
    parameters: [], fields: [{ name: 'leads', description: 'Array de objetos com os mesmos campos da criação individual.', required: true }],
    body: { leads: [leadExample] }, response: { success: [{ index: 0, data: { id: 'UUID_DO_LEAD' } }], failed: [] },
    notes: ['Confira success e failed mesmo quando a resposta HTTP for 200: o lote pode ter falhas parciais.'],
  },
  actionEndpoint({
    id: 'preview-flow-message', action: 'preview-flow-message', title: 'Pré-visualizar mensagem de IA', group: 'Automações', access: 'admin',
    description: 'Gera uma mensagem com um contato fictício para avaliar a instrução do fluxo.',
    impact: 'Consome o provedor de IA configurado. A prévia não envia mensagem ao cliente.',
    fields: [{ name: 'instruction', description: 'Instrução para gerar a mensagem.', required: true }, { name: 'flow_name', description: 'Nome do fluxo na prévia.' }],
    body: { flow_name: 'Prévia de atendimento', instruction: 'Cumprimente o contato e pergunte qual plano procura.' },
    response: { success: true, text: 'Mensagem gerada de exemplo', provider: 'provedor', model: 'modelo' },
  }),
  actionEndpoint({
    id: 'test-flow', action: 'test-flow', title: 'Testar etapa de um fluxo', group: 'Automações', access: 'admin',
    description: 'Envia as mensagens de uma etapa de envio que já está salva em um fluxo.',
    impact: 'Envia mensagens reais de WhatsApp ao número informado e pode consumir IA.',
    fields: [
      { name: 'flow_id', description: 'ID do fluxo salvo.', required: true }, { name: 'step_id', description: 'ID da etapa de mensagem.', required: true },
      { name: 'test_phone', description: 'Número de teste com DDI e DDD.', required: true }, { name: 'test_name', description: 'Nome usado quando não há lead para o telefone.' },
    ], body: { flow_id: 'PREENCHA_O_ID_DO_FLUXO', step_id: 'PREENCHA_O_ID_DA_ETAPA', test_phone: 'PREENCHA_O_NUMERO_DE_TESTE', test_name: 'Contato de teste' },
    response: { success: true, message: 'Mensagens de teste enviadas.', count: 1 },
  }),
  actionEndpoint({
    id: 'manual-automation', action: 'manual-automation', title: 'Enviar mensagens manuais', group: 'Automações', access: 'admin',
    description: 'Envia os textos informados para a conversa indicada, respeitando as permissões de contato.',
    impact: 'Envia mensagens reais de WhatsApp para a conversa informada.',
    fields: [{ name: 'chatId', description: 'Identificador da conversa no WhatsApp.', required: true }, { name: 'messages', description: 'Array de textos não vazios.', required: true }],
    body: { chatId: 'PREENCHA_O_CHAT_ID', messages: ['Mensagem de teste autorizada'] }, response: { success: true },
    notes: ['Requer integração de mensagens configurada. Bloqueios de contato retornam 409; indisponibilidade pode retornar 502 ou 503.'],
  }),
  ...([
    { id: 'auto-contact', title: 'Executar gatilho de contato', description: 'Aciona o motor a partir de um evento de lead.', body: { type: 'INSERT', record: { id: 'UUID_DO_LEAD' }, old_record: null }, fields: [{ name: 'type, record, old_record, is_status_change', description: 'Payload do gatilho de lead.' }] },
    { id: 'process-flow-jobs', title: 'Processar fila de fluxos', description: 'Processa os trabalhos pendentes das automações.', body: {}, fields: [] },
    { id: 'check-status-duration', title: 'Verificar tempo no status', description: 'Reavalia um fluxo de tempo no status.', body: { lead_id: 'UUID_DO_LEAD', flow_id: 'ID_DO_FLUXO' }, fields: [{ name: 'lead_id, flow_id', description: 'Lead e fluxo a reavaliar.' }] },
    { id: 'check-inactivity-duration', title: 'Verificar inatividade', description: 'Reavalia um fluxo de inatividade e a referência da última mensagem.', body: { lead_id: 'UUID_DO_LEAD', flow_id: 'ID_DO_FLUXO', inactivity_started_at: '2026-10-22T12:00:00.000Z', trigger_message_id: 'ID_DA_MENSAGEM' }, fields: [{ name: 'lead_id, flow_id, inactivity_started_at, trigger_message_id', description: 'Contexto da inatividade a reavaliar.' }] },
    { id: 'check-lead-created-backlog', title: 'Reavaliar lead sem abordagem', description: 'Recupera a abordagem de um lead que ficou sem trabalhos de automação.', body: { lead_id: 'UUID_DO_LEAD' }, fields: [{ name: 'lead_id', description: 'ID do lead a reavaliar.', required: true }] },
  ]).map((item) => actionEndpoint({
    ...item, action: item.id, group: 'Rotinas do servidor', access: 'server',
    impact: 'Pode agendar automações e enviar mensagens reais.',
    response: { success: true },
    notes: ['Exige credencial de servidor (service role). Execute somente no servidor; nunca cole essa chave no navegador.', 'O retorno pode indicar skipped e reason quando a rotina não tiver trabalho a executar.'],
  })),
];

export const endpointAccessLabels = {
  public: 'Sem sessão de usuário', reader: 'Administrador ou observador', admin: 'Administrador', server: 'Somente servidor',
};

export function endpointPath(endpoint: ApiEndpoint): string {
  return endpoint.action ? `?action=${endpoint.action}` : endpoint.path;
}
