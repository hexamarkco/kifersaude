export type WhatsappMessageVariable = {
  token: string;
  description: string;
};

export const WHATSAPP_MESSAGE_VARIABLES: WhatsappMessageVariable[] = [
  {
    token: '{{saudacao}}',
    description: 'Saudação automática de acordo com o horário (bom dia/boa tarde/boa noite).',
  },
  {
    token: '{{greeting}}',
    description: 'Alias de {{saudacao}}.',
  },
  { token: '{{nome}}', description: 'Nome completo do lead.' },
  { token: '{{lead_nome}}', description: 'Alias de {{nome}}.' },
  { token: '{{primeiro_nome}}', description: 'Primeiro nome do lead.' },
  { token: '{{lead_primeiro_nome}}', description: 'Alias de {{primeiro_nome}}.' },
  { token: '{{telefone}}', description: 'Telefone do lead.' },
  { token: '{{lead_status}}', description: 'Status atual do lead.' },
  { token: '{{lead_origem}}', description: 'Origem do lead.' },
  { token: '{{lead_tipo_contratacao}}', description: 'Tipo de contratação do lead.' },
  { token: '{{lead_responsavel}}', description: 'Responsável pelo lead.' },
  { token: '{{lead_data_cadastro}}', description: 'Data de cadastro do lead.' },
  { token: '{{campanha_nome}}', description: 'Nome da campanha atual.' },
  { token: '{{data_envio}}', description: 'Data em que a mensagem é enviada.' },
  { token: '{{hora_envio}}', description: 'Hora em que a mensagem é enviada.' },
  { token: '{{contrato_codigo}}', description: 'Código do contrato do lead.' },
  { token: '{{contrato_status}}', description: 'Status do contrato do lead.' },
  { token: '{{contrato_modalidade}}', description: 'Modalidade do contrato do lead.' },
  { token: '{{contrato_operadora}}', description: 'Operadora do contrato do lead.' },
  { token: '{{contrato_plano}}', description: 'Plano/produto do contrato do lead.' },
  { token: '{{contrato_mensalidade}}', description: 'Mensalidade formatada do contrato do lead.' },
  { token: '{{contrato_criado_em}}', description: 'Data de criação do contrato do lead.' },
  {
    token: '{{meta_<campo>}}',
    description: 'Metadados enviados com o lead (ex.: {{meta_cor}}, {{meta_uf}}). Útil para campos personalizados.',
  },
];

export const WHATSAPP_MESSAGE_VARIABLE_HINTS = WHATSAPP_MESSAGE_VARIABLES.slice(0, 8).map(
  variable => variable.token,
);
