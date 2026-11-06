import { hasIncompleteMessageVariations, type FlowMessageVariation } from './message-variations.ts';

type MessageItem = FlowMessageVariation['messages'][number];
export type MessageVariationSelection = { id: string; messages: MessageItem[] };

// The job UUID distributes versions across executions; retries keep the saved snapshot.
export async function resolveMessageVariation({
  primaryMessages, variations, storedSelection, seed, persist, preservePrimary = false,
}: {
  primaryMessages: MessageItem[];
  variations: unknown;
  storedSelection?: unknown;
  seed: string;
  persist?: (selection: MessageVariationSelection) => Promise<void>;
  preservePrimary?: boolean;
}): Promise<MessageItem[]> {
  if (storedSelection != null) {
    if (!storedSelection || typeof storedSelection !== 'object' ||
        !Array.isArray((storedSelection as MessageVariationSelection).messages) ||
        !(storedSelection as MessageVariationSelection).messages.length) {
      throw new Error('A variação salva está incompleta. Revise a etapa antes de tentar novamente.');
    }
    return (storedSelection as MessageVariationSelection).messages;
  }
  if (!Array.isArray(variations) || !variations.length) return primaryMessages;
  const versions = [{ id: 'primary', messages: primaryMessages }, ...variations as FlowMessageVariation[]];
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const selection = versions[preservePrimary ? 0 : hash % versions.length];
  // Validate the chosen packet before caching it or generating/sending any message.
  const templates = selection.messages.flatMap((item) => 'templateId' in item ? [{ id: item.templateId }] : []);
  if (hasIncompleteMessageVariations([selection], templates)) {
    throw new Error('A variação escolhida contém mensagens incompletas. Preencha a etapa antes do envio.');
  }
  if (persist) await persist(selection);
  return selection.messages;
}
