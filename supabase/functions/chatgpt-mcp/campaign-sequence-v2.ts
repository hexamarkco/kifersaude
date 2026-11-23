/**
 * Contrato de variações do Disparos, espelhando o modelo de mensagens
 * independentes do editor (A..Z). Só prepara payload, nunca dispara.
 */
type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const trim = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const DELAY_UNITS = new Set(['seconds', 'minutes', 'hours', 'days']);

export type McpNormalizedCampaignStages =
  | { ok: true; steps: JsonRecord[]; firstMessage: string; variants: string[] }
  | { ok: false; error: string };

export const normalizeMcpCampaignStages = (value: unknown): McpNormalizedCampaignStages => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) {
    return { ok: false, error: 'stages deve conter de 1 a 30 etapas.' };
  }
  const steps: JsonRecord[] = [];
  let position = 0;
  let variants: string[] = [];
  let firstMessage = '';
  for (let stageIndex = 0; stageIndex < value.length; stageIndex += 1) {
    const stage = value[stageIndex];
    if (!isRecord(stage) || !isRecord(stage.variations)) {
      return { ok: false, error: 'Cada etapa precisa de variations contendo listas A, B, C...' };
    }
    const labels = Object.keys(stage.variations).sort();
    if (!labels.includes('A') || !labels.includes('B') || labels.length > 26
      || labels.some((label, index) => label !== String.fromCharCode(65 + index))) {
      return { ok: false, error: 'As cópias precisam ser letras contíguas começando por A e B.' };
    }
    if (stageIndex === 0) variants = labels;
    if (labels.join(',') !== variants.join(',')) {
      return { ok: false, error: 'Todas as etapas precisam declarar as mesmas variações.' };
    }
    const amount = stage.delay_amount ?? 0;
    const unit = stage.delay_unit ?? 'minutes';
    if (!Number.isInteger(amount) || Number(amount) < 0 || Number(amount) > 31622400 || !DELAY_UNITS.has(String(unit))) {
      return { ok: false, error: 'Atraso ou unidade de tempo inválidos.' };
    }
    const normalized = new Map<string, JsonRecord[]>();
    for (const label of labels) {
      const items = stage.variations[label];
      if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
        return { ok: false, error: 'Cada copy deve ter entre 1 e 30 mensagens na etapa.' };
      }
      const messages: JsonRecord[] = [];
      for (const item of items) {
        const entry = typeof item === 'string' ? { message: item } : item;
        if (!isRecord(entry)) return { ok: false, error: 'Mensagem da copy inválida.' };
        if (Object.keys(entry).some((key) => !['message', 'media_storage_path'].includes(key))) {
          return { ok: false, error: 'Mensagem contém campos não permitidos.' };
        }
        const mediaPath = entry.media_storage_path;
        if (mediaPath !== undefined && mediaPath !== null
          && (typeof mediaPath !== 'string' || !mediaPath || mediaPath.length > 512)) {
          return { ok: false, error: 'Caminho de mídia inválido.' };
        }
        const rawMessage = trim(entry.message);
        const parts = stage.split_by_line_breaks !== false && !mediaPath
          ? rawMessage.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
          : [rawMessage];
        if (!parts.length || parts.some((part) => !part || part.length > 4096)) {
          return { ok: false, error: 'Cada balão precisa ter texto válido de até 4096 caracteres.' };
        }
        for (const message of parts) {
          messages.push({ message, ...(mediaPath !== undefined ? { media_storage_path: mediaPath } : {}) });
        }
      }
      if (messages.length > 30) return { ok: false, error: 'Máximo de 30 balões por variação e etapa.' };
      normalized.set(label, messages);
    }
    const maxMessages = Math.max(...labels.map((label) => normalized.get(label)?.length ?? 0));
    if (position + maxMessages > 30) {
      return { ok: false, error: 'A sequência inteira não pode exceder 30 posições de envio.' };
    }
    for (let messageIndex = 0; messageIndex < maxMessages; messageIndex += 1) {
      for (const label of labels) {
        const item = normalized.get(label)?.[messageIndex];
        if (!item) continue;
        const message = trim(item.message);
        if (!firstMessage && label === 'A') firstMessage = message;
        steps.push({
          step_index: position,
          stage_index: stageIndex,
          step_kind: 'message',
          variant_label: label,
          message,
          delay_amount: stageIndex === 0 || messageIndex !== 0 ? 0 : Number(amount),
          delay_unit: unit,
          ...(item.media_storage_path !== undefined ? { media_storage_path: item.media_storage_path } : {}),
        });
      }
      position += 1;
    }
    if (steps.length > 240) return { ok: false, error: 'Máximo de 240 balões físicos por campanha.' };
  }
  return { ok: true, steps, firstMessage, variants };
};

export const campaignCopyLabels = (steps: JsonRecord[]): string[] => {
  const labels = [...new Set(steps.map((row) => trim(row.variant_label)).filter((label) => /^[A-Z]$/.test(label)))].sort();
  return labels.length ? labels : ['A'];
};

/** Uma posição gera no máximo uma mensagem para a copy selecionada. */
export const resolveCampaignCopySteps = (steps: JsonRecord[], variant: string, independent: boolean): JsonRecord[] => {
  const byIndex = new Map<number, JsonRecord>();
  for (const row of steps) {
    const index = Number(row.step_index) || 0;
    const label = trim(row.variant_label) || 'ANY';
    if (label === 'ANY' && !byIndex.has(index)) byIndex.set(index, row);
    else if (label === variant) byIndex.set(index, row);
    else if (!independent && label === 'A' && !byIndex.has(index)) byIndex.set(index, row);
  }
  return [...byIndex.values()].sort((a, b) => Number(a.step_index) - Number(b.step_index));
};
