type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document';
type MessageItem =
  | { templateId: string }
  | { custom: { type: MessageType; text?: string; mediaUrl?: string; caption?: string; filename?: string } }
  | { ai: { instruction: string } };

export type FlowMessageVariation = { id: string; messages: MessageItem[] };

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown) => typeof value === 'string' ? value : '';

export function normalizeFlowMessageVariations(
  value: unknown,
  templates: { id: string }[],
  fallbackTemplateId: string,
): FlowMessageVariation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = new Set<string>();
  return value.flatMap((entry, index) => {
    const variation = record(entry);
    if (!variation) return [];
    let id = text(variation.id).trim() || `variation-${index + 1}`;
    while (ids.has(id) || id === 'primary') id += '-copy';
    ids.add(id);
    const messages: MessageItem[] = [];
    for (const raw of Array.isArray(variation.messages) ? variation.messages : []) {
      const item = record(raw);
      if (!item) continue;
      if (text(item.templateId).trim()) {
        messages.push({ templateId: templates.some((template) => template.id === item.templateId)
          ? text(item.templateId) : fallbackTemplateId });
      } else if (record(item.custom)) {
        const custom = record(item.custom)!;
        const type = ['text', 'image', 'video', 'audio', 'document'].includes(text(custom.type))
          ? custom.type as MessageType : 'text';
        messages.push({ custom: { type, text: text(custom.text), mediaUrl: text(custom.mediaUrl),
          caption: text(custom.caption), filename: text(custom.filename) } });
      } else if (record(item.ai)) {
        messages.push({ ai: { instruction: text(record(item.ai)!.instruction) } });
      }
    }
    return [{ id, messages }];
  });
}

export function hasIncompleteMessageVariations(
  variations: FlowMessageVariation[] | undefined,
  templates: { id: string }[],
): boolean {
  return (variations ?? []).some(({ messages }) => !messages.length || messages.some((item) => {
    if ('templateId' in item) return !templates.some((template) => template.id === item.templateId);
    if ('ai' in item) return !item.ai.instruction.trim();
    return item.custom.type === 'text' ? !item.custom.text?.trim() : !item.custom.mediaUrl?.trim();
  }));
}
