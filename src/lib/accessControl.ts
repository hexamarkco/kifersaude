export type AccessModuleDefinition = {
  id: string;
  label: string;
  description: string;
  group: 'workspace' | 'config';
};

export const ACCESS_MODULES: AccessModuleDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Resumo geral das operações e indicadores-chave.', group: 'workspace' },
  { id: 'leads', label: 'Leads', description: 'Gestão completa do funil de leads.', group: 'workspace' },
  { id: 'cotador', label: 'Cotador', description: 'Workspace interno para montar e comparar cotacoes por perfil.', group: 'workspace' },
  { id: 'contracts', label: 'Contratos', description: 'Gestão de contratos, titulares e dependentes.', group: 'workspace' },
  { id: 'reminders', label: 'Lembretes', description: 'Agenda e lembretes automáticos para acompanhamento.', group: 'workspace' },
  { id: 'financeiro-agenda', label: 'Financeiro - Tarefas', description: 'Acesso às tarefas do módulo financeiro.', group: 'workspace' },
  { id: 'financeiro-comissoes', label: 'Financeiro - Comissões', description: 'Acesso ao acompanhamento de comissões.', group: 'workspace' },
  { id: 'whatsapp-inbox', label: 'Comunicação - WhatsApp Inbox', description: 'Acesso ao inbox compartilhado do WhatsApp via Whapi.', group: 'workspace' },
  { id: 'blog', label: 'Blog', description: 'Gestão de conteúdo do blog e SEO.', group: 'workspace' },
  { id: 'config-system', label: 'Configurações - Sistema', description: 'Preferências do sistema, operadoras, leads e contratos.', group: 'config' },
  { id: 'config-access', label: 'Configurações - Perfis e Acessos', description: 'Criação de perfis e definição detalhada de acessos.', group: 'config' },
  { id: 'config-users', label: 'Configurações - Usuários', description: 'Criação, edição e exclusão de usuários do sistema.', group: 'config' },
  { id: 'config-automation', label: 'Configurações - Automações', description: 'Gestão dos fluxos de automação do sistema.', group: 'config' },
  { id: 'config-integrations', label: 'Configurações - Integrações', description: 'Parâmetros e credenciais de integrações.', group: 'config' },
];

export const CONFIG_MODULE_IDS = ACCESS_MODULES.filter((module) => module.group === 'config').map((module) => module.id);

const MODULE_ALIASES: Record<string, string[]> = {
  agenda: ['reminders', 'financeiro-agenda'],
  config: CONFIG_MODULE_IDS,
  'config-system': ['config'],
  'config-access': ['config'],
  'config-users': ['config'],
  'config-automation': ['config'],
  'config-integrations': ['config'],
};

export const getModuleLookupOrder = (moduleId: string): string[] => {
  const aliases = MODULE_ALIASES[moduleId] ?? [];
  return [moduleId, ...aliases];
};

export const buildProfileSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

export const formatProfileLabel = (slug: string, name?: string | null) => {
  if (name && name.trim()) {
    return name.trim();
  }

  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};
