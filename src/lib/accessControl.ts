export type AccessModuleDefinition = {
  id: string;
  label: string;
  description: string;
  group: 'workspace' | 'config';
};

export const ACCESS_MODULES: AccessModuleDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Resumo geral das operacoes e indicadores-chave.', group: 'workspace' },
  { id: 'leads', label: 'Leads', description: 'Gestao completa do funil de leads.', group: 'workspace' },
  { id: 'contracts', label: 'Contratos', description: 'Gestao de contratos, titulares e dependentes.', group: 'workspace' },
  { id: 'reminders', label: 'Lembretes', description: 'Agenda e lembretes automaticos para acompanhamento.', group: 'workspace' },
  { id: 'financeiro-agenda', label: 'Financeiro - Tarefas', description: 'Acesso as tarefas do modulo financeiro.', group: 'workspace' },
  { id: 'financeiro-comissoes', label: 'Financeiro - Comissoes', description: 'Acesso ao acompanhamento de comissoes.', group: 'workspace' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Gestao de conversas e mensagens do WhatsApp.', group: 'workspace' },
  { id: 'blog', label: 'Blog', description: 'Gestao de conteudo do blog e SEO.', group: 'workspace' },
  { id: 'config-system', label: 'Configuracoes - Sistema', description: 'Preferencias do sistema, operadoras, leads e contratos.', group: 'config' },
  { id: 'config-access', label: 'Configuracoes - Perfis e Acessos', description: 'Criacao de perfis e definicao detalhada de acessos.', group: 'config' },
  { id: 'config-users', label: 'Configuracoes - Usuarios', description: 'Criacao, edicao e exclusao de usuarios do sistema.', group: 'config' },
  { id: 'config-automation', label: 'Configuracoes - Automacoes', description: 'Gestao dos fluxos de automacao do sistema.', group: 'config' },
  { id: 'config-integrations', label: 'Configuracoes - Integracoes', description: 'Parametros e credenciais de integracoes.', group: 'config' },
];

export const CONFIG_MODULE_IDS = ACCESS_MODULES.filter((module) => module.group === 'config').map((module) => module.id);

const MODULE_ALIASES: Record<string, string[]> = {
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
