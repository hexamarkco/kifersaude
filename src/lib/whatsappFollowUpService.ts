import type { WhatsAppFollowUpFlow, WhatsAppFollowUpSettings, WhatsAppFollowUpStep } from '../types/whatsappFollowUp';

export const WHATSAPP_FOLLOWUP_INTEGRATION_SLUG = 'whatsapp_followup_flows';

const toSafeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const toSafeNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const normalizeStep = (rawStep: unknown, index: number): WhatsAppFollowUpStep => {
  const step = asRecord(rawStep);
  const delayMinutesRaw = toSafeNumber(step.delayMinutes ?? (step.delayHours as number) * 60, 0);

  return {
    id: toSafeString(step.id) || `step-${index}`,
    message: toSafeString(step.message),
    delayMinutes: Math.max(0, Math.round(delayMinutesRaw)),
    active: step.active !== false,
  };
};

const normalizeFlow = (rawFlow: unknown, index: number): WhatsAppFollowUpFlow => {
  const flow = asRecord(rawFlow);
  const monitoredStatuses = Array.isArray(flow.monitoredStatuses)
    ? Array.from(new Set(flow.monitoredStatuses.map((status: unknown) => toSafeString(status)).filter(Boolean)))
    : [];

  const stopStatuses = Array.isArray(flow.stopStatuses)
    ? Array.from(new Set(flow.stopStatuses.map((status: unknown) => toSafeString(status)).filter(Boolean)))
    : [];

  const steps = Array.isArray(flow.steps)
    ? flow.steps.map((step: unknown, stepIndex: number) => normalizeStep(step, stepIndex)).sort((a, b) => a.delayMinutes - b.delayMinutes)
    : [];

  return {
    id: toSafeString(flow.id) || `flow-${index}`,
    name: toSafeString(flow.name) || `Fluxo ${index + 1}`,
    monitoredStatuses,
    stopStatuses,
    stopOnAnyStatusChange: flow.stopOnAnyStatusChange !== false,
    maxMessages: Math.max(1, Math.min(50, Math.round(toSafeNumber(flow.maxMessages, 5)))),
    active: flow.active !== false,
    steps,
  };
};

export const getDefaultFollowUpSettings = (): WhatsAppFollowUpSettings => ({
  enabled: true,
  defaultStopStatuses: ['Em atendimento', 'Contrato enviado'],
  flows: [
    {
      id: 'followup-contato-inicial',
      name: 'Reabordagem - Contato inicial',
      monitoredStatuses: ['Contato Inicial'],
      stopStatuses: ['Em atendimento'],
      stopOnAnyStatusChange: true,
      maxMessages: 5,
      active: true,
      steps: [
        {
          id: 'contato-step-1',
          message: 'Oi {{primeiro_nome}}, tudo bem? Vi seu interesse e queria te ajudar com a cotação 👍',
          delayMinutes: 180,
          active: true,
        },
        {
          id: 'contato-step-2',
          message: 'Passando para confirmar se recebeu minha mensagem. Consigo te mandar opções ainda hoje!',
          delayMinutes: 1440,
          active: true,
        },
        {
          id: 'contato-step-3',
          message: 'Só checando se faz sentido seguirmos. Prefere falar por aqui ou uma rápida ligação?',
          delayMinutes: 4320,
          active: true,
        },
        {
          id: 'contato-step-4',
          message: 'Tenho condições atualizadas e posso te mandar valores resumidos. Posso seguir?',
          delayMinutes: 7200,
          active: true,
        },
        {
          id: 'contato-step-5',
          message: 'Último toque para não perder seu contato. Se quiser continuar, é só me sinalizar 🙏',
          delayMinutes: 10080,
          active: true,
        },
      ],
    },
    {
      id: 'followup-em-atendimento',
      name: 'Acompanhamento - Em atendimento',
      monitoredStatuses: ['Em atendimento'],
      stopStatuses: ['Contrato enviado', 'Fechado'],
      stopOnAnyStatusChange: true,
      maxMessages: 4,
      active: true,
      steps: [
        {
          id: 'atendimento-step-1',
          message: 'Conforme conversamos, enviei as opções no e-mail. Quer que envie um resumo aqui no Whats?',
          delayMinutes: 1440,
          active: true,
        },
        {
          id: 'atendimento-step-2',
          message: 'Conseguiu analisar as opções? Posso ajustar valores ou condições se precisar.',
          delayMinutes: 4320,
          active: true,
        },
        {
          id: 'atendimento-step-3',
          message: 'Alguma dúvida sobre a proposta? Estou por aqui para ajudar no que precisar.',
          delayMinutes: 7200,
          active: true,
        },
        {
          id: 'atendimento-step-4',
          message: 'Sigo acompanhando você. Caso queira avançar, consigo agilizar toda a papelada.',
          delayMinutes: 10080,
          active: true,
        },
      ],
    },
  ],
});

export const normalizeWhatsAppFollowUpSettings = (
  rawSettings: Record<string, unknown> | null | undefined,
): WhatsAppFollowUpSettings => {
  const fallback = getDefaultFollowUpSettings();
  const settings = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};

  const enabled = settings.enabled !== false;
  const defaultStopStatuses = Array.isArray(settings.defaultStopStatuses)
    ? Array.from(new Set(settings.defaultStopStatuses.map((status: unknown) => toSafeString(status)).filter(Boolean)))
    : fallback.defaultStopStatuses;

  const flows = Array.isArray(settings.flows)
    ? settings.flows.map((flow: unknown, index: number) => normalizeFlow(flow, index))
    : fallback.flows;

  return {
    enabled,
    defaultStopStatuses: defaultStopStatuses.length ? defaultStopStatuses : fallback.defaultStopStatuses,
    flows: flows.length ? flows : fallback.flows,
  };
};

export const sanitizeFollowUpSettings = (settings: WhatsAppFollowUpSettings): WhatsAppFollowUpSettings =>
  normalizeWhatsAppFollowUpSettings(settings);
