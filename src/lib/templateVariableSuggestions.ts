export type TemplateVariableSuggestion = {
  key: string;
  label: string;
  description: string;
};

export const AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS: TemplateVariableSuggestion[] = [
  { key: 'nome', label: 'Nome completo', description: 'Nome completo do lead.' },
  { key: 'primeiro_nome', label: 'Primeiro nome', description: 'Primeiro nome do lead.' },
  { key: 'saudacao', label: 'Saudacao', description: 'Saudacao atual em minusculo, como "bom dia".' },
  {
    key: 'saudacao_titulo',
    label: 'Saudacao em titulo',
    description: 'Saudacao atual capitalizada, como "Bom dia".',
  },
  {
    key: 'saudacao_capitalizada',
    label: 'Saudacao capitalizada',
    description: 'Alias de saudacao capitalizada, como "Bom dia".',
  },
  { key: 'origem', label: 'Origem', description: 'Origem cadastrada do lead.' },
  { key: 'cidade', label: 'Cidade', description: 'Cidade cadastrada do lead.' },
  { key: 'responsavel', label: 'Responsavel', description: 'Responsavel atual pelo lead.' },
];

export const WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS: TemplateVariableSuggestion[] = [
  { key: 'nome', label: 'Nome do lead', description: 'Nome completo do lead atual.' },
  { key: 'primeiro_nome', label: 'Primeiro nome', description: 'Primeiro nome do lead atual.' },
  { key: 'data_hoje', label: 'Data de hoje', description: 'Data atual no fuso de Brasilia.' },
  { key: 'hora_agora', label: 'Hora atual', description: 'Hora atual no fuso de Brasilia.' },
  {
    key: 'data_hora_atual_brasilia',
    label: 'Data e hora de Brasilia',
    description: 'Data e hora atuais no fuso de Brasilia.',
  },
];
