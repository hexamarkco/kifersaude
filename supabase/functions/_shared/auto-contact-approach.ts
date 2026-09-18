type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null
);

const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const getFirstName = (leadName: string): string => leadName.trim().split(/\s+/)[0] ?? '';

const renderApproachText = (value: string, leadName: string): string => {
  const firstName = getFirstName(leadName);
  return value
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, firstName)
    .replace(/\{\{\s*nome\s*\}\}/gi, leadName.trim())
    .trim();
};

const readTextMessage = (value: unknown, leadName: string): string => {
  const record = asRecord(value);
  if (!record) return renderApproachText(asString(value), leadName);

  const type = asString(record.type).toLowerCase();
  const text = asString(record.text);
  const caption = asString(record.caption);
  if (type === 'text' || text) return renderApproachText(text, leadName);
  return renderApproachText(caption, leadName);
};

const readTemplateText = (template: JsonRecord | null, leadName: string): string => {
  if (!template) return '';

  const messages = Array.isArray(template.messages) ? template.messages : [];
  if (messages.length > 0) {
    return messages
      .map((message) => readTextMessage(message, leadName))
      .filter(Boolean)
      .join('\n\n');
  }

  return renderApproachText(asString(template.message), leadName);
};

const buildTemplateMap = (rawSettings: JsonRecord): Map<string, JsonRecord> => {
  const templates = Array.isArray(rawSettings.messageTemplates) ? rawSettings.messageTemplates : [];
  return new Map(
    templates
      .map(asRecord)
      .filter((template): template is JsonRecord => Boolean(template))
      .map((template, index) => [
        asString(template.id) || `template-${index}`,
        template,
      ]),
  );
};

const readStepMessages = (
  step: JsonRecord,
  templates: Map<string, JsonRecord>,
  leadName: string,
): string[] => {
  const rawItems = Array.isArray(step.messages) ? step.messages : [];
  if (rawItems.length > 0) {
    return rawItems
      .map(asRecord)
      .filter((item): item is JsonRecord => Boolean(item))
      .flatMap((item) => {
        const templateId = asString(item.templateId);
        if (templateId) {
          const text = readTemplateText(templates.get(templateId) ?? null, leadName);
          return text ? [text] : [];
        }

        const custom = asRecord(item.custom);
        const customText = readTextMessage(custom, leadName);
        return customText ? [customText] : [];
      });
  }

  const templateId = asString(step.templateId);
  if (templateId) {
    const text = readTemplateText(templates.get(templateId) ?? null, leadName);
    if (text) return [text];
  }

  const customText = readTextMessage(step.customMessage, leadName);
  return customText ? [customText] : [];
};

const readApproachFromConfiguredFlow = (rawSettings: JsonRecord, leadName: string): string[] => {
  const templates = buildTemplateMap(rawSettings);
  const flows = Array.isArray(rawSettings.flows) ? rawSettings.flows : [];
  const normalizedFlows = flows
    .map(asRecord)
    .filter((flow): flow is JsonRecord => Boolean(flow) && flow.ativo !== false)
    .sort((left, right) => {
      const leftPriority = asString(left.triggerType) === 'lead_created' ? 0 : 1;
      const rightPriority = asString(right.triggerType) === 'lead_created' ? 0 : 1;
      return leftPriority - rightPriority;
    });

  for (const flow of normalizedFlows) {
    const steps = Array.isArray(flow.steps) ? flow.steps : [];
    for (const rawStep of steps) {
      const step = asRecord(rawStep);
      if (!step || asString(step.actionType) !== 'send_message') continue;

      const messages = readStepMessages(step, templates, leadName);
      if (messages.length > 0) return messages;
    }
  }

  return [];
};

export const buildSandboxApproachMessages = (rawSettings: unknown, leadName: string): string[] => {
  const settings = asRecord(rawSettings);
  const configuredMessages = settings ? readApproachFromConfiguredFlow(settings, leadName) : [];
  if (configuredMessages.length > 0) return configuredMessages;

  const fallback = renderApproachText(
    'Oi {{primeiro_nome}}, tudo bem? Sou a Luiza Kifer, especialista em planos de saúde, e vi que você demonstrou interesse em receber uma cotação.',
    leadName,
  );
  return fallback ? [fallback] : [];
};
