import { getMessageContent, type MessageRow } from './comm-whatsapp-transcript.ts';

export type ArrivalOrderedMessage = MessageRow & { created_at?: string };

/**
 * A provider timestamp may only have second precision. Use the local
 * persistence time for the AI turn order, not WhatsApp's message_at.
 */
export const orderAutonomousConversationalMessages = <T extends ArrivalOrderedMessage>(messages: readonly T[]): T[] => (
  [...messages].filter((message) => Boolean(getMessageContent(message)))
    .sort((a, b) => {
      const left = a.created_at ?? a.message_at;
      const right = b.created_at ?? b.message_at;
      return left.localeCompare(right) || a.id.localeCompare(b.id);
    })
);

export const getLatestAutonomousInboundMessageId = (messages: readonly ArrivalOrderedMessage[]): string | null => (
  orderAutonomousConversationalMessages(messages).reverse()
    .find((message) => message.direction === 'inbound')?.id ?? null
);

/**
 * A resposta autonoma so pode ser enviada se a ultima mensagem recebida
 * continua sendo exatamente a que embasou o prompt. Uma nova mensagem durante
 * a geracao torna a resposta obsoleta: o proximo job vai montar o contexto
 * com o turno completo do cliente.
 */
export const isAutonomousReplyStale = (
  promptInboundMessageId: string,
  latestInboundMessageId: string | null,
) => latestInboundMessageId !== promptInboundMessageId;
