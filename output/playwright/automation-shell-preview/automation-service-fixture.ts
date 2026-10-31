import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  DEFAULT_AUTO_CONTACT_FLOWS,
  normalizeAutoContactSettings,
} from '../../../src/lib/autoContactService';

const settings = normalizeAutoContactSettings(null);
const baseFlow = DEFAULT_AUTO_CONTACT_FLOWS[0]!;
const flowNames = [
  'Abordagem inicial',
  'Proposta sem retorno',
  'Reativação de contatos',
  'Pós-venda e acompanhamento',
  'Lead aguardando cotação',
  'Retorno após simulação',
  'Contato sem resposta',
  'Nova oportunidade',
];
const triggerTypes = [
  'lead_created',
  'status_changed',
  'status_duration',
  'inactivity_duration',
  'status_changed',
  'lead_created',
  'inactivity_duration',
  'status_duration',
] as const;
const flows = flowNames.map((name, index) => ({
  ...baseFlow,
  id: `preview-flow-${index + 1}`,
  name,
  ativo: index % 3 !== 2,
  triggerType: triggerTypes[index]!,
  triggerStatus: ['Contato Inicial', 'Proposta enviada', 'Decisão', 'Atendimento'][index % 4]!,
  steps: baseFlow.steps.map((step, stepIndex) => ({
    ...step,
    id: `preview-flow-${index + 1}-step-${stepIndex + 1}`,
  })),
  tags: [index % 2 === 0 ? 'follow-up' : 'reativação', 'demonstração'],
}));

export const configService = {
  getIntegrationSetting: async (slug: string) => slug === AUTO_CONTACT_INTEGRATION_SLUG
    ? {
      id: 'preview-auto-contact-integration',
      slug,
      name: 'Automação de contatos',
      description: 'Fixture local para revisão visual',
      settings: { ...settings, flows },
      created_at: '2026-10-30T12:00:00.000Z',
      updated_at: '2026-10-30T12:00:00.000Z',
    }
    : null,
  getLeadStatusConfig: async () => [],
  updateIntegrationSetting: async () => ({ data: null, error: new Error('Escritas bloqueadas nesta prévia sintética.') }),
};
